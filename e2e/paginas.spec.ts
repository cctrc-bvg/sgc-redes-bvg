import { expect, test } from '@playwright/test';
import { entrar, type Perfil } from './apoio';

// Abre as páginas principais de cada perfil e confere que carregam sem erro de servidor nem de JavaScript.
const PAGINAS: Record<Perfil, string[]> = {
  coordenacao: [
    '/painel', '/calendario', '/grade', '/grade/minha', '/grade/sabados', '/ausencias', '/alimentacao', '/comunicacao',
    '/comunicacao/modelos', '/comunicacao/periodicas', '/usuarios', '/turmas', '/disciplinas', '/ofertas', '/auditoria', '/ppe', '/ppi', '/diarios', '/diarios/conferencia', '/reposicoes', '/periodos',
    '/processos', '/relatorios', '/ajuda', '/conta/contato',
  ],
  professor: ['/painel', '/grade', '/grade/minha', '/calendario', '/disciplinas', '/ppe', '/diarios', '/reposicoes', '/ajuda'],
  ctp: ['/painel', '/ppe', '/processos', '/relatorios', '/calendario', '/ajuda'],
  direcao: ['/painel', '/relatorios', '/calendario', '/ajuda'],
  cae: ['/painel', '/alimentacao', '/calendario', '/ajuda'],
};

for (const [perfil, rotas] of Object.entries(PAGINAS) as [Perfil, string[]][]) {
  test(`páginas principais: ${perfil}`, async ({ page }) => {
    test.setTimeout(150_000);
    const errosJs: string[] = [];
    page.on('pageerror', (e) => errosJs.push(e.message));
    // Recurso bloqueado pela política de conteúdo (next.config.ts) aparece como erro no console.
    page.on('console', (m) => {
      if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) errosJs.push(m.text());
    });
    await entrar(page, perfil);
    for (const rota of rotas) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), rota).toBeLessThan(400);
      await expect(page, rota).not.toHaveURL(/aviso=sem-permissao/);
      await expect(page.getByRole('heading', { level: 1 }).first(), rota).toBeVisible();
    }
    expect(errosJs).toEqual([]);
  });
}

test('ausência de demonstração mostra as mensagens prontas', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/ausencias');
  const link = page.locator('main a[href^="/ausencias/"]:not([href="/ausencias/nova"])').first();
  test.skip((await link.count()) === 0, 'Sem ausência nos dados de demonstração (sem aula no próximo dia útil).');
  await link.click();
  await expect(page).toHaveURL(/\/ausencias\/[^/]+$/);
  await expect(page.getByRole('link', { name: 'Abrir no e-mail' }).first()).toBeVisible();
});

test('cabeçalhos de segurança nas respostas', async ({ request }) => {
  const resposta = await request.get('/login');
  const h = resposta.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).not.toContain('unsafe-eval');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['x-powered-by']).toBeUndefined();
});
