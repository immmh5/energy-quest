import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LevelInfo } from '../types';
import {
  createStandardRenderer,
  setupStudioLighting,
  createAtmosphericSkyDome,
  createContactShadow,
  scheduleNextFrame,
  isSoftwareGl,
} from './common';
import { sound } from '../audio/synth';
import { Play, Star, Footprints, Sliders, ArrowUp, ArrowDown, Zap } from 'lucide-react';

interface HubSceneProps {
  levels: LevelInfo[];
  onSelectLevel: (levelId: number) => void;
}

export const HubScene: React.FC<HubSceneProps> = ({ levels, onSelectLevel }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedPortal, setSelectedPortal] = useState<LevelInfo | null>(levels[0] || null);
  const [nearbyPortalId, setNearbyPortalId] = useState<number | null>(null);
  const nearbyPortalIdRef = useRef<number | null>(null);

  // Camera Sensitivity setting (0.35 = Slow/Smooth, 0.60 = Balanced/Default, 0.90 = Fast)
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [showSensitivityMenu, setShowSensitivityMenu] = useState(false);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Keyboard input states (WASD + Space to raise up + Shift to lower down + Ctrl for Sprint)
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,   // Space: يرفعني للأعلى
    down: false, // Shift: ينزلني للأسفل
    sprint: false, // Ctrl: تيربو وسرعة فائقة
  });

  const playerRef = useRef<{
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotationY: number;
    mesh: THREE.Group | null;
    shadow: THREE.Mesh | null;
    thrusterLight: THREE.PointLight | null;
  }>({
    position: new THREE.Vector3(0, 1.2, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotationY: 0,
    mesh: null,
    shadow: null,
    thrusterLight: null,
  });

  // Enter level helper
  const handleEnterLevel = useCallback(
    (lvlId: number) => {
      sound.playPortalEnter();
      onSelectLevel(lvlId);
    },
    [onSelectLevel]
  );

  // Sync nearbyPortalIdRef
  useEffect(() => {
    nearbyPortalIdRef.current = nearbyPortalId;
  }, [nearbyPortalId]);

  // Update OrbitControls sensitivity live
  useEffect(() => {
    if (!controlsRef.current) return;
    const speedMap = { low: 0.35, medium: 0.60, high: 0.90 };
    controlsRef.current.rotateSpeed = speedMap[sensitivity];
  }, [sensitivity]);

  // Robust Key Listeners: Support English WASD, Arrow keys, Arabic keyboard equivalents (ص, س, ش, ي), Space to ascend, Shift to descend
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const code = e.code || '';
      const key = e.key ? e.key.toLowerCase() : '';

      // Prevent default scrolling for Space and Arrows
      if (code === 'Space' || key === ' ' || code.startsWith('Arrow')) {
        e.preventDefault();
      }

      // Forward (W / Up / ص)
      if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'ص' || key === 'arrowup') {
        keysRef.current.forward = true;
      }
      // Backward (S / Down / س)
      if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'س' || key === 'arrowdown') {
        keysRef.current.backward = true;
      }
      // Left (A / Left / ش)
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'ش' || key === 'arrowleft') {
        keysRef.current.left = true;
      }
      // Right (D / Right / ي)
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'ي' || key === 'arrowright') {
        keysRef.current.right = true;
      }
      // Space: Ascend / Elevate UP (يرفعني)
      if (code === 'Space' || key === ' ' || key === 'spacebar') {
        keysRef.current.up = true;
      }
      // Shift: Descend / Lower DOWN (ينزلني)
      if (code === 'ShiftLeft' || code === 'ShiftRight' || e.shiftKey || key === 'shift') {
        keysRef.current.down = true;
      }
      // Ctrl: Sprint / Turbo Speed
      if (code === 'ControlLeft' || code === 'ControlRight' || e.ctrlKey || key === 'control') {
        keysRef.current.sprint = true;
      }
      // Enter or E to enter portal if nearby
      if (code === 'Enter' || code === 'KeyE' || key === 'e' || key === 'enter') {
        if (nearbyPortalIdRef.current !== null) {
          e.preventDefault();
          handleEnterLevel(nearbyPortalIdRef.current);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code || '';
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'ص' || key === 'arrowup') {
        keysRef.current.forward = false;
      }
      if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'س' || key === 'arrowdown') {
        keysRef.current.backward = false;
      }
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'ش' || key === 'arrowleft') {
        keysRef.current.left = false;
      }
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'ي' || key === 'arrowright') {
        keysRef.current.right = false;
      }
      if (code === 'Space' || key === ' ' || key === 'spacebar') {
        keysRef.current.up = false;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
        keysRef.current.down = false;
      }
      if (code === 'ControlLeft' || code === 'ControlRight' || key === 'control') {
        keysRef.current.sprint = false;
      }
    };

    const handleBlur = () => {
      keysRef.current.forward = false;
      keysRef.current.backward = false;
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.up = false;
      keysRef.current.down = false;
      keysRef.current.sprint = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    window.addEventListener('blur', handleBlur);
    document.addEventListener('keydown', handleKeyDown, { passive: false });
    document.addEventListener('keyup', handleKeyUp, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleEnterLevel]);

  // Touch button helpers for mobile D-pad and flight buttons
  const setTouchKey = (key: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down' | 'sprint', active: boolean) => {
    keysRef.current[key] = active;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Auto-focus container so keyboard works immediately
    container.focus();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    // Camera positioned comfortably behind and above player
    camera.position.set(0, 6.0, 13.0);

    const renderer = createStandardRenderer(container);
    setupStudioLighting(scene, renderer, 0x0c1120);

    // Procedural twilight gradient sky dome
    const skyDome = createAtmosphericSkyDome(90);
    scene.add(skyDome);

    // OrbitControls: Allows full mouse rotation around the player (both left and right click), zoom with wheel, and options click
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = sensitivity === 'low' ? 0.35 : sensitivity === 'high' ? 0.90 : 0.60;
    controls.enablePan = true; // Left click moves screen 2D (يمين يسار فوق تحت)
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.8;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // Left click: 2D Panning
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE, // Right click: 3D Rotation
    };
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera clipping underneath ground
    controls.minDistance = 0.1; // Allow zooming all the way into first-person view (1D)
    controls.maxDistance = 26;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    // Composite Floating Island
    const islandGroup = new THREE.Group();

    // 1. Main grass plateau (radius ~14)
    const topGeo = new THREE.CylinderGeometry(14, 13, 2, 16);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x143224,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.y = 0;
    topMesh.receiveShadow = !isSoftwareGl;
    islandGroup.add(topMesh);

    // 2. Middle rocky layer
    const midGeo = new THREE.CylinderGeometry(13, 10, 4, 10);
    const midMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    const midMesh = new THREE.Mesh(midGeo, midMat);
    midMesh.position.y = -3;
    islandGroup.add(midMesh);

    // 3. Lower crystal spire
    const bottomGeo = new THREE.ConeGeometry(10, 9, 8);
    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.8,
      metalness: 0.3,
      flatShading: true,
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.position.y = -9.5;
    bottomMesh.rotation.x = Math.PI;
    islandGroup.add(bottomMesh);

    // 4. Center Core Pillar & Floating Orb
    const corePillarGeo = new THREE.CylinderGeometry(1.4, 1.8, 3, 8);
    const corePillarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.5,
    });
    const corePillar = new THREE.Mesh(corePillarGeo, corePillarMat);
    corePillar.position.set(0, 1.5, 0);
    islandGroup.add(corePillar);

    const orbGeo = new THREE.IcosahedronGeometry(0.9, 1);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.6,
      roughness: 0.1,
      metalness: 0.8,
    });
    const orbMesh = new THREE.Mesh(orbGeo, orbMat);
    orbMesh.position.set(0, 4.2, 0);
    islandGroup.add(orbMesh);

    const ringGeo = new THREE.TorusGeometry(1.8, 0.07, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    ringMesh.position.set(0, 4.2, 0);
    islandGroup.add(ringMesh);

    // Low poly trees
    const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.2, 5);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const treeFoliageGeo = new THREE.ConeGeometry(1.1, 2.2, 5);
    const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.8, flatShading: true });

    const treePositions = [
      [-6, 1, -4], [-8, 1, 2], [6, 1, -5], [7, 1, 3], [-4, 1, -8], [4, 1, -7],
    ];
    treePositions.forEach(([tx, ty, tz]) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
      trunk.position.y = 0.6;
      const fol = new THREE.Mesh(treeFoliageGeo, treeFoliageMat);
      fol.position.y = 1.9;
      tree.add(trunk, fol);
      tree.position.set(tx, ty, tz);
      tree.scale.setScalar(0.75 + Math.random() * 0.35);
      islandGroup.add(tree);
    });

    scene.add(islandGroup);

    // 5 Distinct Glowing Portal Stations around circumference (radius = 10.5)
    const portalRadius = 10.5;
    const portalGroups: THREE.Group[] = [];
    const portalRings: THREE.Mesh[] = [];
    const portalBeacons: THREE.Mesh[] = [];

    // Canvas texture generator for Arabic floating station signs
    const createSignTexture = (text: string, colorHex: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0f172a';
      ctx.roundRect(10, 10, 492, 108, 20);
      ctx.fill();
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    levels.forEach((lvl, index) => {
      const angle = (index / levels.length) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * portalRadius;
      const pz = Math.sin(angle) * portalRadius;

      // Illuminated cobblestone pathway from center to portal
      const pathGeo = new THREE.PlaneGeometry(1.5, portalRadius);
      const pathMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.8,
        metalness: 0.2,
      });
      const pathMesh = new THREE.Mesh(pathGeo, pathMat);
      pathMesh.rotation.x = -Math.PI / 2;
      pathMesh.rotation.z = -angle + Math.PI / 2;
      pathMesh.position.set(px / 2, 1.02, pz / 2);
      scene.add(pathMesh);

      const portalGroup = new THREE.Group();
      portalGroup.position.set(px, 1.0, pz);
      portalGroup.lookAt(0, 1.0, 0); // Face island center

      // Platform dais
      const daisGeo = new THREE.CylinderGeometry(2.2, 2.5, 0.4, 8);
      const daisMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.6,
        metalness: 0.4,
      });
      const dais = new THREE.Mesh(daisGeo, daisMat);
      dais.position.y = 0.2;
      dais.receiveShadow = !isSoftwareGl;
      portalGroup.add(dais);

      // Side pillars
      const pGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.4, 8);
      const pMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
      const lp = new THREE.Mesh(pGeo, pMat);
      lp.position.set(-1.3, 1.9, 0);
      const rp = new THREE.Mesh(pGeo, pMat);
      rp.position.set(1.3, 1.9, 0);
      portalGroup.add(lp, rp);

      // Cross Arch
      const archGeo = new THREE.BoxGeometry(2.9, 0.35, 0.5);
      const arch = new THREE.Mesh(archGeo, pMat);
      arch.position.set(0, 3.65, 0);
      portalGroup.add(arch);

      // Rotating Energy Ring
      const ringGeo = new THREE.TorusGeometry(1.2, 0.18, 12, 32);
      const ringMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(lvl.portalColor),
        emissive: new THREE.Color(lvl.portalColor),
        emissiveIntensity: 1.2,
        roughness: 0.2,
        metalness: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 2.0, 0);
      portalGroup.add(ring);
      portalRings.push(ring);

      // Energy Membrane
      const discGeo = new THREE.CircleGeometry(1.1, 24);
      const discMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(lvl.portalColor),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.set(0, 2.0, 0);
      portalGroup.add(disc);

      // Floating Arabic Level Title Banner
      const signTex = createSignTexture(`المستوى ${lvl.id}: ${lvl.title}`, lvl.portalColor);
      const signGeo = new THREE.PlaneGeometry(2.6, 0.65);
      const signMat = new THREE.MeshBasicMaterial({
        map: signTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, 4.3, 0);
      portalGroup.add(signMesh);

      // Proximity vertical light beacon ray
      const beaconGeo = new THREE.CylinderGeometry(0.8, 1.2, 10, 16, 1, true);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(lvl.portalColor),
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 5, 0);
      portalGroup.add(beacon);
      portalBeacons.push(beacon);

      // Stars above
      if (lvl.stars > 0) {
        const starGroup = new THREE.Group();
        starGroup.position.set(0, 5.0, 0);
        for (let s = 0; s < lvl.stars; s++) {
          const starGeo = new THREE.OctahedronGeometry(0.2, 0);
          const starMat = new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xd97706,
            emissiveIntensity: 1.2,
          });
          const sm = new THREE.Mesh(starGeo, starMat);
          sm.position.x = (s - (lvl.stars - 1) / 2) * 0.55;
          starGroup.add(sm);
        }
        portalGroup.add(starGroup);
      }

      portalGroup.userData = { levelId: lvl.id, index, pos: new THREE.Vector3(px, 1.0, pz) };
      scene.add(portalGroup);
      portalGroups.push(portalGroup);
    });

    // 3D Player Character Model (High-Tech Energy Explorer Robot)
    const playerGroup = new THREE.Group();
    playerGroup.position.copy(playerRef.current.position);

    // Torso / Metallic Chassis
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.7, 12);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.85,
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.55;
    playerGroup.add(torso);

    // Head Unit with Visor
    const headGeo = new THREE.SphereGeometry(0.3, 16, 14);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.05;
    playerGroup.add(head);

    // Wide Glowing Visor (Faces forward)
    const visorGeo = new THREE.BoxGeometry(0.38, 0.12, 0.18);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.06, 0.22);
    playerGroup.add(visor);

    // Antenna
    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6);
    const antennaMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(0, 1.4, 0);
    playerGroup.add(antenna);

    // Magnetic Thruster Ring around waist
    const thrusterRingGeo = new THREE.TorusGeometry(0.48, 0.045, 8, 24);
    const thrusterRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const thrusterRing = new THREE.Mesh(thrusterRingGeo, thrusterRingMat);
    thrusterRing.rotation.x = Math.PI / 2;
    thrusterRing.position.y = 0.22;
    playerGroup.add(thrusterRing);

    // Side hovering magnetic pods
    const podGeo = new THREE.CapsuleGeometry(0.12, 0.25, 4, 8);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.3 });
    const leftPod = new THREE.Mesh(podGeo, podMat);
    leftPod.position.set(-0.55, 0.6, 0);
    const rightPod = new THREE.Mesh(podGeo, podMat);
    rightPod.position.set(0.55, 0.6, 0);
    playerGroup.add(leftPod, rightPod);

    // Thruster glow point light
    const thrusterLight = new THREE.PointLight(0x38bdf8, 1.5, 4.0);
    thrusterLight.position.set(0, 0.1, 0);
    playerGroup.add(thrusterLight);
    playerRef.current.thrusterLight = thrusterLight;

    scene.add(playerGroup);
    playerRef.current.mesh = playerGroup;

    // Soft Player contact shadow on ground
    const playerShadow = createContactShadow(0.7, 0.65);
    playerShadow.position.set(0, 1.02, 0);
    scene.add(playerShadow);
    playerRef.current.shadow = playerShadow;

    // Atmospheric particles
    const particleCount = isSoftwareGl ? 25 : 65;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePositions[p] = (Math.random() - 0.5) * 28;
      particlePositions[p + 1] = 1 + Math.random() * 10;
      particlePositions[p + 2] = (Math.random() - 0.5) * 28;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.18,
      transparent: true,
      opacity: 0.55,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Click on portal raycasting (Mouse options/portal interaction)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      // Re-focus on click
      window.focus();

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let parent: THREE.Object3D | null = hit.object;
        while (parent && !parent.userData.levelId) {
          parent = parent.parent;
        }
        if (parent && parent.userData.levelId) {
          const lId = parent.userData.levelId;
          const targetLvl = levels.find((l) => l.id === lId);
          if (targetLvl) {
            sound.playClick();
            setSelectedPortal(targetLvl);
          }
          break;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation & Physics Loop
    let clock = new THREE.Clock();
    let frameRef = { id: 0 };
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Center orb idle
      orbMesh.rotation.y += dt * 0.7;
      orbMesh.position.y = 4.2 + Math.sin(elapsed * 1.5) * 0.15;
      ringMesh.rotation.z += dt * 0.9;

      // Portals ring rotation
      portalRings.forEach((r, i) => {
        r.rotation.z = elapsed * (0.8 + i * 0.05);
      });

      // --- SMOOTH & RESPONSIVE 3D FLIGHT / WALKING MOVEMENT ---
      const keys = keysRef.current;
      const inputF = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
      const inputS = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const inputY = (keys.up ? 1 : 0) - (keys.down ? 1 : 0); // Space raises (+Y), Shift lowers (-Y)
      const isMovingHorizontal = inputF !== 0 || inputS !== 0;
      const isMovingVertical = inputY !== 0;
      const isMoving = isMovingHorizontal || isMovingVertical;

      const targetVel = new THREE.Vector3(0, 0, 0);

      if (isMovingHorizontal) {
        // Calculate camera-relative movement direction (Forward is camera view flat projection)
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

        const horizDir = new THREE.Vector3()
          .addScaledVector(camDir, inputF)
          .addScaledVector(camRight, inputS)
          .normalize();

        const isSprint = keys.sprint;
        const horizSpeed = isSprint ? 19.0 : 8.5; // m/s
        targetVel.x = horizDir.x * horizSpeed;
        targetVel.z = horizDir.z * horizSpeed;

        // Smooth rotation to face movement direction
        const targetAngle = Math.atan2(horizDir.x, horizDir.z);
        let diff = targetAngle - playerRef.current.rotationY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        playerRef.current.rotationY += diff * Math.min(1, 16 * dt);
      }

      const isSprint = keys.sprint;
      if (isMovingVertical) {
        const vertSpeed = isSprint ? 15.0 : 6.5; // m/s vertical flight speed (Space rises, Shift lowers)
        targetVel.y = inputY * vertSpeed;
      }

      // Smooth acceleration and braking inertia with higher responsiveness when sprinting
      playerRef.current.velocity.lerp(targetVel, isMoving ? (isSprint ? 20 * dt : 14 * dt) : 16 * dt);

      // Compute actual position delta
      const deltaPos = playerRef.current.velocity.clone().multiplyScalar(dt);
      playerRef.current.position.add(deltaPos);

      // Clamp altitude (y: 1.0 = grass ground level, 16.0 = high aerial flight view)
      playerRef.current.position.y = Math.max(1.0, Math.min(16.0, playerRef.current.position.y));

      // Clamp horizontal radius on island: max 13.0m from center so player stays over the island
      const distFromCenter = Math.hypot(playerRef.current.position.x, playerRef.current.position.z);
      if (distFromCenter > 13.0) {
        const factor = 13.0 / distFromCenter;
        playerRef.current.position.x *= factor;
        playerRef.current.position.z *= factor;
      }

      // Update Player Mesh Position, Hover Bobbing, and Lean
      if (playerRef.current.mesh) {
        playerRef.current.mesh.position.x = playerRef.current.position.x;
        playerRef.current.mesh.position.z = playerRef.current.position.z;
        // Hover bobbing
        const bob = Math.sin(elapsed * (isMoving ? 8 : 4)) * (isMoving ? 0.05 : 0.08);
        playerRef.current.mesh.position.y = playerRef.current.position.y + bob;
        playerRef.current.mesh.rotation.y = playerRef.current.rotationY;

        // Dynamic forward tilt when moving forward/backward
        const forwardSpeed = Math.hypot(playerRef.current.velocity.x, playerRef.current.velocity.z);
        const forwardTilt = Math.min(0.36, (forwardSpeed / 19.0) * (isSprint ? 0.35 : 0.22));
        playerRef.current.mesh.rotation.x = forwardTilt;
      }

      // Update Thruster glow light intensity when ascending or flying
      if (playerRef.current.thrusterLight) {
        playerRef.current.thrusterLight.intensity = isSprint ? 4.5 : (keys.up ? 3.0 : (isMoving ? 2.0 : 1.2));
      }

      // Update Contact Shadow: fade and shrink as player ascends higher
      if (playerRef.current.shadow) {
        playerRef.current.shadow.position.x = playerRef.current.position.x;
        playerRef.current.shadow.position.z = playerRef.current.position.z;
        const altitude = Math.max(0, playerRef.current.position.y - 1.0);
        const shadowScale = Math.max(0.12, 1.0 - altitude * 0.07);
        playerRef.current.shadow.scale.set(shadowScale, shadowScale, shadowScale);
        const shadowMat = playerRef.current.shadow.material as THREE.MeshBasicMaterial;
        shadowMat.opacity = Math.max(0.04, 0.65 - altitude * 0.05);
      }

      // --- CRUCIAL: TRUE THIRD-PERSON & FIRST-PERSON (1D) CAMERA FOLLOW ---
      // Move camera position and controls target along with deltaPos so distance & angle stay locked!
      if (deltaPos.lengthSq() > 0.000001) {
        camera.position.add(deltaPos);
        controls.target.add(deltaPos);
      }

      // Check distance for First-Person View (1D)
      const eyePos = new THREE.Vector3(playerRef.current.position.x, playerRef.current.position.y + 0.95, playerRef.current.position.z);
      const distToPlayer = camera.position.distanceTo(eyePos);
      const isFirstPerson = distToPlayer < 1.35;
      if (playerRef.current.mesh) {
        playerRef.current.mesh.visible = !isFirstPerson;
      }

      // Check proximity to all 5 portals
      let closestPortal: LevelInfo | null = null;
      let minDistance = 999;

      portalGroups.forEach((pg, i) => {
        const portalPos = pg.position;
        // 2D ground distance or 3D proximity
        const d = Math.hypot(
          playerRef.current.position.x - portalPos.x,
          playerRef.current.position.z - portalPos.z
        );

        const beacon = portalBeacons[i];
        if (d < 3.4) {
          // Inside portal proximity zone
          if (beacon) {
            (beacon.material as THREE.MeshBasicMaterial).opacity = Math.min(0.45, (3.4 - d) * 0.4);
          }
          if (d < minDistance) {
            minDistance = d;
            const lId = pg.userData.levelId;
            closestPortal = levels.find((l) => l.id === lId) || null;
          }
        } else {
          if (beacon) {
            (beacon.material as THREE.MeshBasicMaterial).opacity = 0;
          }
        }
      });

      if (closestPortal) {
        setNearbyPortalId((closestPortal as LevelInfo).id);
        setSelectedPortal(closestPortal);
      } else {
        setNearbyPortalId(null);
      }

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
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [levels, sensitivity]);

  return (
    <div
      tabIndex={0}
      className="relative w-full h-full select-none overflow-hidden bg-slate-950 font-['Cairo',sans-serif] outline-none"
      onClick={() => window.focus()}
    >
      {/* 3D Canvas Mounting Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Walking & Flight Controls Hint Banner (Top-Center) */}
      <aside
        aria-label="إرشادات الحركة"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-auto max-w-[95vw]"
      >
        <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md text-xs font-bold text-slate-200 text-center">
          <Footprints className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            تحرك بـ <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono border border-slate-700">W</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono border border-slate-700">S</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono border border-slate-700">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono border border-slate-700">D</kbd> • <kbd className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 font-mono border border-amber-600/60 font-bold">Ctrl</kbd> تيربو وسرعة فائقة ⚡ • <kbd className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono border border-slate-700">Space</kbd> صعود • <kbd className="px-2 py-0.5 rounded bg-slate-800 text-rose-300 font-mono border border-slate-700">Shift</kbd> هبوط • كلك يسار: تحريك الشاشة (2D Pan) • كلك يمين: دوران 3D • قرّب الكاميرا لوجه اللاعب لدخول 1D
          </span>
        </div>
      </aside>

      {/* Sensitivity & Camera Controls Pill (Top-Right) */}
      <div className="fixed top-3 right-3 z-30 pointer-events-auto">
        <div className="relative">
          <button
            onClick={() => setShowSensitivityMenu(!showSensitivityMenu)}
            title="ضبط حساسية الكاميرا والتحكم"
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-xl backdrop-blur-md"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>حساسية الكاميرا: {sensitivity === 'low' ? 'هادئة' : sensitivity === 'high' ? 'سريعة' : 'متوازنة'}</span>
          </button>

          {showSensitivityMenu && (
            <div className="absolute top-11 right-0 w-44 bg-slate-900/95 border border-slate-700 rounded-2xl p-2 shadow-2xl backdrop-blur-md space-y-1 text-xs">
              <span className="text-[10px] text-slate-400 px-2 block font-mono">اختر سرعة دوران الكاميرا:</span>
              {(['low', 'medium', 'high'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    sound.playClick();
                    setSensitivity(s);
                    setShowSensitivityMenu(false);
                  }}
                  className={`w-full text-right px-2.5 py-1.5 rounded-xl font-bold transition flex items-center justify-between ${
                    sensitivity === s
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{s === 'low' ? 'هادئة / ناعمة' : s === 'medium' ? 'متوازنة (افتراضي)' : 'سريعة'}</span>
                  {sensitivity === s && <span className="text-white text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* On-Screen Mobile Touch D-Pad & Flight Controls (Bottom-Left) */}
      <div className="fixed bottom-6 left-6 z-30 flex items-end gap-3 pointer-events-auto md:hidden">
        {/* Directional Pad */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onTouchStart={() => setTouchKey('forward', true)}
            onTouchEnd={() => setTouchKey('forward', false)}
            onMouseDown={() => setTouchKey('forward', true)}
            onMouseUp={() => setTouchKey('forward', false)}
            className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white font-black text-lg active:bg-cyan-600 transition flex items-center justify-center shadow-lg active:scale-95"
          >
            ▲
          </button>
          <div className="flex items-center gap-2">
            <button
              onTouchStart={() => setTouchKey('left', true)}
              onTouchEnd={() => setTouchKey('left', false)}
              onMouseDown={() => setTouchKey('left', true)}
              onMouseUp={() => setTouchKey('left', false)}
              className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white font-black text-lg active:bg-cyan-600 transition flex items-center justify-center shadow-lg active:scale-95"
            >
              ◄
            </button>
            <button
              onTouchStart={() => setTouchKey('backward', true)}
              onTouchEnd={() => setTouchKey('backward', false)}
              onMouseDown={() => setTouchKey('backward', true)}
              onMouseUp={() => setTouchKey('backward', false)}
              className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white font-black text-lg active:bg-cyan-600 transition flex items-center justify-center shadow-lg active:scale-95"
            >
              ▼
            </button>
            <button
              onTouchStart={() => setTouchKey('right', true)}
              onTouchEnd={() => setTouchKey('right', false)}
              onMouseDown={() => setTouchKey('right', true)}
              onMouseUp={() => setTouchKey('right', false)}
              className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white font-black text-lg active:bg-cyan-600 transition flex items-center justify-center shadow-lg active:scale-95"
            >
              ►
            </button>
          </div>
        </div>

        {/* Altitude & Sprint Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onTouchStart={() => setTouchKey('sprint', true)}
            onTouchEnd={() => setTouchKey('sprint', false)}
            onMouseDown={() => setTouchKey('sprint', true)}
            onMouseUp={() => setTouchKey('sprint', false)}
            title="تيربو وسرعة فائقة (Ctrl)"
            className="w-12 h-12 rounded-2xl bg-amber-600/90 border border-amber-500/80 text-white font-black text-xs active:bg-amber-500 transition flex flex-col items-center justify-center shadow-lg active:scale-95"
          >
            <Zap className="w-4 h-4 text-amber-200" />
            <span className="text-[9px] font-mono">تيربو</span>
          </button>
          <button
            onTouchStart={() => setTouchKey('up', true)}
            onTouchEnd={() => setTouchKey('up', false)}
            onMouseDown={() => setTouchKey('up', true)}
            onMouseUp={() => setTouchKey('up', false)}
            title="صعود للأعلى (Space)"
            className="w-12 h-12 rounded-2xl bg-emerald-600/90 border border-emerald-500/80 text-white font-black text-xs active:bg-emerald-500 transition flex flex-col items-center justify-center shadow-lg active:scale-95"
          >
            <ArrowUp className="w-4 h-4" />
            <span className="text-[9px] font-mono">صعود</span>
          </button>
          <button
            onTouchStart={() => setTouchKey('down', true)}
            onTouchEnd={() => setTouchKey('down', false)}
            onMouseDown={() => setTouchKey('down', true)}
            onMouseUp={() => setTouchKey('down', false)}
            title="هبوط للأسفل (Shift)"
            className="w-12 h-12 rounded-2xl bg-rose-600/90 border border-rose-500/80 text-white font-black text-xs active:bg-rose-500 transition flex flex-col items-center justify-center shadow-lg active:scale-95"
          >
            <ArrowDown className="w-4 h-4" />
            <span className="text-[9px] font-mono">هبوط</span>
          </button>
        </div>
      </div>

      {/* Selected Portal Card - Bottom Center */}
      {selectedPortal && (
        <aside
          aria-label="بطاقة البوابة المحددة"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4 pointer-events-none"
        >
          <div className={`bg-slate-900/95 border rounded-2xl p-4 shadow-2xl pointer-events-auto text-slate-100 transition-all ${
            nearbyPortalId === selectedPortal.id
              ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-emerald-950/60'
              : 'border-slate-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-cyan-400 font-bold">
                المستوى {selectedPortal.id} من {levels.length} • {selectedPortal.englishTitle}
              </span>
              {nearbyPortalId === selectedPortal.id && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold animate-pulse">
                  أنت أمام البوابة الآن!
                </span>
              )}
            </div>

            <h2 className="text-lg font-black text-white mb-1">{selectedPortal.title}</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">{selectedPortal.description}</p>

            <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 mb-3 text-xs">
              <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                <span className="text-slate-400 font-sans text-[11px]">القانون:</span>
                <span>{selectedPortal.formula}</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= selectedPortal.stars
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => handleEnterLevel(selectedPortal.id)}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm shadow-xl transition transform active:scale-98 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>
                {nearbyPortalId === selectedPortal.id
                  ? 'دخول المستوى الآن (Space)'
                  : 'دخول هذا المختبر'}
              </span>
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};
