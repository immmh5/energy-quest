import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EnergyState, TrialData, QuizQuestion } from '../../types';
import {
  GRAVITY_G,
  BASKETBALL_RESTITUTION,
  calculateKE,
  calculatePEgrav,
  calculatePEelastic,
  calculateGravityWork,
  calculateBounceHeight,
} from '../../physics/formulas';
import {
  createStandardRenderer,
  setupStudioLighting,
  createAtmosphericSkyDome,
  createContactShadow,
  createBasketballTexture,
  createCourtTexture,
  scheduleNextFrame,
  isSoftwareGl,
} from '../common';
import { EnergyHUD } from '../../components/EnergyHUD';
import { BounceGraphModal } from '../../components/BounceGraphModal';
import { QuizModal } from '../../components/QuizModal';
import { sound } from '../../audio/synth';
import {
  Play,
  RotateCcw,
  Home,
  TrendingUp,
  Target,
  Sparkles,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import { ExplorerController } from '../ExplorerController';
import { ExplorerControlBar } from '../../components/ExplorerControlBar';

interface Level1BounceLabProps {
  onCompleteLevel: (stars: number, score: number) => void;
  onReturnHub: () => void;
}

const BALL_MASS_KG = 0.624; // Standard NBA basketball
const BALL_RADIUS_M = 0.35; // Visually clear scaled radius

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'لماذا لا تعود الكرة أبداً إلى نفس الارتفاع الذي سقطت منه عند إفلاتها من السكون؟',
    options: [
      'بسبب تحول جزء من الطاقة الميكانيكية إلى طاقة حرارية وصوتية أثناء التصادم غير المرن.',
      'لأن الجاذبية الأرضية تصبح أقوى أثناء صعود الكرة للأعلى.',
      'بسبب زيادة كتلة الكرة أثناء حركتها في الهواء.',
      'لأن الشغل المبذول بواسطة الجاذبية الأرضية يختفي تماماً.',
    ],
    correctIndex: 0,
    explanation:
      'تصادم الكرة مع الأرض غير مرن تماماً (Inelastic)؛ ينضغط جسم الكرة وتتحول نسبة من طاقتها الميكانيكية (حوالي 44%) إلى طاقة حرارية داخل جزيئات المطاط وطاقة صوتية (صوت الارتطام).',
  },
  {
    id: 2,
    question: 'عند سقوط الكرة نحو الأرض من ارتفاع h، ما إشارة الشغل الذي تبذله قوة الجاذبية الأرضية؟',
    options: [
      'سالب لأن طاقة الوضع تنقص.',
      'موجب لأن اتجاه قوة الجاذبية في نفس اتجاه إزاحة الكرة للأسفل.',
      'صفر لأن الجاذبية قوة عمودية لا تبذل شغلاً.',
      'موجب في النصف الأول وسالب في النصف الثاني.',
    ],
    correctIndex: 1,
    explanation:
      'قوة الجاذبية تؤثر لأسفل (F = m·g) وإزاحة السقوط لأسفل (d = Δh)، والزاوية بينهما θ = 0°؛ لذا الشغل W = F · d · cos(0) = موجب، وهو ما يزيد من الطاقة الحركية للكرة.',
  },
  {
    id: 3,
    question: 'إذا اخترنا مستوى الإسناد عند حافة سلة السلة (ارتفاع 3.05 م)، فما قيمة طاقة وضع الكرة عندما تكون على سطح الأرض؟',
    options: [
      'موجبة وتساوي طاقة الحركة.',
      'سالبة لأن ارتفاع الكرة يقع أسفل مستوى الإسناد (h - h₀ < 0).',
      'تساوي صفراً دائماً على الأرض.',
      'لا يمكن لطاقة الوضع أن تكون سالبة في أي نظام.',
    ],
    correctIndex: 1,
    explanation:
      'طاقة الوضع تعتمد على المرجع المختار: PE = m·g·(h - h₀). بما أن سطح الأرض (h = 0) يقع تحت السلة (h₀ = 3.05)، فإن (0 - 3.05) سالبة، وتكون طاقة الوضع سالبة، بينما فروق الطاقة ΔPE هي التي تظل ثابتة فيزيائياً.',
  },
];

