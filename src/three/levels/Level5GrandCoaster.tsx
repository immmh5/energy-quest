import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EnergyState, QuizQuestion } from '../../types';
import {
  calculateKE,
  calculatePEgrav,
  GRAVITY_G,
  formatJoules,
} from '../../physics/formulas';
import {
  createStandardRenderer,
  setupStudioLighting,
  createContactShadow,
  createAtmosphericSkyDome,
  scheduleNextFrame,
  isSoftwareGl,
} from '../common';
import { EnergyHUD } from '../../components/EnergyHUD';
import { QuizModal } from '../../components/QuizModal';
import { sound } from '../../audio/synth';
import { Home, Sparkles, Activity, Play, Pause, RotateCcw, Sliders } from 'lucide-react';
import { ExplorerController } from '../ExplorerController';
import { ExplorerControlBar } from '../../components/ExplorerControlBar';

interface Level5Props {
  onCompleteLevel: (stars: number, score: number) => void;
  onReturnHub: () => void;
}

const CART_MASS = 250; // kg

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'في قطار الملاهي، وبإهمال قوى الاحتكاك ومقاومة الهواء، ما الذي يحدث للطاقة الميكانيكية الكلية (E_tot)؟',
    options: [
      'تظل ثابتة تماماً عند جميع نقاط المسار (قانون حفظ الطاقة الميكانيكية).',
      'تزداد تدريجياً كلما اقترب القطار من الأرض.',
      'تتناقص حتى تتلاشى.',
      'تتحول بالكامل إلى طاقة وضع فقط.',
    ],
    correctIndex: 0,
    explanation:
      'في نظام محافظ بدون احتكاك: الطاقة الكلية E_tot = KE + PE = مقدار ثابت. أي نقصان في طاقة الوضع يقابله زيادة مساوية تماماً في الطاقة الحركية والعكس.',
  },
  {
    id: 2,
    question: 'إذا غيرنا مستوى الإسناد (h₀ = 0) من أسفل المسار إلى أعلى قمة في المسار، فماذا يحدث لحركة القطار الفيزيائية الفعلية؟',
    options: [
      'لا تتغير حركة القطار ولا سرعته على الإطلاق؛ تتغير فقط قراءات طاقة الوضع في الرسم البياني.',
      'يتوقف القطار عن الحركة فوراً.',
      'تتباطأ سرعة القطار بمقدار النصف.',
      'تنقلب حركة القطار للاتجاه المعاكس.',
    ],
    correctIndex: 0,
    explanation:
      'القوى الفيزيائية وحركة الأجسام تعتمد على مشتقة طاقة الوضع والتغيرات النسبية ΔPE فقط وليس على المرجع المطلق h₀. مستوى الإسناد مجرد اصطلاح قياس!',
  },
  {
    id: 3,
    question: 'عند أدنى نقطة في المسار (أكبر سرعة للقطار)، أي من العبارات التالية صحيحة؟',
    options: [
      'الطاقة الحركية تبلغ قيمتها العظمى وطاقة الوضع تبلغ قيمتها الصغرى.',
      'طاقة الوضع تبلغ قيمتها العظمى والطاقة الحركية تساوي صفراً.',
      'الطاقة الميكانيكية الكلية تساوي صفراً.',
      'طاقة الحركة تساوي نصف طاقة الوضع دائماً.',
    ],
    correctIndex: 0,
    explanation:
      'عند أدنى ارتفاع: يتحول أكبر قدر من طاقة الوضع إلى طاقة حركية، فتصل السرعة إلى أقصاها ويكون عمود KE في أعلى ارتفاع له.',
  },
];

