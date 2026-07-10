import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig({
  // Single version source for both web and desktop builds; surfaced in the status bar.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/__geocarto_basemap/v4.pmtiles': {
        target: 'https://data.source.coop',
        changeOrigin: true,
        rewrite: () => '/protomaps/openstreetmap/v4.pmtiles',
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Bundle budget is enforced separately by scripts/check-bundle-budget.mjs;
    // raising this just silences the rollup warning since our split chunks
    // (maplibre, konva) are intentionally large and downloaded in parallel.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split heavy renderer/exporter packages into their own chunks so the
        // initial shell parse stays small and the browser can fetch them in
        // parallel. M7 bundle hardening — keeps cold start headroom for the
        // PRD §7 < 2 s target.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('?raw') && (id.includes('/maplibre-gl/') || id.includes('/pmtiles/'))) {
            return 'html-runtime';
          }
          if (id.includes('/maplibre-gl/')) return 'maplibre';
          if (id.includes('/pmtiles/') || id.includes('@protomaps/')) return 'pmtiles';
          if (id.includes('/konva/') || id.includes('/react-konva/')) return 'konva';
          if (id.includes('/@deck.gl/') || id.includes('/@luma.gl/')) return 'deck';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/project/**/*.{ts,tsx}', 'src/state/**/*.{ts,tsx}', 'src/export/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      thresholds: {
        statements: 45,
        branches: 70,
        functions: 55,
        lines: 45,
      },
    },
  },
});
