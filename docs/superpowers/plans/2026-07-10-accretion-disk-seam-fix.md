# Accretion Disk Seam Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the straight azimuth seam from the direct and gravitationally lensed accretion disk without changing its geometry, palette, or quality budgets.

**Architecture:** Keep the existing ray marcher and disk sampler intact. Replace only the two turbulence lookups that use a discontinuous scalar angle with circular `cos`/`sin` coordinates, so the texture domain closes continuously at the `atan` branch cut.

**Tech Stack:** TypeScript, Vitest, GLSL ES, Three.js, Vite

## Global Constraints

- Preserve the ray integration, disk geometry, colors, animation speed, and quality budgets.
- Retain two turbulence octaves and the existing radius/time variation.
- Add no dependencies and no additional ray-marching work.

---

### Task 1: Make accretion turbulence periodic

**Files:**
- Modify: `src/render/BlackHoleRenderer.test.ts:43`
- Modify: `src/render/shaders/blackHole.frag.glsl:129`

**Interfaces:**
- Consumes: `flow`, `radius`, and `time` scalar values already computed by `sampleAccretionDisk`.
- Produces: `periodicOrbit` and `periodicOrbit2` circular coordinates used only by the existing `turbulence` calculation.

- [ ] **Step 1: Write the failing regression test**

Add this case inside `describe('BlackHoleRenderer', ...)`:

```ts
it('wraps accretion turbulence continuously around the disk azimuth', () => {
  expect(fragmentShader).toContain(
    'vec2 periodicOrbit = vec2(cos(flow), sin(flow));',
  );
  expect(fragmentShader).toContain(
    'vec2 periodicOrbit2 = vec2(cos(flow * 2.0), sin(flow * 2.0));',
  );
  expect(fragmentShader).not.toContain('valueNoise(vec2(flow * 1.7');
  expect(fragmentShader).not.toContain('valueNoise(vec2(flow * 4.3');
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```powershell
npx vitest run src/render/BlackHoleRenderer.test.ts -t "wraps accretion turbulence continuously"
```

Expected: FAIL because `periodicOrbit` and `periodicOrbit2` are absent and the raw-flow lookups remain.

- [ ] **Step 3: Implement circular turbulence coordinates**

Replace the two raw-flow noise lookups in `sampleAccretionDisk` with:

```glsl
vec2 periodicOrbit = vec2(cos(flow), sin(flow));
vec2 periodicOrbit2 = vec2(cos(flow * 2.0), sin(flow * 2.0));
float turbulence = valueNoise(periodicOrbit * 2.35 + vec2(radius * 0.37, time * 0.14));
turbulence += 0.5 * valueNoise(periodicOrbit2 * 3.6 + vec2(radius * 0.61, -time * 0.27));
```

The angle changes by `2*pi` across the `atan` branch cut, while `flow` changes by `6*pi`; both circular coordinate pairs therefore meet exactly at the wrap.

- [ ] **Step 4: Run the focused test and confirm the green state**

Run:

```powershell
npx vitest run src/render/BlackHoleRenderer.test.ts -t "wraps accretion turbulence continuously"
```

Expected: PASS.

- [ ] **Step 5: Run all automated verification**

Run:

```powershell
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all tests pass, TypeScript emits no diagnostics, Vite creates the production bundle, and Git reports no whitespace errors.

- [ ] **Step 6: Verify the rendered result**

Launch the production preview, open the close black-hole view in the in-app browser, and inspect the left and right azimuth wrap regions. Confirm that no straight discontinuity crosses the rings and that the granular bands remain visible around the full disk.

- [ ] **Step 7: Commit the implementation**

```powershell
git add -- src/render/BlackHoleRenderer.test.ts src/render/shaders/blackHole.frag.glsl docs/superpowers/plans/2026-07-10-accretion-disk-seam-fix.md
git commit -m "fix: remove accretion disk texture seam"
```
