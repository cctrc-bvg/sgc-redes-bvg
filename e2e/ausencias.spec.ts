import { expect, test, type Page } from '@playwright/test';
import { SENHA_DEMO, entrar } from './apoio';

/** E-mail do docente de demonstração pelo nome ("Fábio Exemplo Nunes" → fabio.nunes@exemplo.edu.br). */
function emailDoDocente(nome: string) {
  const partes = nome.replace(/ \(leciona na turma\)$/, '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().split(/\s+/);
  return `${partes[0]}.${partes[partes.length - 1]}@exemplo.edu.br`;
}

/** Procura, a partir de `aPartirDe` dias à frente, um dia útil em que a docente tem aula ainda sem ausência registrada. */
async function abrirDiaComAula(page: Page, docente: string, aPartirDe = 8) {
  await page.goto('/ausencias/nova');
  const valor = await page.getByLabel('Docente').locator('option', { hasText: docente }).getAttribute('value');
  expect(valor, `docente ${docente} nos dados de demonstração`).toBeTruthy();
  const d = new Date();
  d.setDate(d.getDate() + aPartirDe);
  for (let i = 0; i < 21; i++, d.setDate(d.getDate() + 1)) {
    if ([0, 6].includes(d.getDay())) continue;
    const iso = d.toISOString().slice(0, 10);
    await page.goto(`/ausencias/nova?professorId=${valor}&data=${iso}`);
    if ((await page.locator('input[name="aula"]:not([disabled])').count()) > 0) return iso;
  }
  throw new Error(`Sem aula de ${docente} nas próximas semanas (grade de demonstração).`);
}

test('ausência: registrar, convidar substituto, aceitar em Minha grade e cancelar', async ({ page, browser }) => {
  test.setTimeout(150_000);
  await entrar(page, 'coordenacao');
  const dataAula = await abrirDiaComAula(page, 'Ana Exemplo Lima');
  const dataBr = dataAula.split('-').reverse().join('/');

  // Registrar só a primeira aula do dia.
  const aulas = page.locator('input[name="aula"]:not([disabled])');
  const total = await aulas.count();
  for (let i = 1; i < total; i++) await aulas.nth(i).uncheck();
  // Sem motivo: erro, e as aulas desmarcadas continuam desmarcadas.
  await page.getByRole('button', { name: 'Registrar ausência' }).click();
  await expect(page.getByText('Escolha o motivo operacional.')).toBeVisible();
  await expect(aulas.first()).toBeChecked();
  if (total > 1) await expect(aulas.nth(1)).not.toBeChecked();
  await page.getByLabel('Motivo operacional').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Registrar ausência' }).click();
  await expect(page).toHaveURL(/\/ausencias\/[^/?]+\?aviso=registrada/);
  const urlAusencia = page.url().split('?')[0];

  // Convidar um docente livre no horário.
  const convite = page.locator('section[aria-labelledby="convites"]');
  const selecao = convite.getByLabel(/^Convidar para/).first();
  await convite.getByRole('button', { name: 'Convidar' }).first().click();
  await expect(convite).toContainText('Escolha o docente a convidar.');
  const opcao = selecao.locator('option').nth(1);
  const nomeConvidado = (await opcao.textContent())?.trim() ?? '';
  expect(nomeConvidado, 'algum docente livre no horário').not.toBe('');
  await selecao.selectOption({ index: 1 });
  await convite.getByRole('button', { name: 'Convidar' }).first().click();
  await expect(convite).toContainText('Convite registrado.');

  // O convidado aceita em "Minha grade" (outra sessão).
  const contexto = await browser.newContext();
  const convidado = await contexto.newPage();
  await convidado.goto('/login');
  await convidado.getByLabel('E-mail institucional').fill(emailDoDocente(nomeConvidado));
  await convidado.getByLabel('Senha').fill(SENHA_DEMO);
  await convidado.getByRole('button', { name: 'Entrar' }).click();
  await expect(convidado).toHaveURL(/\/painel/);
  await convidado.goto('/grade/minha');
  const secaoConvites = convidado.locator('section[aria-labelledby="convites"]');
  await expect(secaoConvites).toBeVisible();
  // Pode haver o convite da demonstração também: aceita o desta data.
  await secaoConvites.getByRole('button', { name: `Aceitar: ${dataBr}` }).click();
  // A lista de convites se atualiza e a aula passa a constar nas mudanças dos próximos dias do convidado.
  await expect(convidado.locator('section[aria-labelledby="mudancas"]')).toContainText(new RegExp(`${dataBr}.*Substituição`), { timeout: 60_000 });
  await contexto.close();

  // A Coordenação vê a situação e cancela o registro (exige confirmação).
  await page.goto(urlAusencia);
  await expect(page.locator('main')).toContainText(/Substitui|Aceito/);
  await page.getByRole('button', { name: 'Cancelar registro' }).click();
  await expect(page.locator('main')).toContainText('Marque a confirmação para cancelar o registro.');
  await page.getByLabel(/Confirmo que o docente não vai faltar/).check();
  await page.getByRole('button', { name: 'Cancelar registro' }).click();
  await expect(page).toHaveURL(/\/ausencias\?.*aviso=cancelada/);
});

test('turma dispensada mostra o prazo de reposição do ROD (15 dias letivos ou fim da etapa)', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/ausencias');
  const linha = page.locator('tr', { hasText: 'Turma dispensada' }).first();
  await expect(linha).toBeVisible();
  await linha.getByRole('link').first().click();
  await expect(page.getByText(/Reposição das aulas dispensadas: até \d{2}\/\d{2}\/\d{4} \((15 dias letivos|fim da N\d)\)/)).toBeVisible();
  await expect(page.getByText('Art. 37, § 2º')).toBeVisible();
});

