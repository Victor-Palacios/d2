import { defineConfig } from 'vite';

// Relative base so the static build works from GitHub Pages / itch.io subpaths.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
