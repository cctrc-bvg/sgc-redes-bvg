import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('resumo semanal: gera uma mensagem por docente e registra o envio uma vez por semana', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/comunicacao/periodicas');
  await expect(page.getByRole('heading', { level: 1, name: 'Resumo semanal dos docentes' })).toBeVisible();

  const texto = page.getByLabel('Texto da mensagem').first();
  await expect(texto).toHaveValue(/Segue o resumo da semana de \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}\./);
  await expect(texto).toHaveValue(/\*Suas aulas\*/);

  await page.getByLabel('Enviado por').first().selectOption('EMAIL_MANUAL');
  await page.getByRole('button', { name: 'Já enviei: registrar' }).first().click();
  await expect(page.locator('main')).toContainText('Envio registrado (e-mail).');

  // Depois de registrado, o docente sai da fila da semana.
  await page.reload();
  await expect(page.locator('main')).toContainText('✔ Envio registrado.');
});
