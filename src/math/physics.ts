import type { SimulationSnapshot } from '../state/SimulationStore';

const SCHWARZSCHILD_KM_PER_SOLAR_MASS = 2.9535;
const DEFAULT_MASS_MILLIONS = 4.1;

export interface DerivedPhysics {
  massSolar: number;
  schwarzschildRadiusKm: number;
  eventHorizonDiameterKm: number;
}

export interface ShaderParameters {
  massScale: number;
  spin: number;
  diskHeat: number;
  lensing: number;
  timeScale: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const derivePhysics = (state: SimulationSnapshot): DerivedPhysics => {
  const massSolar = state.mass * 1_000_000;
  const schwarzschildRadiusKm = SCHWARZSCHILD_KM_PER_SOLAR_MASS * massSolar;

  return {
    massSolar,
    schwarzschildRadiusKm,
    eventHorizonDiameterKm: schwarzschildRadiusKm * 2,
  };
};

export const toShaderParameters = (state: SimulationSnapshot): ShaderParameters => ({
  massScale: clamp(state.mass / DEFAULT_MASS_MILLIONS, 0.45, 2.2),
  spin: state.spin,
  diskHeat: state.diskHeat,
  lensing: state.lensing,
  timeScale: state.timeScale,
});
