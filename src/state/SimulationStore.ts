export type QualityPreset = 'auto' | 'high' | 'balanced' | 'performance';
export type CameraPreset = 'observatory' | 'edge' | 'polar' | 'wide';

export interface SimulationState {
  mass: number;
  spin: number;
  diskHeat: number;
  lensing: number;
  timeScale: number;
  paused: boolean;
  uiVisible: boolean;
  quality: QualityPreset;
  cameraPreset: CameraPreset;
}

export type SimulationSnapshot = Readonly<SimulationState>;
export type SimulationSubscriber = (snapshot: SimulationSnapshot) => void;

export const DEFAULT_SIMULATION_STATE: SimulationSnapshot = Object.freeze({
  mass: 4.1,
  spin: 0.72,
  diskHeat: 0.58,
  lensing: 1,
  timeScale: 1,
  paused: false,
  uiVisible: true,
  quality: 'auto',
  cameraPreset: 'observatory',
});

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const normalizePatch = (patch: Partial<SimulationState>): Partial<SimulationState> => ({
  ...patch,
  ...(patch.mass === undefined ? {} : { mass: clamp(patch.mass, 0.5, 40) }),
  ...(patch.spin === undefined ? {} : { spin: clamp(patch.spin, 0, 0.99) }),
  ...(patch.diskHeat === undefined ? {} : { diskHeat: clamp(patch.diskHeat, 0, 1) }),
  ...(patch.lensing === undefined ? {} : { lensing: clamp(patch.lensing, 0.65, 1.35) }),
  ...(patch.timeScale === undefined ? {} : { timeScale: clamp(patch.timeScale, 0, 2) }),
});

export class SimulationStore {
  private state: SimulationSnapshot = DEFAULT_SIMULATION_STATE;
  private readonly subscribers = new Set<SimulationSubscriber>();

  getSnapshot(): SimulationSnapshot {
    return this.state;
  }

  patch(patch: Partial<SimulationState>): SimulationSnapshot {
    this.state = Object.freeze({ ...this.state, ...normalizePatch(patch) });
    this.notify();
    return this.state;
  }

  reset(): SimulationSnapshot {
    this.state = Object.freeze({ ...DEFAULT_SIMULATION_STATE });
    this.notify();
    return this.state;
  }

  subscribe(subscriber: SimulationSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.state);
    }
  }
}
