import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('diário: validação, atualização e lembrete ao docente', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/diarios');
  await page.locator('main a[href^="/diarios/"]').first().click();
  await expect(page).toHaveURL(/\/diarios\/[^/?]+$/);

  const ministradas = page.getByLabel(/^Aulas ministradas/);
  const emDia = page.getByLabel(/Diário em dia/);
  const original = await ministradas.inputValue();
  const estavaEmDia = await emDia.isChecked();

  // Valor inválido: erro, e a marcação feita continua.
  await emDia.setChecked(!estavaEmDia);
  await ministradas.fill('abc');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('main')).toContainText('Informe o número de aulas (ex.: 24).');
  await expect(emDia).toBeChecked({ checked: !estavaEmDia });

  await ministradas.fill(String(Number(original) + 1));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('main')).toContainText('Diário atualizado.');

  // Lembrete pronto ao docente: abre no e-mail e registra o envio.
  await expect(page.getByRole('link', { name: 'Abrir no e-mail' }).first()).toHaveAttribute('href', /^mailto:[^?]+@exemplo\.edu\.br\?/);
  await page.getByLabel('Enviado por').selectOption('EMAIL_MANUAL');
  await page.getByRole('button', { name: 'Já enviei: registrar lembrete' }).click();
  await expect(page.locator('main')).toContainText('Lembrete registrado (e-mail).');

  // Devolve os dados de demonstração.
  await ministradas.fill(original);
  await emDia.setChecked(estavaEmDia);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('main')).toContainText(/Diário atualizado\.|Nenhuma alteração para salvar\./);
});
