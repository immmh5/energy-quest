import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EnergyState, QuizQuestion } from '../../types';
import { calculatePEgrav, calculateGravityWork, GRAVITY_G, formatJoules, formatMeters } from '../../physics/formulas';
import {
  createStandardRenderer,
  setupStudioLighting,
  createAtmosphericSkyDome,
  createContactShadow,
  scheduleNextFrame,
  isSoftwareGl,
} from '../common';
import { EnergyHUD } from '../../components/EnergyHUD';
import { QuizModal } from '../../components/QuizModal';
import { GravityAnalysisModal } from '../../components/GravityAnalysisModal';
import { sound } from '../../audio/synth';
import confetti from 'canvas-confetti';
import {
  Home,
  Sparkles,
  Dumbbell,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle2,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { ExplorerController } from '../ExplorerController';
import { ExplorerControlBar } from '../../components/ExplorerControlBar';

interface Level3Props {
  onCompleteLevel: (stars: number, score: number) => void;
  onReturnHub: () => void;
}

const BOWLING_BALL_MASS = 7.30; // kg
const RACK_HEIGHT = 0.610; // m
const SHOULDER_HEIGHT = 1.120; // m
const BALL_RADIUS = 0.16; // m

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'عند رفع كرة البولينج (7.30 كغ) من الرف (0.610 م) إلى مستوى الكتف (1.12 م)، كم يبلغ شغل قوة الجاذبية الأرضية؟',
    options: [
      '-36.5 جول (سالب لأن قوة الجاذبية لأسفل بينما الإزاحة لأعلى).',
      '+36.5 جول.',
      '+80.1 جول.',
      'صفر لأن الكرة رُفعت بسرعة ثابتة تقريباً.',
    ],
    correctIndex: 0,
    explanation:
      'W_g = - m·g·Δh = - 7.30 × 9.80 × (1.120 - 0.610) = - 7.30 × 9.80 × 0.510 = -36.49 J ≈ -36.5 J. تبذل قوة الجاذبية شغلاً سالباً لأنها تقاوم حركة الصعود.',
  },
  {
    id: 2,
    question: 'إذا اخترنا سطح الرف (h = 0.610 م) كمستوى إسناد (h₀ = 0)، فما قيمة طاقة وضع الكرة عندما تكون على سطح الأرض (h = 0)؟',
    options: [
      '-43.6 جول (قيمة سالبة لأن موضع الكرة يقع أسفل مستوى الإسناد).',
      '+43.6 جول.',
      'تساوي صفراً دائماً على الأرض.',
      'لا يمكن لطاقة الوضع أن تكون سالبة في الفيزياء.',
    ],
    correctIndex: 0,
    explanation:
      'قانون طاقة الوضع PE = m·g·(h - h₀) = 7.30 × 9.80 × (0 - 0.610) = -43.64 J. طاقة الوضع نسبية وتكون سالبة لجميع النقاط الواقعة أسفل المرجع المختار.',
  },
  {
    id: 3,
    question: 'هل يؤثر تغيير مستوى الإسناد على مقدار الشغل المبذول بواسطة الجاذبية بين الرف والكتف؟',
    options: [
      'لا؛ لأن الشغل يعتمد فقط على فرق الارتفاع الحقيقي Δh = h₂ - h₁ وليس على موقع المرجع.',
      'نعم؛ يتغير الشغل تماماً مع تغير المرجع المختار.',
      'نعم؛ يصبح الشغل صفراً دائماً إذا اخترنا سطح الأرض.',
      'نعم؛ تتضاعف قيمة الشغل كلما ارتفع المرجع.',
    ],
    correctIndex: 0,
    explanation:
      'الشغل والتغير في طاقة الوضع (ΔPE = PE₂ - PE₁) كميات فيزيائية حقيقية ومطلقة لا تعتمد على المرجع؛ لأن (h₂ - h₀) - (h₁ - h₀) = h₂ - h₁.',
  },
];

