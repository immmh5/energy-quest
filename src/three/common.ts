import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const isSoftwareGl = (() => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

export function createStandardRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(container.clientWidth, container.clientHeight);

  container.appendChild(renderer.domElement);
  return renderer;
}

export function setupStudioLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer, skyColor = 0x0f1426) {
  // Studio RoomEnvironment for realistic metallic & roughness reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();

  // Sky & Soft Atmospheric Horizon Fog
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.FogExp2(skyColor, 0.012);

  // Warm Golden-Hour Directional Key Light (Sun)
  const keyLight = new THREE.DirectionalLight(0xffe29a, 2.6);
  keyLight.position.set(14, 24, 12);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 55;
    const d = 18;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  // Cool Twilight Hemisphere Fill (Sky / Ground gradient)
  const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e1b4b, 1.3);
  hemiLight.position.set(0, 30, 0);
  scene.add(hemiLight);

  // Golden-Hour Horizon Rim Light (Backlight)
  const rimLight = new THREE.DirectionalLight(0xf472b6, 1.1);
  rimLight.position.set(-16, 12, -16);
  scene.add(rimLight);

  return { keyLight, hemiLight, rimLight };
}

/**
 * Creates an expansive, procedural gradient sky dome with golden hour atmosphere
 */
export function createAtmosphericSkyDome(radius: number = 80): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);

  // Gradient: Zenith (deep cosmic blue) -> Horizon (golden sunset violet/amber) -> Nadir
  const topColor = new THREE.Color(0x090d1a);
  const midColor = new THREE.Color(0x1e1b4b);
  const horizonColor = new THREE.Color(0x311b92);

  const pos = geo.attributes.position;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i) / radius; // -1 to 1
    const color = new THREE.Color();
    if (y > 0) {
      color.lerpColors(horizonColor, topColor, Math.pow(y, 0.6));
    } else {
      color.lerpColors(horizonColor, midColor, Math.min(1, -y * 1.5));
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
  });

  return new THREE.Mesh(geo, mat);
}

/**
 * Creates procedural soft contact shadow circle
 */
export function createContactShadow(radius: number = 1.0, opacity: number = 0.45): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${opacity})`);
  gradient.addColorStop(0.5, `rgba(0, 0, 0, ${opacity * 0.5})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02; // prevent z-fighting
  return mesh;
}

/**
 * Procedural Basketball Texture with distinct orange pebble leather and black ribs
 */
export function createBasketballTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base orange leather
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, 0, 512, 256);

  // Leather pebble noise
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const rad = 0.8 + Math.random() * 1.2;
    ctx.fillStyle = Math.random() > 0.5 ? '#f97316' : '#c2410c';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Black seam lines
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  // Horizontal equator seam
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.stroke();

  // Vertical meridians
  for (let x = 64; x < 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  // Curved basketball signature seams
  ctx.beginPath();
  ctx.bezierCurveTo(128, 40, 256, 40, 384, 128);
  ctx.bezierCurveTo(256, 216, 128, 216, 0, 128);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural grid court texture for realistic measurements
 */
export function createCourtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Hardwood floor planks
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, 512);

  // Meter grid lines
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  const step = 64;
  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Key circles and arcs
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(256, 256, 128, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

/**
 * Paced afterDraw for software GL to prevent frame drops
 */
export function scheduleNextFrame(renderer: THREE.WebGLRenderer, tick: () => void, frameRef: { id: number }) {
  if (isSoftwareGl) {
    try {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : 0;
        if (state === gl.UNSIGNALED) {
          frameRef.id = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameRef.id = window.setTimeout(tick, 70);
        }
      };
      frameRef.id = window.setTimeout(poll, 5);
    } catch {
      frameRef.id = requestAnimationFrame(tick);
    }
  } else {
    frameRef.id = requestAnimationFrame(tick);
  }
}
