import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SIMULATION_STATE, SimulationStore } from './SimulationStore';

describe('SimulationStore', () => {
  it('starts with the cinematic default state', () => {
    const store = new SimulationStore();

    expect(store.getSnapshot()).toEqual(DEFAULT_SIMULATION_STATE);
  });

  it('clamps physical controls to supported ranges', () => {
    const store = new SimulationStore();

    store.patch({ mass: 100, spin: -2, diskHeat: 4, lensing: 0, timeScale: 8 });

    expect(store.getSnapshot()).toMatchObject({
      mass: 40,
      spin: 0,
      diskHeat: 1,
      lensing: 0.65,
      timeScale: 2,
    });
  });

  it('notifies subscribers once per patch and supports unsubscribe', () => {
    const store = new SimulationStore();
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);

    store.patch({ spin: 0.9, diskHeat: 0.8 });
    unsubscribe();
    store.patch({ spin: 0.4 });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({ spin: 0.9, diskHeat: 0.8 }));
  });

  it('resets all fields atomically', () => {
    const store = new SimulationStore();
    const subscriber = vi.fn();
    store.subscribe(subscriber);
    store.patch({ mass: 12, paused: true, uiVisible: false, cameraPreset: 'polar' });
    subscriber.mockClear();

    store.reset();

    expect(store.getSnapshot()).toEqual(DEFAULT_SIMULATION_STATE);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});
