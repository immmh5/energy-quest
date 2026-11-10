import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EnergyState, QuizQuestion } from '../../types';
import {
  calculateKE,
  calculatePEgrav,
  calculatePEelastic,
  GRAVITY_G,
  formatJoules,
} from '../../physics/formulas';
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
import { sound } from '../../audio/synth';
import { Home, Sparkles, Crosshair, Play, RotateCcw } from 'lucide-react';
import { ExplorerController } from '../ExplorerController';
import { ExplorerControlBar } from '../../components/ExplorerControlBar';

interface Level4Props {
  onCompleteLevel: (stars: number, score: number) => void;
  onReturnHub: () => void;
}

const SPRING_K = 250; // N/m
const ARROW_MASS = 0.05; // kg (50 grams)

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'عند سحب وتر القوس إلى الخلف لمسافة x، أي شكل من أشكال الطاقة يتم تخزينه في البداية؟',
    options: [
      'طاقة وضع مرونية (Elastic PE = ½ k x²).',
      'طاقة وضع تثاقلية فقط.',
      'طاقة حرارية مباشرة.',
      'شغل حركي متناقص.',
    ],
    correctIndex: 0,
    explanation:
      'يبذل الرامي شغلاً لإزاحة الوتر؛ فيتشوه الوتر وعمود القوس ويختزن طاقة وضع مرونية تتناسب مع مربع الاستطالة x² وثابت المرونة k.',
  },
  {
    id: 2,
    question: 'أثناء انطلاق السهم من الوتر وصعوده لأعلى، ما الترتيب الصحيح لتحولات الطاقة؟',
    options: [
      'طاقة وضع مرونية ← طاقة حركية ← طاقة وضع تثاقلية.',
      'طاقة حركية ← طاقة وضع مرونية ← طاقة حرارية.',
      'طاقة وضع تثاقلية ← طاقة مرونية ← طاقة حركية.',
      'طاقة حرارية ← طاقة حركية ← طاقة وضع مرونية.',
    ],
    correctIndex: 0,
    explanation:
      'عند الإفلات: تتحول PE_e بالكامل إلى KE سريعة للسهم؛ ثم أثناء الصعود الرأسي ضد الجاذبية تتباطأ السرعة وتتحول KE إلى PE_g عند أقصى ارتفاع.',
  },
  {
    id: 3,
    question: 'إذا سحب الرامي الوتر بضعف الإزاحة السابقة (2x)، فكم تتضاعف طاقة الوضع المرونية المختزنة؟',
    options: [
      'تتضاعف 4 مرات (تتناسب مع مربع الإزاحة x²).',
      'تتضاعف مرتين فقط.',
      'تتضاعف 8 مرات.',
      'لا تتغير لأن ثابت الصلابة k ثابت.',
    ],
    correctIndex: 0,
    explanation:
      'PE_e = ½ k x²؛ بما أن x مربعة، فإن (2x)² = 4x²، فتتضاعف الطاقة المرونية 4 أضعاف وتمنح السهم سرعة ابتدائية مضاعفة.',
  },
];

