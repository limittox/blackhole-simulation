# GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken legacy/Jekyll Pages publication with an automatically verified Vite artifact deployment at `https://limittox.github.io/blackhole-simulation/`.

**Architecture:** Vite emits repository-prefixed asset URLs into `dist`. A pinned GitHub Actions workflow tests, builds, uploads that directory, and deploys it through the `github-pages` environment; the existing Pages site is migrated from `legacy` to `workflow` through the GitHub Pages API.

**Tech Stack:** Vite 8, TypeScript, Vitest, GitHub Actions, GitHub Pages REST API

## Global Constraints

- The production base path is exactly `/blackhole-simulation/`.
- Publish only `dist`; do not commit generated build output or create a `gh-pages` branch.
- Run `npm test` and `npm run build` before artifact upload.
- Use Node 22 with `npm ci` and the committed lockfile.
- Default to no workflow permissions, grant the build job only `contents: read`,
  and grant the deploy job only `pages: write` and `id-token: write`.
- Pin every third-party action to the audited immutable commit SHA.
- Preserve the public URL `https://limittox.github.io/blackhole-simulation/`.

---

### Task 1: Build and deployment contract

**Files:**
- Create: `src/deployment/GitHubPages.test.ts`
- Modify: `vite.config.ts`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: the existing `npm test` and `npm run build` scripts.
- Produces: Vite `base: '/blackhole-simulation/'` and a `deploy-pages.yml` workflow that publishes `dist`.

- [ ] **Step 1: Write the failing deployment regression**

Create `src/deployment/GitHubPages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

const pagesWorkflows = import.meta.glob<string>(
  '../../.github/workflows/deploy-pages.yml',
  { query: '?raw', import: 'default', eager: true },
);
const pagesWorkflow =
  pagesWorkflows['../../.github/workflows/deploy-pages.yml'] ?? '';

const yamlBlock = (source: string, header: string) => {
  const lines = source.split(/\r?\n/);
  const start = lines.indexOf(header);
  if (start === -1) return '';

  const indentation = header.length - header.trimStart().length;
  const block = [header];

  for (const line of lines.slice(start + 1)) {
    const nextIndentation = line.length - line.trimStart().length;
    if (line.trim() && nextIndentation <= indentation) break;
    block.push(line);
  }

  return block.join('\n').trimEnd();
};

const actionReferences = (source: string) =>
  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('uses: '));

const expectedActionReferences = [
  'uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
  'uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
  'uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9',
  'uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d',
  'uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128',
];

describe('GitHub Pages deployment', () => {
  it('builds assets below the repository Pages path', () => {
    expect(viteConfig).toMatchObject({ base: '/blackhole-simulation/' });
  });

  it('tests and builds a pinned Pages artifact before deploying it', () => {
    expect(pagesWorkflow).toContain("branches: ['main']");
    expect(pagesWorkflow).toContain('workflow_dispatch:');
    expect(pagesWorkflow).toContain('contents: read');
    expect(pagesWorkflow).toContain('pages: write');
    expect(pagesWorkflow).toContain('id-token: write');
    expect(pagesWorkflow).toContain('node-version: 22');
    expect(pagesWorkflow).toContain('run: npm ci');
    expect(pagesWorkflow).toContain('run: npm test');
    expect(pagesWorkflow).toContain('run: npm run build');
    expect(pagesWorkflow).toContain("path: './dist'");
    expect(pagesWorkflow).toContain('needs: build');
    expect(pagesWorkflow).toContain('name: github-pages');
    expect(pagesWorkflow).toContain('url: ${{ steps.deployment.outputs.page_url }}');

    const testStep = pagesWorkflow.indexOf('run: npm test');
    const buildStep = pagesWorkflow.indexOf('run: npm run build');
    const uploadStep = pagesWorkflow.indexOf('actions/upload-pages-artifact@');
    expect(testStep).toBeGreaterThan(-1);
    expect(testStep).toBeLessThan(buildStep);
    expect(buildStep).toBeLessThan(uploadStep);

    expect(pagesWorkflow).toContain(
      'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
    );
    expect(pagesWorkflow).toContain(
      'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
    );
    expect(pagesWorkflow).toContain(
      'actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d',
    );
    expect(pagesWorkflow).toContain(
      'actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9',
    );
    expect(pagesWorkflow).toContain(
      'actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128',
    );
  });

  it('scopes write credentials and Pages configuration to deployment', () => {
    const buildJob = yamlBlock(pagesWorkflow, '  build:');
    const deployJob = yamlBlock(pagesWorkflow, '  deploy:');

    expect.soft(yamlBlock(pagesWorkflow, 'permissions: {}')).toBe(
      'permissions: {}',
    );
    expect.soft(yamlBlock(buildJob, '    permissions:')).toBe(
      '    permissions:\n      contents: read',
    );
    expect.soft(buildJob).not.toContain('pages: write');
    expect.soft(buildJob).not.toContain('id-token: write');
    expect.soft(yamlBlock(deployJob, '    permissions:')).toBe(
      '    permissions:\n      pages: write\n      id-token: write',
    );
    expect.soft(deployJob).not.toContain('contents: read');
    expect.soft(actionReferences(buildJob)).toEqual(
      expectedActionReferences.slice(0, 3),
    );
    expect.soft(actionReferences(deployJob)).toEqual(
      expectedActionReferences.slice(3),
    );
    expect(deployJob).toContain(
      [
        '      - name: Configure Pages',
        `        ${expectedActionReferences[3]}`,
        '      - name: Deploy to GitHub Pages',
        '        id: deployment',
        `        ${expectedActionReferences[4]}`,
      ].join('\n'),
    );
  });

  it('uses exactly the approved immutable action references', () => {
    const references = actionReferences(pagesWorkflow);

    expect(references).toEqual(expectedActionReferences);
    expect(references).toHaveLength(5);
    for (const reference of references) {
      expect(reference).toMatch(/^uses: [^@\s]+@[0-9a-f]{40}$/);
    }
  });
});
```

