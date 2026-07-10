# Black Hole Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-first, cinematic, interactive black-hole simulation with real-time physics-inspired lensing and an accessible science control deck.

**Architecture:** A vanilla TypeScript application owns a typed simulation store, deterministic camera and quality controllers, and a direct Three.js renderer. A full-screen GLSL pass reconstructs view rays and renders the event shadow, photon ring, lensed accretion disk, Doppler asymmetry, redshift, and procedural stars; semantic HTML/CSS overlays provide controls without entering the render loop.

**Tech Stack:** Vite, TypeScript, Three.js, GLSL ES 3.0-compatible shader code, Vitest with jsdom, CSS, and npm.

## Global Constraints

- Target a desktop-first browser experience and require WebGL2 for the primary renderer.
- Target 60 frames per second with adaptive internal resolution and High, Balanced, and Performance quality presets.
- Use a physics-inspired cinematic model, not a numerical Kerr geodesic solver.
- Keep all imagery procedural; do not use protected movie assets.
- Support pointer orbit, wheel zoom, `Space`, `H`, `R`, and camera presets `1`–`4`.
- Respect `prefers-reduced-motion` and provide a keyboard-accessible semantic interface.
- Keep simulation state local; no backend, accounts, or remote runtime dependencies.

## File map

- `package.json`: scripts and runtime/development dependencies.
- `tsconfig.json`, `vite.config.ts`: strict TypeScript and Vite/Vitest configuration.
- `src/vite-env.d.ts`: Vite and raw GLSL module declarations.
- `index.html`: canvas, accessible summary, loading shell, and application mount.
- `src/main.ts`: single application entry point.
- `src/styles.css`: full visual system, responsive science deck, focus states, and reduced-motion rules.
- `src/state/SimulationStore.ts`: typed state, validation, reset, subscriptions, and derived snapshots.
- `src/state/SimulationStore.test.ts`: store behavior and parameter-bound tests.
- `src/math/physics.ts`: mass, radius, temperature, and shader-uniform mapping helpers.
- `src/math/physics.test.ts`: deterministic physics-helper tests.
- `src/performance/AdaptiveQuality.ts`: sustained-frame-time quality controller.
- `src/performance/AdaptiveQuality.test.ts`: downgrade, upgrade, and hysteresis tests.
- `src/camera/CameraController.ts`: orbit/zoom damping, safe bounds, idle drift, and presets.
- `src/camera/CameraController.test.ts`: clamping, preset, input, and reduced-motion tests.
- `src/render/shaders/fullscreen.vert.glsl`: full-screen triangle vertex shader.
- `src/render/shaders/blackHole.frag.glsl`: ray reconstruction, lensing, disk, shadow, stars, and tone mapping.
- `src/render/Starfield.ts`: deterministic generated stellar texture used by the lensing shader.
- `src/render/Starfield.test.ts`: seeded star-generation tests.
- `src/render/BlackHoleRenderer.ts`: Three.js lifecycle, uniforms, sizing, context handling, and render loop integration.
- `src/render/BlackHoleRenderer.test.ts`: capability/failure behavior with renderer injection.
- `src/ui/ScienceDeck.ts`: semantic controls, readouts, quality selector, and preset actions.
- `src/ui/ScienceDeck.test.ts`: DOM events, labeling, and state synchronization.
- `src/ui/IntroSequence.ts`: reduced-motion-aware intro and input-to-skip behavior.
- `src/app/BlackHoleApp.ts`: composition root, shortcuts, animation loop, pause/visibility, and teardown.
- `src/app/BlackHoleApp.test.ts`: integration tests with injected renderer/frame scheduler.
- `src/test/setup.ts`: DOM test cleanup and browser API shims.
- `README.md`: run, build, controls, visual model, and browser requirements.

---

