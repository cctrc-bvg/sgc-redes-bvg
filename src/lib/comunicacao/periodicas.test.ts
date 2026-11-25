import { describe, expect, it } from 'vitest';
import { chaveResumoSemanal, diasDaSemana, etapasComPrazo, nesimoDiaLetivoDepois, proximaSegunda, resumoSemanal, type DadosResumo } from './periodicas';

describe('mensagens periódicas (G27)', () => {
  it('a próxima segunda: de sexta, sábado, domingo e segunda', () => {
    expect(proximaSegunda('2026-03-06')).toBe('2026-03-09'); // sexta
    expect(proximaSegunda('2026-03-07')).toBe('2026-03-09'); // sábado
    expect(proximaSegunda('2026-03-08')).toBe('2026-03-09'); // domingo
    expect(proximaSegunda('2026-03-09')).toBe('2026-03-16'); // segunda
    expect(diasDaSemana('2026-03-09')).toEqual(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']);
  });

  it('n-ésimo dia letivo depois de uma data', () => {
    const letivos = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09'];
    expect(nesimoDiaLetivoDepois('2026-03-02', letivos, 5)).toBe('2026-03-09');
    expect(nesimoDiaLetivoDepois('2026-03-03', letivos, 5)).toBeNull();
  });

  it('etapas: avisa a que termina até a sexta e some depois da entrega', () => {
    const letivos = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20'];
    const etapas = [{ inicio: '2026-02-02', fim: '2026-03-06' }, { inicio: '2026-03-09', fim: '2026-05-01' }, null, null];
    const semana1 = etapasComPrazo(etapas, letivos, '2026-03-02');
    expect(semana1).toEqual([{ etapa: 1, fim: '2026-03-06', entregaAte: '2026-03-13' }]);
    expect(etapasComPrazo(etapas, letivos, '2026-03-09')).toHaveLength(1); // entrega em 13/03, ainda vale
    expect(etapasComPrazo(etapas, letivos, '2026-03-16')).toEqual([]); // entrega passou
  });

  const dados: DadosResumo = {
    nome: 'Ana',
    segunda: '2026-03-09',
    dias: [
      { data: '2026-03-09', semAula: null, aulas: [{ disciplina: 'Redes I', turma: 'REDES-1', quantidade: 2 }] },
      { data: '2026-03-10', semAula: 'feriado municipal', aulas: [] },
      { data: '2026-03-11', semAula: null, aulas: [] },
      { data: '2026-03-12', semAula: null, aulas: [] },
      { data: '2026-03-13', semAula: null, aulas: [] },
    ],
    substituicoes: [{ data: '2026-03-11', disciplina: 'Lógica', turma: 'REDES-2', frequenciaAte: '2026-03-20' }],
    ausencias: [{ data: '2026-03-12', disciplina: 'Redes I', turma: 'REDES-1', situacao: 'Turma dispensada' }],
    reposicoes: [{ dataAula: '2026-03-12', disciplina: 'Redes I', turma: 'REDES-1', ate: '2026-04-02' }],
    etapas: [{ etapa: 1, fim: '2026-03-06', entregaAte: '2026-03-13' }],
  };

  it('monta o resumo com aulas, mudanças e prazos', () => {
    const { assunto, texto } = resumoSemanal(dados);
    expect(assunto).toBe('[SGC-Redes] Resumo da semana — 09/03/2026 a 13/03/2026');
    expect(texto).toContain('Olá, Ana!');
    expect(texto).toContain('seg 09/03: Redes I (REDES-1), 2 aulas.');
    expect(texto).toContain('ter 10/03: sem aula (feriado municipal).');
    expect(texto).toContain('Você assume Lógica (REDES-2) em 11/03/2026. Lance a frequência até 20/03/2026 (ROD, Art. 43).');
    expect(texto).toContain('turma dispensada');
    expect(texto).toContain('Reposição de Redes I (REDES-1), aula de 12/03/2026: até 02/04/2026 (ROD, Art. 37).');
    expect(texto).toContain('entrega dos diários e notas até 13/03/2026');
  });

  it('sem mudanças nem prazos, omite essas seções', () => {
    const { texto } = resumoSemanal({ ...dados, substituicoes: [], ausencias: [], reposicoes: [], etapas: [] });
    expect(texto).not.toContain('*Mudanças*');
    expect(texto).not.toContain('*Prazos*');
  });

  it('semana sem aulas na grade', () => {
    const { texto } = resumoSemanal({ ...dados, dias: dados.dias.map((d) => ({ ...d, semAula: null, aulas: [] })), substituicoes: [], ausencias: [], reposicoes: [], etapas: [] });
    expect(texto).toContain('Nenhuma aula na grade desta semana.');
  });

  it('chave de envio por semana e docente', () => {
    expect(chaveResumoSemanal('2026-03-09', 'u1')).toBe('resumo:2026-03-09:u1');
  });
});
