import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EnergyState, QuizQuestion } from '../../types';
import { calculateKE, formatJoules, formatVelocity, formatMass } from '../../physics/formulas';
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
import { KineticComparisonModal } from '../../components/KineticComparisonModal';
import { sound } from '../../audio/synth';
import confetti from 'canvas-confetti';
import {
  Play,
  RotateCcw,
  Home,
  Sparkles,
  Zap,
  BarChart2,
  CheckCircle2,
  Info,
  Clock,
  Gauge,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { ExplorerController } from '../ExplorerController';
import { ExplorerControlBar } from '../../components/ExplorerControlBar';

interface Level2Props {
  onCompleteLevel: (stars: number, score: number) => void;
  onReturnHub: () => void;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'إذا تضاعفت سرعة سيارة من 20 م/ث إلى 40 م/ث، فبأي معامل تتضاعف طاقتها الحركية؟',
    options: [
      'تتضاعف 4 مرات (تتناسب طردياً مع مربع السرعة v²).',
      'تتضاعف مرتين فقط (تناسب خطي).',
      'تتضاعف 8 مرات.',
      'تظل ثابتة لأن الكتلة لم تتغير.',
    ],
    correctIndex: 0,
    explanation:
      'قانون الطاقة الحركية هو KE = ½ m v²؛ بما أن السرعة مربعة (2² = 4)، فإن مضاعفة السرعة تضاعف الطاقة الحركية 4 مرات، مما يتطلب شغفاً أكبر بـ 4 أضعاف لإيقاف المركبة!',
  },
  {
    id: 2,
    question: 'ما مقدار الشغل اللازم لإيقاف متزلج كتلته 52.0 كغ يتحرك بسرعة 2.50 م/ث تماماً؟',
    options: [
      '-162.5 جول (شغل سالب تبذله قوة الاحتكاك لإزالة طاقته الحركية).',
      '+162.5 جول.',
      '-65.0 جول.',
      'صفر لأن السرعة صغيرة.',
    ],
    correctIndex: 0,
    explanation:
      'حسب نظرية الشغل والطاقة: W = ΔKE = KE_final - KE_initial = 0 - (½ × 52 × 2.5²) = -162.5 J. الإشارة السالبة تعني أن القوة معاكسة لاتجاه الحركة لامتصاص الطاقة الحركية.',
  },
  {
    id: 3,
    question: 'سيارة كتلتها 875 كغ تم تسريعها من 22.0 م/ث إلى 44.0 م/ث. ما الشغل الصافي المبذول بواسطة المحرك؟',
    options: [
      '635,250 جول (حوالي 635.3 ك.جول).',
      '211,750 جول.',
      '423,500 جول.',
      '847,000 جول.',
    ],
    correctIndex: 0,
    explanation:
      'W = ½ m (v₂² - v₁²) = ½ × 875 × (44² - 22²) = 437.5 × (1936 - 484) = 437.5 × 1452 = 635,250 J = 635.25 kJ.',
  },
];

