import { CameraController, type FlightInput } from '../camera/CameraController';
import { AdaptiveQuality } from '../performance/AdaptiveQuality';
import { BlackHoleRenderer } from '../render/BlackHoleRenderer';
import {
  SimulationStore,
  type CameraPreset,
  type QualityPreset,
  type SimulationSnapshot,
} from '../state/SimulationStore';
import { IntroSequence } from '../ui/IntroSequence';
import { ScienceDeck } from '../ui/ScienceDeck';

export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface BlackHoleAppOptions {
  canvas: HTMLCanvasElement;
  interfaceRoot: HTMLElement;
  loadingScreen: HTMLElement;
  store?: SimulationStore;
  camera?: CameraController;
  rendererFactory?: (canvas: HTMLCanvasElement) => BlackHoleRenderer;
  scheduler?: FrameScheduler;
  reducedMotion?: boolean;
}

const browserScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

const keyboardPresets: Readonly<Record<string, CameraPreset>> = {
  '1': 'observatory',
  '2': 'edge',
  '3': 'polar',
  '4': 'wide',
  '5': 'cockpit',
};

const flightControlCodes = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE']);

const isFormTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, select, button, textarea') || target.isContentEditable;
};

export class BlackHoleApp {
  readonly store: SimulationStore;
  readonly camera: CameraController;

  private readonly canvas: HTMLCanvasElement;
  private readonly interfaceRoot: HTMLElement;
  private readonly loadingScreen: HTMLElement;
  private readonly scheduler: FrameScheduler;
  private readonly rendererFactory: (canvas: HTMLCanvasElement) => BlackHoleRenderer;
  private readonly quality: AdaptiveQuality;
  private readonly scienceDeck: ScienceDeck;
  private readonly intro: IntroSequence;
  private renderer: BlackHoleRenderer | null = null;
  private unsubscribe: (() => void) | null = null;
  private frameHandle: number | null = null;
  private lastFrameTime: number | null = null;
  private lastInteractionTime = 0;
  private simulationTime = 0;
  private running = false;
  private started = false;
  private disposed = false;
  private lastCameraPreset: CameraPreset;
  private lastQualityPreset: QualityPreset;
  private readonly pressedFlightControls = new Set<string>();

  constructor(options: BlackHoleAppOptions) {
    this.canvas = options.canvas;
    this.interfaceRoot = options.interfaceRoot;
    this.loadingScreen = options.loadingScreen;
    this.store = options.store ?? new SimulationStore();
    const reducedMotion =
      options.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.camera = options.camera ?? new CameraController(reducedMotion);
    this.scheduler = options.scheduler ?? browserScheduler;
    this.rendererFactory = options.rendererFactory ?? ((canvas) => new BlackHoleRenderer(canvas));
    const snapshot = this.store.getSnapshot();
    this.lastCameraPreset = snapshot.cameraPreset;
    this.lastQualityPreset = snapshot.quality;
    this.quality = new AdaptiveQuality(snapshot.quality);
    this.scienceDeck = new ScienceDeck(this.store, {
      onReset: () => {
        this.camera.reset();
        this.noteInteraction();
      },
    });
    const host = this.canvas.closest<HTMLElement>('#app') ?? this.canvas.parentElement ?? document.body;
    this.intro = new IntroSequence(host, this.loadingScreen, reducedMotion);
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.scienceDeck.mount(this.interfaceRoot);

    try {
      this.renderer = this.rendererFactory(this.canvas);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The renderer could not be initialized.';
      this.scienceDeck.showFallback(message);
      this.loadingScreen.classList.add('is-complete');
      return;
    }

    this.unsubscribe = this.store.subscribe(this.handleStateChange);
    this.addInteractionListeners();
    this.lastInteractionTime = performance.now();
    this.running = true;
    this.intro.start();
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle !== null) {
      this.scheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.removeInteractionListeners();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.intro.dispose();
    this.scienceDeck.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }

