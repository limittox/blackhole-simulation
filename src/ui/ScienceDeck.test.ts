import { describe, expect, it, vi } from 'vitest';
import { SimulationStore } from '../state/SimulationStore';
import { ScienceDeck } from './ScienceDeck';

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

  it('updates the quality preset from the native selector', () => {
    const { root, store } = mountDeck();
    const quality = root.querySelector<HTMLSelectElement>('#quality-control')!;

    quality.value = 'performance';
    quality.dispatchEvent(new Event('input', { bubbles: true }));

    expect(store.getSnapshot().quality).toBe('performance');
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
