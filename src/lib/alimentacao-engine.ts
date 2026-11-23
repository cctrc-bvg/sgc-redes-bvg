import { NivelUrgenciaSla, TipoRefeicao } from '@prisma/client';

export interface PresencaTurnos {
  temAulaManha: boolean;
  temAulaTarde: boolean;
}

export interface ImpactoRefeicao {
  tipoRefeicao: TipoRefeicao;
  horarioReferencia: string; // "09:30" | "12:00" | "15:00"
  acao: 'CANCELAR' | 'ADICIONAR';
  antecedenciaMinutos: number;
  nivelSla: NivelUrgenciaSla;
  etiquetaSla: string;
}

const HORARIOS_REFEICAO: Record<TipoRefeicao, string> = {
  LANCHE_MANHA: '09:30',
  ALMOCO: '12:00',
  LANCHE_TARDE: '15:00',
};

/**
 * Regra oficial do Campus Boa Viagem:
 * - Só Manhã: Lanche Manhã (09:30)
 * - Só Tarde: Lanche Tarde (15:00)
 * - Integral (Manhã + Tarde): Lanche Manhã (09:30) + Almoço (12:00) + Lanche Tarde (15:00)
 */
export function calcularRefeicoesPrevistas(presenca: PresencaTurnos): TipoRefeicao[] {
  const refeicoes: TipoRefeicao[] = [];

  if (presenca.temAulaManha) {
    refeicoes.push('LANCHE_MANHA');
  }
  if (presenca.temAulaManha && presenca.temAulaTarde) {
    refeicoes.push('ALMOCO');
  }
  if (presenca.temAulaTarde) {
    refeicoes.push('LANCHE_TARDE');
  }

  return refeicoes;
}

/**
 * Cria Date exato no fuso horário do Ceará (UTC-03:00) independente do fuso do servidor Docker.
 */
function criarDataHoraCeara(dataISO: string, horaHHMM: string): Date {
  // dataISO esperada: "YYYY-MM-DD"
  return new Date(`${dataISO}T${horaHHMM}:00-03:00`);
}

export function classificarSla(antecedenciaMinutos: number): {
  nivel: NivelUrgenciaSla;
  etiqueta: string;
} {
  if (antecedenciaMinutos >= 24 * 60) {
    return { nivel: 'VERDE_24H_MAIS', etiqueta: '🟢 Planejado (24h+)' };
  }
  if (antecedenciaMinutos >= 4 * 60) {
    return { nivel: 'AMARELO_4H_A_24H', etiqueta: '🟡 Imprevisto Moderado (4h–24h)' };
  }
  return { nivel: 'VERMELHO_MENOS_4H', etiqueta: '🔴 Emergência (< 4h)' };
}

/**
 * Compara o planejamento original do dia com o novo cenário após ausência/remanejamento.
 */
export function calcularImpactoAlimentacao(params: {
  dataAulaISO: string; // "YYYY-MM-DD"
  antes: PresencaTurnos;
  depois: PresencaTurnos;
  agora?: Date;
}): ImpactoRefeicao[] {
  const agora = params.agora ?? new Date();
  const refeicoesAntes = calcularRefeicoesPrevistas(params.antes);
  const refeicoesDepois = calcularRefeicoesPrevistas(params.depois);

  const impactos: ImpactoRefeicao[] = [];

  // Refeições que deixaram de ser necessárias
  for (const ref of refeicoesAntes) {
    if (!refeicoesDepois.includes(ref)) {
      const hora = HORARIOS_REFEICAO[ref];
      const dataHoraRef = criarDataHoraCeara(params.dataAulaISO, hora);
      const diffMin = Math.floor((dataHoraRef.getTime() - agora.getTime()) / 60000);
      const sla = classificarSla(diffMin);

      impactos.push({
        tipoRefeicao: ref,
        horarioReferencia: hora,
        acao: 'CANCELAR',
        antecedenciaMinutos: diffMin,
        nivelSla: sla.nivel,
        etiquetaSla: sla.etiqueta,
      });
    }
  }

  // Refeições adicionadas (ex: encontro presencial de PEI/reposição tornando o dia integral)
  for (const ref of refeicoesDepois) {
    if (!refeicoesAntes.includes(ref)) {
      const hora = HORARIOS_REFEICAO[ref];
      const dataHoraRef = criarDataHoraCeara(params.dataAulaISO, hora);
      const diffMin = Math.floor((dataHoraRef.getTime() - agora.getTime()) / 60000);
      const sla = classificarSla(diffMin);

      impactos.push({
        tipoRefeicao: ref,
        horarioReferencia: hora,
        acao: 'ADICIONAR',
        antecedenciaMinutos: diffMin,
        nivelSla: sla.nivel,
        etiquetaSla: sla.etiqueta,
      });
    }
  }

  return impactos;
}

/**
 * Gera texto LGPD-safe (sem dados pessoais sensíveis) pronto para WhatsApp da Assistência Estudantil.
 */
export function gerarMensagemAssistenciaEstudantil(params: {
  nomeTurma: string;
  dataFormatada: string; // "20/11/2026"
  qtdAlunos: number;
  motivoOperacional: string;
  impactos: ImpactoRefeicao[];
}): string {
  if (params.impactos.length === 0) {
    return `Coordenação de Redes informa: houve remanejamento na turma *${params.nomeTurma}* em ${params.dataFormatada}, mas o turno de permanência NÃO mudou. Alimentação mantida normalmente.`;
  }

  const nomesRefeicao: Record<TipoRefeicao, string> = {
    LANCHE_MANHA: 'Lanche da Manhã (09:30)',
    ALMOCO: 'Almoço (12:00)',
    LANCHE_TARDE: 'Lanche da Tarde (15:00)',
  };

  const linhas = params.impactos.map((i) => {
    const verbo = i.acao === 'CANCELAR' ? 'CANCELAR' : 'ADICIONAR';
    return `- ${verbo} *${nomesRefeicao[i.tipoRefeicao]}* — ${i.etiquetaSla}`;
  });

  return [
    `*AVISO DE REPLANEJAMENTO ALIMENTAR — COORD. REDES DE COMPUTADORES*`,
    `Turma: *${params.nomeTurma}* (~${params.qtdAlunos} estudantes)`,
    `Data: *${params.dataFormatada}*`,
    `Alterações necessárias:`,
    ...linhas,
    `Motivo operacional: ${params.motivoOperacional}`,
    `_Registro gerado automaticamente pelo Painel da Coordenação._`,
  ].join('\n');
}