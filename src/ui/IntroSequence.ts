export class IntroSequence {
  private timers: number[] = [];
  private active = false;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly loadingScreen: HTMLElement,
    private readonly reducedMotion: boolean,
  ) {}

  start(): void {
    if (this.active || this.disposed) return;
    this.active = true;
    this.host.classList.add('is-intro');
    window.addEventListener('pointerdown', this.handleSkip, { once: true });
    window.addEventListener('keydown', this.handleSkip, { once: true });

    if (this.reducedMotion) {
      this.schedule(() => this.complete(), 0);
      return;
    }

    this.schedule(() => this.host.classList.add('stars-ready'), 250);
    this.schedule(() => this.host.classList.add('scene-ready'), 900);
    this.schedule(() => this.complete(), 1_800);
  }

  skip(): void {
    if (!this.active || this.disposed) return;
    this.host.classList.add('stars-ready', 'scene-ready');
    this.complete();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    this.clearTimers();
    this.removeSkipListeners();
  }

  private complete(): void {
    if (this.disposed) return;
    this.clearTimers();
    this.host.classList.add('stars-ready', 'scene-ready');
    this.host.classList.remove('is-intro');
    this.loadingScreen.classList.add('is-complete');
    this.active = false;
    this.removeSkipListeners();
  }

  private schedule(callback: () => void, delay: number): void {
    this.timers.push(window.setTimeout(callback, delay));
  }

  private clearTimers(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
  }

  private removeSkipListeners(): void {
    window.removeEventListener('pointerdown', this.handleSkip);
    window.removeEventListener('keydown', this.handleSkip);
  }

  private readonly handleSkip = (): void => this.skip();
}
