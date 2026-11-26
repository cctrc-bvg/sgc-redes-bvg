import { expect, type Page } from '@playwright/test';

/** Usuários dos dados de demonstração (prisma/demo.ts). */
export const USUARIOS = {
  coordenacao: 'coordenacao@exemplo.edu.br',
  professor: 'ana.lima@exemplo.edu.br',
  ctp: 'ctp@exemplo.edu.br',
  direcao: 'direcao@exemplo.edu.br',
  cae: 'cae@exemplo.edu.br',
  cca: 'cca@exemplo.edu.br',
} as const;

export type Perfil = keyof typeof USUARIOS;

export const SENHA_DEMO = process.env.DEMO_SENHA || 'Demonstracao2026';

/** Entra pela tela de login e espera chegar ao painel. */
export async function entrar(page: Page, perfil: Perfil) {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(USUARIOS[perfil]);
  await page.getByLabel('Senha').fill(SENHA_DEMO);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // O primeiro login depois de subir o servidor é lento em máquina fraca (bcrypt + conexão fria ao banco).
  await expect(page).toHaveURL(/\/painel/, { timeout: 30_000 });
}
