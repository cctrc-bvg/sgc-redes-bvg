import { expect, test } from '@playwright/test';
import { entrar, USUARIOS } from './apoio';

test.describe('Login e sessão', () => {
  test('senha errada mostra o erro e mantém o e-mail digitado', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail institucional').fill(USUARIOS.professor);
    await page.getByLabel('Senha').fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('E-mail ou senha incorretos')).toBeVisible();
    await expect(page.getByLabel('E-mail institucional')).toHaveValue(USUARIOS.professor);
    await expect(page).toHaveURL(/\/login/);
  });

  test('página logada sem sessão leva ao login', async ({ page }) => {
    await page.goto('/grade');
    await expect(page).toHaveURL(/\/login/);
  });

  test('entra, vê o painel do perfil e sai', async ({ page }) => {
    await entrar(page, 'coordenacao');
    await expect(page.getByRole('heading', { level: 1, name: /Olá/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Conta' })).toContainText('Coordenação');
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);
    // A sessão foi encerrada no servidor: voltar ao painel pede login de novo.
    await page.goto('/painel');
    await expect(page).toHaveURL(/\/login/);
  });
});
