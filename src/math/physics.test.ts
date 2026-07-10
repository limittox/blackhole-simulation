import { describe, expect, it } from 'vitest';
import { DEFAULT_SIMULATION_STATE } from '../state/SimulationStore';
import { derivePhysics, toShaderParameters } from './physics';

describe('physics helpers', () => {
  it('derives the Schwarzschild radius from millions of solar masses', () => {
    expect(
      derivePhysics({ ...DEFAULT_SIMULATION_STATE, mass: 4.1 }).schwarzschildRadiusKm,
    ).toBeCloseTo(12_109_350, 1);
  });

  it('maps the default controls to stable shader values', () => {
    expect(toShaderParameters(DEFAULT_SIMULATION_STATE)).toEqual({
      massScale: 1,
      spin: 0.72,
      diskHeat: 0.58,
      lensing: 1,
      timeScale: 1,
    });
  });

  it('compresses visual mass into a safe range', () => {
    expect(toShaderParameters({ ...DEFAULT_SIMULATION_STATE, mass: 0.5 }).massScale).toBe(0.45);
    expect(toShaderParameters({ ...DEFAULT_SIMULATION_STATE, mass: 40 }).massScale).toBe(2.2);
  });
});
