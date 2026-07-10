import { describe, expect, it, vi } from 'vitest';
import {
  CAMERA_DISTANCE_LIMITS,
  CAMERA_PRESETS,
  DEFAULT_CAMERA_POSE,
} from '../camera/CameraController';
import { QUALITY_SETTINGS } from '../performance/AdaptiveQuality';
import { DEFAULT_SIMULATION_STATE } from '../state/SimulationStore';
import fragmentShader from './shaders/blackHole.frag.glsl?raw';
import {
  BlackHoleRenderer,
  CINEMATIC_RENDER_SETTINGS,
  DISK_MODEL,
  type RendererBackend,
  type UniformFrame,
  WebGLUnavailableError,
} from './BlackHoleRenderer';

const createCanvas = (withWebGL2: boolean): HTMLCanvasElement => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
  const canvas = document.createElement('canvas');
  const context = withWebGL2 ? ({} as WebGL2RenderingContext) : null;
  canvas.getContext = vi.fn(() => context) as unknown as typeof canvas.getContext;
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: 1280 },
    clientHeight: { configurable: true, value: 720 },
  });
  return canvas;
};

const createFakeBackend = (): RendererBackend & { lastFrame?: UniformFrame } => {
  const backend: RendererBackend & { lastFrame?: UniformFrame } = {
    resize: vi.fn(),
    render: vi.fn((frame: UniformFrame) => {
      backend.lastFrame = frame;
    }),
    dispose: vi.fn(),
  };
  return backend;
};

