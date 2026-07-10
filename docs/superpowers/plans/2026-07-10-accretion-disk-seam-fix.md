# Accretion Disk Seam Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the straight azimuth seam from the direct and gravitationally lensed accretion disk without changing its geometry, palette, or quality budgets.

**Architecture:** Keep the existing ray marcher and disk sampler intact. Make value noise periodic along its flow axis and tune each flow frequency to an integer lattice period across the full `atan` wrap, so the texture domain closes continuously without introducing repeated angular sectors.

**Tech Stack:** TypeScript, Vitest, GLSL ES, Three.js, Vite

## Global Constraints

- Preserve the ray integration, disk geometry, colors, animation speed, and quality budgets.
- Retain two turbulence octaves and the existing radius/time variation.
- Use 32- and 81-cell lattice periods, keeping both flow frequencies within 0.14 percent of their current values.
- Add no dependencies, extra noise samples, or additional ray-marching work.

---

### Task 1: Make accretion turbulence periodic

**Files:**
- Modify: `src/render/BlackHoleRenderer.test.ts:43`
- Modify: `src/render/shaders/blackHole.frag.glsl:129`

**Interfaces:**
- Consumes: `flow`, `radius`, and `time` scalar values already computed by `sampleAccretionDisk`.
- Produces: `valueNoisePeriodicX(vec2 p, float period) -> float`, used only by the existing `turbulence` calculation.

- [ ] **Step 1: Write the failing regression test**

Add this case inside `describe('BlackHoleRenderer', ...)`:

```ts
it('wraps accretion turbulence continuously around the disk azimuth', () => {
  expect(fragmentShader).toContain(
    'float valueNoisePeriodicX(vec2 p, float period)',
  );
  expect(fragmentShader).toContain(
    'const float PRIMARY_NOISE_PERIOD = 32.0;',
  );
  expect(fragmentShader).toContain(
    'const float SECONDARY_NOISE_PERIOD = 81.0;',
  );
  expect(fragmentShader).toContain(
    'PRIMARY_NOISE_PERIOD / (TAU * 3.0)',
  );
  expect(fragmentShader).toContain(
    'SECONDARY_NOISE_PERIOD / (TAU * 3.0)',
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

Expected: FAIL because periodic flow-axis noise and its lattice periods are absent while the raw-flow lookups remain.

- [ ] **Step 3: Implement periodic flow-axis lattice coordinates**

Replace the original value-noise helper with a centered cell wrapper and
periodic flow-axis helper:

```glsl
float wrapPeriodicCell(float value, float period) {
  return mod(value + period * 0.5, period) - period * 0.5;
}

float valueNoisePeriodicX(vec2 p, float period) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);
  float cellX0 = wrapPeriodicCell(cell.x, period);
  float cellX1 = wrapPeriodicCell(cell.x + 1.0, period);
  float a = hash21(vec2(cellX0, cell.y));
  float b = hash21(vec2(cellX1, cell.y));
  float c = hash21(vec2(cellX0, cell.y + 1.0));
  float d = hash21(vec2(cellX1, cell.y + 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}
```

Then replace the two raw-flow lookups in `sampleAccretionDisk` with:

```glsl
const float PRIMARY_NOISE_PERIOD = 32.0;
const float SECONDARY_NOISE_PERIOD = 81.0;
float primaryFlowFrequency = PRIMARY_NOISE_PERIOD / (TAU * 3.0);
float secondaryFlowFrequency = SECONDARY_NOISE_PERIOD / (TAU * 3.0);
float turbulence = valueNoisePeriodicX(
  vec2(flow * primaryFlowFrequency, radius * 3.9 + time * 0.14),
  PRIMARY_NOISE_PERIOD
);
turbulence += 0.5 * valueNoisePeriodicX(
  vec2(flow * secondaryFlowFrequency - time * 0.27, radius * 8.1),
  SECONDARY_NOISE_PERIOD
);
```

The angle changes by `2*pi` across the `atan` branch cut, while `flow` changes
by `TAU * 3`. The noise coordinates therefore change by exactly one matching
lattice period: 32 cells for the first octave and 81 for the second.

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
