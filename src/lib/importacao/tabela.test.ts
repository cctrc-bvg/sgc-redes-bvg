import { describe, expect, it } from 'vitest';
import { celulaSegura, gerarCsv, lerCsv, lerSimNao, mapearColunas, normalizarCabecalho } from './tabela';

describe('lerCsv', () => {
  it('lê ";" com BOM e CRLF, descartando linhas vazias', () => {
    const t = lerCsv('﻿nome;carga\r\nBiologia I;80\r\n;\r\n\r\nFísica I;80\r\n');
    expect(t.cabecalho).toEqual(['nome', 'carga']);
    expect(t.linhas).toEqual([
      { numero: 2, celulas: ['Biologia I', '80'] },
      { numero: 5, celulas: ['Física I', '80'] },
    ]);
  });

  it('detecta vírgula e respeita aspas, aspas escapadas e quebra de linha entre aspas', () => {
    const t = lerCsv('nome,obs\n"Redes, Cabeamento","diz ""olá""\nsegunda linha"\nX,Y');
    expect(t.linhas[0].celulas).toEqual(['Redes, Cabeamento', 'diz "olá"\nsegunda linha']);
    // Uma célula com quebra de linha continua sendo uma linha da planilha.
    expect(t.linhas[1]).toEqual({ numero: 3, celulas: ['X', 'Y'] });
  });

  it('arquivo vazio', () => {
    expect(lerCsv('')).toEqual({ cabecalho: [], linhas: [] });
  });
});

describe('cabeçalhos e colunas', () => {
  it('normaliza acentos, caixa e separadores', () => {
    expect(normalizarCabecalho(' Carga Horária (h) ')).toBe('carga_horaria_h');
    expect(normalizarCabecalho('E-mail')).toBe('e_mail');
  });

  const colunas = [
    { campo: 'nome', titulo: 'Nome', apelidos: ['disciplina'], obrigatoria: true },
    { campo: 'cargaHoraria', titulo: 'Carga horária', apelidos: ['ch', 'carga_horaria_h'], obrigatoria: true },
    { campo: 'codigo', titulo: 'Código', apelidos: ['sigla'] },
  ] as const;

  it('mapeia por título, apelido ou nome do campo, em qualquer ordem', () => {
    const r = mapearColunas({ cabecalho: ['Sigla', 'CH', 'Disciplina', 'Extra'], linhas: [{ numero: 2, celulas: ['BIO.1', '80', 'Biologia I', 'x'] }] }, colunas);
    expect(r.registros).toEqual([{ numero: 2, valores: { nome: 'Biologia I', cargaHoraria: '80', codigo: 'BIO.1' } }]);
    expect(r.faltando).toEqual([]);
    expect(r.desconhecidas).toEqual(['Extra']);
  });

  it('aponta colunas obrigatórias ausentes e preenche opcionais com vazio', () => {
    const r = mapearColunas({ cabecalho: ['Nome'], linhas: [{ numero: 2, celulas: ['Biologia I'] }] }, colunas);
    expect(r.faltando).toEqual(['Carga horária']);
    expect(r.registros[0].valores.codigo).toBe('');
  });
});

describe('lerSimNao', () => {
  it.each([
    ['Sim', true],
    ['x', true],
    ['NÃO', false],
    ['', false],
    ['talvez', null],
  ])('%s → %s', (v, esperado) => {
    expect(lerSimNao(v)).toBe(esperado);
  });
});

describe('gerarCsv', () => {
  it('usa ";", BOM, CRLF e aspas quando preciso', () => {
    expect(gerarCsv(['a', 'b'], [['x;y', 'diz "oi"']])).toBe('﻿a;b\r\n"x;y";"diz ""oi"""\r\n');
  });

  it('neutraliza fórmulas (injeção de CSV)', () => {
    expect(celulaSegura('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(celulaSegura('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(celulaSegura('Redes')).toBe('Redes');
  });

  it('o CSV gerado é lido de volta igual', () => {
    const linhas = [['Redes; Cabeamento', 'linha\nquebrada', '"aspas"']];
    expect(lerCsv(gerarCsv(['a', 'b', 'c'], linhas)).linhas[0].celulas).toEqual(linhas[0]);
  });
});
