import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULOS, PERMISSOES } from '@/lib/auth/rbac';
import { topicosDoPerfil } from './acesso';
import { TOPICOS } from './topicos';

const RAIZ = path.resolve(__dirname, '../../..');

/** Rotas estáticas do App Router (sem grupos de rota), ex.: "/calendario/eventos/novo". */
function rotasDoApp(dir = path.join(RAIZ, 'src/app'), prefixo = ''): Set<string> {
  const rotas = new Set<string>();
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      const segmento = /^\(.*\)$/.test(nome) ? '' : `/${nome}`;
      for (const r of rotasDoApp(caminho, prefixo + segmento)) rotas.add(r);
    } else if (nome === 'page.tsx') rotas.add(prefixo || '/');
  }
  return rotas;
}
const ROTAS = rotasDoApp();
const semConsulta = (rota: string) => rota.split('?')[0];

describe('conteúdo da Ajuda', () => {
  it('ids únicos, relacionados existentes e permissões válidas', () => {
    const ids = TOPICOS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOPICOS) {
      for (const r of t.relacionados) expect(ids, `${t.id} → ${r}`).toContain(r);
      if (t.permissao) for (const p of ([] as string[]).concat(t.permissao)) expect(PERMISSOES, t.id).toContain(p);
      expect(t.capacidades.length, t.id).toBeGreaterThan(0);
      expect(t.fluxos.length, t.id).toBeGreaterThan(0);
    }
  });

  it('todo módulo do painel tem um tópico de ajuda', () => {
    const rotas = new Set(TOPICOS.map((t) => t.rota));
    for (const m of MODULOS) expect(rotas, `módulo ${m.id} sem tópico na Ajuda (src/lib/ajuda/topicos.ts)`).toContain(m.href);
  });

  it('rotas citadas existem no sistema', () => {
    for (const t of TOPICOS) {
      if (t.rota) expect(ROTAS, `${t.id}: ${t.rota}`).toContain(semConsulta(t.rota));
      for (const img of t.imagens) expect(ROTAS, `${img.arquivo}: ${img.captura.rota}`).toContain(semConsulta(img.captura.rota));
    }
  });

  it('cada imagem tem arquivo único, texto alternativo e existe em public/manual', () => {
    const arquivos = TOPICOS.flatMap((t) => t.imagens.map((i) => i.arquivo));
    expect(new Set(arquivos).size).toBe(arquivos.length);
    for (const t of TOPICOS) {
      for (const img of t.imagens) {
        expect(img.alt.length, img.arquivo).toBeGreaterThan(20);
        expect(existsSync(path.join(RAIZ, 'public/manual', img.arquivo)), `falta public/manual/${img.arquivo}: rode npm run capturas`).toBe(true);
      }
    }
  });

  it('a CCA vê os tópicos gerais, de calendário e de diários (só consulta)', () => {
    expect(topicosDoPerfil('CCA').map((t) => t.id)).toEqual(['primeiros-passos', 'calendario', 'diarios', 'planilhas', 'privacidade']);
  });

  it('a Assistência Estudantil vê só os tópicos gerais, de calendário e de alimentação', () => {
    expect(topicosDoPerfil('ASSISTENCIA_ESTUDANTIL').map((t) => t.id)).toEqual(['primeiros-passos', 'calendario', 'alimentacao', 'planilhas', 'privacidade']);
  });
});

describe('manual em Markdown', () => {
  it('docs/MANUAL_DO_USUARIO.md está atualizado (rode npm run manual)', async () => {
    const { readFileSync } = await import('node:fs');
    const { montarManual } = await import('./markdown');
    expect(readFileSync(path.join(RAIZ, 'docs/MANUAL_DO_USUARIO.md'), 'utf8')).toBe(montarManual());
  });

  it('âncora no estilo do GitHub', async () => {
    const { ancora } = await import('./markdown');
    expect(ancora('3. Grade horária')).toBe('3-grade-horária');
    expect(ancora('12. Cadastros: usuários, turmas')).toBe('12-cadastros-usuários-turmas');
  });
});
