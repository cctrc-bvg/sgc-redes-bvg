import { expect, test, type Page } from '@playwright/test';
import { SENHA_DEMO, entrar } from './apoio';

/** E-mail do docente de demonstração pelo nome ("Fábio Exemplo Nunes" → fabio.nunes@exemplo.edu.br). */
function emailDoDocente(nome: string) {
  const partes = nome.replace(/ \(leciona na turma\)$/, '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().split(/\s+/);
  return `${partes[0]}.${partes[partes.length - 1]}@exemplo.edu.br`;
}

/** Procura, a partir de 8 dias à frente, um dia útil em que a docente tem aula ainda sem ausência registrada. */
async function abrirDiaComAula(page: Page, docente: string) {
  await page.goto('/ausencias/nova');
  const valor = await page.getByLabel('Docente').locator('option', { hasText: docente }).getAttribute('value');
  expect(valor, `docente ${docente} nos dados de demonstração`).toBeTruthy();
  const d = new Date();
  d.setDate(d.getDate() + 8);
  for (let i = 0; i < 21; i++, d.setDate(d.getDate() + 1)) {
    if ([0, 6].includes(d.getDay())) continue;
    const iso = d.toISOString().slice(0, 10);
    await page.goto(`/ausencias/nova?professorId=${valor}&data=${iso}`);
    if ((await page.locator('input[name="aula"]:not([disabled])').count()) > 0) return iso;
  }
  throw new Error(`Sem aula de ${docente} nas próximas semanas (grade de demonstração).`);
}

test('ausência: registrar, convidar substituto, aceitar em Minha grade e cancelar', async ({ page, browser }) => {
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
  await expect(convidado.locator('section[aria-labelledby="mudancas"]')).toContainText(new RegExp(`${dataBr}.*Substituição`));
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
