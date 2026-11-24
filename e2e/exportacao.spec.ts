import { expect, test, type Page } from '@playwright/test';
import { entrar } from './apoio';

// Clica no link e confere o arquivo baixado: nome com a extensão certa e conteúdo não vazio.
async function baixar(page: Page, nomeLink: string | RegExp, extensao: 'xlsx' | 'csv') {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: nomeLink }).first().click()]);
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extensao}$`));
  const caminho = await download.path();
  const { readFile } = await import('node:fs/promises');
  const conteudo = await readFile(caminho);
  expect(conteudo.length).toBeGreaterThan(0);
  if (extensao === 'xlsx') expect(conteudo.subarray(0, 2).toString()).toBe('PK'); // .xlsx é um zip
  return conteudo;
}

test.describe('Exportação e modelos de planilha', () => {
  test.beforeEach(async ({ page }) => entrar(page, 'coordenacao'));

  for (const rota of ['/turmas', '/usuarios', '/disciplinas', '/ofertas', '/calendario', '/ausencias', '/grade', '/relatorios']) {
    test(`exporta ${rota} em .xlsx e .csv`, async ({ page }) => {
      await page.goto(rota);
      await baixar(page, /\(\.xlsx\)$/, 'xlsx');
      const csv = (await baixar(page, /\(\.csv\)$/, 'csv')).toString('utf8');
      expect(csv.split(/\r?\n/).filter(Boolean).length, 'cabeçalho e linhas').toBeGreaterThan(0);
    });
  }

  test('baixa o modelo de importação de usuários nos dois formatos', async ({ page }) => {
    await page.goto('/usuarios/importar');
    await baixar(page, /\.xlsx/, 'xlsx');
    const csv = (await baixar(page, /\.csv/, 'csv')).toString('utf8');
    expect(csv).toContain('E-mail');
  });

  test('professor não acessa a exportação de usuários', async ({ page }) => {
    await page.context().clearCookies();
    await entrar(page, 'professor');
    const resposta = await page.request.get('/exportar/usuarios', { maxRedirects: 0 });
    expect(resposta.headers()['content-disposition'] ?? '').not.toContain('attachment');
  });
});
