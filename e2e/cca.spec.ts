import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('CCA: acompanha os diários só em leitura e não alcança a conferência nem a PPI', async ({ page }) => {
  await entrar(page, 'cca');
  await page.goto('/diarios');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Leitura: sem o formulário do período, sem o link de conferência e sem link para editar cada diário.
  await expect(page.getByRole('link', { name: 'Conferir com o sistema acadêmico' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar período' })).toHaveCount(0);
  await expect(page.locator('main table a[href^="/diarios/"]')).toHaveCount(0);

  for (const rota of ['/diarios/conferencia', '/ppi', '/ppi/resumo-cca', '/usuarios']) {
    await page.goto(rota);
    await expect(page, rota).toHaveURL(/aviso=sem-permissao/);
  }
});

test('Coordenação: resumo da PPI para a CCA traz só totais por turma', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/ppi/resumo-cca');
  await expect(page.getByRole('heading', { level: 1, name: 'Resumo da PPI para a CCA' })).toBeVisible();
  const texto = await page.getByLabel('Texto da mensagem').inputValue();
  expect(texto).toContain('Apanhado geral');
  expect(texto).not.toMatch(/matrícula/i);
});