### Task 1: Project foundation, simulation state, and derived physics

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/vite-env.d.ts`
- Create: `src/test/setup.ts`
- Create: `src/state/SimulationStore.ts`
- Create: `src/state/SimulationStore.test.ts`
- Create: `src/math/physics.ts`
- Create: `src/math/physics.test.ts`

**Interfaces:**
- Produces: `SimulationStore`, `SimulationState`, `SimulationSnapshot`, `QualityPreset`, `DEFAULT_SIMULATION_STATE`, `derivePhysics(state)`, and `toShaderParameters(state)`.
- Consumes: no application interfaces; this task establishes the shared contracts.

- [ ] **Step 1: Create the Vite/TypeScript/Vitest foundation**

Run `npm init -y`, `npm install three`, and `npm install --save-dev @types/three jsdom typescript vite vitest`. Replace the generated scripts with `dev`, `build`, `preview`, `test`, `test:watch`, and `typecheck`. Configure strict TypeScript with `noUncheckedIndexedAccess`, DOM libraries, Vite client types, and this raw shader declaration in `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

declare module '*.glsl?raw' {
  const source: string;
  export default source;
}
```

Configure Vitest inside `vite.config.ts` to use jsdom and `src/test/setup.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
```

Create `index.html` with this stable application contract:

```html
<body>
  <main id="app">
    <canvas id="black-hole-canvas" aria-label="Interactive visualization of light bending around a rotating black hole"></canvas>
    <div id="interface-root"></div>
    <div id="loading-screen" role="status" aria-live="polite">Initializing spacetime…</div>
  </main>
  <script type="module" src="/src/main.ts"></script>
</body>
```

- [ ] **Step 2: Write failing state and physics tests**

Create tests that assert exact defaults and bounds:

```ts
it('clamps physical controls and resets atomically', () => {
  const store = new SimulationStore();
  store.patch({ mass: 100, spin: -2, diskHeat: 4, lensing: 0, timeScale: 8 });
  expect(store.getSnapshot()).toMatchObject({
    mass: 40, spin: 0, diskHeat: 1, lensing: 0.65, timeScale: 2,
  });
  store.reset();
  expect(store.getSnapshot()).toEqual(DEFAULT_SIMULATION_STATE);
});

it('derives a Schwarzschild radius for the displayed mass', () => {
  expect(derivePhysics({ ...DEFAULT_SIMULATION_STATE, mass: 4.1 }).schwarzschildRadiusKm)
    .toBeCloseTo(12_109_350, 1);
});

it('maps state to stable normalized shader parameters', () => {
  expect(toShaderParameters(DEFAULT_SIMULATION_STATE)).toEqual({
    massScale: 1,
    spin: 0.72,
    diskHeat: 0.58,
    lensing: 1,
    timeScale: 1,
  });
});
```

- [ ] **Step 3: Run the focused tests and confirm the red state**

Run: `npm install && npm test -- src/state/SimulationStore.test.ts src/math/physics.test.ts`

Expected: FAIL because `SimulationStore.ts` and `physics.ts` do not exist.

- [ ] **Step 4: Implement the typed state and derived helpers**

Use this exact state shape:

```ts
export type QualityPreset = 'auto' | 'high' | 'balanced' | 'performance';

export interface SimulationState {
  mass: number;
  spin: number;
  diskHeat: number;
  lensing: number;
  timeScale: number;
  paused: boolean;
  uiVisible: boolean;
  quality: QualityPreset;
  cameraPreset: 'observatory' | 'edge' | 'polar' | 'wide';
}

export const DEFAULT_SIMULATION_STATE: Readonly<SimulationState> = Object.freeze({
  mass: 4.1,
  spin: 0.72,
  diskHeat: 0.58,
  lensing: 1,
  timeScale: 1,
  paused: false,
  uiVisible: true,
  quality: 'auto',
  cameraPreset: 'observatory',
});

export type SimulationSnapshot = Readonly<SimulationState>;
```

`SimulationStore.patch()` must clamp `mass` to `0.5..40`, `spin` to `0..0.99`, `diskHeat` to `0..1`, `lensing` to `0.65..1.35`, and `timeScale` to `0..2`; notify subscribers once per patch and return an unsubscribe function from `subscribe()`.

Use `2.9535 * mass * 1_000_000` kilometers for the displayed Schwarzschild radius because the mass control is in millions of solar masses. Normalize mass for the shader by dividing by the 4.1 default, then clamp it to `0.45..2.2`; do not let visual scale grow linearly to 40. Export this exact shader contract:

```ts
export interface ShaderParameters {
  massScale: number;
  spin: number;
  diskHeat: number;
  lensing: number;
  timeScale: number;
}
```

- [ ] **Step 5: Run tests and commit the foundation**

Run: `npm test -- src/state/SimulationStore.test.ts src/math/physics.test.ts && npm run typecheck`

Expected: all focused tests PASS and TypeScript exits 0.

Commit:

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/test src/state src/math
git commit -m "feat: establish simulation state and physics model"
```

