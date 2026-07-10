import { describe, expect, it, vi } from 'vitest';
import { CameraController } from '../camera/CameraController';
import { BlackHoleRenderer, WebGLUnavailableError } from '../render/BlackHoleRenderer';
import { SimulationStore } from '../state/SimulationStore';
import { BlackHoleApp, type FrameScheduler } from './BlackHoleApp';

const createAppHarness = (options: { rendererError?: Error } = {}) => {
  document.body.innerHTML = `
    <main id="app">
      <canvas id="black-hole-canvas"></canvas>
      <div id="interface-root"></div>
      <div id="loading-screen"></div>
    </main>`;
  const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
  const root = document.querySelector<HTMLElement>('#interface-root')!;
  const loadingScreen = document.querySelector<HTMLElement>('#loading-screen')!;
  const store = new SimulationStore();
  const camera = new CameraController(true);
  const renderer = {
    renderFrame: vi.fn(),
    dispose: vi.fn(),
  } as unknown as BlackHoleRenderer;
  let scheduledFrame: FrameRequestCallback | null = null;
  const scheduler: FrameScheduler = {
    request: vi.fn((callback: FrameRequestCallback) => {
      scheduledFrame = callback;
      return 23;
    }),
    cancel: vi.fn(),
  };
  const rendererFactory = vi.fn(() => {
    if (options.rendererError) throw options.rendererError;
    return renderer;
  });
  const app = new BlackHoleApp({
    canvas,
    interfaceRoot: root,
    loadingScreen,
    store,
    camera,
    rendererFactory,
    scheduler,
    reducedMotion: true,
  });
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  };
  const runFrame = (time: number) => {
    const frame = scheduledFrame;
    if (!frame) throw new Error('No animation frame was scheduled.');
    scheduledFrame = null;
    frame(time);
  };
  return { app, camera, renderer, scheduler, root, runFrame, setHidden, store };
};

describe('BlackHoleApp', () => {
  it('maps shortcuts to state and camera presets', () => {
    const harness = createAppHarness();
    harness.app.start();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));

    expect(harness.store.getSnapshot().paused).toBe(true);
    expect(harness.store.getSnapshot().uiVisible).toBe(false);
    expect(harness.store.getSnapshot().cameraPreset).toBe('polar');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));

    expect(harness.store.getSnapshot().cameraPreset).toBe('cockpit');
  });

  it('applies held pilot controls only in flight deck mode', () => {
    const harness = createAppHarness();
    harness.app.start();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    harness.runFrame(1_000);
    expect(harness.camera.getFlightTelemetry().active).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    harness.store.patch({ cameraPreset: 'cockpit' });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    harness.runFrame(1_100);

    expect(harness.camera.getFlightTelemetry().active).toBe(true);
    expect(harness.camera.getFlightTelemetry().speed).toBeGreaterThan(0);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  });

  it('toggles horizon descent from the flight deck with F', () => {
    const harness = createAppHarness();
    harness.app.start();
    harness.store.patch({ cameraPreset: 'cockpit' });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f' }));
    expect(harness.camera.getFlightTelemetry().falling).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f' }));
    expect(harness.camera.getFlightTelemetry().falling).toBe(false);
  });

  it('ignores shortcuts originating from form controls', () => {
    const harness = createAppHarness();
    harness.app.start();
    const input = harness.root.querySelector<HTMLInputElement>('#spin-control')!;

    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));

    expect(harness.store.getSnapshot().paused).toBe(false);
  });

  it('renders scheduled frames with current state', () => {
    const harness = createAppHarness();
    harness.app.start();

    harness.runFrame(1_000);
    harness.runFrame(1_016);

    expect(harness.renderer.renderFrame).toHaveBeenCalled();
    expect(harness.scheduler.request).toHaveBeenCalledTimes(3);
  });

  it('pauses frames while the document is hidden', () => {
    const harness = createAppHarness();
    harness.app.start();

    harness.setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(harness.scheduler.cancel).toHaveBeenCalledTimes(1);
  });

  it('shows a styled fallback when renderer construction fails', () => {
    const harness = createAppHarness({ rendererError: new WebGLUnavailableError() });

    harness.app.start();

    expect(harness.root.textContent).toContain('WebGL2 is required');
    expect(harness.scheduler.request).not.toHaveBeenCalled();
  });

  it('disposes renderer and listeners exactly once', () => {
    const harness = createAppHarness();
    harness.app.start();

    harness.app.dispose();
    harness.app.dispose();

    expect(harness.renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
