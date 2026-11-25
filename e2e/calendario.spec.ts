import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

// Data futura num dia útil, longe dos dados de demonstração.
function dataFutura() {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

test('suspensão de aulas: formulário dinâmico, mensagens prontas e remoção', async ({ page }) => {
  const descricao = `Teste E2E ${Date.now().toString(36)}`; // única: não confunde com sobras de execuções que falharam
  await entrar(page, 'coordenacao');
  await page.goto('/calendario/eventos/novo');

  // Trocar o tipo para suspensão mostra o motivo e marca "sem aula" e "não prevista".
  await page.getByLabel('Tipo').selectOption({ label: 'Suspensão de aulas (força maior)' });
  await expect(page.getByLabel('Motivo')).toBeVisible();
  await expect(page.getByLabel(/Sem aula nestes dias/)).toBeChecked();
  await expect(page.getByLabel(/Alteração não prevista/)).toBeChecked();

  await page.getByLabel('Início').fill(dataFutura());
  await page.getByLabel(/^Descrição/).fill(descricao);
  // Sem motivo: erro, e o tipo escolhido continua.
  await page.getByRole('button', { name: 'Cadastrar evento' }).click();
  await expect(page.locator('main')).toContainText('Escolha o motivo da suspensão.');
  await expect(page.getByLabel('Tipo')).toHaveValue('SUSPENSAO_AULAS');

  await page.getByLabel('Motivo').selectOption('Falta de energia');
  await page.getByRole('button', { name: 'Cadastrar evento' }).click();

  // Alteração não prevista leva às mensagens prontas.
  await expect(page).toHaveURL(/\/calendario\/eventos\/[^/]+\/comunicar\?aviso=criado/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(descricao);
  await expect(page.locator('main')).toContainText('Evento cadastrado no calendário.');
  const textos = page.getByLabel('Texto da mensagem');
  expect(await textos.count()).toBeGreaterThan(0);
  const todos = (await textos.evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value))).join('\n');
  expect(todos).toContain('Falta de energia');

  // Remover o evento (exige confirmação).
  await page.getByRole('link', { name: 'Editar o evento' }).click();
  await page.getByLabel('Confirmo a remoção deste evento.').check();
  await page.getByRole('button', { name: 'Remover evento' }).click();
  await expect(page).toHaveURL(/\/calendario\?.*aviso=removido/);
  await expect(page.locator('main')).not.toContainText(descricao);
});

test('atalho das avaliações finais: tipo preenchido, início na data sugerida e "sem aula" fixo', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/calendario/eventos/novo?tipo=AVALIACOES_FINAIS&inicio=2026-12-17');
  await expect(page.getByLabel('Tipo')).toHaveValue('AVALIACOES_FINAIS');
  await expect(page.getByLabel('Início')).toHaveValue('2026-12-17');
  const semAula = page.getByRole('checkbox', { name: /Sem aula nestes dias/ });
  await expect(semAula).toBeChecked();
  await expect(semAula).toBeDisabled();
});
