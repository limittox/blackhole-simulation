import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { CameraPose } from '../camera/CameraController';
import type { QualitySettings } from '../performance/AdaptiveQuality';
import type { SimulationSnapshot } from '../state/SimulationStore';
import { toShaderParameters } from '../math/physics';
import { createStarfieldTextureData } from './Starfield';
import fragmentShader from './shaders/blackHole.frag.glsl?raw';
import vertexShader from './shaders/fullscreen.vert.glsl?raw';

export class WebGLUnavailableError extends Error {
  constructor() {
    super('WebGL2 is required to render the black hole simulation.');
    this.name = 'WebGLUnavailableError';
  }
}

export interface UniformFrame {
  resolution: readonly [number, number];
  time: number;
  massScale: number;
  spin: number;
  diskHeat: number;
  lensing: number;
  camera: Readonly<CameraPose>;
  diskSteps: number;
  bloom: boolean;
}

export interface RendererBackend {
  resize(width: number, height: number, pixelRatio: number): void;
  render(frame: UniformFrame): void;
  dispose(): void;
}

export type RendererBackendFactory = (
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
) => RendererBackend;

interface ShaderUniforms {
  [uniform: string]: THREE.IUniform;
  uResolution: { value: THREE.Vector2 };
  uTime: { value: number };
  uMassScale: { value: number };
  uSpin: { value: number };
  uDiskHeat: { value: number };
  uLensing: { value: number };
  uCamera: { value: THREE.Vector3 };
  uDiskSteps: { value: number };
  uStarfield: { value: THREE.Texture };
}

class ThreeRendererBackend implements RendererBackend {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.RawShaderMaterial;
  private readonly starfield: THREE.DataTexture;
  private readonly uniforms: ShaderUniforms;
  private contextLost = false;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    context: WebGL2RenderingContext,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.starfield = new THREE.DataTexture(
      createStarfieldTextureData(1024, 512),
      1024,
      512,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    this.starfield.wrapS = THREE.RepeatWrapping;
    this.starfield.wrapT = THREE.ClampToEdgeWrapping;
    this.starfield.minFilter = THREE.LinearFilter;
    this.starfield.magFilter = THREE.LinearFilter;
    this.starfield.colorSpace = THREE.SRGBColorSpace;
    this.starfield.needsUpdate = true;

    this.uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMassScale: { value: 1 },
      uSpin: { value: 0.72 },
      uDiskHeat: { value: 0.58 },
      uLensing: { value: 1 },
      uCamera: { value: new THREE.Vector3(-0.28, 0.2, 4.6) },
      uDiskSteps: { value: 56 },
      uStarfield: { value: this.starfield },
    };

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const screenTriangle = new THREE.Mesh(this.geometry, this.material);
    screenTriangle.frustumCulled = false;
    scene.add(screenTriangle);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.35, 0.62, 0.12);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(frame: UniformFrame): void {
    if (this.contextLost || this.disposed) return;
    this.uniforms.uResolution.value.set(frame.resolution[0], frame.resolution[1]);
    this.uniforms.uTime.value = frame.time;
    this.uniforms.uMassScale.value = frame.massScale;
    this.uniforms.uSpin.value = frame.spin;
    this.uniforms.uDiskHeat.value = frame.diskHeat;
    this.uniforms.uLensing.value = frame.lensing;
    this.uniforms.uCamera.value.set(frame.camera.yaw, frame.camera.pitch, frame.camera.distance);
    this.uniforms.uDiskSteps.value = frame.diskSteps;
    this.bloomPass.enabled = frame.bloom;
    this.bloomPass.strength = 1.05 + frame.diskHeat * 0.95;
    this.bloomPass.radius = 0.54 + frame.diskHeat * 0.16;
    this.composer.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.geometry.dispose();
    this.material.dispose();
    this.starfield.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
  };
}

const createThreeBackend: RendererBackendFactory = (canvas, context) =>
  new ThreeRendererBackend(canvas, context);

export class BlackHoleRenderer {
  private readonly backend: RendererBackend;
  private disposed = false;
  private width = 0;
  private height = 0;
  private pixelRatio = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    backendFactory: RendererBackendFactory = createThreeBackend,
  ) {
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!context) throw new WebGLUnavailableError();
    this.backend = backendFactory(canvas, context);
  }

  renderFrame(
    state: SimulationSnapshot,
    camera: Readonly<CameraPose>,
    time: number,
    quality: Readonly<QualitySettings>,
  ): void {
    if (this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width || 1);
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height || 1);
    const devicePixelRatio = window.devicePixelRatio || 1;
    const pixelRatio = Math.min(devicePixelRatio, quality.pixelRatioCap);

    if (width !== this.width || height !== this.height || pixelRatio !== this.pixelRatio) {
      this.width = width;
      this.height = height;
      this.pixelRatio = pixelRatio;
      this.backend.resize(width, height, pixelRatio);
    }

    const shader = toShaderParameters(state);
    this.backend.render({
      resolution: [Math.round(width * pixelRatio), Math.round(height * pixelRatio)],
      time,
      massScale: shader.massScale,
      spin: shader.spin,
      diskHeat: shader.diskHeat,
      lensing: shader.lensing,
      camera: { ...camera },
      diskSteps: quality.diskSteps,
      bloom: quality.bloom,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.backend.dispose();
  }
}
