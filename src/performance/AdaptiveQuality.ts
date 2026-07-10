import type { QualityPreset } from '../state/SimulationStore';

export type RenderQualityLevel = Exclude<QualityPreset, 'auto'>;

export interface QualitySettings {
  pixelRatioCap: number;
  diskSteps: number;
  bloom: boolean;
}

export const QUALITY_SETTINGS: Readonly<Record<RenderQualityLevel, Readonly<QualitySettings>>> = {
  high: Object.freeze({ pixelRatioCap: 1.75, diskSteps: 96, bloom: true }),
  balanced: Object.freeze({ pixelRatioCap: 1.25, diskSteps: 80, bloom: true }),
  performance: Object.freeze({ pixelRatioCap: 0.9, diskSteps: 64, bloom: false }),
};

const downgrade = (level: RenderQualityLevel): RenderQualityLevel => {
  if (level === 'high') return 'balanced';
  return 'performance';
};

const upgrade = (level: RenderQualityLevel): RenderQualityLevel => {
  if (level === 'performance') return 'balanced';
  return 'high';
};

export class AdaptiveQuality {
  private preset: QualityPreset;
  private currentLevel: RenderQualityLevel;
  private slowFrames = 0;
  private fastFrames = 0;

  constructor(preset: QualityPreset) {
    this.preset = preset;
    this.currentLevel = preset === 'auto' ? 'balanced' : preset;
  }

  get level(): RenderQualityLevel {
    return this.currentLevel;
  }

  get settings(): Readonly<QualitySettings> {
    return QUALITY_SETTINGS[this.currentLevel];
  }

  setPreset(preset: QualityPreset): void {
    this.preset = preset;
    this.currentLevel = preset === 'auto' ? 'balanced' : preset;
    this.slowFrames = 0;
    this.fastFrames = 0;
  }

  sample(frameTimeMilliseconds: number): RenderQualityLevel {
    if (this.preset !== 'auto') return this.currentLevel;

    if (frameTimeMilliseconds > 20) {
      this.slowFrames += 1;
      this.fastFrames = 0;
    } else if (frameTimeMilliseconds < 14) {
      this.fastFrames += 1;
      this.slowFrames = 0;
    } else {
      this.slowFrames = 0;
      this.fastFrames = 0;
    }

    if (this.slowFrames >= 45) {
      this.currentLevel = downgrade(this.currentLevel);
      this.slowFrames = 0;
      this.fastFrames = 0;
    } else if (this.fastFrames >= 240) {
      this.currentLevel = upgrade(this.currentLevel);
      this.slowFrames = 0;
      this.fastFrames = 0;
    }

    return this.currentLevel;
  }
}
