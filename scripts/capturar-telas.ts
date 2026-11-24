/**
 * Gera as capturas de tela do módulo Ajuda (public/manual/*.jpg) a partir de `src/lib/ajuda/topicos.ts`.
 *
 * Pré-requisitos: um servidor rodando com os DADOS DE DEMONSTRAÇÃO (npm run db:demo -- --confirmo) e o
 * Chromium do Playwright (npx playwright install chromium-headless-shell).
 *
 *   BASE_URL=http://localhost:3000 npm run capturas            # todas
 *   BASE_URL=http://localhost:3000 npm run capturas -- grade   # só os tópicos cujo id contém "grade"
 *
 * Variáveis: BASE_URL (padrão http://localhost:3000) e DEMO_SENHA (padrão Demonstracao2026).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext } from '@playwright/test';
import { TOPICOS, type PerfilCaptura } from '../src/lib/ajuda/topicos';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SENHA = process.env.DEMO_SENHA || 'Demonstracao2026';
const DESTINO = path.resolve(__dirname, '../public/manual');
const ALTURA_MAXIMA = 2600; // páginas longas são cortadas para o arquivo não ficar enorme
const EMAILS: Record<PerfilCaptura, string> = {
  coordenacao: 'coordenacao@exemplo.edu.br',
  professor: 'ana.lima@exemplo.edu.br',
  ctp: 'ctp@exemplo.edu.br',
  direcao: 'direcao@exemplo.edu.br',
  cae: 'cae@exemplo.edu.br',
};

async function entrar(browser: Browser, perfil: PerfilCaptura): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', EMAILS[perfil]);
  await page.fill('input[name="senha"]', SENHA);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 }), page.click('button[type="submit"]')]);
  if (new URL(page.url()).pathname.startsWith('/conta/senha')) throw new Error(`${EMAILS[perfil]} precisa trocar a senha: use os dados de demonstração.`);
  await page.close();
  return ctx;
}

async function main() {
  const filtro = process.argv[2] ?? '';
  mkdirSync(DESTINO, { recursive: true });
  const browser = await chromium.launch();
  const contextos = new Map<PerfilCaptura | 'anonimo', BrowserContext>();
  const contexto = async (perfil: PerfilCaptura, anonimo: boolean) => {
    const chave = anonimo ? 'anonimo' : perfil;
    if (!contextos.has(chave)) {
      contextos.set(
        chave,
        anonimo ? await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'pt-BR' }) : await entrar(browser, perfil),
      );
    }
    return contextos.get(chave)!;
  };
  let feitas = 0;
  try {
    for (const t of TOPICOS.filter((x) => x.id.includes(filtro))) {
      for (const img of t.imagens) {
        const { rota, perfil, clicar, focar, paginaInteira } = img.captura;
        const page = await (await contexto(perfil, rota === '/login')).newPage();
        await page.goto(`${BASE}${rota}`, { waitUntil: 'networkidle' });
        if (clicar) {
          // Link do Next navega no cliente: espera o endereço mudar, não só a rede.
          const antes = page.url();
          await page.locator(clicar).first().click();
          await page.waitForURL((u) => u.toString() !== antes, { timeout: 30_000 });
          await page.waitForLoadState('networkidle');
        }
        // Menus <details> do cabeçalho fechados e sem foco visível.
        await page.evaluate(() => {
          document.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
          (document.activeElement as HTMLElement | null)?.blur();
        });
        if (focar) await page.locator(focar).first().scrollIntoViewIfNeeded();
        const arquivo = path.join(DESTINO, img.arquivo);
        if (paginaInteira) {
          const altura = await page.evaluate(() => document.documentElement.scrollHeight);
          await page.screenshot({ path: arquivo, type: 'jpeg', quality: 72, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(altura, ALTURA_MAXIMA) } });
        } else {
          await page.screenshot({ path: arquivo, type: 'jpeg', quality: 72 });
        }
        console.log(`✔ ${img.arquivo}  (${perfil} ${rota}${clicar ? ` → ${clicar}` : ''})`);
        feitas++;
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`${feitas} captura(s) em public/manual/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