export const Level4ElasticField: React.FC<Level4Props> = ({
  onCompleteLevel,
  onReturnHub,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [drawDistance, setDrawDistance] = useState<number>(0.6); // meters
  const [phase, setPhase] = useState<'drawn' | 'flying' | 'peak' | 'settled'>('drawn');
  const [showQuiz, setShowQuiz] = useState<boolean>(false);

  const initialPeE = calculatePEelastic(SPRING_K, drawDistance);

  const [energy, setEnergy] = useState<EnergyState>({
    ke: 0,
    peGrav: 0,
    peElastic: initialPeE,
    workDone: initialPeE,
    totalEnergy: initialPeE,
    refHeight: 0,
    mass: ARROW_MASS,
    velocity: 0,
    height: 1.5,
  });

  const simRef = useRef({
    phase: 'drawn' as 'drawn' | 'flying' | 'peak' | 'settled',
    y: 1.5,
    vy: 0,
    x: 0,
    draw: drawDistance,
  });

  const arrowMeshRef = useRef<THREE.Group | null>(null);
  const bowStringRef = useRef<THREE.Line | null>(null);

  // Explorer Avatar & 1D Mode States
  const [isExplorerMode, setIsExplorerMode] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const explorerRef = useRef<ExplorerController | null>(null);

  useEffect(() => {
    const peE = calculatePEelastic(SPRING_K, drawDistance);
    simRef.current.draw = drawDistance;
    setEnergy({
      ke: 0,
      peGrav: calculatePEgrav(ARROW_MASS, 1.5, 0),
      peElastic: peE,
      workDone: peE,
      totalEnergy: peE + calculatePEgrav(ARROW_MASS, 1.5, 0),
      refHeight: 0,
      mass: ARROW_MASS,
      velocity: 0,
      height: 1.5,
    });
  }, [drawDistance]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4, 10);

    const renderer = createStandardRenderer(container);
    setupStudioLighting(scene, renderer, 0x110e24);

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
    const defaultTarget = new THREE.Vector3(0, 2, 0);
    controls.target.copy(defaultTarget);

    const explorer = new ExplorerController({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
      defaultTarget,
      initialPos: new THREE.Vector3(0, 1.2, 4.0),
      bounds: { minY: 0.8, maxY: 16.0, maxRadius: 22.0 },
      onModeChange: (isExp, isFP) => {
        setIsExplorerMode(isExp);
        setIsFirstPerson(isFP);
      },
    });
    explorerRef.current = explorer;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Bow model
    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, 1.5, 0);

    // Curved stave
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.6, 0.8, 0),
      new THREE.Vector3(0.1, 0, 0),
      new THREE.Vector3(-0.6, -0.8, 0)
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.03, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.5, roughness: 0.3 });
    const bow = new THREE.Mesh(tubeGeo, tubeMat);
    bowGroup.add(bow);

    scene.add(bowGroup);

    // Arrow (Composite 3 parts)
    const arrowGroup = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2, 8);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.z = Math.PI / 2;
    arrowGroup.add(shaft);

    const headGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.65;
    arrowGroup.add(head);

    arrowGroup.position.set(0, 1.5, 0);
    scene.add(arrowGroup);
    arrowMeshRef.current = arrowGroup;

    let clock = new THREE.Clock();
    let frameRef = { id: 0 };
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      if (simRef.current.phase === 'flying') {
        simRef.current.x += 18 * dt;
        simRef.current.vy -= GRAVITY_G * dt;
        simRef.current.y += simRef.current.vy * dt;

        if (simRef.current.y <= 0) {
          simRef.current.y = 0;
          simRef.current.phase = 'settled';
          setPhase('settled');
        }

        const v = Math.sqrt(18 * 18 + simRef.current.vy * simRef.current.vy);
        const ke = calculateKE(ARROW_MASS, v);
        const peG = calculatePEgrav(ARROW_MASS, simRef.current.y, 0);

        setEnergy({
          ke,
          peGrav: peG,
          peElastic: 0,
          workDone: 0,
          totalEnergy: ke + peG,
          refHeight: 0,
          mass: ARROW_MASS,
          velocity: v,
          height: simRef.current.y,
        });

        if (arrowMeshRef.current) {
          arrowMeshRef.current.position.set(simRef.current.x, simRef.current.y, 0);
          arrowMeshRef.current.rotation.z = Math.atan2(simRef.current.vy, 18);
        }
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
      explorer.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleShoot = () => {
    sound.playRelease();
    sound.playEnergyTransfer(true);
    simRef.current.phase = 'flying';
    simRef.current.x = 0;
    simRef.current.y = 1.5;
    // v0 from elastic energy conversion: 1/2 k x^2 = 1/2 m v^2 -> v = x * sqrt(k/m)
    const v0 = drawDistance * Math.sqrt(SPRING_K / ARROW_MASS) * 0.3;
    simRef.current.vy = v0 * 0.7;
    setPhase('flying');
  };

  const handleReset = () => {
    sound.playClick();
    simRef.current.phase = 'drawn';
    simRef.current.x = 0;
    simRef.current.y = 1.5;
    setPhase('drawn');
    if (arrowMeshRef.current) {
      arrowMeshRef.current.position.set(0, 1.5, 0);
      arrowMeshRef.current.rotation.z = 0;
    }
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
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
            setShowQuiz(true);
          }}
          className="flex items-center gap-2 py-2 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs pointer-events-auto transition shadow-xl shadow-purple-900/40 backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4" />
          <span>بدء الاختبار (3 أسئلة)</span>
        </button>
      </div>

      {/* Side Slider for String Draw on Left */}
      <aside
        aria-label="سحب وتر القوس"
        className="fixed top-26 left-3 z-20 w-80 max-w-[88vw] bg-slate-900/95 border border-slate-700 rounded-2xl p-4 shadow-2xl text-xs space-y-3 pointer-events-auto"
      >
        <span className="font-bold text-slate-200 flex items-center gap-1.5">
          <Crosshair className="w-4 h-4 text-purple-400" />
          <span>سحب وتر القوس (إزاحة التشوه x):</span>
        </span>

        <div>
          <div className="flex justify-between font-mono text-slate-300 mb-1">
            <span>مسافة السحب (x):</span>
            <span className="font-bold text-purple-400 text-sm">{drawDistance.toFixed(2)} م</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.05"
            disabled={phase === 'flying'}
            value={drawDistance}
            onChange={(e) => setDrawDistance(parseFloat(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer disabled:opacity-40"
          />
        </div>

        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-300">
            <span>طاقة الوضع المرونية (PE_e):</span>
            <span className="font-mono font-bold text-amber-400 text-sm">{formatJoules(initialPeE)}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            ½ × {SPRING_K} N/m × {drawDistance}² = {initialPeE.toFixed(1)} J
          </p>
        </div>
      </aside>

      {/* Action Dock */}
      <div className="fixed bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-sm px-4 flex justify-center">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 pointer-events-auto">
          {phase === 'drawn' ? (
            <button
              onClick={handleShoot}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-purple-950/40"
            >
              <Play className="w-4 h-4" />
              <span>إطلاق السهم (تحرير الطاقة)</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة شد القوس</span>
            </button>
          )}
        </div>
      </div>

      <EnergyHUD
        energy={energy}
        maxEnergyScale={60}
        showWork={false}
        showElastic={true}
      />

      {showQuiz && (
        <QuizModal
          levelTitle="ميدان المرونة وتحولات الطاقة"
          questions={QUIZ_QUESTIONS}
          onComplete={onCompleteLevel}
          onReplay={() => setShowQuiz(false)}
          onReturnHub={onReturnHub}
        />
      )}
    </div>
  );
};
