# Accretion Disk Seam Fix Design

## Problem

The accretion disk shows a straight horizontal seam where the azimuth returned by
`atan(z, x)` wraps from `+pi` to `-pi`. The ray-traced hit positions remain
continuous, but the shader passes that wrapped angle directly into non-periodic
value-noise coordinates. The resulting jump is visible in both the direct disk
and its gravitationally lensed image.

## Chosen Design

Keep the ray integration, disk geometry, colors, animation speed, and quality
budgets unchanged. Make the existing value noise periodic only along its flow
axis. The flow changes by `TAU * 3` across the `atan` branch cut, so use the
nearest integer lattice periods to the current frequencies: 32 cells for the
1.7 octave and 81 cells for the 4.3 octave. Derive the exact replacement
frequencies from those periods, changing them by less than 0.14 percent.

Wrap lattice-cell hashes around a centered period while leaving the fractional
interpolation and radial/time coordinates intact. This makes both sides of the
branch cut sample the same cells, preserves the current noise almost everywhere,
and adds neither extra noise samples nor repeated angular sectors.

## Alternatives Considered

- Feather the seam in screen space: easy to hide at one camera angle, but it
  would conceal rather than remove the discontinuity and could fail as the
  camera moves.
- Change the `atan` branch-cut direction: this would only move the artifact.
- Map flow directly through `cos` and `sin`: seamless and inexpensive, but the
  existing `angle * 3` flow would visibly repeat the same turbulence three times.
- Add 3D noise: naturally supports cylindrical coordinates, but adds shader
  complexity and GPU cost that are unnecessary for this localized defect.

## Verification

- Add a shader-source regression test requiring periodic flow-axis noise with
  the 32- and 81-cell periods and rejecting the old raw-flow lookups.
- Run the full unit suite, TypeScript check, production build, and diff checks.
- Inspect the rendered disk close-up in the browser at the former seam location
  and confirm the lensed rings remain detailed and animated.
