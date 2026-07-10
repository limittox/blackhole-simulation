import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

const pagesWorkflows = import.meta.glob<string>(
  '../../.github/workflows/deploy-pages.yml',
  { query: '?raw', import: 'default', eager: true },
);
const pagesWorkflow =
  pagesWorkflows['../../.github/workflows/deploy-pages.yml'] ?? '';

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
});
