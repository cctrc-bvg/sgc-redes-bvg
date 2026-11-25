/**
 * Testes de fumaça de ponta a ponta (Playwright), com JavaScript ligado, sobre os DADOS DE DEMONSTRAÇÃO.
 *
 * Pré-requisitos: banco com `npm run db:seed` + `npm run db:demo -- --confirmo` e o build de produção
 * (`npm run build`). O Playwright sobe o servidor standalone sozinho (scripts/e2e-servidor.sh) ou
 * reaproveita um que já esteja rodando em BASE_URL.
 *
 *   npm run e2e                      # todos os roteiros
 *   npm run e2e -- e2e/menus.spec.ts # um roteiro
 *
 * Variáveis: BASE_URL (padrão http://127.0.0.1:3123) e DEMO_SENHA (padrão Demonstracao2026).
 * Os roteiros alteram dados (envios, importação): rode sobre um banco descartável.
 */
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3123').replace(/\/$/, '');
const PORTA = new URL(BASE_URL).port || '3123';

export default defineConfig({
  testDir: 'e2e',
  // Os roteiros compartilham o mesmo banco: um de cada vez, na ordem dos arquivos.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bash scripts/e2e-servidor.sh',
    url: `${BASE_URL}/login`,
    env: { PORT: PORTA, APP_URL: BASE_URL },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
