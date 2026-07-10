# GitHub Pages Deployment Design

## Goal

Publish the existing Vite/WebGL black-hole simulation at
`https://limittox.github.io/blackhole-simulation/` and redeploy it
automatically whenever `main` changes.

The repository currently has Pages enabled in legacy branch/Jekyll mode. That
deployment serves the raw Vite entry, so `/src/main.ts` resolves at the account
root and returns 404. This change migrates the existing site rather than
creating a second Pages site.

## Chosen Design

Use GitHub's artifact-based Pages workflow. Vite will build the application
with `base: '/blackhole-simulation/'`, GitHub Actions will upload only `dist`,
and the Pages deployment job will publish that artifact through the
`github-pages` environment.

The workflow will:

- run on pushes to `main` and manual `workflow_dispatch` runs;
- install the locked dependency graph with Node 22 and `npm ci`;
- run the full test suite and production build before publishing;
- use the minimum required `contents: read`, `pages: write`, and
  `id-token: write` permissions;
- prevent overlapping Pages deployments with a single concurrency group;
- upload `dist` rather than committing generated files to the repository.

## Path Compatibility

The Vite entry in `index.html` is build-managed and will be rewritten beneath
the configured base path. The project has no public assets, CSS URL references,
runtime fetches, client-side routes, or other root-relative resources. No
custom `404.html` fallback is required.

## Activation and Data Flow

After the configuration reaches `main`, switch the existing repository Pages
source from branch/Jekyll publishing to GitHub Actions. The workflow then checks
out the pushed commit, verifies and builds it, uploads the static artifact, and
deploys it. The resulting public URL is taken from the deployment job output
rather than inferred during validation.

## Verification

- Add a regression test for the exact Vite base and the workflow's trigger,
  build, artifact, permissions, environment, and deployment contract.
- Run the regression test red before implementation and green afterward.
- Run all tests, typecheck, and the production build locally.
- Confirm generated HTML references
  `/blackhole-simulation/assets/` and contains no root `/assets/` URLs.
- Verify the pushed GitHub Actions run succeeds.
- Open the public Pages URL, confirm the WebGL experience renders, verify its
  same-origin JS/CSS assets return successfully, and check for browser errors.

## Alternatives Considered

- Commit `dist` to a `gh-pages` branch: works, but stores generated output and
  adds branch-maintenance machinery.
- Publish raw files from `main`: unsuitable because Vite requires a build step.
- Use a root base or custom domain: unnecessary for this repository-scoped
  project site and would make the default Pages URL resolve assets incorrectly.

## Rollback

The deployment is isolated to `vite.config.ts` and one workflow file. Reverting
their implementation commit stops future deployments and restores the original
root build behavior; the Pages site can then be unpublished independently.
