import { describe, expect, it } from 'vitest';
import {
  CAMERA_PRESETS,
  CameraController,
  DEFAULT_CAMERA_POSE,
} from './CameraController';

describe('CameraController', () => {
  it('starts at the observatory pose', () => {
    const camera = new CameraController(false);

    expect(camera.getPose()).toEqual(DEFAULT_CAMERA_POSE);
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