export const Level5GrandCoaster: React.FC<Level5Props> = ({
  onCompleteLevel,
  onReturnHub,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [hill1Height, setHill1Height] = useState<number>(8.0); // meters
  const [hill2Height, setHill2Height] = useState<number>(4.5); // meters
  const [refHeight, setRefHeight] = useState<number>(0.0);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);

  // Initial total energy from top of hill 1 starting at low speed v0 = 1.0 m/s
  const initialPe = calculatePEgrav(CART_MASS, hill1Height, refHeight);
  const initialKe = calculateKE(CART_MASS, 1.0);
  const totalMechanicalE = initialPe + initialKe;

  const [energy, setEnergy] = useState<EnergyState>({
    ke: initialKe,
    peGrav: initialPe,
    peElastic: 0,
    workDone: 0,
    totalEnergy: totalMechanicalE,
    refHeight: refHeight,
    mass: CART_MASS,
    velocity: 1.0,
    height: hill1Height,
  });

  const simRef = useRef({
    t: 0, // progress along track 0 to 1
    isPlaying: true,
    hill1: hill1Height,
    hill2: hill2Height,
    refH: refHeight,
  });

  const cartMeshRef = useRef<THREE.Group | null>(null);

  // Explorer Avatar & 1D Mode States
  const [isExplorerMode, setIsExplorerMode] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const explorerRef = useRef<ExplorerController | null>(null);

  useEffect(() => {
    simRef.current.hill1 = hill1Height;
    simRef.current.hill2 = hill2Height;
    simRef.current.refH = refHeight;
  }, [hill1Height, hill2Height, refHeight]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 10, 22);

    const renderer = createStandardRenderer(container);
    setupStudioLighting(scene, renderer, 0x1a0b1e);
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
    const defaultTarget = new THREE.Vector3(0, 4, 0);
    controls.target.copy(defaultTarget);

    const explorer = new ExplorerController({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
      defaultTarget,
      initialPos: new THREE.Vector3(0, 1.2, 8.0),
      bounds: { minY: 0.8, maxY: 24.0, maxRadius: 30.0 },
      onModeChange: (isExp, isFP) => {
        setIsExplorerMode(isExp);
        setIsFirstPerson(isFP);
      },
    });
    explorerRef.current = explorer;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(35, 35);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f142b, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Track spline
    const curvePoints = [
      new THREE.Vector3(-12, 8, 0),
      new THREE.Vector3(-6, 1.5, 0),
      new THREE.Vector3(0, 5, 0),
      new THREE.Vector3(6, 1.0, 0),
      new THREE.Vector3(12, 6, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const trackGeo = new THREE.TubeGeometry(curve, 64, 0.12, 8, false);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0xec4899, metalness: 0.8, roughness: 0.2 });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    scene.add(trackMesh);

    // Support pillars
    curvePoints.forEach((pt) => {
      const pGeo = new THREE.CylinderGeometry(0.08, 0.08, pt.y, 8);
      const pMat = new THREE.MeshStandardMaterial({ color: 0x4a044e, metalness: 0.5 });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(pt.x, pt.y / 2, pt.z);
      scene.add(p);
    });

    // Roller Coaster Cart Model (Composite 4 parts)
    const cartGroup = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(1.4, 0.5, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, metalness: 0.6, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.3;
    cartGroup.add(body);

    const seatGeo = new THREE.BoxGeometry(0.8, 0.4, 0.6);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x881337 });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(-0.1, 0.45, 0);
    cartGroup.add(seat);

    cartGroup.position.copy(curvePoints[0]);
    scene.add(cartGroup);
    cartMeshRef.current = cartGroup;

    let clock = new THREE.Clock();
    let frameRef = { id: 0 };
    let isMounted = true;
    let u = 0; // 0 to 1 along curve

    const tick = () => {
      if (!isMounted) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      if (simRef.current.isPlaying) {
        // Dynamic speed based on height along track (conservation of energy!)
        const currentPt = curve.getPointAt(u);
        const deltaH = Math.max(0.1, 8.5 - currentPt.y);
        const currentV = Math.sqrt(2 * GRAVITY_G * deltaH);

        u += (currentV / 25) * dt;
        if (u > 1) u = 0;

        const pos = curve.getPointAt(u);
        const tangent = curve.getTangentAt(u);

        if (cartMeshRef.current) {
          cartMeshRef.current.position.copy(pos);
          cartMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent);
        }

        const ke = calculateKE(CART_MASS, currentV);
        const pe = calculatePEgrav(CART_MASS, pos.y, simRef.current.refH);
        const total = ke + pe;

        setEnergy({
          ke,
          peGrav: pe,
          peElastic: 0,
          workDone: 0,
          totalEnergy: total,
          refHeight: simRef.current.refH,
          mass: CART_MASS,
          velocity: currentV,
          height: pos.y,
        });
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

  const handleTogglePlay = () => {
    sound.playClick();
    setIsPlaying(!isPlaying);
    simRef.current.isPlaying = !isPlaying;
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
          className="flex items-center gap-2 py-2 px-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs pointer-events-auto transition shadow-xl shadow-pink-900/40 backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4" />
          <span>بدء الاختبار (3 أسئلة)</span>
        </button>
      </div>

      {/* Action Dock */}
      <div className="fixed bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-sm px-4 flex justify-center">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 pointer-events-auto">
          <button
            onClick={handleTogglePlay}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-pink-950/40"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'إيقاف القطار مؤقتاً' : 'متابعة مسار القطار'}</span>
          </button>
        </div>
      </div>

      <EnergyHUD
        energy={energy}
        maxEnergyScale={25000}
        showWork={false}
        showElastic={false}
        referenceHeightLabel="قاعدة المسار (0 م)"
        availableRefHeights={[
          { label: 'أرضية المسار', height: 0.0 },
          { label: 'قمة التل الثاني', height: 4.5 },
          { label: 'أعلى قمة للمسار', height: 8.0 },
        ]}
        onReferenceHeightChange={(nh) => {
          sound.playClick();
          setRefHeight(nh);
        }}
      />

      {showQuiz && (
        <QuizModal
          levelTitle="الأفعوانية الكبرى وحفظ الطاقة"
          questions={QUIZ_QUESTIONS}
          onComplete={onCompleteLevel}
          onReplay={() => setShowQuiz(false)}
          onReturnHub={onReturnHub}
        />
      )}
    </div>
  );
};
