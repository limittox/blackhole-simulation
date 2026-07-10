# Spaceship Perspective Design

## Goal

Add an immersive first-person spaceship viewpoint to the black-hole simulation
while preserving every existing camera preset and the scientific control deck.

## Chosen Experience

Add a fifth camera preset named `Flight deck`, available from the camera grid
and keyboard shortcut `5`. The camera moves to a close, safe, slightly elevated
pose that frames the event horizon through a forward observation window.

Selecting the preset reveals a code-native cockpit layer:

- dark canopy arches and side struts that establish physical depth;
- a low console silhouette that leaves the event horizon unobstructed;
- subtle amber and ice-blue instrument illumination;
- a centered navigation reticle and restrained flight telemetry;
- glass reflections and very low-amplitude drift that respect reduced-motion
  preferences.

The existing science deck remains usable above the cockpit treatment. Hiding
the interface removes informational HUD text but retains the physical cockpit
frame, so the view still reads as being inside a ship.

## Architecture

- Extend `CameraPreset` with `cockpit` and add its safe pose to
  `CAMERA_PRESETS`.
- Add shortcut `5` and a `05 Flight deck` button through the existing store and
  preset-selection paths.
- Render the cockpit as semantic-free, `aria-hidden` HTML inside `ScienceDeck`.
  Toggle it with an `is-cockpit` class on the interface root derived solely from
  `snapshot.cameraPreset`.
- Implement the visual entirely in CSS gradients, borders, pseudo-elements,
  and clip paths. No raster assets, dependencies, or renderer work are needed.

## Interaction and State

The cockpit is active only when `cameraPreset === 'cockpit'`. Switching to any
other preset fades it away. Reset continues to restore `observatory`. Orbit and
zoom controls remain available from the cockpit camera.

The physical frame is a sibling of the ordinary `.interface-layer`, allowing it
to remain visible when `uiVisible` is false. HUD labels inside the frame fade in
that state. On narrow screens the struts and console become shallower to
preserve the black hole and avoid the bottom science deck.

## Accessibility and Performance

- Cockpit decoration is `aria-hidden` and never receives pointer events.
- The new camera button exposes normal pressed state and keyboard access.
- Shortcut `5` follows the same form-control guard as shortcuts `1`–`4`.
- Animation is transform/opacity based and disabled by the existing
  `prefers-reduced-motion` rule.
- The overlay adds no WebGL passes, textures, or network assets.

## Verification

- Test the new state union, safe camera pose, button selection, root class,
  shortcut, reset behavior, and decorative markup.
- Run the complete test suite, typecheck, production build, and whitespace
  checks.
- Inspect desktop and narrow browser views, with both UI-visible and UI-hidden
  states, and verify the console is clean.
- Push to `main`, require the Pages workflow to succeed, and visually verify the
  deployed `Flight deck` view.

## Alternatives Considered

- Third-person ship silhouette: preserves the existing UI but reads as watching
  a ship rather than occupying it.
- Full 3D cockpit geometry: offers real parallax but adds asset, renderer, and
  performance complexity disproportionate to a single viewpoint.
- HUD-only overlay: inexpensive, but lacks the canopy and console depth cues
  needed for a convincing spacecraft perspective.