---

### Task 2: Adaptive render quality

**Files:**
- Create: `src/performance/AdaptiveQuality.ts`
- Create: `src/performance/AdaptiveQuality.test.ts`

**Interfaces:**
- Consumes: `QualityPreset` from `src/state/SimulationStore.ts`.
- Produces: `AdaptiveQuality`, `QualitySettings`, and `QUALITY_SETTINGS` for the renderer.

- [ ] **Step 1: Write failing quality-controller tests**

```ts
it('downgrades only after a sustained slow window', () => {
  const quality = new AdaptiveQuality('auto');
  for (let i = 0; i < 44; i += 1) quality.sample(24);
  expect(quality.level).toBe('balanced');
  quality.sample(24);
  expect(quality.level).toBe('performance');
});

it('uses hysteresis before returning to balanced', () => {
  const quality = new AdaptiveQuality('auto');
  for (let i = 0; i < 45; i += 1) quality.sample(24);
  for (let i = 0; i < 239; i += 1) quality.sample(12);
  expect(quality.level).toBe('performance');
  quality.sample(12);
  expect(quality.level).toBe('balanced');
});

it('never changes a manually selected preset', () => {
  const quality = new AdaptiveQuality('high');
  for (let i = 0; i < 500; i += 1) quality.sample(40);
  expect(quality.level).toBe('high');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/performance/AdaptiveQuality.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement fixed settings and hysteresis**

Use these exact renderer settings:

```ts
export const QUALITY_SETTINGS = {
  high: { pixelRatioCap: 1.75, diskSteps: 96, bloom: true },
  balanced: { pixelRatioCap: 1.25, diskSteps: 80, bloom: true },
  performance: { pixelRatioCap: 0.9, diskSteps: 64, bloom: false },
} as const;
```

In auto mode, begin at `balanced`, downgrade after 45 consecutive samples above 20 ms, and upgrade after 240 consecutive samples below 14 ms. Reset the opposite counter whenever a sample crosses the relevant threshold. Manual presets return their fixed level without sampling changes.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/performance/AdaptiveQuality.test.ts && npm run typecheck`

Expected: all focused tests PASS.

Commit:

```bash
git add src/performance
git commit -m "feat: add adaptive rendering quality"
```

---

### Task 3: Camera controller and interaction model

**Files:**
- Create: `src/camera/CameraController.ts`
- Create: `src/camera/CameraController.test.ts`

**Interfaces:**
- Consumes: camera preset names from `SimulationState.cameraPreset`.
- Produces: `CameraController`, `CameraPose`, `DEFAULT_CAMERA_POSE`, `CAMERA_PRESETS`, `beginOrbit()`, `moveOrbit()`, `endOrbit()`, `zoom()`, `selectPreset()`, `update()`, and `getPose()`.

- [ ] **Step 1: Write failing deterministic camera tests**

```ts
it('clamps pitch and distance to safe shader ranges', () => {
  const camera = new CameraController(false);
  camera.beginOrbit(0, 0);
  camera.moveOrbit(0, 10_000);
  camera.zoom(10_000);
  camera.update(1 / 60, 0);
  expect(camera.getPose().pitch).toBeLessThanOrEqual(1.18);
  expect(camera.getPose().distance).toBeLessThanOrEqual(8.5);
});

it('moves toward exact named presets', () => {
  const camera = new CameraController(false);
  camera.selectPreset('polar');
  camera.update(10, 0);
  expect(camera.getPose()).toMatchObject(CAMERA_PRESETS.polar);
});

it('does not idle-drift when reduced motion is enabled', () => {
  const camera = new CameraController(true);
  const before = camera.getPose();
  camera.update(1, 30);
  expect(camera.getPose()).toEqual(before);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/camera/CameraController.test.ts`

Expected: FAIL because `CameraController` does not exist.

- [ ] **Step 3: Implement presets, damping, and safe bounds**

Use these stable presets:

