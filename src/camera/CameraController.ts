import type { CameraPreset } from '../state/SimulationStore';

export interface CameraPose {
  yaw: number;
  pitch: number;
  distance: number;
}

export const CAMERA_PRESETS: Readonly<Record<CameraPreset, Readonly<CameraPose>>> = {
  observatory: Object.freeze({ yaw: -0.28, pitch: 0.2, distance: 4.6 }),
  edge: Object.freeze({ yaw: 0.52, pitch: 0.04, distance: 3.15 }),
  polar: Object.freeze({ yaw: -0.08, pitch: 1.08, distance: 4.2 }),
  wide: Object.freeze({ yaw: -0.7, pitch: 0.32, distance: 7.2 }),
};

export const DEFAULT_CAMERA_POSE = CAMERA_PRESETS.observatory;

const MIN_PITCH = -1.18;
const MAX_PITCH = 1.18;
const MIN_DISTANCE = 2.65;
const MAX_DISTANCE = 8.5;
const ORBIT_SPEED = 0.004;
const ZOOM_SPEED = 0.001;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const copyPose = (pose: Readonly<CameraPose>): CameraPose => ({ ...pose });

export class CameraController {
  private readonly reducedMotion: boolean;
  private current = copyPose(DEFAULT_CAMERA_POSE);
  private target = copyPose(DEFAULT_CAMERA_POSE);
  private dragging = false;
  private pointerX = 0;
  private pointerY = 0;

  constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
  }

  beginOrbit(x: number, y: number): void {
    this.dragging = true;
    this.pointerX = x;
    this.pointerY = y;
  }

  moveOrbit(x: number, y: number): void {
    if (!this.dragging) return;

    const deltaX = x - this.pointerX;
    const deltaY = y - this.pointerY;
    this.pointerX = x;
    this.pointerY = y;
    this.target.yaw -= deltaX * ORBIT_SPEED;
    this.target.pitch = clamp(
      this.target.pitch - deltaY * ORBIT_SPEED,
      MIN_PITCH,
      MAX_PITCH,
    );
  }

  endOrbit(): void {
    this.dragging = false;
  }

  zoom(deltaY: number): void {
    this.target.distance = clamp(
      this.target.distance * Math.exp(deltaY * ZOOM_SPEED),
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
  }

  selectPreset(preset: CameraPreset): void {
    this.target = copyPose(CAMERA_PRESETS[preset]);
  }

  reset(): void {
    this.selectPreset('observatory');
  }

  update(deltaSeconds: number, idleSeconds: number): CameraPose {
    if (!this.reducedMotion && !this.dragging && idleSeconds > 8) {
      this.target.yaw += 0.018 * deltaSeconds;
    }

    const damping = 1 - Math.exp(-8 * Math.max(0, deltaSeconds));
    this.current.yaw += (this.target.yaw - this.current.yaw) * damping;
    this.current.pitch += (this.target.pitch - this.current.pitch) * damping;
    this.current.distance += (this.target.distance - this.current.distance) * damping;

    return this.getPose();
  }

  getPose(): CameraPose {
    return copyPose(this.current);
  }
}
