import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

// Mensagens prontas das decisões de PPI e PPE (dados de demonstração: uma PPI em análise, uma PPE com PEI
// pronto e outra aguardando o docente).
test.describe('Comunicar decisões de PPI e PPE', () => {
  test.beforeEach(async ({ page }) => entrar(page, 'coordenacao'));

  test('indeferir a PPI leva às mensagens do estudante e da CTP', async ({ page }) => {
    await page.goto('/ppi');
    await page.locator('main a[href^="/ppi/c"]').first().click();
    await expect(page).toHaveURL(/\/ppi\/[^/]+$/);
    await page.getByLabel('Situação', { exact: true }).selectOption('INDEFERIDA');
    await page.getByLabel('Observações').fill('Faltam os comprovantes do estágio (teste E2E).');
    await page.getByRole('button', { name: 'Salvar situação' }).click();

    await expect(page).toHaveURL(/\/ppi\/[^/]+\/comunicar\?aviso=decidida/);
    await expect(page.getByRole('heading', { level: 1, name: 'Comunicar a decisão da PPI' })).toBeVisible();
    const textos = page.getByLabel('Texto da mensagem');
    await expect(textos).toHaveCount(2);
    await expect(textos.first()).toHaveValue(/foi \*indeferida\*/);
    await expect(textos.first()).toHaveValue(/Motivo: Faltam os comprovantes do estágio/);

    // Registrar o envio ao estudante.
    const caixa = page.locator('li', { has: page.getByRole('heading', { name: /^Estudante:/ }) });
    await caixa.getByRole('button', { name: 'Já enviei: registrar' }).click();
    await expect(caixa.getByText('registrado no histórico')).toBeVisible();
    await page.reload();
    await expect(page.locator('li', { has: page.getByRole('heading', { name: /^Estudante:/ }) }).getByText('Envio registrado')).toBeVisible();
  });

  test('PPE aguardando o docente: mensagem só para o docente, sem o nome do estudante', async ({ page }) => {
    await page.goto('/ppe');
    const linha = page.locator('main tr', { hasText: 'Aguardando o docente' }).first();
    const estudante = (await linha.locator('th span.font-semibold').innerText()).trim();
    await linha.locator('a[href^="/ppe/"]').first().click();
    await page.getByRole('link', { name: 'Ver mensagens prontas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Comunicar: Pedir a definição da modalidade' })).toBeVisible();
    const textos = page.getByLabel('Texto da mensagem');
    await expect(textos.first()).toHaveValue(/aguardando a definição da modalidade/);
    expect(estudante.length).toBeGreaterThan(0);
    for (const t of await textos.all()) expect(await t.inputValue()).not.toContain(estudante);
  });

  test('PEI pronto: estudante recebe o cronograma de encontros', async ({ page }) => {
    await page.goto('/ppe');
    await page.locator('main tr', { hasText: 'Em andamento' }).first().locator('a[href^="/ppe/"]').first().click();
    await page.getByRole('link', { name: 'Ver mensagens prontas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Comunicar: PEI pronto' })).toBeVisible();
    await expect(page.getByLabel('Texto da mensagem').first()).toHaveValue(/\*Encontros:\*\n• \d{2}\/\d{2}\/\d{4} — /);
  });

  test('PEI em andamento: marcar e desmarcar encontros realizados', async ({ page }) => {
    await page.goto('/ppe');
    await page.locator('main tr', { hasText: 'Em andamento' }).first().locator('a[href^="/ppe/"]').first().click();
    const secao = page.locator('section[aria-labelledby="encontros"]');
    const primeiro = secao.getByRole('checkbox').first();
    await expect(primeiro).toBeVisible();
    const total = await secao.getByRole('checkbox').count();
    await primeiro.check();
    await secao.getByRole('button', { name: 'Salvar encontros realizados' }).click();
    await expect(secao).toContainText(total === 1 ? 'Todos os encontros realizados' : `1 de ${total} encontro(s) realizado(s).`);
    // Desfaz, para a próxima execução partir do mesmo estado.
    await primeiro.uncheck();
    await secao.getByRole('button', { name: 'Salvar encontros realizados' }).click();
    await expect(secao).toContainText('0 de');
  });
});