```ts
export const CAMERA_PRESETS = {
  observatory: { yaw: -0.28, pitch: 0.2, distance: 4.6 },
  edge: { yaw: 0.52, pitch: 0.04, distance: 3.75 },
  polar: { yaw: -0.08, pitch: 1.08, distance: 4.2 },
  wide: { yaw: -0.7, pitch: 0.32, distance: 7.2 },
} as const;

export const DEFAULT_CAMERA_POSE = CAMERA_PRESETS.observatory;
```

Clamp pitch to `-1.18..1.18` and distance to `3.55..8.5` so every user-controlled view remains outside the emitting disk. Pointer movement changes target yaw/pitch, wheel movement changes target distance, and `update(deltaSeconds, idleSeconds)` applies exponential damping with `1 - exp(-8 * deltaSeconds)`. Add a yaw drift of `0.018 * deltaSeconds` only after 8 idle seconds and only when reduced motion is false.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/camera/CameraController.test.ts && npm run typecheck`

Expected: all focused tests PASS.

Commit:

```bash
git add src/camera
git commit -m "feat: add cinematic camera controller"
```

---

### Task 4: GPU black-hole renderer and shader

**Files:**
- Create: `src/render/shaders/fullscreen.vert.glsl`
- Create: `src/render/shaders/blackHole.frag.glsl`
- Create: `src/render/Starfield.ts`
- Create: `src/render/Starfield.test.ts`
- Create: `src/render/BlackHoleRenderer.ts`
- Create: `src/render/BlackHoleRenderer.test.ts`

**Interfaces:**
- Consumes: `SimulationSnapshot`, `ShaderParameters`, `CameraPose`, and `QualitySettings`.
- Produces: `createStarfieldTextureData()`, `BlackHoleRenderer`, `WebGLUnavailableError`, `RendererBackend`, `RendererBackendFactory`, `UniformFrame`, `resize()`, `renderFrame()`, and `dispose()`.

- [ ] **Step 1: Write failing renderer capability tests**

Inject a `RendererBackendFactory` so tests do not need a GPU. Define the production contracts as:

```ts
export interface UniformFrame {
  resolution: readonly [number, number];
  time: number;
  massScale: number;
  spin: number;
  diskHeat: number;
  lensing: number;
  camera: CameraPose;
  diskSteps: number;
  bloom: boolean;
}

export interface RendererBackend {
  resize(width: number, height: number, pixelRatio: number): void;
  render(frame: UniformFrame): void;
  dispose(): void;
}

export type RendererBackendFactory = (
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
) => RendererBackend;
```

Define these concrete test helpers directly in `BlackHoleRenderer.test.ts`:

```ts
function createWebGL2Canvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue({} as WebGL2RenderingContext);
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: 1280 },
    clientHeight: { configurable: true, value: 720 },
  });
  return canvas;
}

function createFakeBackend(): RendererBackend & { lastFrame?: UniformFrame } {
  const backend: RendererBackend & { lastFrame?: UniformFrame } = {
    resize: vi.fn(),
    render: vi.fn((frame: UniformFrame) => { backend.lastFrame = frame; }),
    dispose: vi.fn(),
  };
  return backend;
}
```

Then write the capability and uniform tests:

```ts
it('reports WebGL2 absence without constructing a backend', () => {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(null);
  expect(() => new BlackHoleRenderer(canvas, vi.fn())).toThrow(WebGLUnavailableError);
});

it('forwards a complete uniform frame to the backend', () => {
  const backend = createFakeBackend();
  const renderer = new BlackHoleRenderer(createWebGL2Canvas(), () => backend);
  renderer.renderFrame(DEFAULT_SIMULATION_STATE, DEFAULT_CAMERA_POSE, 1.5, QUALITY_SETTINGS.balanced);
  expect(backend.lastFrame).toMatchObject({ time: 1.5, spin: 0.72, diskHeat: 0.58 });
});

