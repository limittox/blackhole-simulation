import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CAMERA_POSE } from '../camera/CameraController';
import { QUALITY_SETTINGS } from '../performance/AdaptiveQuality';
import { DEFAULT_SIMULATION_STATE } from '../state/SimulationStore';
import {
  BlackHoleRenderer,
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
      diskSteps: 56,
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
