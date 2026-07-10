# Black Hole Simulation Design

**Date:** 2026-07-10
**Status:** Approved for autonomous implementation
**Target:** Desktop-first browser experience

## Product intent

Create a visually exceptional, interactive black-hole simulation that evokes the scale and clarity of a premium science-fiction film while remaining recognizably grounded in real black-hole phenomena. The experience should feel like a cinematic observatory rather than a conventional dashboard.

The user selected an **Interactive Science Deck** direction and delegated subsequent decisions. The implementation will therefore prioritize a full-screen cinematic canvas, place scientific controls in a restrained overlay, and use a physics-inspired rendering model rather than a research-grade general-relativity solver.

## Success criteria

- The black hole is immediately striking at first load, with a bright warped accretion disk, black central shadow, lensed upper and lower disk images, Doppler brightness asymmetry, and a convincing stellar background.
- Camera movement preserves the lensing illusion instead of exposing flat compositing.
- The visual remains responsive on a contemporary desktop GPU, targeting 60 frames per second at a dynamically selected render resolution.
- Users can understand and manipulate the main visual parameters without prior scientific knowledge.
- The interface can fade away for an unobstructed cinematic view.
- The experience works with mouse, keyboard, and trackpad and degrades cleanly when WebGL features or GPU performance are limited.

## Experience design

### Opening sequence

The app begins in darkness with a minimal loading mark. Stars resolve first, followed by the accretion glow and the central shadow. A short camera drift reveals the warped disk and then settles into the default observatory view. Any pointer or keyboard input skips the drift. Interface labels enter only after the scene is established.

### Main view

The renderer fills the viewport. The default composition places the black hole slightly right of center so the left side can hold a compact title and readout without obscuring the subject. Warm white, amber, and ionized orange light around the disk contrasts with an almost-black blue background. Cool cyan is reserved for scientific interface elements.

Subtle film grain, vignette, chromatic dispersion at only the strongest lensing edges, and restrained bloom create a cinematic finish. Effects must not wash out the black-hole shadow or turn the starfield into visual noise.

### Science deck

A collapsible panel exposes five primary controls:

- **Mass:** changes the displayed scale and derived Schwarzschild-radius readout while maintaining a useful visual framing.
- **Spin:** changes rotational distortion, Doppler asymmetry, inner disk radius, and disk animation speed.
- **Disk heat:** shifts the disk from amber/red toward white-hot and increases bloom energy.
- **Lensing:** artistically scales the apparent bending strength within a physically plausible visual range.
- **Time:** pauses or scales accretion flow, star drift, and camera ambience.

The deck also provides Reset, Hide UI, and Quality controls. Values use scientific labels and friendly explanatory tooltips, but no long-form educational content is required for the first version.

### Camera and interaction

- Pointer drag orbits the camera around the subject with damped momentum.
- Mouse wheel or trackpad pinch adjusts distance within safe bounds.
- Keyboard shortcuts: `Space` pauses time, `H` hides the interface, `R` resets the view, and `1`–`4` select camera presets.
- Camera presets: **Observatory**, **Edge of Light**, **Polar Crown**, and **Wide Orbit**.
- Camera limits prevent crossing through the event shadow or reaching angles where the approximation breaks down.
- An idle camera drift begins after a short period without input and stops immediately on interaction.

## Technical approach

### Stack

- Vite and TypeScript for the application shell and build tooling.
- Three.js with direct scene management rather than a component abstraction layer.
- Custom GLSL shader materials for the black-hole image, accretion disk, star lensing, and procedural noise.
- Three.js post-processing for bloom, color grading, vignette, and final compositing.
- CSS and semantic HTML for the interface overlay.
- Vitest for deterministic unit tests and Playwright-compatible DOM structure for later end-to-end checks.

### Rendering model

The visual uses a hybrid screen-space relativistic approximation:

1. A full-screen shader pass reconstructs a view ray for each fragment from the active camera state.
2. The shader analytically bends the ray around a rotating mass using a stable approximation parameterized by mass, spin, and lensing strength.
3. Ray intersections with an equatorial accretion disk are accumulated over a small fixed number of steps.
4. Disk color comes from radius-based temperature, procedural turbulence, and time-driven angular flow.
5. Doppler beaming brightens the approaching disk and dims/reddens the receding side.
6. Gravitational redshift warms and darkens emission near the inner stable orbit.
7. Rays missing the disk sample a procedural or generated stellar environment, with lensing displacement near the photon ring.
8. A sharp black capture region, thin photon ring, bloom, and exposure curve form the final silhouette.