- [ ] **Step 2: Confirm the red state**

Run:

```powershell
npx vitest run src/deployment/GitHubPages.test.ts
```

Expected: FAIL because the workflow file does not exist and Vite has no Pages base.

- [ ] **Step 3: Configure the Vite base**

Add the exact root property to `vite.config.ts`:

```ts
export default defineConfig({
  base: '/blackhole-simulation/',
  // existing build and test settings remain unchanged
});
```

- [ ] **Step 4: Add the pinned Pages workflow**

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions: {}

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    permissions:
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      - name: Set up Node
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9
        with:
          path: './dist'

  deploy:
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Configure Pages
        uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128
```

- [ ] **Step 5: Confirm the green state and generated paths**

Run:

```powershell
npx vitest run src/deployment/GitHubPages.test.ts
npm test
npm run typecheck
npm run build
```

Expected: the focused test and all project tests pass, typecheck/build exit 0,
and `dist/index.html` contains `/blackhole-simulation/assets/` with no
`src="/assets/` or `href="/assets/` references.

- [ ] **Step 6: Commit the implementation**

```powershell
git add -- src/deployment/GitHubPages.test.ts vite.config.ts .github/workflows/deploy-pages.yml
git commit -m "ci: deploy simulation to GitHub Pages"
```

### Task 2: Migrate and verify the live Pages site

**Files:**
- No repository files changed.

**Interfaces:**
- Consumes: the committed `deploy-pages.yml`, GitHub repository admin credentials, and the existing legacy Pages site.
- Produces: Pages `build_type: workflow`, a successful deployment run, and a verified public URL.

- [ ] **Step 1: Re-read the live Pages state**

Use the authenticated GitHub Pages REST endpoint and verify the response still
contains `build_type: legacy`, `source.branch: main`, and the expected public
URL. Stop if the state changed unexpectedly.

- [ ] **Step 2: Switch the existing site to workflow publishing**

Send:

```http
PUT /repos/limittox/blackhole-simulation/pages
Content-Type: application/json

{"build_type":"workflow"}
```

Verify a follow-up GET returns `build_type: workflow`. If the subsequent push
fails, restore `build_type: legacy` with source `{branch: "main", path: "/"}`.

- [ ] **Step 3: Push the implementation**

```powershell
git push origin main
```

Expected: `origin/main` advances to the deployment implementation commit and a
`Deploy to GitHub Pages` push workflow starts for that SHA.

- [ ] **Step 4: Monitor the workflow**

Poll the GitHub Actions API for the run attached to the pushed commit. Require
both the `build` and `deploy` jobs to conclude `success`; on failure, collect the
failed job and step logs, fix the repository configuration, and re-run.

- [ ] **Step 5: Verify the public deployment**

Open `https://limittox.github.io/blackhole-simulation/`. Confirm HTTP 200,
the canvas and science controls render, emitted JS/CSS requests are under
`/blackhole-simulation/assets/` and return 200, WebGL renders the black hole,
and the browser console contains no errors.

- [ ] **Step 6: Confirm final repository state**

Verify `main` equals `origin/main`, Pages still reports `build_type: workflow`,
the deployment URL matches the expected public URL, and the worktree is clean.
