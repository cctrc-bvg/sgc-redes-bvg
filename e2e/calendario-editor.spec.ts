import { expect, test, type Page } from '@playwright/test';
import { entrar } from './apoio';

// Ano sem dados nos de demonstração, para não mexer no calendário usado pelos outros testes.
const ANO = 2031;
const dia = (page: Page, iso: string) => page.locator(`[data-data="${iso}"]`);

test('editor do calendário: seleção com Shift e Ctrl, categorias, contadores, histórico e restauração', async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page, 'coordenacao');
  await page.goto(`/calendario/editor?ano=${ANO}`);
  await expect(page.getByRole('heading', { level: 1, name: `Editor do calendário ${ANO}` })).toBeVisible();

  // Clique + Shift+clique: intervalo de segunda (06/01/2031) a sexta (10/01/2031).
  await dia(page, `${ANO}-01-06`).click();
  await dia(page, `${ANO}-01-10`).click({ modifiers: ['Shift'] });
  await expect(page.getByRole('status').filter({ hasText: 'dias selecionados' })).toContainText('5 dias selecionados');

  // Ctrl+clique desmarca um dia solto e marca outro.
  await dia(page, `${ANO}-01-08`).click({ modifiers: ['Control'] });
  await expect(page.getByRole('status').filter({ hasText: 'selecionados' })).toContainText('4 dias selecionados');
  await dia(page, `${ANO}-01-08`).click({ modifiers: ['Control'] });
  await expect(page.getByRole('status').filter({ hasText: 'selecionados' })).toContainText('5 dias selecionados');

  await page.getByLabel('Rótulo (opcional)').fill('Recesso de teste');
  await page.getByRole('button', { name: 'Feriado', exact: true }).click();
  await expect(dia(page, `${ANO}-01-07`)).toHaveAttribute('data-situacao', 'FERIADO');
  const contagem = page.getByRole('complementary', { name: 'Contadores' });
  await expect(contagem.getByText('Feriados (dias úteis)').locator('xpath=..')).toContainText('5');

  // Sábado letivo e ponto facultativo; os contadores acompanham.
  await dia(page, `${ANO}-01-11`).click();
  await page.getByLabel('Sábado/domingo letivo: grade de').selectOption('3');
  await page.getByRole('button', { name: 'Dia letivo', exact: true }).click();
  await expect(dia(page, `${ANO}-01-11`)).toHaveAttribute('data-situacao', 'FIM_DE_SEMANA_LETIVO');
  await expect(contagem.getByText('Sábados letivos').locator('xpath=..')).toContainText('1');
  await dia(page, `${ANO}-01-12`).click(); // domingo
  await page.getByRole('button', { name: 'Dia letivo', exact: true }).click();
  await expect(contagem.getByText('Domingos letivos').locator('xpath=..')).toContainText('1');
  await dia(page, `${ANO}-01-13`).click();
  await page.getByRole('button', { name: 'Ponto facultativo', exact: true }).click();
  await expect(contagem.getByText('Pontos facultativos').locator('xpath=..')).toContainText('1');

  // Desfazer volta o ponto facultativo.
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(dia(page, `${ANO}-01-13`)).toHaveAttribute('data-situacao', 'LETIVO');

  await page.getByLabel(/^Motivo da mudança/).fill('Primeira versão do teste');
  await page.getByRole('button', { name: 'Salvar calendário' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Calendário atual: revisão 1/ })).toBeVisible({ timeout: 60_000 });
  await expect(dia(page, `${ANO}-01-07`)).toHaveAttribute('data-situacao', 'FERIADO');

  // Segunda revisão: sábado letivo volta a ser sábado comum e entra um feriado a mais.
  await dia(page, `${ANO}-01-11`).click();
  await page.getByRole('button', { name: 'Voltar ao padrão' }).click();
  await dia(page, `${ANO}-01-14`).click();
  await page.getByRole('button', { name: 'Feriado', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar calendário' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Calendário atual: revisão 2/ })).toBeVisible({ timeout: 60_000 });
  await expect(dia(page, `${ANO}-01-11`)).toHaveAttribute('data-situacao', 'FIM_DE_SEMANA');

  // Histórico: a revisão 1 mostra o estado antigo, só para leitura; restaurar cria a revisão 3.
  await page.getByRole('link', { name: /Revisão anterior \(1\)/ }).click();
  await expect(page.locator('main')).toContainText('Revisão 1 de 2 (somente leitura)');
  await expect(dia(page, `${ANO}-01-11`)).toHaveAttribute('data-situacao', 'FIM_DE_SEMANA_LETIVO');
  await expect(dia(page, `${ANO}-01-14`)).toHaveAttribute('data-situacao', 'LETIVO');
  await expect(dia(page, `${ANO}-01-11`)).toBeDisabled();
  await page.getByLabel('Quero restaurar esta revisão como o calendário vigente').check();
  await page.getByRole('button', { name: 'Restaurar esta revisão' }).click();
  await expect(page.locator('main')).toContainText('Revisão restaurada', { timeout: 60_000 });
  await expect(page.getByRole('status').filter({ hasText: /Calendário atual: revisão 3 de 3/ })).toBeVisible();
  await expect(dia(page, `${ANO}-01-11`)).toHaveAttribute('data-situacao', 'FIM_DE_SEMANA_LETIVO');
  await expect(dia(page, `${ANO}-01-14`)).toHaveAttribute('data-situacao', 'LETIVO');
});
