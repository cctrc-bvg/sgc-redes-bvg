import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

// Dia útil daqui a ~45 dias (longe dos avisos de demonstração e dentro do prazo normal da AE).
function dataFutura() {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

test('acréscimo de refeição: aviso, mensagem para a AE, ciência e cancelamento', async ({ page, browser }) => {
  const data = dataFutura();
  const atividade = `Encontro de PEI E2E ${Date.now().toString(36)}`;
  await entrar(page, 'coordenacao');
  await page.goto('/alimentacao/adicionar');

  const turma = page.getByLabel('Turma');
  await turma.selectOption({ index: 1 });
  const turmaEscolhida = await turma.inputValue();
  await page.getByLabel('Data do encontro').fill(data);
  await page.getByLabel('Estudantes').fill('5');
  await page.getByLabel('Atividade').fill(atividade);
  // Sem refeição marcada: erro, e a turma escolhida continua selecionada.
  await page.getByRole('button', { name: 'Avisar a Assistência Estudantil' }).click();
  await expect(page.locator('#refeicoes-erro')).toBeVisible();
  await expect(turma).toHaveValue(turmaEscolhida);

  await page.getByLabel('Almoço (12:00)').check();
  await page.getByRole('button', { name: 'Avisar a Assistência Estudantil' }).click();

  // Quem pode comunicar cai nas mensagens prontas do dia, com a saudação do grupo.
  await expect(page).toHaveURL(new RegExp(`/alimentacao/comunicar\\?data=${data}&motivo=acrescimo`));
  const textos = (await page.getByLabel('Texto da mensagem').evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value))).join('\n');
  expect(textos).toContain('Olá, prezados(as) colegas da Assistência Estudantil!');
  expect(textos).toContain(atividade);

  // A Assistência Estudantil dá ciência no painel dela.
  const contexto = await browser.newContext();
  const cae = await contexto.newPage();
  await entrar(cae, 'cae');
  await cae.goto(`/alimentacao?data=${data}`);
  const aviso = cae.locator('section[aria-labelledby="pendentes"] li', { hasText: atividade });
  await expect(aviso).toBeVisible();
  await aviso.getByRole('button', { name: 'Dar ciência' }).click();
  await expect(cae.locator('section[aria-labelledby="pendentes"] li', { hasText: atividade })).toHaveCount(0);
  await contexto.close();

  // A Coordenação cancela o acréscimo.
  await page.goto(`/alimentacao?data=${data}`);
  const doDia = page.locator('li', { hasText: atividade }).last();
  await doDia.getByRole('button', { name: 'Cancelar acréscimo' }).click();
  await expect(page.locator('li', { hasText: atividade }).last()).toContainText('Aviso cancelado');
});