describe('BlackHoleRenderer', () => {
  it('wraps accretion turbulence continuously around the disk azimuth', () => {
    const compactShader = fragmentShader.replace(/\s+/g, ' ');
    const primaryTurbulenceCall = [
      'float turbulence = valueNoisePeriodicX(',
      'vec2(flow * primaryFlowFrequency, radius * 3.9 + time * 0.14),',
      'PRIMARY_NOISE_PERIOD',
      ');',
    ].join(' ');
    const secondaryTurbulenceCall = [
      'turbulence += 0.5 * valueNoisePeriodicX(',
      'vec2(flow * secondaryFlowFrequency - time * 0.27, radius * 8.1),',
      'SECONDARY_NOISE_PERIOD',
      ');',
    ].join(' ');

    expect(fragmentShader).toContain(
      'float valueNoisePeriodicX(vec2 p, float period)',
    );
    expect(fragmentShader).toContain(
      'return mod(value + period * 0.5, period) - period * 0.5;',
    );
    expect(fragmentShader).toContain(
      'float cellX0 = wrapPeriodicCell(cell.x, period);',
    );
    expect(fragmentShader).toContain(
      'float cellX1 = wrapPeriodicCell(cell.x + 1.0, period);',
    );
    expect(fragmentShader).toContain(
      'const float PRIMARY_NOISE_PERIOD = 32.0;',
    );
    expect(fragmentShader).toContain(
      'const float SECONDARY_NOISE_PERIOD = 81.0;',
    );
    expect(fragmentShader).toContain(
      'PRIMARY_NOISE_PERIOD / (TAU * 3.0)',
    );
    expect(fragmentShader).toContain(
      'SECONDARY_NOISE_PERIOD / (TAU * 3.0)',
    );
    expect(compactShader).toContain(primaryTurbulenceCall);
    expect(compactShader).toContain(secondaryTurbulenceCall);
    expect(fragmentShader).not.toContain('valueNoise(vec2(flow * 1.7');
    expect(fragmentShader).not.toContain('valueNoise(vec2(flow * 4.3');
  });

  it('keeps an outbound ray phase for the lensed far-side disk at every quality', () => {
    expect(fragmentShader).toContain('const int MAX_DISK_STEPS = 96;');
    expect(fragmentShader).toContain('bool outbound = false;');
    expect(fragmentShader).toContain('stepSize *= 2.5;');
    expect(QUALITY_SETTINGS.performance.diskSteps).toBeGreaterThanOrEqual(64);
    expect(QUALITY_SETTINGS.balanced.diskSteps).toBeGreaterThanOrEqual(80);
    expect(QUALITY_SETTINGS.high.diskSteps).toBeGreaterThanOrEqual(96);
  });

  it('scales each lensing impulse by the integration step', () => {
    expect(fragmentShader).toContain('integrationStep / (radius * radius)');
  });

  it('separates ship position and heading so pilot steering moves the observer', () => {
    expect(fragmentShader).toContain('uniform vec3 uCameraPosition;');
    expect(fragmentShader).toContain('uniform vec3 uCameraForward;');
    expect(fragmentShader).toContain('cameraRay(vUv, uCameraForward)');
    expect(fragmentShader).not.toContain('cameraRay(vUv, origin, vec3(0.0))');
  });

  it('keeps the observatory outside the emitting disk with restrained bloom', () => {
    for (const preset of Object.values(CAMERA_PRESETS)) {
      expect(preset.distance).toBeGreaterThan(DISK_MODEL.outerRadius + 0.25);
    }
    expect(CAMERA_DISTANCE_LIMITS.minimum).toBeGreaterThan(DISK_MODEL.outerRadius + 0.25);
    expect(CINEMATIC_RENDER_SETTINGS.bloomThreshold).toBeGreaterThanOrEqual(0.55);
    expect(CINEMATIC_RENDER_SETTINGS.bloomStrengthBase).toBeLessThan(1);
  });

  it('reports WebGL2 absence without constructing a backend', () => {
    const factory = vi.fn();

    expect(() => new BlackHoleRenderer(createCanvas(false), factory)).toThrow(
      WebGLUnavailableError,
    );
    expect(factory).not.toHaveBeenCalled();
  });

  it('constructs the backend with the selected canvas and WebGL2 context', () => {
    const canvas = createCanvas(true);
    const backend = createFakeBackend();
    const factory = vi.fn(() => backend);

    new BlackHoleRenderer(canvas, factory);

    expect(factory).toHaveBeenCalledWith(canvas, expect.any(Object));
  });

  it('forwards a complete normalized uniform frame', () => {
    const backend = createFakeBackend();
    const renderer = new BlackHoleRenderer(createCanvas(true), () => backend);

    renderer.renderFrame(
      DEFAULT_SIMULATION_STATE,
      DEFAULT_CAMERA_POSE,
      1.5,
      QUALITY_SETTINGS.balanced,
    );

    expect(backend.lastFrame).toMatchObject({
      resolution: [1600, 900],
      time: 1.5,
      massScale: 1,
      spin: 0.72,
      diskHeat: 0.58,
      lensing: 1,
      camera: DEFAULT_CAMERA_POSE,
      diskSteps: 80,
      bloom: true,
    });
  });

  it('resizes only when canvas size or pixel ratio changes', () => {
    const backend = createFakeBackend();
    const renderer = new BlackHoleRenderer(createCanvas(true), () => backend);

    renderer.renderFrame(
      DEFAULT_SIMULATION_STATE,
      DEFAULT_CAMERA_POSE,
      0,
      QUALITY_SETTINGS.balanced,
    );
    renderer.renderFrame(
      DEFAULT_SIMULATION_STATE,
      DEFAULT_CAMERA_POSE,
      1,
      QUALITY_SETTINGS.balanced,
    );

    expect(backend.resize).toHaveBeenCalledTimes(1);
    expect(backend.resize).toHaveBeenCalledWith(1280, 720, 1.25);
  });

  it('disposes the backend exactly once', () => {
    const backend = createFakeBackend();
    const renderer = new BlackHoleRenderer(createCanvas(true), () => backend);

    renderer.dispose();
    renderer.dispose();

    expect(backend.dispose).toHaveBeenCalledTimes(1);
  });
});
