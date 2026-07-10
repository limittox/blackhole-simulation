import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/blackhole-simulation/',
  build: {
    chunkSizeWarningLimit: 650,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
