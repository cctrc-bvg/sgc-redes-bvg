import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { entrar, type Perfil } from './apoio';

// Verificação automática de acessibilidade (axe-core, WCAG 2.1 A e AA — base do eMAG). Não substitui o teste com
// leitor de tela e teclado, mas pega contraste, rótulos, estrutura de títulos, ARIA inválido etc.
const PAGINAS: [Perfil, string[]][] = [
  [
    'coordenacao',
    [
      '/painel', '/calendario', '/calendario/editor', '/calendario/eventos/novo', '/grade', '/grade/minha', '/diarios?escopo=meus', '/ppe?escopo=minhas', '/ausencias', '/ausencias/nova',
      '/alimentacao', '/alimentacao/adicionar', '/comunicacao', '/comunicacao/modelos', '/comunicacao/periodicas', '/usuarios', '/usuarios/importar',
      '/turmas', '/turmas/nova', '/disciplinas', '/ofertas', '/ppe', '/ppi', '/diarios', '/diarios/conferencia', '/reposicoes', '/periodos', '/processos', '/relatorios',
      '/auditoria', '/ajuda', '/conta/contato', '/conta/senha',
    ],
  ],
  ['professor', ['/painel', '/grade/minha', '/ausencias/informar']],
  ['cae', ['/painel', '/alimentacao']],
  ['cca', ['/painel', '/diarios']],
];

async function violacoes(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

test('acessibilidade: tela de login', async ({ page }) => {
  await page.goto('/login');
  expect(await violacoes(page)).toEqual([]);
});

for (const [perfil, rotas] of PAGINAS) {
  test(`acessibilidade: páginas de ${perfil}`, async ({ page }) => {
    test.setTimeout(300_000);
    await entrar(page, perfil);
    const achados: string[] = [];
    for (const rota of rotas) {
      await page.goto(rota);
      for (const v of await violacoes(page)) achados.push(`${rota}: ${v}`);
    }
    expect(achados).toEqual([]);
  });
}

// Páginas de detalhe: abre o primeiro item de cada listagem (dados de demonstração) e, quando houver, a comunicação.
test('acessibilidade: páginas de detalhe e de comunicação', async ({ page }) => {
  test.setTimeout(300_000);
  await entrar(page, 'coordenacao');
  const achados: string[] = [];
  let visitadas = 0;
  for (const base of ['/ausencias', '/ppe', '/ppi', '/diarios', '/turmas', '/processos']) {
    await page.goto(base);
    const hrefs = await page
      .locator(`main a[href^="${base}/"]`)
      .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '').filter((h) => /^\/[a-z]+\/[A-Za-z0-9_-]+$/.test(h) && !/\/(nova|novo|importar)$/.test(h)));
    if (hrefs.length === 0) continue;
    const rotas = [hrefs[0]];
    if (base === '/ppe' || base === '/ppi') rotas.push(`${hrefs[0]}/comunicar`);
    if (base === '/ppe') rotas.push(...hrefs.map((h) => `${h}/imprimir`)); // só as PPE com PEI abrem a impressão
    for (const rota of rotas) {
      const resposta = await page.goto(rota);
      if ((resposta?.status() ?? 500) >= 400) continue;
      visitadas++;
      for (const v of await violacoes(page)) achados.push(`${rota}: ${v}`);
    }
  }
  expect(achados).toEqual([]);
  expect(visitadas, 'páginas de detalhe verificadas').toBeGreaterThanOrEqual(6);
});
