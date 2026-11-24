import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test.describe('Comunicação: mensagem avulsa e caixa de mensagem', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    await entrar(page, 'coordenacao');
    await page.goto('/comunicacao');
  });

  test('gera a mensagem, preenche o campo, copia, abre no e-mail e registra o envio', async ({ page }) => {
    const avulsa = page.locator('section[aria-labelledby="avulsa"]');
    await avulsa.getByRole('checkbox', { name: 'Assistência Estudantil' }).first().check();
    await avulsa.getByLabel('Assunto').fill('Teste E2E: reunião');
    await avulsa.getByLabel('Texto', { exact: true }).fill('Reunião sobre a turma {{turma}} na sala de sempre.');

    // O campo {{turma}} vira controle com a lista das turmas cadastradas.
    const campoTurma = avulsa.getByLabel(/^turma/);
    await expect(campoTurma).toHaveAttribute('list', 'lista-turmas');
    await campoTurma.fill('Turma E2E');
    await avulsa.getByRole('button', { name: 'Gerar mensagens' }).click();

    const caixa = avulsa.locator('div.space-y-3', { has: page.getByRole('button', { name: 'Copiar texto' }) }).first();
    await expect(caixa).toBeVisible();
    const texto = caixa.getByLabel('Texto da mensagem');
    await expect(texto).toHaveValue(/Reunião sobre a turma Turma E2E/);

    // Copiar usa a área de transferência do navegador.
    await caixa.getByRole('button', { name: 'Copiar texto' }).click();
    await expect(caixa.getByRole('status')).toHaveText(/copiado/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Turma E2E');

    // Edição na caixa reflete no link do e-mail.
    await caixa.getByLabel('Para (e-mail)').fill('setor@exemplo.edu.br');
    await caixa.getByLabel('Assunto').fill('Assunto ajustado');
    const href = await caixa.getByRole('link', { name: 'Abrir no e-mail' }).getAttribute('href');
    expect(href).toMatch(/^mailto:setor@exemplo\.edu\.br\?/);
    expect(decodeURIComponent(href ?? '')).toContain('Assunto ajustado');

    // Restaurar volta ao texto gerado.
    await texto.fill('outro texto');
    await caixa.getByRole('button', { name: 'Restaurar original' }).click();
    await expect(texto).toHaveValue(/Turma E2E/);

    // Registrar o envio grava no histórico.
    await caixa.getByRole('button', { name: 'Já enviei: registrar' }).click();
    await expect(page.locator('section[aria-labelledby="historico"]')).toContainText('Assunto: Teste E2E: reunião');
  });

  test('texto-padrão preenche assunto e texto e marca destinatários sugeridos', async ({ page }) => {
    const avulsa = page.locator('section[aria-labelledby="avulsa"]');
    const select = avulsa.getByLabel('Texto-padrão (opcional)');
    const opcoes = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    expect(opcoes.length).toBeGreaterThan(0);
    await select.selectOption(opcoes[0]);
    await expect(avulsa.getByLabel('Assunto')).not.toHaveValue('');
    await expect(avulsa.getByLabel('Texto', { exact: true })).not.toHaveValue('');
  });
});