export const Level2KineticArena: React.FC<Level2Props> = ({
  onCompleteLevel,
  onReturnHub,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [mass, setMass] = useState<number>(52.0); // kg
  const [speed, setSpeed] = useState<number>(2.5); // m/s
  const [activeChallenge, setActiveChallenge] = useState<'free' | 'skier' | 'car'>('skier');
  const [simRunState, setSimRunState] = useState<'idle' | 'running' | 'braking' | 'stopped'>('idle');
  const [timeScale, setTimeScale] = useState<number>(1.0);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(false);

  // Success tracking for the 2 challenges
  const [skierSolved, setSkierSolved] = useState<boolean>(false);
  const [carSolved, setCarSolved] = useState<boolean>(false);

  const ke = calculateKE(mass, speed);

  // Energy state for HUD
  const [energy, setEnergy] = useState<EnergyState>({
    ke: ke,
    peGrav: 0,
    peElastic: 0,
    workDone: 0,
    totalEnergy: ke,
    refHeight: 0,
    mass: mass,
    velocity: speed,
    height: 0,
  });

  // Mutable animation ref
  const simRef = useRef({
    x: -12,
    speed: speed,
    initialSpeed: speed,
    mass: mass,
    state: 'idle' as 'idle' | 'running' | 'braking' | 'stopped',
    brakingForce: 80, // N
    workAccumulated: 0,
    mode: 'skier' as 'skier' | 'car' | 'free',
  });

  const carGroupRef = useRef<THREE.Group | null>(null);
  const skierGroupRef = useRef<THREE.Group | null>(null);
  const wheelsRef = useRef<THREE.Mesh[]>([]);

  // Explorer Avatar & 1D Mode States
  const [isExplorerMode, setIsExplorerMode] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const explorerRef = useRef<ExplorerController | null>(null);

  // Synchronize mass and speed changes
  useEffect(() => {
    const calculatedKE = calculateKE(mass, speed);
    setEnergy({
      ke: calculatedKE,
      peGrav: 0,
      peElastic: 0,
      workDone: activeChallenge === 'skier' ? -calculatedKE : (activeChallenge === 'car' ? 635250 : 0),
      totalEnergy: calculatedKE,
      refHeight: 0,
      mass: mass,
      velocity: speed,
      height: 0,
    });
    simRef.current.speed = speed;
    simRef.current.initialSpeed = speed;
    simRef.current.mass = mass;
  }, [mass, speed, activeChallenge]);

  // 3D Scene setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 7, 16);

    const renderer = createStandardRenderer(container);
    setupStudioLighting(scene, renderer, 0x081020);

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
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    const defaultTarget = new THREE.Vector3(0, 1, 0);
    controls.target.copy(defaultTarget);

    const explorer = new ExplorerController({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
      defaultTarget,
      initialPos: new THREE.Vector3(0, 1.2, 5.0),
      bounds: { minY: 0.8, maxY: 16.0, minX: -18, maxX: 18, minZ: -18, maxZ: 18 },
      onModeChange: (isExp, isFP) => {
        setIsExplorerMode(isExp);
        setIsFirstPerson(isFP);
      },
    });
    explorerRef.current = explorer;

    // Track Arena Ground (Asphalt & Ice Track)
    const trackGeo = new THREE.PlaneGeometry(36, 10);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.3,
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.receiveShadow = !isSoftwareGl;
    scene.add(track);

    // Track Distance Lines and Checkered Finish
    for (let x = -15; x <= 15; x += 3) {
      const lineGeo = new THREE.PlaneGeometry(0.12, 9);
      const isFinish = x === 0;
      const lineMat = new THREE.MeshBasicMaterial({
        color: isFinish ? 0xf59e0b : 0x0284c7,
        transparent: true,
        opacity: isFinish ? 0.9 : 0.3,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.015, 0);
      scene.add(line);
    }

    // Speed Radar Gate at x = 0 (Composite 4 parts)
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, 0);

    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.2, 5, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const leftP = new THREE.Mesh(pillarGeo, pillarMat);
    leftP.position.set(0, 2.5, -4.6);
    const rightP = new THREE.Mesh(pillarGeo, pillarMat);
    rightP.position.set(0, 2.5, 4.6);
    gateGroup.add(leftP, rightP);

    // Overarch beam
    const beamGeo = new THREE.BoxGeometry(0.5, 0.4, 9.5);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 5, 0);
    gateGroup.add(beam);

    // Glowing Speed Sensor
    const sensorGeo = new THREE.BoxGeometry(0.8, 0.3, 0.3);
    const sensorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const sensor = new THREE.Mesh(sensorGeo, sensorMat);
    sensor.position.set(0, 4.7, 0);
    gateGroup.add(sensor);

    scene.add(gateGroup);

    // Composite Model A: Skier (Composite 6 parts: skis, body, head/helmet, ski poles)
    const skierGroup = new THREE.Group();

    // Skis
    const skiGeo = new THREE.BoxGeometry(2.4, 0.05, 0.2);
    const skiMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.5 });
    const leftSki = new THREE.Mesh(skiGeo, skiMat);
    leftSki.position.set(0, 0.03, -0.3);
    const rightSki = new THREE.Mesh(skiGeo, skiMat);
    rightSki.position.set(0, 0.03, 0.3);
    skierGroup.add(leftSki, rightSki);

    // Torso (leaning forward)
    const torsoGeo = new THREE.BoxGeometry(0.5, 1.1, 0.6);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(0.1, 1.0, 0);
    torso.rotation.z = -0.25; // athletic forward lean
    skierGroup.add(torso);

    // Head / Helmet
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.35, 1.7, 0);
    skierGroup.add(head);

    // Ski poles
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const leftPole = new THREE.Mesh(poleGeo, poleMat);
    leftPole.rotation.z = 0.3;
    leftPole.position.set(-0.2, 0.8, -0.5);
    const rightPole = new THREE.Mesh(poleGeo, poleMat);
    rightPole.rotation.z = 0.3;
    rightPole.position.set(-0.2, 0.8, 0.5);
    skierGroup.add(leftPole, rightPole);

    skierGroup.position.set(-12, 0, 0);
    scene.add(skierGroup);
    skierGroupRef.current = skierGroup;

    // Composite Model B: Cyber Sports Car (Composite 8 parts)
    const carGroup = new THREE.Group();

    // Aerodynamic Chassis
    const carBodyGeo = new THREE.BoxGeometry(3.2, 0.65, 1.6);
    const carBodyMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.85, roughness: 0.2 });
    const carBody = new THREE.Mesh(carBodyGeo, carBodyMat);
    carBody.position.y = 0.65;
    carGroup.add(carBody);

    // Canopy / Windshield
    const canopyGeo = new THREE.BoxGeometry(1.6, 0.55, 1.3);
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(-0.3, 1.15, 0);
    carGroup.add(canopy);

    // Rear Spoiler
    const spoilerGeo = new THREE.BoxGeometry(0.4, 0.08, 1.7);
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.7 });
    const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
    spoiler.position.set(-1.45, 1.25, 0);
    carGroup.add(spoiler);

    // Glowing Headlights
    const lightGeo = new THREE.BoxGeometry(0.1, 0.15, 0.35);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftLight = new THREE.Mesh(lightGeo, lightMat);
    leftLight.position.set(1.6, 0.65, -0.55);
    const rightLight = new THREE.Mesh(lightGeo, lightMat);
    rightLight.position.set(1.6, 0.65, 0.55);
    carGroup.add(leftLight, rightLight);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 });
    const wheelPositions = [
      [1.0, 0.4, 0.85], [1.0, 0.4, -0.85],
      [-1.0, 0.4, 0.85], [-1.0, 0.4, -0.85],
    ];
    const wheelMeshes: THREE.Mesh[] = [];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      carGroup.add(wheel);
      wheelMeshes.push(wheel);
    });
    wheelsRef.current = wheelMeshes;

    carGroup.position.set(-12, 0, 0);
    carGroup.visible = false;
    scene.add(carGroup);
    carGroupRef.current = carGroup;

    // Contact shadows
    const shadow = createContactShadow(2.0, 0.6);
    skierGroup.add(shadow.clone());
    carGroup.add(shadow.clone());

    // Animation Loop
    let clock = new THREE.Clock();
    let frameRef = { id: 0 };
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      const sim = simRef.current;

      if (sim.state === 'running' || sim.state === 'braking') {
        sim.x += sim.speed * dt * 0.8;

        // Wheel spin
        wheelsRef.current.forEach(w => {
          w.rotation.z -= sim.speed * dt * 2.0;
        });

        // Trigger braking after passing line x = 0
        if (sim.x >= 0 && sim.state === 'running') {
          sim.state = 'braking';
          setSimRunState('braking');
          sound.playBounce(0.5); // friction sound
        }

        if (sim.state === 'braking') {
          // Decelerate: a = F_brake / m
          const decel = Math.max(0.5, sim.brakingForce / sim.mass) * 12;
          sim.speed = Math.max(0, sim.speed - decel * dt);

          const currentKE = calculateKE(sim.mass, sim.speed);
          const initialKE = calculateKE(sim.mass, sim.initialSpeed);
          const workDoneSoFar = currentKE - initialKE; // negative work!

          setEnergy({
            ke: currentKE,
            peGrav: 0,
            peElastic: 0,
            workDone: workDoneSoFar,
            totalEnergy: currentKE,
            refHeight: 0,
            mass: sim.mass,
            velocity: sim.speed,
            height: 0,
          });

          if (sim.speed <= 0.02) {
            sim.speed = 0;
            sim.state = 'stopped';
            setSimRunState('stopped');

            // Check if skier challenge solved
            if (activeChallenge === 'skier') {
              setSkierSolved(true);
              sound.playVictory();
              confetti({ particleCount: 50, spread: 60 });
            } else if (activeChallenge === 'car') {
              setCarSolved(true);
              sound.playVictory();
              confetti({ particleCount: 50, spread: 60 });
            }
          }
        }
      }

      // Update mesh positions
      if (skierGroupRef.current) skierGroupRef.current.position.x = sim.x;
      if (carGroupRef.current) carGroupRef.current.position.x = sim.x;

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
      explorer.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [activeChallenge]);

  // Mode switch
  const selectSkierChallenge = () => {
    sound.playClick();
    setActiveChallenge('skier');
    setMass(52.0);
    setSpeed(2.5);
    simRef.current.mode = 'skier';
    simRef.current.brakingForce = 45;
    handleReset(-12, 2.5, 52.0);
    if (skierGroupRef.current) skierGroupRef.current.visible = true;
    if (carGroupRef.current) carGroupRef.current.visible = false;
  };

  const selectCarChallenge = () => {
    sound.playClick();
    setActiveChallenge('car');
    setMass(875.0);
    setSpeed(22.0);
    simRef.current.mode = 'car';
    simRef.current.brakingForce = 350;
    handleReset(-12, 22.0, 875.0);
    if (skierGroupRef.current) skierGroupRef.current.visible = false;
    if (carGroupRef.current) carGroupRef.current.visible = true;
  };

  const selectFreePlay = () => {
    sound.playClick();
    setActiveChallenge('free');
    simRef.current.mode = 'free';
    if (carGroupRef.current) carGroupRef.current.visible = true;
    if (skierGroupRef.current) skierGroupRef.current.visible = false;
  };

  const handleStartRun = () => {
    sound.playRelease();
    simRef.current.state = 'running';
    simRef.current.x = -12;
    simRef.current.speed = speed;
    simRef.current.initialSpeed = speed;
    setSimRunState('running');
  };

  const handleReset = (customX = -12, customSpeed = speed, customMass = mass) => {
    sound.playClick();
    simRef.current.state = 'idle';
    simRef.current.x = customX;
    simRef.current.speed = customSpeed;
    simRef.current.initialSpeed = customSpeed;
    simRef.current.mass = customMass;
    setSimRunState('idle');

    if (skierGroupRef.current) skierGroupRef.current.position.x = customX;
    if (carGroupRef.current) carGroupRef.current.position.x = customX;

    const currentKE = calculateKE(customMass, customSpeed);
    setEnergy({
      ke: currentKE,
      peGrav: 0,
      peElastic: 0,
      workDone: 0,
      totalEnergy: currentKE,
      refHeight: 0,
      mass: customMass,
      velocity: customSpeed,
      height: 0,
    });
  };

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
            setShowComparisonModal(true);
          }}
          className="flex items-center gap-1.5 py-2 px-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-cyan-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition shadow-xl backdrop-blur-md"
        >
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          <span>المقارنة البصرية</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setShowQuiz(true);
          }}
          className="flex items-center gap-1.5 py-2 px-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-xl shadow-cyan-900/40 backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4" />
          <span>اختبار الفهم</span>
        </button>
      </div>

      {/* Side Challenges & Sliders Card on Left */}
      <aside
        aria-label="لوحة تحديات الطاقة الحركية"
        className="fixed top-26 left-3 z-20 w-84 max-w-[88vw] bg-slate-900/95 border border-slate-700 rounded-2xl p-4 shadow-2xl text-xs space-y-3 pointer-events-auto max-h-[calc(100vh-160px)] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>التحديات المطلوبة للمستوى:</span>
          </span>
          <button
            onClick={() => setShowIntro(!showIntro)}
            className="text-slate-400 hover:text-slate-200"
            title="تعليمات"
          >
            <Info className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {showIntro && (
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
            الهدف: دراسة كيف تتغير الطاقة الحركية خطياً مع الكتلة وتربيعياً مع السرعة، وتطبيق نظرية الشغل والطاقة ($W = \Delta KE$) في إيقاف الأجسام وتسريعها.
          </div>
        )}

        {/* Challenge selector tabs */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={selectSkierChallenge}
            className={`p-2 rounded-xl border text-right transition ${
              activeChallenge === 'skier'
                ? 'bg-cyan-950/80 border-cyan-500 text-white font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-cyan-300 text-xs">1. إيقاف المتزلج</span>
              {skierSolved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <span className="text-[10px] text-slate-400 block">m = 52 كغ • v = 2.5 م/ث</span>
          </button>

          <button
            onClick={selectCarChallenge}
            className={`p-2 rounded-xl border text-right transition ${
              activeChallenge === 'car'
                ? 'bg-cyan-950/80 border-cyan-500 text-white font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-cyan-300 text-xs">2. تسريع السيارة</span>
              {carSolved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <span className="text-[10px] text-slate-400 block">m = 875 كغ • 22 → 44 م/ث</span>
          </button>
        </div>

        {/* Challenge specific details banner */}
        {activeChallenge === 'skier' && (
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">الشغل اللازم لإيقاف المتزلج تماماً:</span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-rose-400 font-bold text-sm">W = -162.5 جول</span>
              <span className="text-[11px] text-slate-400">(W = 0 - ½ × 52 × 2.5²)</span>
            </div>
          </div>
        )}

        {activeChallenge === 'car' && (
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">الشغل الصافي لرفع السرعة لـ 44 م/ث:</span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-emerald-400 font-bold text-sm">W = +635.3 ك.جول</span>
              <span className="text-[10px] text-slate-400">(635,250 J)</span>
            </div>
          </div>
        )}

        {/* Sliders */}
        <div className="space-y-2.5 pt-1 border-t border-slate-800">
          <div>
            <div className="flex justify-between font-mono text-slate-300 mb-1">
              <span>الكتلة (m):</span>
              <span className="font-bold text-amber-400">{mass.toFixed(1)} كغ</span>
            </div>
            <input
              type="range"
              min="10"
              max="1200"
              step="5"
              value={mass}
              onChange={(e) => setMass(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-slate-300 mb-1">
              <span>السرعة (v):</span>
              <span className="font-bold text-cyan-400">{speed.toFixed(1)} م/ث</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="50"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Readout calculation card */}
        <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-300 text-xs">
            <span>الطاقة الحركية الحالية (KE):</span>
            <span className="font-mono font-bold text-cyan-400 text-sm">{formatJoules(ke)}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            ½ × {mass} × {speed}² = {ke.toFixed(1)} J
          </div>
        </div>
      </aside>

      {/* Floating Interactive Controls Dock */}
      <div className="fixed bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-md px-4 flex justify-center">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 pointer-events-auto">
          {simRunState === 'idle' ? (
            <button
              onClick={handleStartRun}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs md:text-sm shadow-lg shadow-cyan-950/40 transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>تشغيل تجربة الحركة والكبح</span>
            </button>
          ) : (
            <button
              onClick={() => handleReset()}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs md:text-sm border border-slate-700 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة للموضع الابتدائي</span>
            </button>
          )}
        </div>
      </div>

      {/* Core Feature: Live Energy Bar Chart HUD */}
      <EnergyHUD
        energy={energy}
        maxEnergyScale={Math.max(200, ke * 1.15)}
        showWork={true}
        showElastic={false}
      />

      {/* Comparison Modal */}
      {showComparisonModal && (
        <KineticComparisonModal onClose={() => setShowComparisonModal(false)} />
      )}

      {/* Quiz Modal */}
      {showQuiz && (
        <QuizModal
          levelTitle="حلبة الطاقة الحركية والشغل"
          questions={QUIZ_QUESTIONS}
          onComplete={onCompleteLevel}
          onReplay={() => {
            setShowQuiz(false);
            handleReset();
          }}
          onReturnHub={onReturnHub}
        />
      )}
    </div>
  );
};
