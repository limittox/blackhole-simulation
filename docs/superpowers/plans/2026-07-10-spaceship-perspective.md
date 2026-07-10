# Spaceship Perspective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an immersive, selectable first-person spaceship flight-deck view without changing the black-hole renderer or removing existing viewpoints.

**Architecture:** Extend the existing camera-preset state path with `cockpit`, then let `ScienceDeck` derive an `is-cockpit` root class from that state. A separate `aria-hidden`, pointer-transparent cockpit shell provides the physical canopy, console, reflections, reticle, and HUD through HTML/CSS while the existing science controls remain usable above it.

**Tech Stack:** TypeScript, Vitest, HTML templates, CSS, Vite

## Global Constraints

- Preserve all four existing camera presets and reset to `observatory`.
- The new preset key is exactly `cockpit`, the UI label is `Flight deck`, and the shortcut is `5`.
- Use the safe pose `{ yaw: 0.14, pitch: 0.1, distance: 3.7 }`.
- The cockpit is decorative, `aria-hidden`, pointer-transparent, and adds no renderer passes, assets, or dependencies.
- Hiding UI keeps the physical cockpit frame visible but fades cockpit HUD text.
- Narrow layouts preserve the event horizon and the bottom science deck.
- Existing reduced-motion behavior disables cockpit animation.

---

### Task 1: Flight-deck preset and interaction wiring

**Files:**
- Modify: `src/state/SimulationStore.ts`
- Modify: `src/camera/CameraController.ts`
- Modify: `src/camera/CameraController.test.ts`
- Modify: `src/ui/ScienceDeck.ts`
- Modify: `src/ui/ScienceDeck.test.ts`
- Modify: `src/app/BlackHoleApp.ts`
- Modify: `src/app/BlackHoleApp.test.ts`

**Interfaces:**
- Consumes: the existing `CameraPreset`, `CAMERA_PRESETS`, store patching, camera grid, and numeric-shortcut paths.
- Produces: `CameraPreset = ... | 'cockpit'`, `CAMERA_PRESETS.cockpit`, button `data-camera-preset="cockpit"`, shortcut `5`, and root class `is-cockpit`.

- [ ] **Step 1: Add failing preset integration tests**

Add these expectations before changing production code:

```ts
// CameraController.test.ts
it('offers a close safe flight-deck pose', () => {
  expect(CAMERA_PRESETS).toHaveProperty('cockpit', {
    yaw: 0.14,
    pitch: 0.1,
    distance: 3.7,
  });
});

// ScienceDeck.test.ts
it('selects the flight deck and exposes cockpit state on the root', () => {
  const { root, store } = mountDeck();
  const flightDeck = root.querySelector<HTMLButtonElement>(
    '[data-camera-preset="cockpit"]',
  );

  expect(flightDeck?.textContent).toContain('Flight deck');
  flightDeck?.click();
  expect(store.getSnapshot().cameraPreset).toBe('cockpit');
  expect(root.classList.contains('is-cockpit')).toBe(true);

  root.querySelector<HTMLButtonElement>(
    '[data-camera-preset="observatory"]',
  )?.click();
  expect(root.classList.contains('is-cockpit')).toBe(false);
});

// BlackHoleApp.test.ts, inside the shortcut test
window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
expect(harness.store.getSnapshot().cameraPreset).toBe('cockpit');
```

- [ ] **Step 2: Confirm the red state**

Run:

```powershell
npx vitest run src/camera/CameraController.test.ts src/ui/ScienceDeck.test.ts src/app/BlackHoleApp.test.ts
```

Expected: assertion failures for the absent preset, button/root class, and shortcut.

- [ ] **Step 3: Implement the preset path**

Apply these production changes:

```ts
// SimulationStore.ts
export type CameraPreset =
  | 'observatory'
  | 'edge'
  | 'polar'
  | 'wide'
  | 'cockpit';

// CameraController.ts
cockpit: Object.freeze({ yaw: 0.14, pitch: 0.1, distance: 3.7 }),

// ScienceDeck.ts
const cameraPresets = new Set<CameraPreset>([
  'observatory',
  'edge',
  'polar',
  'wide',
  'cockpit',
]);
```

Add the fifth grid button:

```html
<button type="button" data-camera-preset="cockpit" aria-pressed="false">
  <b>05</b><span>Flight deck</span>
</button>
```

Derive and clean up the root class:

```ts
this.root.classList.toggle('is-cockpit', snapshot.cameraPreset === 'cockpit');
// dispose():
this.root.classList.remove('ui-hidden', 'is-cockpit');
```

Add the numeric shortcut:

```ts
const keyboardPresets: Readonly<Record<string, CameraPreset>> = {
  '1': 'observatory',
  '2': 'edge',
  '3': 'polar',
  '4': 'wide',
  '5': 'cockpit',
};
```

- [ ] **Step 4: Confirm green integration tests**

Run the same focused command. Expected: all focused files pass, including the
existing reset and camera-safety assertions.

### Task 2: Cockpit structure and cinematic presentation

**Files:**
- Modify: `src/ui/ScienceDeck.ts`
- Modify: `src/ui/ScienceDeck.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `#interface-root.is-cockpit`, `#interface-root.ui-hidden`, and the existing interface layer.
- Produces: `.cockpit-shell` as a sibling before `.interface-layer`, with `.cockpit-frame`, `.cockpit-hud`, `.cockpit-reticle`, and `.cockpit-console` visual units.

