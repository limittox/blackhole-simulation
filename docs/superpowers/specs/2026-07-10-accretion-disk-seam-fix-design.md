# Accretion Disk Seam Fix Design

## Problem

The accretion disk shows a straight horizontal seam where the azimuth returned by
`atan(z, x)` wraps from `+pi` to `-pi`. The ray-traced hit positions remain
continuous, but the shader passes that wrapped angle directly into non-periodic
value-noise coordinates. The resulting jump is visible in both the direct disk
and its gravitationally lensed image.

## Chosen Design

Keep the ray integration, disk geometry, colors, animation speed, and quality
budgets unchanged. Map the animated angular flow onto a unit circle with
`cos(flow)` and `sin(flow)` before sampling turbulence. Use separate circular
coordinates for the two noise octaves, with the existing radius and time terms
retained as offsets. Both sides of the `atan` branch cut then produce identical
noise coordinates, eliminating the seam without blurring disk detail.

## Alternatives Considered

- Feather the seam in screen space: easy to hide at one camera angle, but it
  would conceal rather than remove the discontinuity and could fail as the
  camera moves.
- Change the `atan` branch-cut direction: this would only move the artifact.
- Add 3D noise: naturally supports cylindrical coordinates, but adds shader
  complexity and GPU cost that are unnecessary for this localized defect.

## Verification

- Add a shader-source regression test requiring circular orbital coordinates
  and rejecting the old raw-flow value-noise lookup.
- Run the full unit suite, TypeScript check, production build, and diff checks.
- Inspect the rendered disk close-up in the browser at the former seam location
  and confirm the lensed rings remain detailed and animated.