export const Level3GravityGym: React.FC<Level3Props> = ({
  onCompleteLevel,
  onReturnHub,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Ball height & reference level
  const [currentHeight, setCurrentHeight] = useState<number>(RACK_HEIGHT);
  const [refHeight, setRefHeight] = useState<number>(0.0);
  const [refMode, setRefMode] = useState<'ground' | 'rack' | 'shoulder' | 'custom'>('ground');

  // Investigation Tasks
  const [task1Done, setTask1Done] = useState<boolean>(false);
  const [task2Done, setTask2Done] = useState<boolean>(false);
  const [task3Done, setTask3Done] = useState<boolean>(false);
  const [allTasksDone, setAllTasksDone] = useState<boolean>(false);

  // Modals & UI
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(false);

  // Physics values
  const pe = calculatePEgrav(BOWLING_BALL_MASS, currentHeight, refHeight);
  const workGrav = calculateGravityWork(BOWLING_BALL_MASS, RACK_HEIGHT, currentHeight);

  // Energy state for HUD
  const [energy, setEnergy] = useState<EnergyState>({
    ke: 0,
    peGrav: pe,
    peElastic: 0,
    workDone: workGrav,
    totalEnergy: pe,
    refHeight: refHeight,
    mass: BOWLING_BALL_MASS,
    velocity: 0,
    height: currentHeight,
  });

  // Mutable refs for 3D animation - zero GC allocations in loop
  const simDataRef = useRef({
    targetY: RACK_HEIGHT,
    currentY: RACK_HEIGHT,
    refHeight: 0.0,
    isDirty: true,
  });

  const ballMeshRef = useRef<THREE.Group | null>(null);
  const rackShadowRef = useRef<THREE.Mesh | null>(null);
  const floorShadowRef = useRef<THREE.Mesh | null>(null);
  const refPlaneMeshRef = useRef<THREE.Mesh | null>(null);
  const refLineMeshRef = useRef<THREE.LineSegments | null>(null);

  // Explorer Avatar & 1D Mode States
  const [isExplorerMode, setIsExplorerMode] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const explorerRef = useRef<ExplorerController | null>(null);

  // Synchronize physics and check tasks
  useEffect(() => {
    const newPe = calculatePEgrav(BOWLING_BALL_MASS, currentHeight, refHeight);
    const newWg = calculateGravityWork(BOWLING_BALL_MASS, RACK_HEIGHT, currentHeight);

    setEnergy({
      ke: 0,
      peGrav: newPe,
      peElastic: 0,
      workDone: newWg,
      totalEnergy: newPe,
      refHeight: refHeight,
      mass: BOWLING_BALL_MASS,
      velocity: 0,
      height: currentHeight,
    });

    simDataRef.current.targetY = currentHeight;
    simDataRef.current.refHeight = refHeight;
    simDataRef.current.isDirty = true;

    // Check Task 1: Ball on rack (0.61m) with ground ref (0m)
    if (Math.abs(currentHeight - RACK_HEIGHT) < 0.05 && refHeight === 0.0) {
      setTask1Done(true);
    }

    // Check Task 2: Ball lifted to shoulder (1.12m)
    if (Math.abs(currentHeight - SHOULDER_HEIGHT) < 0.05) {
      setTask2Done(true);
    }

    // Check Task 3: Ball on ground (0m) with rack ref (0.61m) -> Negative PE!
    if (Math.abs(currentHeight - 0.0) < 0.05 && Math.abs(refHeight - RACK_HEIGHT) < 0.05) {
      setTask3Done(true);
    }
  }, [currentHeight, refHeight]);

  // Check if all tasks finished to play victory fanfare
  useEffect(() => {
    if (task1Done && task2Done && task3Done && !allTasksDone) {
      setAllTasksDone(true);
      sound.playVictory();
      confetti({ particleCount: 70, spread: 70 });
    }
  }, [task1Done, task2Done, task3Done, allTasksDone]);

  // 3D Scene setup - optimized for 60fps with zero stutter
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 80);
    camera.position.set(0, 1.8, 3.8);

    const renderer = createStandardRenderer(container);
    setupStudioLighting(scene, renderer, 0x09121d);

    // Atmospheric sky dome
    const skyDome = createAtmosphericSkyDome(75);
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
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 2.0;
    controls.maxDistance = 7.5;
    const defaultTarget = new THREE.Vector3(0, 0.85, 0);
    controls.target.copy(defaultTarget);

    const explorer = new ExplorerController({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
      defaultTarget,
      initialPos: new THREE.Vector3(1.2, 1.0, 1.8),
      bounds: { minY: 0.8, maxY: 10.0, maxRadius: 10.0 },
      onModeChange: (isExp, isFP) => {
        setIsExplorerMode(isExp);
        setIsFirstPerson(isFP);
      },
    });
    explorerRef.current = explorer;

    // Parquet Floor - simple high-performance standard material
    const floorGeo = new THREE.PlaneGeometry(8, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !isSoftwareGl;
    scene.add(floor);

    // Back Gym Wall
    const wallGeo = new THREE.PlaneGeometry(8, 5);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 2.5, -2.5);
    scene.add(wall);

    // Measurement column with calibrated ticks (instanced or grouped)
    const rulerGroup = new THREE.Group();
    rulerGroup.position.set(1.4, 0, -1.8);
    for (let m = 0; m <= 20; m++) {
      const hMeters = m * 0.1;
      const isMajor = m % 5 === 0;
      const tickGeo = new THREE.BoxGeometry(isMajor ? 0.35 : 0.18, 0.015, 0.02);
      const tickMat = new THREE.MeshBasicMaterial({
        color: isMajor ? 0x10b981 : 0x64748b,
      });
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.set(0, hMeters, 0);
      rulerGroup.add(tick);
    }
    scene.add(rulerGroup);

    // Bowling Ball Rack at exact height 0.610 m (Composite 5 parts)
    const rackGroup = new THREE.Group();
    rackGroup.position.set(0, 0, 0);

    const tableTopGeo = new THREE.BoxGeometry(1.6, 0.06, 0.8);
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.4,
    });
    const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
    tableTop.position.y = RACK_HEIGHT;
    tableTop.receiveShadow = !isSoftwareGl;
    rackGroup.add(tableTop);

    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, RACK_HEIGHT, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const legPositions = [
      [-0.7, RACK_HEIGHT / 2, -0.3], [0.7, RACK_HEIGHT / 2, -0.3],
      [-0.7, RACK_HEIGHT / 2, 0.3], [0.7, RACK_HEIGHT / 2, 0.3],
    ];
    legPositions.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, ly, lz);
      rackGroup.add(leg);
    });
    scene.add(rackGroup);

    // Shoulder Height Guide Bar at exact 1.120 m
    const shoulderBarGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.6, 8);
    const shoulderBarMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.6 });
    const shoulderBar = new THREE.Mesh(shoulderBarGeo, shoulderBarMat);
    shoulderBar.rotation.z = Math.PI / 2;
    shoulderBar.position.set(0, SHOULDER_HEIGHT, -0.35);
    scene.add(shoulderBar);

    // 3D Reference Level Grid Plane (shifts live to visualize h0 = 0)
    const refPlaneGeo = new THREE.PlaneGeometry(3.5, 3.5);
    const refPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const refPlane = new THREE.Mesh(refPlaneGeo, refPlaneMat);
    refPlane.rotation.x = -Math.PI / 2;
    refPlane.position.y = refHeight;
    scene.add(refPlane);
    refPlaneMeshRef.current = refPlane;

    const refWireGeo = new THREE.EdgesGeometry(refPlaneGeo);
    const refWireMat = new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 });
    const refWire = new THREE.LineSegments(refWireGeo, refWireMat);
    refWire.rotation.x = -Math.PI / 2;
    refWire.position.y = refHeight;
    scene.add(refWire);
    refLineMeshRef.current = refWire;

    // Bowling Ball 3D Model: High-performance MeshStandardMaterial
    const ballGroup = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 18);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0x059669, // vibrant glossy emerald
      roughness: 0.2,
      metalness: 0.35,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = !isSoftwareGl;
    ballGroup.add(ballMesh);

    // 3 Finger holes
    const holeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x022c22 });
    const holes = [[0, 0.12, 0.08], [-0.035, 0.07, 0.1], [0.035, 0.07, 0.1]];
    holes.forEach(([hx, hy, hz]) => {
      const h = new THREE.Mesh(holeGeo, holeMat);
      h.position.set(hx, hy, hz);
      ballGroup.add(h);
    });

    ballGroup.position.set(0, currentHeight + BALL_RADIUS, 0);
    scene.add(ballGroup);
    ballMeshRef.current = ballGroup;

    // Continuous Two-Layer Contact Shadows:
    // 1. Rack shadow (rests permanently on rack at y = RACK_HEIGHT + 0.031)
    const rackShadow = createContactShadow(BALL_RADIUS * 1.5, 0.5);
    rackShadow.position.set(0, RACK_HEIGHT + 0.031, 0);
    scene.add(rackShadow);
    rackShadowRef.current = rackShadow;

    // 2. Floor shadow (rests permanently on ground at y = 0.015)
    const floorShadow = createContactShadow(BALL_RADIUS * 1.5, 0.5);
    floorShadow.position.set(0, 0.015, 0);
    scene.add(floorShadow);
    floorShadowRef.current = floorShadow;

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop with frame-rate independent smooth damping
    let clock = new THREE.Clock();
    let frameRef = { id: 0 };
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      const sim = simDataRef.current;

      // Exponential damping with settlement threshold to avoid unnecessary calculations
      const diff = sim.targetY - sim.currentY;
      if (Math.abs(diff) > 0.0005) {
        sim.currentY += diff * (1 - Math.exp(-14 * dt));
        sim.isDirty = true;
      } else if (sim.currentY !== sim.targetY) {
        sim.currentY = sim.targetY;
        sim.isDirty = true;
      }

      if (sim.isDirty) {
        // Update Ball position
        if (ballMeshRef.current) {
          ballMeshRef.current.position.y = sim.currentY + BALL_RADIUS;
        }

        // Update Rack Shadow opacity smoothly
        if (rackShadowRef.current) {
          const distToRack = Math.abs(sim.currentY - RACK_HEIGHT);
          const opacity = Math.max(0, 0.55 - distToRack * 1.8);
          (rackShadowRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
          const s = Math.max(0.4, 1.0 - distToRack * 0.5);
          rackShadowRef.current.scale.set(s, s, s);
        }

        // Update Floor Shadow opacity smoothly
        if (floorShadowRef.current) {
          const distToFloor = sim.currentY;
          const opacity = Math.max(0, 0.55 - distToFloor * 0.7);
          (floorShadowRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
          const s = Math.max(0.4, 1.0 - distToFloor * 0.3);
          floorShadowRef.current.scale.set(s, s, s);
        }

        // Update Reference line and plane position
        if (refPlaneMeshRef.current) {
          refPlaneMeshRef.current.position.y = sim.refHeight;
        }
        if (refLineMeshRef.current) {
          refLineMeshRef.current.position.y = sim.refHeight;
        }

        sim.isDirty = false;
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

  // Quick Action Handlers
  const handleLiftToShoulder = useCallback(() => {
    sound.playRelease();
    setCurrentHeight(SHOULDER_HEIGHT);
  }, []);

  const handleLowerToRack = useCallback(() => {
    sound.playClick();
    setCurrentHeight(RACK_HEIGHT);
  }, []);

  const handlePlaceOnGround = useCallback(() => {
    sound.playClick();
    setCurrentHeight(0.0);
  }, []);

  const handleSelectRef = useCallback((mode: 'ground' | 'rack' | 'shoulder') => {
    sound.playClick();
    setRefMode(mode);
    if (mode === 'ground') setRefHeight(0.0);
    if (mode === 'rack') setRefHeight(RACK_HEIGHT);
    if (mode === 'shoulder') setRefHeight(SHOULDER_HEIGHT);
  }, []);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      {/* 3D Canvas Mounting Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Auxiliary Control Bar */}
      <div className="fixed top-14 left-3 z-30 flex items-center gap-2 pointer-events-auto">
        <ExplorerControlBar
          isExplorerMode={isExplorerMode}
          isFirstPerson={isFirstPerson}
          onToggleMode={() => explorerRef.current?.toggleMode()}
          onTouchKey={(key, active) => explorerRef.current?.setTouchKey(key, active)}
        />
        <button
          onClick={() => {
            sound.playClick();
            setShowAnalysisModal(true);
          }}
          className="flex items-center gap-1.5 py-2 px-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-emerald-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition shadow-xl backdrop-blur-md"
        >
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span>دليل مستويات الإسناد</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setShowQuiz(true);
          }}
          className="flex items-center gap-1.5 py-2 px-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-xl shadow-emerald-900/40 backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4" />
          <span>اختبار الفهم</span>
        </button>
      </div>

      {/* Side Investigation Tasks & Reference Switcher Card on Left */}
      <aside
        aria-label="لوحة مستويات الإسناد"
        className="fixed top-26 left-3 z-20 w-84 max-w-[88vw] bg-slate-900/95 border border-slate-700 rounded-2xl p-4 shadow-2xl text-xs space-y-3 pointer-events-auto max-h-[calc(100vh-160px)] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            <Dumbbell className="w-4 h-4 text-emerald-400" />
            <span>مهام الاستكشاف الفيزيائي:</span>
          </span>
          <button
            onClick={() => setShowIntro(!showIntro)}
            className="text-slate-400 hover:text-slate-200"
            title="إرشادات"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {showIntro && (
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
            الهدف: إثبات أن طاقة الوضع تعتمد على المرجع المختار ($h_0$) وتكون سالبة تحته، وأن شغل الجاذبية يعتمد فقط على فرق الارتفاع ولا يتأثر بالمرجع المختار!
          </div>
        )}

        {/* 3 Guided Checklist Tasks */}
        <div className="space-y-1.5">
          <div className={`p-2 rounded-xl border flex items-center justify-between transition ${
            task1Done ? 'bg-emerald-950/40 border-emerald-500/60 text-slate-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${task1Done ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span>1. وضع الكرة على الرف مع إسناد الأرض (+43.6 J)</span>
            </div>
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between transition ${
            task2Done ? 'bg-emerald-950/40 border-emerald-500/60 text-slate-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${task2Done ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span>2. الرفع للكتف وملاحظة شغل الجاذبية السالب (-36.5 J)</span>
            </div>
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between transition ${
            task3Done ? 'bg-emerald-950/40 border-emerald-500/60 text-slate-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${task3Done ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span>3. جعل الرف مرجعاً وملاحظة طاقة الوضع السالبة على الأرض!</span>
            </div>
          </div>
        </div>

        {/* Reference Level Selector Tabs */}
        <div className="pt-2 border-t border-slate-800">
          <span className="text-slate-300 font-bold block mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>اختر مستوى الإسناد (h₀ = 0):</span>
          </span>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => handleSelectRef('ground')}
              className={`p-2 rounded-xl border text-center transition ${
                refMode === 'ground'
                  ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <span className="block text-xs">الأرض</span>
              <span className="text-[10px] font-mono text-emerald-400">0.00 م</span>
            </button>

            <button
              onClick={() => handleSelectRef('rack')}
              className={`p-2 rounded-xl border text-center transition ${
                refMode === 'rack'
                  ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <span className="block text-xs">الرف</span>
              <span className="text-[10px] font-mono text-emerald-400">0.61 م</span>
            </button>

            <button
              onClick={() => handleSelectRef('shoulder')}
              className={`p-2 rounded-xl border text-center transition ${
                refMode === 'shoulder'
                  ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <span className="block text-xs">الكتف</span>
              <span className="text-[10px] font-mono text-emerald-400">1.12 م</span>
            </button>
          </div>
        </div>

        {/* Custom Height Slider */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between font-mono text-slate-300 text-[11px]">
            <span>ارتفاع الكرة الحالي (h):</span>
            <span className="font-bold text-emerald-400">{currentHeight.toFixed(3)} م</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.8"
            step="0.01"
            value={currentHeight}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentHeight(val);
              simDataRef.current.targetY = val;
              simDataRef.current.isDirty = true;
            }}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Live Calculation Card */}
        <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-300">
            <span>طاقة الوضع (PE):</span>
            <span className={`font-mono font-bold text-sm ${pe < -0.01 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatJoules(pe)}
            </span>
          </div>
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>شغل الجاذبية من الرف (W_g):</span>
            <span className="font-mono font-bold text-purple-400">{formatJoules(workGrav)}</span>
          </div>
          {pe < -0.01 && (
            <p className="text-[10px] text-rose-300 pt-0.5">
              لاحظ: طاقة الوضع سالبة لأن موضع الكرة يقع أسفل مستوى الإسناد (h &lt; h₀)!
            </p>
          )}
        </div>
      </aside>

      {/* Floating Action Lift / Lower Controls Dock */}
      <div className="fixed bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-lg px-4 flex justify-center">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleLiftToShoulder}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-emerald-950/40"
          >
            <ArrowUp className="w-4 h-4" />
            <span>رفع للكتف (1.12م)</span>
          </button>

          <button
            onClick={handleLowerToRack}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition active:scale-95"
          >
            <span>وضع على الرف (0.61م)</span>
          </button>

          <button
            onClick={handlePlaceOnGround}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition active:scale-95"
          >
            <ArrowDown className="w-4 h-4" />
            <span>على الأرض (0.00م)</span>
          </button>
        </div>
      </div>

      {/* Core Feature: Live Energy Bar Chart HUD with positive and negative zero axis in top right */}
      <EnergyHUD
        energy={energy}
        maxEnergyScale={90}
        showWork={true}
        showElastic={false}
        referenceHeightLabel={
          refMode === 'ground' ? 'سطح الأرض (0 م)' : (refMode === 'rack' ? 'رف الكرات (0.61 م)' : 'مستوى الكتف (1.12 م)')
        }
        availableRefHeights={[
          { label: 'سطح الأرض', height: 0.0 },
          { label: 'سطح الرف', height: RACK_HEIGHT },
          { label: 'مستوى الكتف', height: SHOULDER_HEIGHT },
        ]}
        onReferenceHeightChange={(newH) => {
          sound.playClick();
          setRefHeight(newH);
          if (newH === 0.0) setRefMode('ground');
          else if (Math.abs(newH - RACK_HEIGHT) < 0.01) setRefMode('rack');
          else if (Math.abs(newH - SHOULDER_HEIGHT) < 0.01) setRefMode('shoulder');
          else setRefMode('custom');
        }}
      />

      {/* Guide / Analysis Modal */}
      {showAnalysisModal && (
        <GravityAnalysisModal onClose={() => setShowAnalysisModal(false)} />
      )}

      {/* Quiz Modal with Victory Sound & Confetti */}
      {showQuiz && (
        <QuizModal
          levelTitle="نادي الجاذبية ومستويات الإسناد"
          questions={QUIZ_QUESTIONS}
          onComplete={onCompleteLevel}
          onReplay={() => {
            setShowQuiz(false);
            handleLowerToRack();
          }}
          onReturnHub={onReturnHub}
        />
      )}
    </div>
  );
};
