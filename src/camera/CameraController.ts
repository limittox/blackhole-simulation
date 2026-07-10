import type { CameraPreset } from '../state/SimulationStore';

export type CameraVector = readonly [number, number, number];

export interface CameraOrbit {
  yaw: number;
  pitch: number;
  distance: number;
}

export interface CameraPose extends CameraOrbit {
  position: CameraVector;
  forward: CameraVector;
}

export interface FlightInput {
  thrust: number;
  strafe: number;
  lift: number;
}

export interface FlightTelemetry extends FlightInput {
  active: boolean;
  distance: number;
  speed: number;
}

type MutableVector = [number, number, number];

export const CAMERA_PRESETS: Readonly<Record<CameraPreset, Readonly<CameraOrbit>>> = {
  observatory: Object.freeze({ yaw: -0.28, pitch: 0.2, distance: 4.6 }),
  edge: Object.freeze({ yaw: 0.52, pitch: 0.04, distance: 3.75 }),
  polar: Object.freeze({ yaw: -0.08, pitch: 1.08, distance: 4.2 }),
  wide: Object.freeze({ yaw: -0.7, pitch: 0.32, distance: 7.2 }),
  cockpit: Object.freeze({ yaw: 0.14, pitch: 0.1, distance: 3.7 }),
};

const MIN_PITCH = -1.18;
const MAX_PITCH = 1.18;
const MIN_FLIGHT_PITCH = -1.25;
const MAX_FLIGHT_PITCH = 1.25;
export const CAMERA_DISTANCE_LIMITS = Object.freeze({ minimum: 3.55, maximum: 8.5 });
const ORBIT_SPEED = 0.004;
const FLIGHT_LOOK_SPEED = 0.0025;
const ZOOM_SPEED = 0.001;
const FLIGHT_ACCELERATION = 1.45;
const FLIGHT_DRAG = 0.72;
const MAX_FLIGHT_SPEED = 0.92;
const MAX_FLIGHT_STEP = 0.1;
const WORLD_UP: MutableVector = [0, 1, 0];
const ZERO_INPUT: FlightInput = Object.freeze({ thrust: 0, strafe: 0, lift: 0 });

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const length = (vector: CameraVector): number =>
  Math.hypot(vector[0], vector[1], vector[2]);

const scale = (vector: CameraVector, scalar: number): MutableVector => [
  vector[0] * scalar,
  vector[1] * scalar,
  vector[2] * scalar,
];

const add = (left: CameraVector, right: CameraVector): MutableVector => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2],
];

const subtract = (left: CameraVector, right: CameraVector): MutableVector => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
];

const dot = (left: CameraVector, right: CameraVector): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const cross = (left: CameraVector, right: CameraVector): MutableVector => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
];

const normalize = (vector: CameraVector): MutableVector => {
  const magnitude = length(vector);
  if (magnitude < 0.000001) return [0, 0, -1];
  return scale(vector, 1 / magnitude);
};

const copyOrbit = (pose: Readonly<CameraOrbit>): CameraOrbit => ({ ...pose });
const copyVector = (vector: CameraVector): MutableVector => [...vector];

const positionFromOrbit = (pose: Readonly<CameraOrbit>): MutableVector => {
  const cosPitch = Math.cos(pose.pitch);
  return [
    cosPitch * Math.sin(pose.yaw) * pose.distance,
    Math.sin(pose.pitch) * pose.distance,
    cosPitch * Math.cos(pose.yaw) * pose.distance,
  ];
};

const orbitFromPosition = (position: CameraVector): CameraOrbit => {
  const distance = length(position);
  return {
    yaw: Math.atan2(position[0], position[2]),
    pitch: Math.asin(clamp(position[1] / Math.max(distance, 0.000001), -1, 1)),
    distance,
  };
};

const forwardFromAngles = (yaw: number, pitch: number): MutableVector => {
  const cosPitch = Math.cos(pitch);
  return normalize([
    cosPitch * Math.sin(yaw),
    Math.sin(pitch),
    cosPitch * Math.cos(yaw),
  ]);
};

const lookAtOrigin = (position: CameraVector): MutableVector =>
  normalize(scale(position, -1));

const buildOrbitPose = (orbit: Readonly<CameraOrbit>): CameraPose => {
  const position = positionFromOrbit(orbit);
  return { ...orbit, position, forward: lookAtOrigin(position) };
};

export const DEFAULT_CAMERA_POSE: Readonly<CameraPose> = Object.freeze(
  buildOrbitPose(CAMERA_PRESETS.observatory),
);

export class CameraController {
  private readonly reducedMotion: boolean;
  private current = copyOrbit(CAMERA_PRESETS.observatory);
  private target = copyOrbit(CAMERA_PRESETS.observatory);
  private dragging = false;
  private pointerX = 0;
  private pointerY = 0;
  private flightActive = false;
  private flightPosition = copyVector(DEFAULT_CAMERA_POSE.position);
  private flightVelocity: MutableVector = [0, 0, 0];
  private flightYaw = Math.atan2(DEFAULT_CAMERA_POSE.forward[0], DEFAULT_CAMERA_POSE.forward[2]);
  private flightPitch = Math.asin(DEFAULT_CAMERA_POSE.forward[1]);
  private flightInput: FlightInput = { ...ZERO_INPUT };

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