- [ ] **Step 1: Add a failing cockpit-structure regression**

Import the stylesheet as raw text in `ScienceDeck.test.ts` and add:

```ts
import styles from '../styles.css?raw';

it('renders a persistent decorative cockpit with a hideable HUD', () => {
  const { root, store } = mountDeck();
  const shell = root.querySelector<HTMLElement>('.cockpit-shell');

  expect(shell?.getAttribute('aria-hidden')).toBe('true');
  expect(shell?.parentElement).toBe(root);
  expect(shell?.nextElementSibling?.classList.contains('interface-layer')).toBe(true);
  expect(shell?.querySelector('.cockpit-canopy')).not.toBeNull();
  expect(shell?.querySelector('.cockpit-console')).not.toBeNull();
  expect(shell?.querySelector('.cockpit-reticle')).not.toBeNull();
  expect(shell?.querySelector('.cockpit-hud')).not.toBeNull();

  store.patch({ cameraPreset: 'cockpit', uiVisible: false });
  expect(root.classList.contains('is-cockpit')).toBe(true);
  expect(root.classList.contains('ui-hidden')).toBe(true);

  expect(styles).toContain('#interface-root.is-cockpit .cockpit-shell');
  expect(styles).toContain('#interface-root.ui-hidden .cockpit-hud');
  expect(styles).toContain('.view-grid [data-camera-preset="cockpit"]');
});
```

- [ ] **Step 2: Confirm the structure test fails**

Run:

```powershell
npx vitest run src/ui/ScienceDeck.test.ts
```

Expected: FAIL because the shell and cockpit CSS do not exist.

- [ ] **Step 3: Add the cockpit markup before `.interface-layer`**

Insert this at the start of `deckMarkup`:

```html
<div class="cockpit-shell" aria-hidden="true">
  <div class="cockpit-glass"></div>
  <div class="cockpit-canopy">
    <span class="cockpit-strut cockpit-strut--left"></span>
    <span class="cockpit-strut cockpit-strut--right"></span>
    <span class="cockpit-header-beam"></span>
  </div>
  <div class="cockpit-hud">
    <div class="cockpit-hud-block cockpit-hud-block--left">
      <b>RANGER 07</b><span>FORWARD OBSERVATION</span><i>NAV / LOCKED</i>
    </div>
    <div class="cockpit-hud-block cockpit-hud-block--right">
      <b>PROXIMITY</b><span>3.70 R<sub>S</sub></span><i>HULL / NOMINAL</i>
    </div>
    <div class="cockpit-reticle"><i></i><span></span><b>VECTOR HOLD</b></div>
  </div>
  <div class="cockpit-console">
    <div class="cockpit-panel cockpit-panel--left"><span></span><span></span><span></span></div>
    <div class="cockpit-panel cockpit-panel--center"><i></i><b>MANUAL VECTOR</b><i></i></div>
    <div class="cockpit-panel cockpit-panel--right"><span></span><span></span><span></span></div>
  </div>
</div>
```

- [ ] **Step 4: Add the cockpit CSS system**

Create styles with these exact behavioral contracts:

```css
.cockpit-shell {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transform: scale(1.018);
  transition: opacity 650ms ease, transform 900ms cubic-bezier(.2,.8,.2,1);
}

#interface-root.is-cockpit .cockpit-shell { opacity: 1; transform: scale(1); }
#interface-root.ui-hidden .cockpit-hud { opacity: 0; }
.interface-layer { z-index: 2; }
.view-grid [data-camera-preset="cockpit"] { grid-column: 1 / -1; }
```

Build the remaining selectors using layered gradients and clip paths:

- `.cockpit-glass`: inset vignette plus diagonal reflection; no opaque center.
- `.cockpit-header-beam`: shallow dark top arch with amber seam.
- `.cockpit-strut--left/right`: 8–11vw diagonal canopy beams confined to outer
  edges, with inner metal highlights.
- `.cockpit-console`: bottom 19–23vh polygonal silhouette, darkest at the edge,
  with an illuminated upper lip.
- `.cockpit-panel`: compact instrument clusters inside the console silhouette.
- `.cockpit-hud-block`: 8px monospaced uppercase telemetry with low-opacity
  amber/ice lines; place below the mission title and left of the science deck.
- `.cockpit-reticle`: centered 42px broken-ring target with a tiny vector label.
- `@keyframes cockpit-glass-drift`: move only the reflection by at most 1.5%.
- In `@media (max-width: 900px)`, reduce console height, beam width, and HUD
  density; hide the right HUD block and vector label.

- [ ] **Step 5: Verify presentation and the whole project**

Run:

```powershell
npx vitest run src/ui/ScienceDeck.test.ts
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all commands exit 0 with no warnings beyond the existing bundle-size
report.

- [ ] **Step 6: Perform browser QA**

Verify desktop and narrow viewports. Select `05 Flight deck`, confirm the camera
transition, physical frame, HUD, console, event-horizon visibility, science-deck
interactions, shortcut `5`, and UI-hidden behavior. Check for console errors and
confirm reduced motion removes the reflection animation.

- [ ] **Step 7: Commit the feature**

```powershell
git add -- src/state/SimulationStore.ts src/camera/CameraController.ts src/camera/CameraController.test.ts src/ui/ScienceDeck.ts src/ui/ScienceDeck.test.ts src/app/BlackHoleApp.ts src/app/BlackHoleApp.test.ts src/styles.css
git commit -m "feat: add spaceship flight deck perspective"
```
