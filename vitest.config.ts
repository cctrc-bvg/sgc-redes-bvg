import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Servidor com pouca RAM: um worker por vez.
    pool: 'forks',
    maxWorkers: 1,
  },
});
