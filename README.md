# Gargantua — Interactive Black Hole Observatory

A desktop-first, real-time black-hole visualization built with Three.js and a custom GLSL lensing shader. The simulation combines physically recognizable phenomena—light bending, a captured-light shadow, photon ring, accretion flow, gravitational redshift, and relativistic Doppler beaming—with controlled cinematic exaggeration.

All visual assets are generated procedurally. The project does not use imagery, footage, or other assets from *Interstellar*.

## Run locally

```bash
npm install
npm run dev
```

Vite prints the local development URL. Open it in a current desktop browser with hardware acceleration enabled.

## Quality checks

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

## Controls

| Input | Action |
| --- | --- |
| Pointer drag | Orbit around the black hole |
| Mouse wheel / trackpad scroll | Change observation distance |
| `Space` | Pause or resume time |
| `H` | Hide or reveal the interface |
| `R` | Reset simulation values and camera |
| `1` | Observatory view |
| `2` | Edge of Light view |
| `3` | Polar Crown view |
| `4` | Wide Orbit view |

The science deck controls mass, spin, accretion heat, lensing intensity, time flow, camera trajectories, and render quality.

## Rendering model

The full-screen fragment shader reconstructs a view ray per fragment, curves it toward a rotating mass, accumulates intersections with a procedural equatorial accretion disk, and samples a generated stellar environment along the escaped direction. A capture region creates the event shadow; closest-approach energy creates the photon ring. Disk emission includes radial temperature, turbulent orbital bands, gravitational redshift, and view-dependent Doppler beaming.

This is a real-time, physics-inspired approximation designed for interactive visual fidelity. It is not a numerical Kerr geodesic integrator and should not be used for scientific measurement.

## Performance and compatibility

- WebGL2 is required.
- Automatic quality starts at the Balanced profile and uses sustained frame-time thresholds before changing resolution or ray steps.
- High, Balanced, and Performance profiles can be selected manually.
- Rendering pauses while the page is hidden.
- Reduced-motion preferences skip the camera-led intro and idle drift.
- The interface remains keyboard accessible and uses native form controls.
