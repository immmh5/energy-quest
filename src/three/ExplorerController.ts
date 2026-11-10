import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createContactShadow } from './common';

export interface ExplorerBounds {
  minY: number;
  maxY: number;
  maxRadius?: number;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
}

export interface ExplorerControllerOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  domElement: HTMLElement;
  initialPos?: THREE.Vector3;
  defaultTarget: THREE.Vector3;
  bounds?: Partial<ExplorerBounds>;
  onModeChange?: (isExplorer: boolean, isFirstPerson: boolean) => void;
}

export class ExplorerController {
  public isExplorerMode = false;
  public isFirstPerson = false;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private domElement: HTMLElement;

  private defaultTarget: THREE.Vector3;
  private bounds: ExplorerBounds;
  private onModeChange?: (isExplorer: boolean, isFirstPerson: boolean) => void;

  public playerPos: THREE.Vector3;
  public velocity = new THREE.Vector3();
  public rotationY = 0;

  public playerMesh: THREE.Group;
  public playerShadow: THREE.Mesh;
  public thrusterLight: THREE.PointLight;

  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false, // Ctrl: Sprint / Turbo speed
  };

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;
  private boundContextMenu: (e: MouseEvent) => void;
  private previousMinDistance = 2.0;

  constructor(options: ExplorerControllerOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.controls = options.controls;
    this.domElement = options.domElement;
    this.defaultTarget = options.defaultTarget.clone();
    this.onModeChange = options.onModeChange;

    this.bounds = {
      minY: options.bounds?.minY ?? 0.8,
      maxY: options.bounds?.maxY ?? 16.0,
      maxRadius: options.bounds?.maxRadius ?? 25.0,
      minX: options.bounds?.minX,
      maxX: options.bounds?.maxX,
      minZ: options.bounds?.minZ,
      maxZ: options.bounds?.maxZ,
    };

    this.playerPos = options.initialPos
      ? options.initialPos.clone()
      : new THREE.Vector3(0, 1.2, 3.5);

    // Build Composite 3D Player Robot Character
    const group = new THREE.Group();

    // Torso / Metallic Chassis
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.7, 12);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.85,
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.55;
    group.add(torso);

    // Head Unit with Visor
    const headGeo = new THREE.SphereGeometry(0.3, 16, 14);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.05;
    group.add(head);

    // Wide Glowing Visor (Faces forward on +Z)
    const visorGeo = new THREE.BoxGeometry(0.38, 0.12, 0.18);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.06, 0.22);
    group.add(visor);

    // Antenna
    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6);
    const antennaMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(0, 1.4, 0);
    group.add(antenna);

    // Magnetic Thruster Ring around waist
    const thrusterRingGeo = new THREE.TorusGeometry(0.48, 0.045, 8, 24);
    const thrusterRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const thrusterRing = new THREE.Mesh(thrusterRingGeo, thrusterRingMat);
    thrusterRing.rotation.x = Math.PI / 2;
    thrusterRing.position.y = 0.22;
    group.add(thrusterRing);

    // Side hovering magnetic pods
    const podGeo = new THREE.CapsuleGeometry(0.12, 0.25, 4, 8);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.3 });
    const leftPod = new THREE.Mesh(podGeo, podMat);
    leftPod.position.set(-0.55, 0.6, 0);
    const rightPod = new THREE.Mesh(podGeo, podMat);
    rightPod.position.set(0.55, 0.6, 0);
    group.add(leftPod, rightPod);

    // Thruster glow point light
    this.thrusterLight = new THREE.PointLight(0x38bdf8, 1.5, 4.0);
    this.thrusterLight.position.set(0, 0.1, 0);
    group.add(this.thrusterLight);

    group.position.copy(this.playerPos);
    group.visible = false; // Hidden initially until user activates Player Mode
    this.scene.add(group);
    this.playerMesh = group;

    // Contact shadow
    this.playerShadow = createContactShadow(0.7, 0.65);
    this.playerShadow.position.set(this.playerPos.x, 0.02, this.playerPos.z);
    this.playerShadow.visible = false;
    this.scene.add(this.playerShadow);

    // Configure OrbitControls: LEFT click is 2D screen-space PAN, RIGHT click is 3D ROTATE
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 0.8;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // Left click moves screen 2D (يمين يسار فوق تحت)
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE, // Right click rotates 3D around player
    };

    // Prevent context menu from popping up on right-click drag
    this.boundContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    this.domElement.addEventListener('contextmenu', this.boundContextMenu);

    // Keyboard event listeners
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!this.isExplorerMode) return;

      const code = e.code || '';
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'Space' || key === ' ' || code.startsWith('Arrow')) {
        e.preventDefault();
      }

      // Forward (W / Up / ص)
      if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'ص' || key === 'arrowup') {
        this.keys.forward = true;
      }
      // Backward (S / Down / س)
      if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'س' || key === 'arrowdown') {
        this.keys.backward = true;
      }
      // Left (A / Left / ش)
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'ش' || key === 'arrowleft') {
        this.keys.left = true;
      }
      // Right (D / Right / ي)
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'ي' || key === 'arrowright') {
        this.keys.right = true;
      }
      // Space: Up
      if (code === 'Space' || key === ' ' || key === 'spacebar') {
        this.keys.up = true;
      }
      // Shift: Down
      if (code === 'ShiftLeft' || code === 'ShiftRight' || e.shiftKey || key === 'shift') {
        this.keys.down = true;
      }
      // Ctrl: Sprint / Turbo
      if (code === 'ControlLeft' || code === 'ControlRight' || e.ctrlKey || key === 'control') {
        this.keys.sprint = true;
      }
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      const code = e.code || '';
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'ص' || key === 'arrowup') {
        this.keys.forward = false;
      }
      if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'س' || key === 'arrowdown') {
        this.keys.backward = false;
      }
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'ش' || key === 'arrowleft') {
        this.keys.left = false;
      }
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'ي' || key === 'arrowright') {
        this.keys.right = false;
      }
      if (code === 'Space' || key === ' ' || key === 'spacebar') {
        this.keys.up = false;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
        this.keys.down = false;
      }
      if (code === 'ControlLeft' || code === 'ControlRight' || key === 'control') {
        this.keys.sprint = false;
      }
    };

    this.boundBlur = () => {
      this.keys.forward = false;
      this.keys.backward = false;
      this.keys.left = false;
      this.keys.right = false;
      this.keys.up = false;
      this.keys.down = false;
      this.keys.sprint = false;
    };

    window.addEventListener('keydown', this.boundKeyDown, { passive: false });
    window.addEventListener('keyup', this.boundKeyUp, { passive: false });
    window.addEventListener('blur', this.boundBlur);
    document.addEventListener('keydown', this.boundKeyDown, { passive: false });
    document.addEventListener('keyup', this.boundKeyUp, { passive: false });
  }

  public setTouchKey(key: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down' | 'sprint', active: boolean) {
    this.keys[key] = active;
  }

  public toggleMode(): boolean {
    this.setExplorerMode(!this.isExplorerMode);
    return this.isExplorerMode;
  }

  public setExplorerMode(enabled: boolean) {
    this.isExplorerMode = enabled;

    if (enabled) {
      this.previousMinDistance = this.controls.minDistance;
      // Allow user to zoom right into first person view (0.1m)
      this.controls.minDistance = 0.1;
      this.playerMesh.visible = true;
      this.playerShadow.visible = true;

      // Position camera nicely behind player if too far
      const targetFocus = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.8, this.playerPos.z);
      this.controls.target.copy(targetFocus);

      // Notify callback
      if (this.onModeChange) {
        this.onModeChange(true, this.isFirstPerson);
      }
    } else {
      // Revert to Experiment apparatus target
      this.controls.minDistance = Math.max(1.5, this.previousMinDistance);
      this.playerMesh.visible = false;
      this.playerShadow.visible = false;
      this.controls.target.copy(this.defaultTarget);
      this.isFirstPerson = false;

      // Reset keys
      this.boundBlur();

      if (this.onModeChange) {
        this.onModeChange(false, false);
      }
    }
  }

  public update(dt: number, elapsed: number) {
    if (!this.isExplorerMode) return;

    const inputF = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    const inputS = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const inputY = (this.keys.up ? 1 : 0) - (this.keys.down ? 1 : 0);
    const isMovingHorizontal = inputF !== 0 || inputS !== 0;
    const isMovingVertical = inputY !== 0;
    const isMoving = isMovingHorizontal || isMovingVertical;

    const targetVel = new THREE.Vector3(0, 0, 0);

    if (isMovingHorizontal) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();

      const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

      const horizDir = new THREE.Vector3()
        .addScaledVector(camDir, inputF)
        .addScaledVector(camRight, inputS)
        .normalize();

      const isSprint = this.keys.sprint;
      const horizSpeed = isSprint ? 19.0 : 8.0; // Fast sprint/turbo when Ctrl is held!
      targetVel.x = horizDir.x * horizSpeed;
      targetVel.z = horizDir.z * horizSpeed;

      const targetAngle = Math.atan2(horizDir.x, horizDir.z);
      let diff = targetAngle - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotationY += diff * Math.min(1, 16 * dt);
    }

    const isSprint = this.keys.sprint;
    if (isMovingVertical) {
      const vertSpeed = isSprint ? 15.0 : 6.0; // Fast flight when Ctrl is held!
      targetVel.y = inputY * vertSpeed;
    }

    // Accelerate / Brake with higher responsiveness when sprinting
    this.velocity.lerp(targetVel, isMoving ? (isSprint ? 20 * dt : 14 * dt) : 16 * dt);

    const deltaPos = this.velocity.clone().multiplyScalar(dt);
    this.playerPos.add(deltaPos);

    // Altitude Clamp
    this.playerPos.y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.playerPos.y));

    // Boundary Clamp (Radius or Box)
    if (this.bounds.maxRadius) {
      const r = Math.hypot(this.playerPos.x, this.playerPos.z);
      if (r > this.bounds.maxRadius) {
        const factor = this.bounds.maxRadius / r;
        this.playerPos.x *= factor;
        this.playerPos.z *= factor;
      }
    }
    if (this.bounds.minX !== undefined) this.playerPos.x = Math.max(this.bounds.minX, this.playerPos.x);
    if (this.bounds.maxX !== undefined) this.playerPos.x = Math.min(this.bounds.maxX, this.playerPos.x);
    if (this.bounds.minZ !== undefined) this.playerPos.z = Math.max(this.bounds.minZ, this.playerPos.z);
    if (this.bounds.maxZ !== undefined) this.playerPos.z = Math.min(this.bounds.maxZ, this.playerPos.z);

    // Move camera and controls.target together to lock viewing angle
    if (deltaPos.lengthSq() > 0.000001) {
      this.camera.position.add(deltaPos);
      this.controls.target.add(deltaPos);
    }

    // Check distance between camera and player head to detect First-Person View (1D)
    const eyeTarget = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.95, this.playerPos.z);
    const camDistToPlayer = this.camera.position.distanceTo(eyeTarget);

    const enteringFirstPerson = camDistToPlayer < 1.35;
    if (enteringFirstPerson !== this.isFirstPerson) {
      this.isFirstPerson = enteringFirstPerson;
      if (this.onModeChange) {
        this.onModeChange(true, this.isFirstPerson);
      }
    }

    // In first person view: hide robot mesh so eyes are unobstructed!
    // In third person view: show robot mesh
    this.playerMesh.visible = !this.isFirstPerson;

    // Update Player Mesh visual effects
    this.playerMesh.position.x = this.playerPos.x;
    this.playerMesh.position.z = this.playerPos.z;
    const bob = Math.sin(elapsed * (isMoving ? 8 : 4)) * (isMoving ? 0.05 : 0.08);
    this.playerMesh.position.y = this.playerPos.y + bob;
    this.playerMesh.rotation.y = this.rotationY;

    // Dynamic forward tilt
    const forwardSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const forwardTilt = Math.min(0.36, (forwardSpeed / 19.0) * (isSprint ? 0.35 : 0.22));
    this.playerMesh.rotation.x = forwardTilt;

    // Thruster glow light intensity
    this.thrusterLight.intensity = isSprint ? 4.5 : (this.keys.up ? 3.0 : (isMoving ? 2.0 : 1.2));

    // Contact shadow
    this.playerShadow.position.x = this.playerPos.x;
    this.playerShadow.position.z = this.playerPos.z;
    const altitude = Math.max(0, this.playerPos.y - this.bounds.minY);
    const shadowScale = Math.max(0.12, 1.0 - altitude * 0.07);
    this.playerShadow.scale.set(shadowScale, shadowScale, shadowScale);
    const shadowMat = this.playerShadow.material as THREE.MeshBasicMaterial;
    shadowMat.opacity = this.isFirstPerson ? 0 : Math.max(0.04, 0.65 - altitude * 0.05);
  }

  public dispose() {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('keyup', this.boundKeyUp);
    this.domElement.removeEventListener('contextmenu', this.boundContextMenu);

    this.scene.remove(this.playerMesh);
    this.scene.remove(this.playerShadow);
  }
}
