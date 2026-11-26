/**
 * Mensagens prontas da decisão sobre a PPI (deferida ou indeferida), para o estudante e a CTP.
 * Funções puras: o servidor acrescenta destinatário, saudação e contato.
 */
import type { StatusPpi } from '@prisma/client';
import { formatarHoras } from './regras';

export interface PpiComunicavel {
  nomeEstudante: string;
  matricula: string;
  turmaAtual: string;
  status: StatusPpi;
  totalValidado: number;
  metaHoras: number;
  observacoes: string | null;
}

export type PublicoPpi = 'estudante' | 'ctp';
export const PUBLICOS_PPI: readonly PublicoPpi[] = ['estudante', 'ctp'];

/** Só a decisão (deferida ou indeferida) pede comunicação. */
export const ppiDecidida = (s: Pick<PpiComunicavel, 'status'>) => s.status === 'DEFERIDA' || s.status === 'INDEFERIDA';

export function assuntoPpi(s: PpiComunicavel): string {
  return `[SGC-Redes] PPI — solicitação ${s.status === 'DEFERIDA' ? 'deferida' : 'indeferida'}`;
}

/** Corpo da mensagem, sem saudação. */
export function textoPpi(s: PpiComunicavel, publico: PublicoPpi): string {
  const horas = `${formatarHoras(s.totalValidado)}h validadas de ${formatarHoras(s.metaHoras)}h`;
  const linhas: string[] = [];
  if (publico === 'estudante') {
    if (s.status === 'DEFERIDA') {
      linhas.push(
        `Sua solicitação de Prática Profissional Integrada (PPI) foi *deferida*: ${horas}.`,
        'A ficha está disponível na Coordenação para assinatura.',
      );
    } else {
      linhas.push(`Sua solicitação de Prática Profissional Integrada (PPI) foi *indeferida* (${horas}).`);
      if (s.observacoes) linhas.push(`Motivo: ${s.observacoes}`);
      linhas.push('Procure a Coordenação para complementar as atividades ou os comprovantes.');
    }
  } else {
    linhas.push(
      `PPI de ${s.nomeEstudante} (matrícula ${s.matricula}, ${s.turmaAtual}): *${s.status === 'DEFERIDA' ? 'deferida' : 'indeferida'}*, ${horas}.`,
    );
    if (s.status === 'INDEFERIDA' && s.observacoes) linhas.push(`Motivo: ${s.observacoes}`);
    linhas.push('Para acompanhamento do estudante.');
  }
  linhas.push('', 'Coordenação do Curso Técnico em Redes de Computadores');
  return linhas.join('\n');
}

export interface LinhaResumoPpi {
  turma: string;
  deferidas: number;
  indeferidas: number;
  emAnalise: number;
}

/** Apanhado geral por turma (sem nomes nem matrículas): é o que a CCA recebe, por minimização de dados (LGPD). */
export function resumoPpiPorTurma(solicitacoes: readonly Pick<PpiComunicavel, 'turmaAtual' | 'status'>[]): LinhaResumoPpi[] {
  const porTurma = new Map<string, LinhaResumoPpi>();
  for (const s of solicitacoes) {
    if (s.status === 'RASCUNHO') continue;
    const l = porTurma.get(s.turmaAtual) ?? { turma: s.turmaAtual, deferidas: 0, indeferidas: 0, emAnalise: 0 };
    if (s.status === 'DEFERIDA') l.deferidas++;
    else if (s.status === 'INDEFERIDA') l.indeferidas++;
    else l.emAnalise++;
    porTurma.set(s.turmaAtual, l);
  }
  return [...porTurma.values()].sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR'));
}

export const assuntoResumoPpi = '[SGC-Redes] PPI — apanhado geral por turma';

/** Corpo da mensagem à CCA, sem saudação. */
export function textoResumoPpi(linhas: readonly LinhaResumoPpi[], dataISO: string): string {
  const data = dataISO.split('-').reverse().join('/');
  const corpo = linhas.length
    ? linhas.map((l) => `- ${l.turma}: ${l.deferidas} deferida(s), ${l.indeferidas} indeferida(s), ${l.emAnalise} em análise`)
    : ['- Nenhuma solicitação de PPI registrada até o momento.'];
  return [
    `Apanhado geral das solicitações de Prática Profissional Integrada (PPI), por turma, em ${data}:`,
    ...corpo,
    '',
    'O resultado de cada estudante já segue pela Coordenação (CTP e estudante); esta mensagem traz só os totais da turma, sem nomes.',
    '',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ].join('\n');
}
