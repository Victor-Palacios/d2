import { defineConfig } from 'vitest/config';

// Unit tests cover the headless game logic only (battle model, damage maths,
// progression) — pure modules with no three.js or DOM imports, so the default
// Node environment is all they need. Browser behaviour is covered separately by
// the Playwright smoke tests in tools/smoke.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