it('generates the same stellar texture for the same seed', () => {
  const first = createStarfieldTextureData(64, 32, 4242);
  const second = createStarfieldTextureData(64, 32, 4242);
  expect(first).toEqual(second);
  expect(first.some((channel) => channel === 255)).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/render/BlackHoleRenderer.test.ts`

Expected: FAIL because the renderer and starfield modules do not exist.

- [ ] **Step 3: Implement the full-screen shader pipeline**

`createStarfieldTextureData(width, height, seed)` must use a deterministic Mulberry32 generator, return an RGBA `Uint8Array`, paint a faint blue-black galactic haze, and distribute at least 0.18% bright white/blue/amber stars with a small number of four-pixel halos. The production backend uploads the data as a clamped equirectangular `THREE.DataTexture`.

The vertex shader must render a single full-screen triangle and expose UV coordinates. The fragment shader must implement these named functions so the visual responsibilities stay legible:

```glsl
float hash21(vec2 p);
vec3 starField(vec3 rayDirection, sampler2D starTexture);
vec3 temperatureColor(float radius, float heat);
vec3 cameraRay(vec2 uv, vec3 cameraPosition, vec3 cameraTarget);
vec3 bendRay(vec3 origin, vec3 direction, float massScale, float lensing);
vec4 sampleAccretionDisk(vec3 origin, vec3 direction, float spin, float heat, float time);
vec3 applyDopplerAndRedshift(vec3 color, vec3 hitPosition, float spin);
```

Use a fixed compile-time maximum of 96 disk steps and break logically when the active `uDiskSteps` threshold is reached. Once a ray passes its closest approach, increase its step length outside the near-horizon region so every quality preset reaches the far-side disk intersection that forms the upper lensed image. Capture rays that enter the horizon, add a narrow photon ring around it, and sample the disk between its mass-scaled inner and outer radii. Warp missed rays before passing them to `starField()`. Apply ACES-style tone mapping and gamma correction after combining disk, ring, and background.

The TypeScript renderer must:

- request WebGL2 and throw `WebGLUnavailableError` if unavailable;
- create one Three.js scene, orthographic camera, full-screen triangle, shader material, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, and `OutputPass`;
- cap pixel ratio from `QualitySettings`;
- update all uniforms through a typed `UniformFrame` object;
- update bloom strength from disk heat and disable the bloom pass when `QualitySettings.bloom` is false;
- handle resize and WebGL context loss/restoration;
- dispose the generated starfield texture, composer targets, passes, geometry, material, renderer, and event listeners exactly once.

- [ ] **Step 4: Run tests, typecheck, and production build**

Run: `npm test -- src/render/Starfield.test.ts src/render/BlackHoleRenderer.test.ts && npm run typecheck && npm run build`

Expected: tests PASS, TypeScript exits 0, and Vite emits `dist/` without shader import errors.

- [ ] **Step 5: Commit the renderer**

```bash
git add src/render
git commit -m "feat: render a lensed cinematic black hole"
```

---

### Task 5: Science deck and visual interface

**Files:**
- Create: `src/ui/ScienceDeck.ts`
- Create: `src/ui/ScienceDeck.test.ts`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: `SimulationStore`, `derivePhysics()`, and camera preset names.
- Produces: `ScienceDeck`, `mount(root)`, `render(snapshot)`, `showFallback(message)`, and `dispose()`.

- [ ] **Step 1: Write failing semantic UI tests**

```ts
it('renders labeled controls and patches the store', () => {
  const store = new SimulationStore();
  const root = document.createElement('div');
  const deck = new ScienceDeck(store);
  deck.mount(root);
  const spin = root.querySelector<HTMLInputElement>('#spin-control')!;
  spin.value = '0.91';
  spin.dispatchEvent(new Event('input', { bubbles: true }));
  expect(store.getSnapshot().spin).toBe(0.91);
  expect(root.querySelector('label[for="spin-control"]')).not.toBeNull();
});

it('updates scientific readouts when mass changes', () => {
  const store = new SimulationStore();
  const root = document.createElement('div');
  new ScienceDeck(store).mount(root);
  store.patch({ mass: 8.2 });
  expect(root.querySelector('[data-readout="radius"]')?.textContent).toContain('24,218,700');
});

it('removes subscriptions and listeners on dispose', () => {
  const store = new SimulationStore();
  const root = document.createElement('div');
  const deck = new ScienceDeck(store);
  deck.mount(root);
  deck.dispose();
  expect(root.childElementCount).toBe(0);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/ui/ScienceDeck.test.ts`

Expected: FAIL because `ScienceDeck` does not exist.

- [ ] **Step 3: Implement semantic markup and event delegation**

Render one `.science-deck` containing:

- eyebrow `LIVE RELATIVISTIC MODEL`;
- title `GARGANTUA` and subtitle `ROTATING SUPERMASSIVE BLACK HOLE`;
- live mass, Schwarzschild radius, and spin readouts;
- native range inputs for Mass, Spin, Disk heat, Lensing, and Time;
- quality `<select>` with Auto, High, Balanced, and Performance;
- four camera preset buttons with `data-camera-preset` attributes;
- Reset and Hide interface buttons;
- a bottom shortcut strip showing `DRAG ORBIT`, `SCROLL RANGE`, `SPACE TIME`, and `H HIDE`.

Inputs must use exact store bounds from Task 1. Use one delegated `input` listener and one delegated `click` listener. `render()` updates values and `aria-pressed` without replacing the DOM, preventing focus loss during slider use.

- [ ] **Step 4: Implement the cinematic CSS system**

Define CSS custom properties for near-black navy, warm disk white, amber, ionized orange, cool readout blue, muted text, and glass borders. The canvas fills `100dvw × 100dvh`; the interface overlays it with `pointer-events: none` at the layout level and restores pointer events on controls. Use restrained uppercase tracking, hairline borders, glass blur, vignette overlays, and a right-aligned science deck no wider than 340px. At widths below 900px, collapse the deck into a bottom sheet. Include visible `:focus-visible` outlines and `@media (prefers-reduced-motion: reduce)` overrides.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- src/ui/ScienceDeck.test.ts && npm run typecheck`

Expected: all focused tests PASS.

Commit:

```bash
git add src/ui src/styles.css
git commit -m "feat: add the interactive science deck"
```

---

### Task 6: Application composition, intro, shortcuts, and fallback

**Files:**
- Create: `src/ui/IntroSequence.ts`
- Create: `src/app/BlackHoleApp.ts`
- Create: `src/app/BlackHoleApp.test.ts`
- Create: `src/main.ts`

**Interfaces:**
- Consumes: store, camera, renderer, quality, science deck, and DOM shell from Tasks 1–5.
- Produces: `FrameScheduler`, `BlackHoleAppOptions`, `BlackHoleApp.start()`, `BlackHoleApp.stop()`, `BlackHoleApp.dispose()`, and the production bootstrap in `main.ts`.

- [ ] **Step 1: Write failing integration tests with injected time and renderer**

Use these production injection contracts:

```ts
export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface BlackHoleAppOptions {
  canvas: HTMLCanvasElement;
  interfaceRoot: HTMLElement;
  loadingScreen: HTMLElement;
  store?: SimulationStore;
  rendererFactory?: (canvas: HTMLCanvasElement) => BlackHoleRenderer;
  scheduler?: FrameScheduler;
  reducedMotion?: boolean;
}
```

Define this harness directly in `BlackHoleApp.test.ts` so every fake is explicit:

```ts
function createAppHarness(options: { rendererError?: Error } = {}) {
  document.body.innerHTML = `
    <main id="app">
      <canvas id="black-hole-canvas"></canvas>
      <div id="interface-root"></div>
      <div id="loading-screen"></div>
    </main>`;
  const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
  const root = document.querySelector<HTMLElement>('#interface-root')!;
  const loadingScreen = document.querySelector<HTMLElement>('#loading-screen')!;
  const store = new SimulationStore();
  const renderer = {
    resize: vi.fn(),
    renderFrame: vi.fn(),
    dispose: vi.fn(),
  } as unknown as BlackHoleRenderer;
  const scheduler: FrameScheduler = {
    request: vi.fn(() => 23),
    cancel: vi.fn(),
  };
  const rendererFactory = vi.fn(() => {
    if (options.rendererError) throw options.rendererError;
    return renderer;
  });
  const app = new BlackHoleApp({
    canvas,
    interfaceRoot: root,
    loadingScreen,
    store,
    rendererFactory,
    scheduler,
    reducedMotion: true,
  });
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  };
  return { app, store, renderer, scheduler, root, setHidden };
}
```

Then add the integration assertions:

```ts
it('maps shortcuts to state and camera actions', () => {
  const harness = createAppHarness();
  harness.app.start();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  expect(harness.store.getSnapshot().paused).toBe(true);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
  expect(harness.store.getSnapshot().uiVisible).toBe(false);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
  expect(harness.store.getSnapshot().cameraPreset).toBe('polar');
});

it('pauses frames while the document is hidden and cleans up once', () => {
  const harness = createAppHarness();
  harness.app.start();
  harness.setHidden(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(harness.scheduler.cancel).toHaveBeenCalledTimes(1);
  harness.app.dispose();
  expect(harness.renderer.dispose).toHaveBeenCalledTimes(1);
});

it('shows the styled fallback when renderer construction fails', () => {
  const harness = createAppHarness({ rendererError: new WebGLUnavailableError() });
  harness.app.start();
  expect(harness.root.textContent).toContain('WebGL2 is required');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/app/BlackHoleApp.test.ts`

Expected: FAIL because `BlackHoleApp` does not exist.

- [ ] **Step 3: Implement the intro and application lifecycle**

`IntroSequence` must add `is-intro` on start, transition through `stars-ready` at 250 ms and `scene-ready` at 900 ms, then remove the loading screen at 1,800 ms. When reduced motion is active, remove the loading screen on the next animation frame. Any pointerdown or keydown calls `skip()` and clears pending timers.

`BlackHoleApp` must:

- construct dependencies once and surface renderer initialization errors in `ScienceDeck.showFallback()`;
- wire pointer capture for orbit and non-passive wheel handling for zoom;
- update idle time on every user interaction;
- map `Space`, `H`, `R`, and `1`–`4` while ignoring keystrokes from inputs/selects/buttons;
- advance simulation time only while unpaused;
- sample frame time through `AdaptiveQuality` and pass its settings into the renderer;
- stop frames on `visibilitychange` and resume when visible;
- expose idempotent `stop()` and `dispose()`.

`main.ts` imports `styles.css`, obtains the three stable shell elements, creates `BlackHoleApp`, starts it, and disposes it on Vite hot-module replacement.

- [ ] **Step 4: Run integration tests and full checks**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests PASS, TypeScript exits 0, and Vite emits a production bundle.

- [ ] **Step 5: Commit application integration**

```bash
git add src/app src/ui/IntroSequence.ts src/main.ts
git commit -m "feat: integrate the black hole experience"
```

---

### Task 7: Runtime polish, documentation, and final verification

**Files:**
- Modify: `src/render/shaders/blackHole.frag.glsl`
- Modify: `src/styles.css`
- Create: `README.md`
- Create: `.gitignore`

**Interfaces:**
- Consumes: the complete running application.
- Produces: a documented, production-verified experience with no new application API.

- [ ] **Step 1: Add repository hygiene and operating documentation**

`.gitignore` must ignore `node_modules/`, `dist/`, `.superpowers/`, coverage output, Vite cache files, and local environment files. `README.md` must include exact commands:

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
```

Document the controls, quality presets, WebGL2 requirement, physics-inspired approximation, procedural asset policy, and reduced-motion behavior.

- [ ] **Step 2: Run the production server and inspect the experience**

Run: `npm run build` followed by `npm run preview -- --host 127.0.0.1`.

Open the printed local URL in the in-app browser. Verify at a typical desktop viewport and a narrow viewport that:

- the intro reveals stars, warped disk, photon ring, and black shadow;
- the upper/lower lensed disk images remain visible through camera presets;
- one disk side is brighter/bluer and the opposite side is dimmer/warmer;
- sliders update the visual continuously;
- all four camera presets work;
- pause, hide UI, and reset shortcuts work outside form fields;
- the narrow layout does not obscure the black-hole shadow;
- reduced motion skips the camera drift;
- the browser console contains no errors.

- [ ] **Step 3: Tune only evidenced visual or runtime defects**

For each observed issue, record the symptom, identify whether it originates in shader mapping, camera bounds, CSS layout, or quality settings, make one focused change, reload the preview, and re-check the same symptom. Do not add new features during this step.

- [ ] **Step 4: Run the complete verification gate**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: all tests PASS, typecheck and build exit 0, `git diff --check` prints nothing, and status contains only the intended README, `.gitignore`, and any focused visual-tuning edits.

- [ ] **Step 5: Commit the verified deliverable**

```bash
git add .gitignore README.md src/render/shaders/blackHole.frag.glsl src/styles.css
git commit -m "docs: finalize and verify the black hole simulation"
```
