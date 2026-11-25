import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('turma: cadastrar, corrigir erro de validação, editar e excluir', async ({ page }) => {
  await entrar(page, 'coordenacao');
  const codigo = `E2E-${Date.now().toString(36).slice(-5).toUpperCase()}`;

  await page.goto('/turmas/nova');
  await page.getByLabel('Nome da turma').fill('Turma de teste E2E');
  await page.getByLabel('Código').fill(codigo);
  await page.getByLabel('Ano do curso').selectOption('1');
  await page.getByLabel('Estudantes ativos').fill('30');
  // Média acima do número de ativos: erro e o formulário mantém o que foi digitado.
  const medias = page.getByLabel(/\(média\)$/);
  await medias.nth(0).fill('40');
  await medias.nth(1).fill('25');
  await medias.nth(2).fill('20');
  await page.getByRole('button', { name: 'Cadastrar turma' }).click();
  await expect(page.getByLabel('Código')).toHaveValue(codigo);
  await expect(page.getByText('A média não pode passar dos 30 estudantes ativos.')).toBeVisible();

  await medias.nth(0).fill('28');
  await page.getByRole('button', { name: 'Cadastrar turma' }).click();
  await expect(page.getByText('Turma de teste E2E', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar às turmas' }).click();

  // Editar pelo link da listagem.
  await page.locator('main a', { hasText: 'Turma de teste E2E' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Turma de teste E2E');
  await page.getByLabel('Nome da turma').fill('Turma de teste E2E (editada)');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: 'Alterações salvas.' })).toBeVisible();

  // Exclusão exige a confirmação.
  await page.getByRole('button', { name: 'Excluir turma' }).click();
  await expect(page.locator('main')).toContainText('Marque a confirmação para excluir a turma.');
  await page.getByLabel(/Confirmo que esta turma foi cadastrada por engano/).check();
  await page.getByRole('button', { name: 'Excluir turma' }).click();
  await expect(page).toHaveURL(/\/turmas(\?|$)/);
  await expect(page.locator('main')).not.toContainText(codigo);
});

test('meu contato: máscara do telefone e preferência salva', async ({ page }) => {
  await entrar(page, 'professor');
  await page.goto('/conta/contato');
  const campo = page.getByLabel('WhatsApp (opcional)');
  const anterior = await campo.inputValue();
  const usa = page.getByLabel(/Usar meu WhatsApp no sistema/);
  const usavaAntes = await usa.isChecked();

  await campo.fill('');
  await campo.pressSequentially('88999990000'); // número fictício
  await expect(campo).toHaveValue('(88) 99999-0000');
  await usa.check();
  await page.getByRole('button', { name: 'Salvar preferência' }).click();
  await expect(page.locator('main')).toContainText('Preferência salva: e-mail e WhatsApp.');

  // Telefone incompleto é recusado e o valor digitado continua no campo.
  await campo.fill('');
  await campo.pressSequentially('8899');
  await page.getByRole('button', { name: 'Salvar preferência' }).click();
  await expect(campo).toHaveValue('(88) 99');
  await expect(page.locator('main')).not.toContainText('Preferência salva');

  // Devolve o estado dos dados de demonstração.
  await campo.fill(anterior);
  await usa.setChecked(usavaAntes);
  await page.getByRole('button', { name: 'Salvar preferência' }).click();
  await expect(page.locator('main')).toContainText('Preferência salva');
});
