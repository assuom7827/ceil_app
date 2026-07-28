import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
    // Les tests e2e sont pilotés par Playwright, pas par Vitest.
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    setupFiles: ['./tests/setup.ts'],
    // Les tests d'intégration partagent une base unique et la remettent à zéro
    // entre chaque cas : exécuter les fichiers en parallèle les ferait se
    // tronquer mutuellement. Les suites sont courtes, la sérialisation coûte peu.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/services/**/*.ts'],
    },
    environmentMatchGlobs: [['tests/components/**', 'jsdom']],
  },
});