This model is not a numerical Kerr geodesic integrator. It deliberately preserves the strongest observable cues at a predictable per-pixel cost suitable for real-time interaction.

### Scene modules

- `BlackHoleRenderer`: owns WebGL renderer, scene lifecycle, frame timing, resize handling, and adaptive pixel ratio.
- `BlackHolePass`: shader pass that renders the lensing, shadow, photon ring, and disk.
- `Starfield`: deterministic layered stellar environment with subtle parallax and color variation.
- `PostProcessing`: bloom and final color treatment with quality-specific settings.
- `CameraController`: orbit, zoom, presets, damping, idle drift, and safe bounds.
- `SimulationStore`: typed state and subscriptions for physical parameters, quality, time, and interface visibility.
- `ScienceDeck`: accessible controls, live readouts, shortcuts, and explanatory labels.
- `IntroSequence`: loading state and first-view reveal, disabled when reduced motion is requested.

Each module has one primary responsibility and communicates through typed state or narrow update methods. Shader uniform updates are centralized so UI code never reaches into shader internals.

## State and data flow

User input updates `SimulationStore`. The animation loop reads a frame snapshot, advances simulation time, updates camera state, maps simulation values to shader uniforms, and renders the post-processing chain. Readouts subscribe to the same state and derived-value helpers, ensuring displayed values and renderer behavior stay consistent.

All simulation parameters are local and deterministic. No backend, account, network API, or persistence beyond optional local quality preference is required.

## Performance strategy

- Cap effective device pixel ratio by quality level.
- Measure rolling frame time and lower or raise internal resolution only after sustained thresholds to avoid oscillation.
- Use fixed-bounds shader loops so WebGL compilers can optimize them.
- Keep high-frequency animation state outside DOM rendering.
- Pause rendering when the document is hidden and reduce work when time is paused.
- Provide High, Balanced, and Performance presets; default to an automatic Balanced profile.
- Respect `prefers-reduced-motion` by skipping the intro drift and disabling idle camera motion.

## Error handling and fallback

- Detect WebGL2 before initializing the main experience.
- If WebGL2 is unavailable, show a styled fallback explaining that a modern GPU-enabled browser is required.
- If shader compilation fails, replace the canvas with the same fallback and expose a concise diagnostic in the console.
- If the measured frame rate remains below the performance threshold at minimum resolution, disable expensive bloom and reduce disk steps.
- Resize, visibility, and context-loss events must be handled without leaking animation frames or listeners.

## Accessibility

- All controls use native labeled inputs and visible keyboard focus states.
- Text and control contrast meet WCAG AA against the dark overlay.
- Interface functions remain usable by keyboard.
- Motion-heavy intro and idle behavior respect reduced-motion preferences.
- Scientific values are conveyed in text, not color alone.
- The canvas is marked as a visual simulation with an accessible summary.

## Testing and verification

### Unit tests

- Simulation parameter bounds, reset behavior, and derived scientific readouts.
- Camera preset values and safe-distance clamping.
- Quality selection and adaptive-resolution threshold logic.
- Color-temperature and shader-uniform mapping helpers.

### Integration checks

- App initializes a renderer when WebGL2 is available and renders the fallback otherwise.
- Control input updates the corresponding store value and renderer uniform.
- Keyboard shortcuts toggle pause, UI visibility, reset, and presets.
- Resize and teardown do not leave duplicate listeners or animation loops.

### Visual and runtime verification

- Production build succeeds without TypeScript or shader-import errors.
- Browser console remains free of errors during startup and interaction.
- The main view is inspected at common desktop sizes and a narrower layout.
- Frame timing is sampled in the running build; adaptive quality changes must be stable.
- Screenshots verify the event shadow remains black, the disk shows upper/lower lensing, the bright side is visibly asymmetric, controls do not obscure the subject, and the hidden-UI mode is cinematic.

## Scope boundaries

The first version excludes a numerical general-relativity solver, mobile-first controls, VR, audio, user accounts, save files, educational chapters, and real astronomical datasets. These may be added later without changing the renderer/store boundary.
