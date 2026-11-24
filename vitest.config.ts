import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mesmo atalho do tsconfig.json ("@/*" → "./src/*").
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Servidor com pouca RAM: um worker por vez.
    pool: 'forks',
    maxWorkers: 1,
  },
});
