// @ts-expect-error Vitest runs in Node; the production bundle intentionally omits Node typings.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SimulationStore } from '../state/SimulationStore';
import { ScienceDeck } from './ScienceDeck';

const styles = readFileSync('src/styles.css', 'utf8');

const mountDeck = () => {
  const store = new SimulationStore();
  const root = document.createElement('div');
  const deck = new ScienceDeck(store);
  deck.mount(root);
  return { deck, root, store };
};

describe('ScienceDeck', () => {
  it('renders labeled physical controls', () => {
    const { root } = mountDeck();

    expect(root.querySelector('label[for="mass-control"]')).not.toBeNull();
    expect(root.querySelector('label[for="spin-control"]')).not.toBeNull();
    expect(root.querySelector('label[for="heat-control"]')).not.toBeNull();
    expect(root.querySelector('label[for="lensing-control"]')).not.toBeNull();
    expect(root.querySelector('label[for="time-control"]')).not.toBeNull();
  });

  it('starts collapsed on narrow viewports to preserve the simulation view', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(max-width: 900px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    try {
      const { root } = mountDeck();
      expect(root.querySelector('.science-deck')?.classList.contains('is-collapsed')).toBe(true);
      expect(root.querySelector('[data-action="collapse"]')?.getAttribute('aria-expanded')).toBe('false');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('patches the store from a range input', () => {
    const { root, store } = mountDeck();
    const spin = root.querySelector<HTMLInputElement>('#spin-control')!;

    spin.value = '0.91';
    spin.dispatchEvent(new Event('input', { bubbles: true }));

    expect(store.getSnapshot().spin).toBe(0.91);
  });

  it('updates scientific readouts when mass changes', () => {
    const { root, store } = mountDeck();

    store.patch({ mass: 8.2 });

    expect(root.querySelector('[data-readout="mass"]')?.textContent).toContain('8.2');
    expect(root.querySelector('[data-readout="radius"]')?.textContent).toContain('24,218,700');
  });

  it('selects camera presets and exposes their active state', () => {
    const { root, store } = mountDeck();
    const polar = root.querySelector<HTMLButtonElement>('[data-camera-preset="polar"]')!;

    polar.click();

    expect(store.getSnapshot().cameraPreset).toBe('polar');
    expect(polar.getAttribute('aria-pressed')).toBe('true');
  });

  it('selects the flight deck and exposes cockpit state on the root', () => {
    const { root, store } = mountDeck();
    const flightDeck = root.querySelector<HTMLButtonElement>(
      '[data-camera-preset="cockpit"]',
    );

    expect(flightDeck).not.toBeNull();
    expect(flightDeck!.textContent).toContain('Flight deck');
    flightDeck!.click();
    expect(store.getSnapshot().cameraPreset).toBe('cockpit');
    expect(root.classList.contains('is-cockpit')).toBe(true);

    root.querySelector<HTMLButtonElement>(
      '[data-camera-preset="observatory"]',
    )?.click();
    expect(root.classList.contains('is-cockpit')).toBe(false);
  });

  it('renders a persistent decorative cockpit with a hideable HUD', () => {
    const { root, store } = mountDeck();
    const shell = root.querySelector<HTMLElement>('.cockpit-shell');

    expect(shell).not.toBeNull();
    expect(shell!.getAttribute('aria-hidden')).toBe('true');
    expect(shell!.parentElement).toBe(root);
    expect(shell!.nextElementSibling?.classList.contains('interface-layer')).toBe(true);
    expect(shell!.querySelector('.cockpit-canopy')).not.toBeNull();
    expect(shell!.querySelector('.cockpit-console')).not.toBeNull();
    expect(shell!.querySelector('.cockpit-reticle')).not.toBeNull();
    expect(shell!.querySelector('.cockpit-hud')).not.toBeNull();

    store.patch({ cameraPreset: 'cockpit', uiVisible: false });
    expect(root.classList.contains('is-cockpit')).toBe(true);
    expect(root.classList.contains('ui-hidden')).toBe(true);

    expect(styles).toContain('#interface-root.is-cockpit .cockpit-shell');
    expect(styles).toContain('#interface-root.is-cockpit .cockpit-glass');
    expect(styles).toContain('#interface-root.ui-hidden .cockpit-hud');
    expect(styles).toContain('.view-grid [data-camera-preset="cockpit"]');
    expect(styles).toContain('@media (max-width: 900px)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('shows live ship telemetry and pilot controls in flight deck mode', () => {
    const { deck, root } = mountDeck();

    deck.updateFlightTelemetry({
      active: true,
      captured: false,
      horizonCrossed: false,
      horizonProgress: 0,
      distance: 4.26,
      speed: 0.42,
      thrust: 1,
      strafe: -1,
      lift: 0,
    });

    expect(root.querySelector('[data-flight-distance]')?.textContent).toBe('4.26');
    expect(root.querySelector('[data-flight-speed]')?.textContent).toBe('0.42');
    expect(root.querySelector('.flight-guide')?.textContent).toContain('THRUST');
    expect(root.classList.contains('is-thrusting')).toBe(true);
    expect(root.style.getPropertyValue('--cockpit-bank')).toBe('0.8deg');
  });

  it('automatically visualizes gravity capture without a separate mode control', () => {
    const { deck, root } = mountDeck();

    expect(root.querySelector('[data-action="fall"]')).toBeNull();

    deck.updateFlightTelemetry({
      active: true,
      captured: true,
      horizonCrossed: false,
      horizonProgress: 0.58,
      distance: 1.42,
      speed: 1.16,
      thrust: 0,
      strafe: 0,
      lift: 0,
    });

    expect(root.classList.contains('is-captured')).toBe(true);
    expect(root.style.getPropertyValue('--capture-progress')).toBe('0.580');
    expect(root.querySelector('[data-flight-status]')?.textContent).toBe('GRAVITY LOCK');
    expect(styles).toContain('.capture-vignette');
    expect(styles).toContain('#interface-root.is-captured');
  });

  it('updates the quality preset from the native selector', () => {
    const { root, store } = mountDeck();
    const quality = root.querySelector<HTMLSelectElement>('#quality-control')!;

    quality.value = 'performance';
    quality.dispatchEvent(new Event('input', { bubbles: true }));

    expect(store.getSnapshot().quality).toBe('performance');
  });

  it('shows the ray budgets that preserve the far-side lensed disk', () => {
    const { root } = mountDeck();

    expect(root.querySelector('option[value="high"]')?.textContent).toContain('96 STEPS');
    expect(root.querySelector('option[value="balanced"]')?.textContent).toContain('80 STEPS');
    expect(root.querySelector('option[value="performance"]')?.textContent).toContain('64 STEPS');
  });

  it('can reset the simulation and hide the interface', () => {
    const { root, store } = mountDeck();
    store.patch({ spin: 0.95 });

    root.querySelector<HTMLButtonElement>('[data-action="reset"]')!.click();
    expect(store.getSnapshot().spin).toBe(0.72);
    root.querySelector<HTMLButtonElement>('[data-action="hide"]')!.click();
    expect(store.getSnapshot().uiVisible).toBe(false);
    expect(root.classList.contains('ui-hidden')).toBe(true);
  });

  it('notifies the application when a reset should also restore the camera', () => {
    const store = new SimulationStore();
    const root = document.createElement('div');
    const onReset = vi.fn();
    const deck = new ScienceDeck(store, { onReset });
    deck.mount(root);

    root.querySelector<HTMLButtonElement>('[data-action="reset"]')!.click();

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('shows a styled renderer fallback', () => {
    const { deck, root } = mountDeck();

    deck.showFallback('WebGL2 is required to continue.');

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('WebGL2 is required');
  });

  it('removes subscriptions, listeners, and markup on dispose', () => {
    const { deck, root, store } = mountDeck();

    deck.dispose();
    store.patch({ mass: 12 });

    expect(root.childElementCount).toBe(0);
  });
});
