import { describe, expect, it } from 'vitest';
import {
  CAMERA_DISTANCE_LIMITS,
  CAMERA_PRESETS,
  CameraController,
  DEFAULT_CAMERA_POSE,
} from './CameraController';

describe('CameraController', () => {
  it('starts at the observatory pose', () => {
    const camera = new CameraController(false);

    expect(camera.getPose()).toEqual(DEFAULT_CAMERA_POSE);
  });

  it('offers a close safe flight-deck pose', () => {
    expect(CAMERA_PRESETS).toHaveProperty('cockpit', {
      yaw: 0.14,
      pitch: 0.1,
      distance: 3.7,
    });
  });

  it('clamps pitch and distance to safe shader ranges', () => {
    const camera = new CameraController(false);
    camera.beginOrbit(0, 0);
    camera.moveOrbit(0, -10_000);
    camera.endOrbit();
    camera.zoom(10_000);
    camera.update(2, 0);

    expect(camera.getPose().pitch).toBeLessThanOrEqual(1.18);
    expect(camera.getPose().distance).toBeLessThanOrEqual(8.5);
  });

  it('moves toward exact named presets', () => {
    const camera = new CameraController(false);

    camera.selectPreset('polar');
    camera.update(10, 0);

    expect(camera.getPose().yaw).toBeCloseTo(CAMERA_PRESETS.polar.yaw, 6);
    expect(camera.getPose().pitch).toBeCloseTo(CAMERA_PRESETS.polar.pitch, 6);
    expect(camera.getPose().distance).toBeCloseTo(CAMERA_PRESETS.polar.distance, 6);
  });

  it('responds to pointer orbit movement with damping', () => {
    const camera = new CameraController(false);
    camera.beginOrbit(100, 100);

    camera.moveOrbit(180, 140);
    camera.endOrbit();
    camera.update(1 / 30, 0);

    expect(camera.getPose().yaw).not.toBe(DEFAULT_CAMERA_POSE.yaw);
    expect(camera.getPose().pitch).not.toBe(DEFAULT_CAMERA_POSE.pitch);
  });

  it('flies the ship through world space with continuous thrust', () => {
    const camera = new CameraController(true);
    camera.selectPreset('cockpit');
    const before = camera.getPose();

    camera.setFlightInput({ thrust: 1, strafe: 0, lift: 0 });
    camera.update(0.5, 0);

    const after = camera.getPose();
    expect(after.position).not.toEqual(before.position);
    expect(after.distance).toBeLessThan(before.distance);
    expect(after.forward).toEqual(before.forward);
    expect(camera.getFlightTelemetry()).toMatchObject({ active: true, thrust: 1 });
    expect(camera.getFlightTelemetry().speed).toBeGreaterThan(0);
  });

  it('steers the ship view without dragging its world position', () => {
    const camera = new CameraController(true);
    camera.selectPreset('cockpit');
    const before = camera.getPose();

    camera.beginOrbit(100, 100);
    camera.moveOrbit(180, 140);
    camera.endOrbit();

    const after = camera.getPose();
    expect(after.position).toEqual(before.position);
    expect(after.forward).not.toEqual(before.forward);
  });

  it('keeps the ship outside the emitting disk during sustained thrust', () => {
    const camera = new CameraController(true);
    camera.selectPreset('cockpit');
    camera.setFlightInput({ thrust: 1, strafe: 0, lift: 0 });

    for (let frame = 0; frame < 240; frame += 1) camera.update(1 / 60, 0);

    expect(camera.getPose().distance).toBeGreaterThanOrEqual(
      CAMERA_DISTANCE_LIMITS.minimum,
    );
  });

  it('falls through the flight boundary and crosses the event horizon', () => {
    const camera = new CameraController(true);
    camera.selectPreset('cockpit');

    expect(camera.beginFallIn()).toBe(true);
    for (let frame = 0; frame < 600; frame += 1) camera.update(1 / 60, 0);

    expect(camera.getPose().distance).toBeLessThan(CAMERA_DISTANCE_LIMITS.minimum);
    expect(camera.getFlightTelemetry()).toMatchObject({
      falling: true,
      horizonCrossed: true,
      horizonProgress: 1,
    });
  });

  it('can abort horizon descent back to the flight-deck pose', () => {
    const camera = new CameraController(true);
    camera.selectPreset('cockpit');
    camera.beginFallIn();
    for (let frame = 0; frame < 60; frame += 1) camera.update(1 / 60, 0);

    expect(camera.abortFallIn()).toBe(true);
    expect(camera.getFlightTelemetry().falling).toBe(false);
    expect(camera.getPose().distance).toBeCloseTo(CAMERA_PRESETS.cockpit.distance, 6);
  });

  it('does not idle-drift when reduced motion is enabled', () => {
    const camera = new CameraController(true);
    const before = camera.getPose();

    camera.update(1, 30);

    expect(camera.getPose()).toEqual(before);
  });

  it('adds a subtle orbit after the idle threshold', () => {
    const camera = new CameraController(false);
    const before = camera.getPose().yaw;

    camera.update(1, 9);

    expect(camera.getPose().yaw).toBeGreaterThan(before);
  });

  it('resets to the observatory target', () => {
    const camera = new CameraController(false);
    camera.selectPreset('edge');
    camera.update(2, 0);

    camera.reset();
    camera.update(10, 0);

    expect(camera.getPose().yaw).toBeCloseTo(DEFAULT_CAMERA_POSE.yaw, 6);
    expect(camera.getPose().pitch).toBeCloseTo(DEFAULT_CAMERA_POSE.pitch, 6);
    expect(camera.getPose().distance).toBeCloseTo(DEFAULT_CAMERA_POSE.distance, 6);
  });
});
