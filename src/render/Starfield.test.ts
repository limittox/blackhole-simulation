import { describe, expect, it } from 'vitest';
import { createStarfieldTextureData } from './Starfield';

describe('createStarfieldTextureData', () => {
  it('is deterministic for the same dimensions and seed', () => {
    const first = createStarfieldTextureData(64, 32, 4242);
    const second = createStarfieldTextureData(64, 32, 4242);

    expect(first).toEqual(second);
  });

  it('creates an opaque RGBA texture with bright stars', () => {
    const pixels = createStarfieldTextureData(64, 32, 99);

    expect(pixels).toHaveLength(64 * 32 * 4);
    expect(pixels.some((channel) => channel === 255)).toBe(true);
    for (let offset = 3; offset < pixels.length; offset += 4) {
      expect(pixels[offset]).toBe(255);
    }
  });

  it('changes when the seed changes', () => {
    expect(createStarfieldTextureData(32, 16, 1)).not.toEqual(
      createStarfieldTextureData(32, 16, 2),
    );
  });

  it('rejects invalid dimensions', () => {
    expect(() => createStarfieldTextureData(0, 10, 1)).toThrow('positive integers');
    expect(() => createStarfieldTextureData(10, 4.5, 1)).toThrow('positive integers');
  });
});
