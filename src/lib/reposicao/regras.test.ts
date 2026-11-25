import { describe, expect, it } from 'vitest';
import { MAX_ANEXO_BYTES, nomeSeguroDoAnexo, reposicaoEmAberto, situacaoReposicao, tipoDoAnexo, validarAnexo, validarDataReposicao } from './regras';

describe('reposição de aulas (ROD, Art. 37)', () => {
  it('situação: pendente, agendada, aguardando ciência e reposta', () => {
    expect(situacaoReposicao({ status: 'TURMA_DISPENSADA', reposicaoEm: null, reposicaoCienteEm: null })).toBe('pendente');
    expect(situacaoReposicao({ status: 'REPOSICAO_AGENDADA', reposicaoEm: null, reposicaoCienteEm: null })).toBe('agendada');
    expect(situacaoReposicao({ status: 'TURMA_DISPENSADA', reposicaoEm: '2026-03-20', reposicaoCienteEm: null })).toBe('aguarda-ciencia');
    expect(situacaoReposicao({ status: 'TURMA_DISPENSADA', reposicaoEm: '2026-03-20', reposicaoCienteEm: new Date() })).toBe('reposta');
  });

  it('em aberto: só dispensa ou reposição agendada sem reposição informada', () => {
    expect(reposicaoEmAberto({ status: 'TURMA_DISPENSADA', reposicaoEm: null })).toBe(true);
    expect(reposicaoEmAberto({ status: 'REPOSICAO_AGENDADA', reposicaoEm: null })).toBe(true);
    expect(reposicaoEmAberto({ status: 'TURMA_DISPENSADA', reposicaoEm: new Date() })).toBe(false);
    expect(reposicaoEmAberto({ status: 'COBERTA_POR_SUBSTITUICAO', reposicaoEm: null })).toBe(false);
  });

  it('data da reposição: nem antes da aula, nem no futuro', () => {
    expect(validarDataReposicao('2026-03-20', '2026-03-12', '2026-03-25')).toBeNull();
    expect(validarDataReposicao('2026-03-10', '2026-03-12', '2026-03-25')).toMatch(/anterior/);
    expect(validarDataReposicao('2026-04-01', '2026-03-12', '2026-03-25')).toMatch(/já passou/);
  });

  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]);

  it('anexo: aceita PDF, JPG e PNG pelo conteúdo e rejeita o resto', () => {
    expect(tipoDoAnexo(pdf)?.ext).toBe('pdf');
    expect(tipoDoAnexo(jpg)?.ext).toBe('jpg');
    expect(tipoDoAnexo(png)?.ext).toBe('png');
    expect(tipoDoAnexo(new Uint8Array([0x4d, 0x5a, 0x90]))).toBeNull(); // executável
    expect(validarAnexo(new Uint8Array([0x3c, 0x68, 0x74]), 0)).toEqual({ erro: 'Envie um arquivo PDF, JPG ou PNG.' }); // HTML
  });

  it('anexo: vazio, grande demais e limite por ausência', () => {
    expect(validarAnexo(new Uint8Array(), 0)).toEqual({ erro: 'O arquivo está vazio.' });
    const grande = new Uint8Array(MAX_ANEXO_BYTES + 1);
    grande.set(pdf);
    expect(validarAnexo(grande, 0)).toMatchObject({ erro: expect.stringContaining('5 MB') });
    expect(validarAnexo(pdf, 3)).toMatchObject({ erro: expect.stringContaining('3 arquivos') });
    expect(validarAnexo(pdf, 2)).toEqual({ mime: 'application/pdf', ext: 'pdf' });
  });

  it('nome seguro: sem caminho, com a extensão verdadeira', () => {
    expect(nomeSeguroDoAnexo('../../etc/passwd.exe', 'pdf')).toBe('etcpasswd.pdf');
    expect(nomeSeguroDoAnexo('Reposição 12-03.docx', 'pdf')).toBe('Reposição 12-03.pdf');
    expect(nomeSeguroDoAnexo('<<>>.png', 'png')).toBe('formulario-reposicao.png');
  });
});
