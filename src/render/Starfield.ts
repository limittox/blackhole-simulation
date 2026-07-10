const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

export const createStarfieldTextureData = (
  width: number,
  height: number,
  seed = 0x47524156,
): Uint8Array => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Starfield dimensions must be positive integers.');
  }

  const random = mulberry32(seed);
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const vertical = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const horizontal = x / Math.max(1, width - 1);
      const warpedBand = 0.54 + Math.sin(horizontal * Math.PI * 2.8 + 0.7) * 0.055;
      const distanceFromBand = (vertical - warpedBand) / 0.12;
      const galacticBand = Math.exp(-distanceFromBand * distanceFromBand);
      const granularDust = random() * 1.8;
      const offset = (y * width + x) * 4;
      pixels[offset] = clampByte(1.2 + galacticBand * 4.5 + granularDust * 0.35);
      pixels[offset + 1] = clampByte(2.1 + galacticBand * 6.2 + granularDust * 0.5);
      pixels[offset + 2] = clampByte(5.2 + galacticBand * 10.5 + granularDust);
      pixels[offset + 3] = 255;
    }
  }

  const paint = (x: number, y: number, red: number, green: number, blue: number): void => {
    const wrappedX = ((x % width) + width) % width;
    if (y < 0 || y >= height) return;
    const offset = (y * width + wrappedX) * 4;
    pixels[offset] = Math.max(pixels[offset] ?? 0, clampByte(red));
    pixels[offset + 1] = Math.max(pixels[offset + 1] ?? 0, clampByte(green));
    pixels[offset + 2] = Math.max(pixels[offset + 2] ?? 0, clampByte(blue));
  };

  const starCount = Math.max(12, Math.floor(width * height * 0.0018));
  for (let index = 0; index < starCount; index += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const colorRoll = random();
    const brightness = 190 + random() * 65;
    const color =
      colorRoll < 0.2
        ? [brightness * 0.78, brightness * 0.88, brightness]
        : colorRoll > 0.84
          ? [brightness, brightness * 0.79, brightness * 0.58]
          : [brightness, brightness * 0.96, brightness * 0.88];

    paint(x, y, color[0] ?? 255, color[1] ?? 255, color[2] ?? 255);
    if (random() > 0.7) {
      paint(x - 1, y, color[0]! * 0.24, color[1]! * 0.24, color[2]! * 0.28);
      paint(x + 1, y, color[0]! * 0.24, color[1]! * 0.24, color[2]! * 0.28);
      paint(x, y - 1, color[0]! * 0.2, color[1]! * 0.2, color[2]! * 0.24);
      paint(x, y + 1, color[0]! * 0.2, color[1]! * 0.2, color[2]! * 0.24);
    }
  }

  return pixels;
};
