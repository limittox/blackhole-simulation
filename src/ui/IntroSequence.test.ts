import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntroSequence } from './IntroSequence';

afterEach(() => {
  vi.useRealTimers();
});

const createIntro = (reducedMotion = false) => {
  const host = document.createElement('main');
  const loading = document.createElement('div');
  host.append(loading);
  const intro = new IntroSequence(host, loading, reducedMotion);
  return { host, intro, loading };
};

describe('IntroSequence', () => {
  it('reveals stars, scene, and interface on a timed sequence', () => {
    vi.useFakeTimers();
    const { host, intro, loading } = createIntro();

    intro.start();
    expect(host.classList.contains('is-intro')).toBe(true);
    vi.advanceTimersByTime(250);
    expect(host.classList.contains('stars-ready')).toBe(true);
    vi.advanceTimersByTime(650);
    expect(host.classList.contains('scene-ready')).toBe(true);
    vi.advanceTimersByTime(900);

    expect(loading.classList.contains('is-complete')).toBe(true);
    expect(host.classList.contains('is-intro')).toBe(false);
  });

  it('completes on the next turn when reduced motion is active', () => {
    vi.useFakeTimers();
    const { intro, loading } = createIntro(true);

    intro.start();
    vi.advanceTimersByTime(0);

    expect(loading.classList.contains('is-complete')).toBe(true);
  });

  it('skips immediately on user input', () => {
    vi.useFakeTimers();
    const { host, intro, loading } = createIntro();
    intro.start();

    window.dispatchEvent(new PointerEvent('pointerdown'));

    expect(host.classList.contains('scene-ready')).toBe(true);
    expect(loading.classList.contains('is-complete')).toBe(true);
  });

  it('clears pending work when disposed', () => {
    vi.useFakeTimers();
    const { host, intro } = createIntro();
    intro.start();

    intro.dispose();
    vi.runAllTimers();

    expect(host.classList.contains('stars-ready')).toBe(false);
  });
});
