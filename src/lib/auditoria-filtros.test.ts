import { describe, expect, it } from 'vitest';
import { condicaoAuditoria, descreverAcao, lerFiltrosAuditoria, urlDaPagina } from './auditoria-filtros';

describe('filtros da auditoria', () => {
  it('lê parâmetros válidos e ignora os inválidos', () => {
    expect(lerFiltrosAuditoria({ acao: 'CRIOU_TURMA', usuario: 'ckabc123', de: '2026-11-01', ate: '2026-11-24', pagina: '2' })).toEqual({
      acao: 'CRIOU_TURMA',
      usuarioId: 'ckabc123',
      de: '2026-11-01',
      ate: '2026-11-24',
      pagina: 2,
    });
    expect(lerFiltrosAuditoria({ acao: "x'; drop", usuario: 'a b', de: '2026-02-30', pagina: '-1' })).toEqual({ pagina: 1 });
  });

  it('inverte período trocado', () => {
    const f = lerFiltrosAuditoria({ de: '2026-11-24', ate: '2026-11-01' });
    expect([f.de, f.ate]).toEqual(['2026-11-01', '2026-11-24']);
  });

  it('monta a condição com datas de Fortaleza e "até" inclusivo', () => {
    expect(condicaoAuditoria({ pagina: 1 })).toEqual({});
    const c = condicaoAuditoria({ acao: 'X_Y', de: '2026-11-01', ate: '2026-11-01', pagina: 1 }) as { createdAt: { gte: Date; lt: Date } };
    expect(c.createdAt.gte.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(c.createdAt.lt.toISOString()).toBe('2026-11-02T03:00:00.000Z');
  });

  it('URL da página e descrição da ação', () => {
    expect(urlDaPagina({ acao: 'CRIOU_TURMA', pagina: 1 }, 3)).toBe('/auditoria?acao=CRIOU_TURMA&pagina=3');
    expect(urlDaPagina({ pagina: 2 }, 1)).toBe('/auditoria');
    expect(descreverAcao('DEU_CIENCIA_ALIMENTACAO')).toBe('Deu ciência de aviso de refeição');
    expect(descreverAcao('ACAO_NOVA')).toBe('ACAO_NOVA');
  });
});