test('licença de vários dias: um registro só para o período inteiro', async ({ page }) => {
  await entrar(page, 'coordenacao');
  // Mais à frente que o teste acima, mas ainda dentro do semestre de demonstração.
  const inicio = await abrirDiaComAula(page, 'Ana Exemplo Lima', 14);
  const professorId = new URL(page.url()).searchParams.get('professorId')!;
  const fim = new Date(`${inicio}T12:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() + 2);
  const ate = fim.toISOString().slice(0, 10);
  await page.goto(`/ausencias/nova?professorId=${professorId}&data=${inicio}&ate=${ate}`);
  await expect(page.getByRole('heading', { level: 2, name: /Aulas de Ana Exemplo Lima de .* a / })).toBeVisible();
  // Todas as aulas do período vêm marcadas, cada uma com a própria data.
  const aulas = page.locator('input[name="aula"]:not([disabled])');
  expect(await aulas.count()).toBeGreaterThan(0);
  expect(await aulas.first().getAttribute('value')).toMatch(/^\d{4}-\d{2}-\d{2}#/);
  await page.getByLabel('Motivo operacional').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Registrar ausência' }).click();
  await expect(page).toHaveURL(/\/ausencias(\/[^/?]+)?\?.*aviso=registrada/);
  // Período acima do máximo é recusado já na consulta.
  const longe = new Date(`${inicio}T12:00:00Z`);
  longe.setUTCDate(longe.getUTCDate() + 20);
  await page.goto(`/ausencias/nova?professorId=${professorId}&data=${inicio}&ate=${longe.toISOString().slice(0, 10)}`);
  await expect(page.getByText(/Use no máximo 15 dias/)).toBeVisible();
});

test('docente informa a própria ausência, a Coordenação vê o selo e o docente cancela', async ({ page, browser }) => {
  await entrar(page, 'professor');
  // Um dia útil bem à frente em que a docente tem aula livre (sem ausência registrada).
  const d = new Date();
  d.setDate(d.getDate() + 10);
  let data = '';
  for (let i = 0; i < 21 && !data; i++, d.setDate(d.getDate() + 1)) {
    if ([0, 6].includes(d.getDay())) continue;
    const iso = d.toISOString().slice(0, 10);
    await page.goto(`/ausencias/informar?data=${iso}`);
    if ((await page.locator('input[name="aula"]:not([disabled])').count()) > 0) data = iso;
  }
  expect(data, 'dia com aula da docente de demonstração').not.toBe('');
  // A orientação da Gestão de Pessoas aparece antes de qualquer envio.
  await expect(page.getByText('cgp.boaviagem@ifce.edu.br')).toBeVisible();
  await page.getByLabel('Motivo operacional').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Informar ausência à Coordenação' }).click();
  await expect(page).toHaveURL(/\/grade\/minha\?aviso=ausencia-informada/);
  const minhas = page.locator('section[aria-labelledby="minhas-ausencias"]');
  const dataBr = data.split('-').reverse().join('/');
  const item = minhas.locator('li', { hasText: dataBr }).first();
  await expect(item).toContainText('informada por você');

  // A Coordenação vê o selo na lista (outra sessão).
  const contexto = await browser.newContext();
  const coord = await contexto.newPage();
  await entrar(coord, 'coordenacao');
  await coord.goto('/ausencias');
  await expect(coord.locator('tr', { hasText: dataBr }).filter({ hasText: 'Informada pelo docente' }).first()).toBeVisible();
  await contexto.close();

  // Enquanto a Coordenação não decide, a docente pode cancelar.
  await item.getByRole('button', { name: /^Cancelar a ausência informada/ }).click();
  await expect(page).toHaveURL(/\/grade\/minha\?aviso=ausencia-cancelada/);
  await expect(page.getByText('Ausência cancelada.')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="minhas-ausencias"] li', { hasText: dataBr }).filter({ hasText: 'informada por você' })).toHaveCount(0);
});