export const Level1BounceLab: React.FC<Level1BounceLabProps> = ({
  onCompleteLevel,
  onReturnHub,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Simulation controls state
  const [dropHeight, setDropHeight] = useState<number>(4.0);
  const [refHeight, setRefHeight] = useState<number>(0.0);
  const [timeScale, setTimeScale] = useState<number>(1.0); // 1x, 0.5x, 0.25x
  const [simState, setSimState] = useState<'ready' | 'falling' | 'rebounding' | 'settled'>('ready');

  // Experimental trials
  const [trials, setTrials] = useState<TrialData[]>([]);
  const [showGraphModal, setShowGraphModal] = useState<boolean>(false);
  const [predictionMode, setPredictionMode] = useState<boolean>(false);
  const [userPrediction, setUserPrediction] = useState<number>(5.5);
  const [predictionResult, setPredictionResult] = useState<{ actual: number; predicted: number; diff: number } | null>(null);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [labIntroSeen, setLabIntroSeen] = useState<boolean>(false);

  // Live Energy State for HUD
  const [energy, setEnergy] = useState<EnergyState>({
    ke: 0,
    peGrav: calculatePEgrav(BALL_MASS_KG, 4.0, 0.0),
    peElastic: 0,
    workDone: 0,
    totalEnergy: calculatePEgrav(BALL_MASS_KG, 4.0, 0.0),
    refHeight: 0.0,
    mass: BALL_MASS_KG,
    velocity: 0,
    height: 4.0,
  });

  // Explorer Avatar & 1D Mode States
  const [isExplorerMode, setIsExplorerMode] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const explorerRef = useRef<ExplorerController | null>(null);

  // Mutable refs for Three.js animation loop
  const simDataRef = useRef({
    state: 'ready' as 'ready' | 'falling' | 'rebounding' | 'settled',
    y: 4.0,
    vy: 0,
    hInitial: 4.0,
    hBouncePeak: 0,
    refHeight: 0.0,
    timeScale: 1.0,
    peakRecorded: false,
    squashFactor: 1.0,
  });

  // Reference lines in 3D scene
  const refLineMeshRef = useRef<THREE.Line | null>(null);
  const ballMeshRef = useRef<THREE.Group | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);

  // Sync state to mutable ref
  useEffect(() => {
    simDataRef.current.refHeight = refHeight;
  }, [refHeight]);

  useEffect(() => {
    simDataRef.current.timeScale = timeScale;
  }, [timeScale]);

  // Handle drop height change when in ready state
  const handleSetDropHeight = (h: number) => {
    if (simState !== 'ready') return;
    setDropHeight(h);
    simDataRef.current.y = h;
    simDataRef.current.hInitial = h;
    simDataRef.current.vy = 0;
    if (ballMeshRef.current) {
      ballMeshRef.current.position.y = h + BALL_RADIUS_M;
    }
    const pe = calculatePEgrav(BALL_MASS_KG, h, refHeight);
    setEnergy({
      ke: 0,
      peGrav: pe,
      peElastic: 0,
      workDone: 0,
      totalEnergy: pe,
      refHeight: refHeight,
      mass: BALL_MASS_KG,
      velocity: 0,
      height: h,
    });
  };

  // Trigger Drop
  const handleDropBall = () => {
    if (simState !== 'ready') return;
    sound.playRelease();
    simDataRef.current.state = 'falling';
    simDataRef.current.vy = 0;
    simDataRef.current.hInitial = dropHeight;
    simDataRef.current.peakRecorded = false;
    simDataRef.current.hBouncePeak = 0;
    setSimState('falling');
  };

  // Reset Ball
  const handleReset = () => {
    sound.playClick();
    simDataRef.current.state = 'ready';
    simDataRef.current.y = dropHeight;
    simDataRef.current.vy = 0;
    simDataRef.current.squashFactor = 1.0;
    simDataRef.current.peakRecorded = false;
    setSimState('ready');
    if (ballMeshRef.current) {
      ballMeshRef.current.position.y = dropHeight + BALL_RADIUS_M;
      ballMeshRef.current.scale.set(1, 1, 1);
    }
    const pe = calculatePEgrav(BALL_MASS_KG, dropHeight, refHeight);
    setEnergy({
      ke: 0,
      peGrav: pe,
      peElastic: 0,
      workDone: 0,
      totalEnergy: pe,
      refHeight: refHeight,
      mass: BALL_MASS_KG,
      velocity: 0,
      height: dropHeight,
    });
  };

  // 3D Scene Initialization
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5, 12);

    const renderer = createStandardRenderer(container);
    setupStudioLighting(scene, renderer, 0x0a0f1d);

    // Atmospheric sky dome
    const skyDome = createAtmosphericSkyDome(90);
    scene.add(skyDome);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.8;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // Left click 2D pan
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE, // Right click 3D rotate
    };
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 4;
    controls.maxDistance = 25;
    const defaultTarget = new THREE.Vector3(0, 3.5, 0);
    controls.target.copy(defaultTarget);

    const explorer = new ExplorerController({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
      defaultTarget,
      initialPos: new THREE.Vector3(2.5, 1.2, 4.0),
      bounds: { minY: 0.8, maxY: 16.0, maxRadius: 20.0 },
      onModeChange: (isExp, isFP) => {
        setIsExplorerMode(isExp);
        setIsFirstPerson(isFP);
      },
    });
    explorerRef.current = explorer;

    // Basketball Court Floor
    const courtGeo = new THREE.PlaneGeometry(24, 24);
    const courtMat = new THREE.MeshStandardMaterial({
      map: createCourtTexture(),
      roughness: 0.35,
      metalness: 0.2,
    });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = !isSoftwareGl;
    scene.add(court);

    // Basketball Hoop Structure (Composite 5 parts)
    const hoopGroup = new THREE.Group();
    hoopGroup.position.set(0, 0, -4.5);

    // 1. Steel post
    const postGeo = new THREE.CylinderGeometry(0.12, 0.15, 3.8, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(0, 1.9, -0.6);
    hoopGroup.add(post);

    // 2. Overhang arm
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.rotation.x = Math.PI / 3;
    arm.position.set(0, 3.3, -0.2);
    hoopGroup.add(arm);

    // 3. Glass Backboard
    const backboardGeo = new THREE.BoxGeometry(2.2, 1.4, 0.08);
    const backboardMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: isSoftwareGl ? 0 : 0.85,
      transparent: true,
      opacity: isSoftwareGl ? 0.4 : 0.9,
      roughness: 0.1,
      metalness: 0.1,
    });
    const backboard = new THREE.Mesh(backboardGeo, backboardMat);
    backboard.position.set(0, 3.5, 0.4);
    hoopGroup.add(backboard);

    // Backboard target white square
    const targetGeo = new THREE.BoxGeometry(0.8, 0.6, 0.1);
    const targetMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const target = new THREE.Mesh(targetGeo, targetMat);
    target.position.set(0, 3.35, 0.41);
    hoopGroup.add(target);

    // 4. Orange Rim (at exact regulation 3.05m height!)
    const rimGeo = new THREE.TorusGeometry(0.45, 0.03, 8, 24);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.7, roughness: 0.3 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 3.05, 0.9);
    hoopGroup.add(rim);

    // 5. White Net (cone outline)
    const netGeo = new THREE.CylinderGeometry(0.45, 0.25, 0.6, 12, 4, true);
    const netMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, wireframe: true });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, 2.75, 0.9);
    hoopGroup.add(net);

    scene.add(hoopGroup);

    // Measurement Tower (Vertical Ruler with meter markers up to 12.0m)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-2.8, 0, 0);

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 12, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 6;
    towerGroup.add(pole);

    // Ruler measurement markings
    for (let m = 0; m <= 12; m++) {
      const isMajor = m % 2 === 0;
      const tickGeo = new THREE.BoxGeometry(isMajor ? 0.6 : 0.35, 0.03, 0.05);
      const tickMat = new THREE.MeshBasicMaterial({ color: isMajor ? 0x38bdf8 : 0x94a3b8 });
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.set(0.3, m, 0);
      towerGroup.add(tick);
    }
    scene.add(towerGroup);

    // Basketball 3D Model (Composite 3 parts: ball sphere, inner weight, contact shadow)
    const ballGroup = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS_M, 32, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      map: createBasketballTexture(),
      roughness: 0.6,
      metalness: 0.1,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = !isSoftwareGl;
    ballGroup.add(ballMesh);

    ballGroup.position.set(0, dropHeight + BALL_RADIUS_M, 0);
    scene.add(ballGroup);
    ballMeshRef.current = ballGroup;

    // Contact Shadow
    const shadow = createContactShadow(BALL_RADIUS_M * 1.5, 0.6);
    scene.add(shadow);
    shadowMeshRef.current = shadow;

    // Visual Reference Level Line (Glowing emerald horizontal plane/line)
    const refPlaneGeo = new THREE.PlaneGeometry(6, 6);
    const refPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const refPlane = new THREE.Mesh(refPlaneGeo, refPlaneMat);
    refPlane.rotation.x = -Math.PI / 2;
    refPlane.position.y = refHeight;
    scene.add(refPlane);

    // Edge wireframe for reference plane
    const wireGeo = new THREE.EdgesGeometry(refPlaneGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 });
    const refLine = new THREE.LineSegments(wireGeo, wireMat);
    refLine.rotation.x = -Math.PI / 2;
    refLine.position.y = refHeight;
    scene.add(refLine);
    refLineMeshRef.current = refLine as unknown as THREE.Line;

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Simulation Loop
    let clock = new THREE.Clock();
    let frameRef = { id: 0 };
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;
      const dt = Math.min(clock.getDelta(), 0.05) * simDataRef.current.timeScale;

      const sim = simDataRef.current;

      // Update reference line height visually
      if (refPlane) refPlane.position.y = sim.refHeight;
      if (refLineMeshRef.current) refLineMeshRef.current.position.y = sim.refHeight;

      if (sim.state === 'falling' || sim.state === 'rebounding') {
        // Analytical equations of motion
        sim.vy -= GRAVITY_G * dt;
        sim.y += sim.vy * dt;

        // Ground Impact Detection
        if (sim.y <= 0) {
          sim.y = 0;
          const impactSpeed = Math.abs(sim.vy);

          // Restitution bounce
          const reboundSpeed = impactSpeed * BASKETBALL_RESTITUTION;
          sim.vy = reboundSpeed;
          sim.state = 'rebounding';

          // Procedural bounce sound scaled by impact velocity and energy transfer feedback
          sound.playBounce(impactSpeed / 10);
          sound.playEnergyTransfer(true);

          // Squash effect on contact
          sim.squashFactor = Math.max(0.65, 1 - (impactSpeed / 20) * 0.4);

          // If bounce is negligible, settle
          if (reboundSpeed < 0.4) {
            sim.state = 'settled';
            sim.vy = 0;
            sim.y = 0;
            sim.squashFactor = 1.0;
            setSimState('settled');
          }
        }

        // Apex/Peak Rebound Detection
        if (sim.state === 'rebounding' && sim.vy <= 0 && !sim.peakRecorded) {
          sim.hBouncePeak = sim.y;
          sim.peakRecorded = true;
          sound.playEnergyTransfer(false);

          // Record trial data
          const bounceH = sim.hBouncePeak;
          const dropH = sim.hInitial;
          const ratio = dropH > 0 ? bounceH / dropH : 0;
          const loss = (1 - ratio) * 100;

          // Update trials
          setTrials((prev) => {
            if (prev.length < 3) {
              return [
                ...prev,
                {
                  id: prev.length + 1,
                  initialHeight: dropH,
                  bounceHeight: bounceH,
                  restitutionSq: ratio,
                  energyLostPct: loss,
                },
              ];
            }
            return prev;
          });

          // Check if prediction mode
          if (predictionMode) {
            const diff = Math.abs(userPrediction - bounceH);
            setPredictionResult({
              actual: bounceH,
              predicted: userPrediction,
              diff,
            });
            sound.playVictory();
          }
        }

        // Recover squash smoothly
        sim.squashFactor += (1.0 - sim.squashFactor) * (15 * dt);

        // Calculate analytical energies live
        const currentH = Math.max(0, sim.y);
        const currentV = Math.abs(sim.vy);
        const ke = calculateKE(BALL_MASS_KG, currentV);
        const peGrav = calculatePEgrav(BALL_MASS_KG, currentH, sim.refHeight);
        // During compression at ground, elastic energy
        const peElastic = sim.y === 0 ? calculatePEelastic(800, (1 - sim.squashFactor) * BALL_RADIUS_M) : 0;
        // Gravity work done from release height to current height
        const workDone = calculateGravityWork(BALL_MASS_KG, sim.hInitial, currentH);
        const total = ke + peGrav + peElastic;

        setEnergy({
          ke,
          peGrav,
          peElastic,
          workDone,
          totalEnergy: total,
          refHeight: sim.refHeight,
          mass: BALL_MASS_KG,
          velocity: currentV,
          height: currentH,
        });
      }

      // Update 3D mesh positions
      if (ballMeshRef.current) {
        ballMeshRef.current.position.y = sim.y + BALL_RADIUS_M * sim.squashFactor;
        ballMeshRef.current.scale.set(
          1 / Math.sqrt(sim.squashFactor),
          sim.squashFactor,
          1 / Math.sqrt(sim.squashFactor)
        );
        // subtle spin
        ballMeshRef.current.rotation.x += sim.vy * 0.05 * dt;
      }

      // Update contact shadow scale and opacity based on height
      if (shadowMeshRef.current) {
        const shadowScale = Math.max(0.3, 1 - sim.y * 0.12);
        shadowMeshRef.current.scale.set(shadowScale, shadowScale, shadowScale);
        const shadowMat = shadowMeshRef.current.material as THREE.MeshBasicMaterial;
        shadowMat.opacity = Math.max(0.1, 0.65 - sim.y * 0.08);
      }

      const elapsed = clock.getElapsedTime();
      explorer.update(dt, elapsed);

      controls.update();
      renderer.render(scene, camera);

      scheduleNextFrame(renderer, tick, frameRef);
    };

    tick();

    return () => {
      isMounted = false;
      cancelAnimationFrame(frameRef.id);
      clearTimeout(frameRef.id);
      window.removeEventListener('resize', handleResize);
      explorer.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleStartPredictionMode = () => {
    sound.playClick();
    setPredictionMode(true);
    handleSetDropHeight(10.0);
    setPredictionResult(null);
  };

  const handleLevelFinished = (stars: number, score: number) => {
    onCompleteLevel(stars, score);
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      {/* 3D Scene Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Auxiliary Control Bar (Explorer Mode + Speed & Instructions) */}
      <div className="fixed top-14 left-3 z-30 flex items-center gap-2 pointer-events-auto">
        <ExplorerControlBar
          isExplorerMode={isExplorerMode}
          isFirstPerson={isFirstPerson}
          onToggleMode={() => explorerRef.current?.toggleMode()}
          onTouchKey={(key, active) => explorerRef.current?.setTouchKey(key, active)}
        />
        <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1 text-xs shadow-xl backdrop-blur-md">
          <span className="px-2 text-slate-400 flex items-center gap-1 font-bold">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">السرعة:</span>
          </span>
          {[1.0, 0.5, 0.25].map((scale) => (
            <button
              key={scale}
              onClick={() => {
                sound.playClick();
                setTimeScale(scale);
              }}
              className={`px-2 py-1 rounded-xl font-mono font-bold transition ${
                timeScale === scale
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {scale}x
            </button>
          ))}
        </div>

        <button
          onClick={() => setLabIntroSeen(!labIntroSeen)}
          className="p-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white transition shadow-xl backdrop-blur-md"
          title="إرشادات التجربة"
        >
          <Info className="w-4 h-4 text-orange-400" />
        </button>
      </div>

      {/* Lab Intro / Instructions Drawer on Left */}
      {labIntroSeen && (
        <aside
          aria-label="إرشادات المختبر"
          className="fixed top-26 left-3 z-30 w-80 max-w-[85vw] bg-slate-900/95 border border-slate-700 rounded-2xl p-4 shadow-2xl text-xs space-y-2 pointer-events-auto animate-fade-in"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="font-bold text-orange-400">الهدف التعليمي للمختبر:</span>
            <button onClick={() => setLabIntroSeen(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <p className="text-slate-300 leading-relaxed">
            1. اختر 3 ارتفاعات سقوط مختلفة (مثلاً: 2م، 4م، 6م) وأسقط الكرة في كل مرة لتسجيل ارتدادها تلقائياً.
          </p>
          <p className="text-slate-300 leading-relaxed">
            2. افتح الرسم البياني ولاحظ خط أفضل مطابقة وعلاقة التناسب الطردي h₂ = e² · h₁.
          </p>
          <p className="text-slate-300 leading-relaxed">
            3. انتقل لتحدي التوقع من 10 أمتار ثم اختبر معلوماتك في الاختبار النهائي لنيل النجوم الـ 3!
          </p>
        </aside>
      )}

      {/* Side Trials Card on Left */}
      {!predictionMode && (
        <aside
          aria-label="جدول البيانات المسجلة"
          className="fixed top-26 left-3 z-20 w-72 max-w-[85vw] bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-xl text-xs space-y-2.5 pointer-events-auto"
        >
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>التجارب المسجلة ({trials.length}/3)</span>
          </span>
          {trials.length >= 1 && (
            <button
              onClick={() => {
                sound.playClick();
                setShowGraphModal(true);
              }}
              className="text-[11px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>الرسم البياني</span>
            </button>
          )}
        </div>

        {/* Trials Table */}
        <div className="space-y-1.5">
          {trials.length === 0 ? (
            <p className="text-slate-500 text-[11px] py-1 text-center">
              لم تسجل تجارب بعد. أسقط الكرة لحساب الارتداد!
            </p>
          ) : (
            trials.map((t) => (
              <div key={t.id} className="p-2 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                <div>
                  <span className="text-slate-400 block">تجربة {t.id}</span>
                  <span className="font-mono text-cyan-400 font-bold">h₁: {t.initialHeight.toFixed(1)}م</span>
                </div>
                <div className="text-left">
                  <span className="text-slate-400 block">الارتداد h₂</span>
                  <span className="font-mono text-emerald-400 font-bold">{t.bounceHeight.toFixed(2)}م</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Actions based on trials count */}
        {trials.length >= 3 && !predictionMode && (
          <button
            onClick={() => {
              sound.playClick();
              setShowGraphModal(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/40"
          >
            <TrendingUp className="w-4 h-4" />
            <span>عرض الرسم البياني وخط المطابقة</span>
          </button>
        )}
      </aside>
      )}

      {/* Prediction Mode Challenge Dialog on Left */}
      {predictionMode && (
        <aside
          aria-label="تحدي التوقع"
          className="fixed top-26 left-3 z-30 w-80 max-w-[85vw] bg-slate-900/95 border border-amber-600/60 rounded-2xl p-4 shadow-2xl text-xs space-y-3 pointer-events-auto animate-fade-in"
        >
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Target className="w-4 h-4" />
            <span>تحدي التوقع من 10.0 أمتار!</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            بناءً على قانون الارتداد (h₂ ≈ 0.562 · h₁)، ما الارتفاع المتوقع أن تبلغه الكرة بعد ارتدادها الأول عند السقوط من 10 أمتار؟
          </p>

          <div className="space-y-1">
            <div className="flex justify-between font-mono text-slate-300">
              <span>توقعك لارتفاع الارتداد:</span>
              <span className="font-bold text-amber-400 text-sm">{userPrediction.toFixed(2)} م</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="9.0"
              step="0.05"
              value={userPrediction}
              onChange={(e) => setUserPrediction(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {predictionResult && (
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between text-slate-300 font-mono">
                <span>الارتداد الفعلي:</span>
                <span className="text-emerald-400 font-bold">{predictionResult.actual.toFixed(2)} م</span>
              </div>
              <div className="flex justify-between text-slate-300 font-mono">
                <span>فارق التوقع:</span>
                <span className={`font-bold ${predictionResult.diff <= 0.3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {predictionResult.diff.toFixed(2)} م
                </span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                {predictionResult.diff <= 0.3
                  ? 'رائع جداً! توقعك دقيق ومطابق تماماً لمعامل الارتداد!'
                  : 'توقع جيد! لاحظ أن 10 × 0.5625 = 5.63 م.'}
              </p>
              <button
                onClick={() => {
                  sound.playClick();
                  setShowQuiz(true);
                }}
                className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>الانتقال للاختبار النهائي (3 أسئلة)</span>
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Floating Interactive Controls Dock */}
      <div className="fixed bottom-10 sm:bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-xl px-4 flex justify-center">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center gap-2 pointer-events-auto">
          {/* Drop height preset selector */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <span className="text-xs text-slate-400 font-semibold hidden sm:inline">الارتفاع:</span>
            {[2.0, 4.0, 6.0, 8.0].map((h) => (
              <button
                key={h}
                disabled={simState !== 'ready' || predictionMode}
                onClick={() => {
                  sound.playClick();
                  handleSetDropHeight(h);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                  dropHeight === h
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 disabled:opacity-40'
                }`}
              >
                {h}م
              </button>
            ))}
          </div>

          {/* Action buttons */}
          {simState === 'ready' ? (
            <button
              onClick={handleDropBall}
              className="flex items-center gap-2 py-2 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs md:text-sm shadow-lg shadow-orange-950/40 transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>إسقاط الكرة</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs md:text-sm border border-slate-700 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة الكرة للقمة</span>
            </button>
          )}
        </div>
      </div>

      {/* CORE FEATURE: Live Energy Bar Chart HUD */}
      <EnergyHUD
        energy={energy}
        maxEnergyScale={60}
        showWork={true}
        showElastic={true}
        referenceHeightLabel={refHeight === 0 ? 'سطح الأرض (0 م)' : 'حافة السلة (3.05 م)'}
        availableRefHeights={[
          { label: 'سطح الأرض', height: 0.0 },
          { label: 'حافة السلة', height: 3.05 },
          { label: 'منتصف البرج', height: 6.0 },
        ]}
        onReferenceHeightChange={(newH) => {
          sound.playClick();
          setRefHeight(newH);
        }}
      />

      {/* Graph Modal */}
      {showGraphModal && (
        <BounceGraphModal
          trials={trials}
          onClose={() => setShowGraphModal(false)}
          onProceedToPrediction={handleStartPredictionMode}
        />
      )}

      {/* Quiz Modal */}
      {showQuiz && (
        <QuizModal
          levelTitle="مختبر الارتداد - تحولات الطاقة"
          questions={QUIZ_QUESTIONS}
          onComplete={handleLevelFinished}
          onReplay={() => {
            setShowQuiz(false);
            setTrials([]);
            setPredictionMode(false);
            setPredictionResult(null);
            handleReset();
          }}
          onReturnHub={onReturnHub}
        />
      )}
    </div>
  );
};
