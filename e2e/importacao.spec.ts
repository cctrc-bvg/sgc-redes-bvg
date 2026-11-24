import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('importação de usuários: prévia, confirmação e senha provisória', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/usuarios/importar');
  await expect(page.getByRole('heading', { level: 1, name: 'Importar usuários por planilha' })).toBeVisible();

  const email = `e2e.${Date.now()}@exemplo.edu.br`;
  const csv = `Nome completo,E-mail,Perfil\nPessoa Teste E2E,${email},Professor\n`;
  await page.getByLabel(/^Arquivo/).setInputFiles({ name: 'usuarios.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await page.getByRole('button', { name: 'Analisar planilha' }).click();

  // Prévia: nada gravado ainda.
  const previa = page.locator('section[aria-labelledby="passo3"]');
  await expect(previa).toContainText('1 novo(s)');
  await expect(previa).toContainText('0 com erro');
  await page.goto('/usuarios');
  await expect(page.getByText(email)).toHaveCount(0);

  // Envia de novo e confirma.
  await page.goto('/usuarios/importar');
  await page.getByLabel(/^Arquivo/).setInputFiles({ name: 'usuarios.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await page.getByRole('button', { name: 'Analisar planilha' }).click();
  await page.getByRole('button', { name: 'Confirmar importação' }).click();
  const senhas = page.locator('section[aria-labelledby="senhas"]');
  await expect(senhas).toContainText(email);

  await page.goto('/usuarios');
  await expect(page.getByText(email)).toBeVisible();
});
