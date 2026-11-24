/**
 * Configuração do Prisma CLI. Substitui o bloco "prisma" do package.json, que o Prisma 7 deixa de ler.
 *
 * Com este arquivo, o Prisma não carrega mais o .env sozinho: carregamos aqui, sem sobrescrever variáveis
 * já definidas no ambiente (Docker Compose, CI e scripts/dev.sh continuam mandando).
 */
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