  private scheduleFrame(): void {
    if (!this.running || this.frameHandle !== null) return;
    this.frameHandle = this.scheduler.request(this.handleFrame);
  }

  private readonly handleFrame = (timestamp: number): void => {
    this.frameHandle = null;
    if (!this.running || !this.renderer) return;

    const frameMilliseconds =
      this.lastFrameTime === null ? 16.667 : Math.min(100, Math.max(1, timestamp - this.lastFrameTime));
    this.lastFrameTime = timestamp;
    const deltaSeconds = frameMilliseconds / 1_000;
    const snapshot = this.store.getSnapshot();
    if (!snapshot.paused) this.simulationTime += deltaSeconds * snapshot.timeScale;
    this.quality.sample(frameMilliseconds);
    const idleSeconds = Math.max(0, (timestamp - this.lastInteractionTime) / 1_000);
    const pose = this.camera.update(deltaSeconds, idleSeconds);
    this.scienceDeck.updateFlightTelemetry(this.camera.getFlightTelemetry());
    this.renderer.renderFrame(snapshot, pose, this.simulationTime, this.quality.settings);
    this.scheduleFrame();
  };

  private readonly handleStateChange = (snapshot: SimulationSnapshot): void => {
    if (snapshot.cameraPreset !== this.lastCameraPreset) {
      this.lastCameraPreset = snapshot.cameraPreset;
      this.clearFlightControls();
      this.camera.selectPreset(snapshot.cameraPreset);
    }
    if (snapshot.quality !== this.lastQualityPreset) {
      this.lastQualityPreset = snapshot.quality;
      this.quality.setPreset(snapshot.quality);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isFormTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const preset = keyboardPresets[event.key];
    this.noteInteraction();

    if (
      flightControlCodes.has(event.code) &&
      this.store.getSnapshot().cameraPreset === 'cockpit'
    ) {
      event.preventDefault();
      this.pressedFlightControls.add(event.code);
      this.syncFlightControls();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      this.store.patch({ paused: !this.store.getSnapshot().paused });
    } else if (key === 'h') {
      this.store.patch({ uiVisible: !this.store.getSnapshot().uiVisible });
    } else if (key === 'r') {
      this.store.reset();
      this.camera.reset();
    } else if (preset) {
      this.store.patch({ cameraPreset: preset });
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!flightControlCodes.has(event.code)) return;
    if (!this.pressedFlightControls.delete(event.code)) return;
    event.preventDefault();
    this.syncFlightControls();
    this.noteInteraction();
  };

  private readonly handleWindowBlur = (): void => {
    this.clearFlightControls();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.camera.beginOrbit(event.clientX, event.clientY);
    this.noteInteraction();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.camera.moveOrbit(event.clientX, event.clientY);
    if (event.buttons === 1) this.noteInteraction();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.camera.endOrbit();
    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.noteInteraction();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.camera.zoom(event.deltaY);
    this.noteInteraction();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearFlightControls();
      this.stop();
      return;
    }
    if (!this.started || this.disposed || !this.renderer) return;
    this.lastFrameTime = null;
    this.running = true;
    this.scheduleFrame();
  };

  private noteInteraction(): void {
    this.lastInteractionTime = performance.now();
    this.intro.skip();
  }

  private syncFlightControls(): void {
    const input: FlightInput = {
      thrust:
        Number(this.pressedFlightControls.has('KeyW')) -
        Number(this.pressedFlightControls.has('KeyS')),
      strafe:
        Number(this.pressedFlightControls.has('KeyD')) -
        Number(this.pressedFlightControls.has('KeyA')),
      lift:
        Number(this.pressedFlightControls.has('KeyE')) -
        Number(this.pressedFlightControls.has('KeyQ')),
    };
    this.camera.setFlightInput(input);
  }

  private clearFlightControls(): void {
    this.pressedFlightControls.clear();
    this.camera.setFlightInput({ thrust: 0, strafe: 0, lift: 0 });
  }

  private addInteractionListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private removeInteractionListeners(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
