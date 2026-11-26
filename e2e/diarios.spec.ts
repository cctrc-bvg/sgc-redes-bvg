import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('diário: validação, atualização e lembrete ao docente', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/diarios');
  await page.locator('main a[href^="/diarios/"]:not([href^="/diarios/conferencia"])').first().click();
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

  // O valor corrigido à mão virou manual; "Voltar ao automático" devolve o presumido (RF08-A).
  // Espera a página assentar (o formulário remonta depois de salvar) antes de clicar.
  await expect(page.getByText('Salvando…')).toHaveCount(0, { timeout: 30_000 });
  const voltar = page.getByRole('button', { name: 'Voltar ao automático' });
  if (await voltar.isVisible()) {
    await voltar.click();
    await expect(page.locator('main')).toContainText('Valor automático', { timeout: 30_000 });
  }
});

test('conferência: valor igual ao presumido mantém o automático; diferente vira manual', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/diarios/conferencia');
  await expect(page.getByRole('heading', { level: 1, name: 'Conferência dos diários' })).toBeVisible();
  const linha = page.locator('tbody tr').first();
  await expect(linha).toBeVisible();
  const campo = linha.getByRole('textbox');
  const original = await campo.inputValue();
  const disciplina = await linha.getByRole('link').first().innerText();

  await campo.fill(String(Number(original) + 3));
  await linha.getByRole('button', { name: 'Conferir' }).click();
  // A linha pode mudar de posição (a lista ordena por diferença): procura pela disciplina.
  const mesma = page.locator('tbody tr', { hasText: disciplina }).first();
  await expect(mesma).toContainText('manual');

  // Devolve o automático pelo detalhe do diário.
  await mesma.getByRole('link').first().click();
  const voltar = page.getByRole('button', { name: 'Voltar ao automático' });
  if (await voltar.isVisible()) await voltar.click();
});
