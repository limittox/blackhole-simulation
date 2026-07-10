import { describe, expect, it } from 'vitest';
import { AdaptiveQuality, QUALITY_SETTINGS } from './AdaptiveQuality';

describe('AdaptiveQuality', () => {
  it('starts automatic quality in the balanced profile', () => {
    const quality = new AdaptiveQuality('auto');

    expect(quality.level).toBe('balanced');
    expect(quality.settings).toEqual(QUALITY_SETTINGS.balanced);
  });

  it('downgrades only after a sustained slow window', () => {
    const quality = new AdaptiveQuality('auto');

    for (let index = 0; index < 44; index += 1) quality.sample(24);
    expect(quality.level).toBe('balanced');
    quality.sample(24);

    expect(quality.level).toBe('performance');
  });

  it('uses hysteresis before returning to balanced', () => {
    const quality = new AdaptiveQuality('auto');
    for (let index = 0; index < 45; index += 1) quality.sample(24);

    for (let index = 0; index < 239; index += 1) quality.sample(12);
    expect(quality.level).toBe('performance');
    quality.sample(12);

    expect(quality.level).toBe('balanced');
  });

  it('resets a partial slow window after a healthy frame', () => {
    const quality = new AdaptiveQuality('auto');
    for (let index = 0; index < 44; index += 1) quality.sample(24);
    quality.sample(16);
    quality.sample(24);

    expect(quality.level).toBe('balanced');
  });

  it('never changes a manually selected profile', () => {
    const quality = new AdaptiveQuality('high');
    for (let index = 0; index < 500; index += 1) quality.sample(40);

    expect(quality.level).toBe('high');
    expect(quality.settings).toEqual(QUALITY_SETTINGS.high);
  });

  it('can switch between manual and automatic modes', () => {
    const quality = new AdaptiveQuality('performance');

    quality.setPreset('auto');

    expect(quality.level).toBe('balanced');
  });
});