    if (this.flightActive) {
      this.flightYaw -= deltaX * FLIGHT_LOOK_SPEED;
      this.flightPitch = clamp(
        this.flightPitch - deltaY * FLIGHT_LOOK_SPEED,
        MIN_FLIGHT_PITCH,
        MAX_FLIGHT_PITCH,
      );
      return;
    }

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
    if (this.flightActive) {
      const impulse = clamp(-deltaY * 0.0012, -0.38, 0.38);
      this.flightVelocity = add(
        this.flightVelocity,
        scale(forwardFromAngles(this.flightYaw, this.flightPitch), impulse),
      );
      return;
    }

    this.target.distance = clamp(
      this.target.distance * Math.exp(deltaY * ZOOM_SPEED),
      CAMERA_DISTANCE_LIMITS.minimum,
      CAMERA_DISTANCE_LIMITS.maximum,
    );
  }

  setFlightInput(input: Readonly<FlightInput>): void {
    this.flightInput = {
      thrust: clamp(input.thrust, -1, 1),
      strafe: clamp(input.strafe, -1, 1),
      lift: clamp(input.lift, -1, 1),
    };
  }

  selectPreset(preset: CameraPreset): void {
    if (preset === 'cockpit') {
      this.current = copyOrbit(CAMERA_PRESETS.cockpit);
      this.target = copyOrbit(CAMERA_PRESETS.cockpit);
      this.flightPosition = positionFromOrbit(CAMERA_PRESETS.cockpit);
      const forward = lookAtOrigin(this.flightPosition);
      this.flightYaw = Math.atan2(forward[0], forward[2]);
      this.flightPitch = Math.asin(forward[1]);
      this.flightVelocity = [0, 0, 0];
      this.flightInput = { ...ZERO_INPUT };
      this.flightActive = true;
      return;
    }

    if (this.flightActive) this.current = orbitFromPosition(this.flightPosition);
    this.flightActive = false;
    this.flightVelocity = [0, 0, 0];
    this.flightInput = { ...ZERO_INPUT };
    this.target = copyOrbit(CAMERA_PRESETS[preset]);
  }

  reset(): void {
    this.selectPreset('observatory');
  }

  update(deltaSeconds: number, idleSeconds: number): CameraPose {
    if (this.flightActive) {
      this.updateFlight(Math.min(MAX_FLIGHT_STEP, Math.max(0, deltaSeconds)));
      return this.getPose();
    }

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
    if (!this.flightActive) return buildOrbitPose(this.current);
    const orbit = orbitFromPosition(this.flightPosition);
    return {
      ...orbit,
      position: copyVector(this.flightPosition),
      forward: forwardFromAngles(this.flightYaw, this.flightPitch),
    };
  }

  getFlightTelemetry(): FlightTelemetry {
    return {
      active: this.flightActive,
      distance: this.flightActive ? length(this.flightPosition) : this.current.distance,
      speed: this.flightActive ? length(this.flightVelocity) : 0,
      ...this.flightInput,
    };
  }

  private updateFlight(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return;
    const forward = forwardFromAngles(this.flightYaw, this.flightPitch);
    const right = normalize(cross(forward, WORLD_UP));
    let acceleration = add(
      add(scale(forward, this.flightInput.thrust), scale(right, this.flightInput.strafe)),
      scale(WORLD_UP, this.flightInput.lift),
    );
    const accelerationLength = length(acceleration);
    if (accelerationLength > 1) acceleration = scale(acceleration, 1 / accelerationLength);

    this.flightVelocity = add(
      this.flightVelocity,
      scale(acceleration, FLIGHT_ACCELERATION * deltaSeconds),
    );
    this.flightVelocity = scale(
      this.flightVelocity,
      Math.exp(-FLIGHT_DRAG * deltaSeconds),
    );
    const speed = length(this.flightVelocity);
    if (speed > MAX_FLIGHT_SPEED) {
      this.flightVelocity = scale(this.flightVelocity, MAX_FLIGHT_SPEED / speed);
    }

    this.flightPosition = add(
      this.flightPosition,
      scale(this.flightVelocity, deltaSeconds),
    );
    this.enforceFlightBoundary();
    this.current = orbitFromPosition(this.flightPosition);
  }

  private enforceFlightBoundary(): void {
    const distance = length(this.flightPosition);
    const minimum = CAMERA_DISTANCE_LIMITS.minimum;
    const maximum = CAMERA_DISTANCE_LIMITS.maximum;
    if (distance >= minimum && distance <= maximum) return;

    const radial = normalize(this.flightPosition);
    const boundary = distance < minimum ? minimum : maximum;
    this.flightPosition = scale(radial, boundary);
    const radialSpeed = dot(this.flightVelocity, radial);
    const crossesBoundary =
      (distance < minimum && radialSpeed < 0) ||
      (distance > maximum && radialSpeed > 0);
    if (crossesBoundary) {
      this.flightVelocity = subtract(
        this.flightVelocity,
        scale(radial, radialSpeed),
      );
    }
  }
}
