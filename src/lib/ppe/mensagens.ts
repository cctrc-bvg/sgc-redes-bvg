/**
 * Mensagens prontas das decisões da PPE (modo semiautomático): pedir ao docente que defina a modalidade,
 * avisar o estudante e a CTP da modalidade definida, do PEI pronto (com o cronograma), da prorrogação do prazo
 * (Art. 124) e do resultado.
 * Funções puras: o servidor (comunicar.ts) acrescenta destinatário, saudação e contato.
 */
import type { ModalidadePPE, StatusPPE } from '@prisma/client';
import { formatarData } from '@/lib/ausencias/regras';

export interface PpeComunicavel {
  semestre: string;
  nomeEstudante: string;
  matricula: string;
  disciplina: string;
  modalidade: ModalidadePPE;
  status: StatusPPE;
  notaFinal: number | null;
  /** Nome do docente que preencheu o PEI ou que leciona a disciplina. */
  docente: string | null;
  pei: {
    cargaHoraria: number;
    horasPresenciais: number;
    horasPraticas: number;
    /** Data-limite da prorrogação (AAAA-MM-DD), se houver. */
    prorrogadoAte: string | null;
    encontros: { data: string; conteudo: string }[];
  } | null;
}

/** Momento da PPE que pede comunicação; define os textos e os destinatários. */
export type SituacaoPpe = 'definir' | 'modalidade' | 'pei' | 'prorrogacao' | 'resultado';
export type PublicoPpe = 'docente' | 'estudante' | 'ctp';

export const NOME_SITUACAO_PPE: Record<SituacaoPpe, string> = {
  definir: 'Pedir a definição da modalidade',
  modalidade: 'Modalidade definida',
  pei: 'PEI pronto',
  prorrogacao: 'Prazo prorrogado',
  resultado: 'Resultado',
};

/** Modalidade em linguagem para o estudante (sem siglas de artigo). */
const MODALIDADE_ESTUDANTE: Record<ModalidadePPE, string> = {
  A_DEFINIR: 'a definir',
  PEI: 'Plano de Estudo Individual (PEI)',
  DEPENDENCIA: 'Dependência presencial',
  DEPENDENCIA_EAD: 'Dependência a distância',
};

export function situacaoDaPpe(p: Pick<PpeComunicavel, 'modalidade' | 'status'> & { pei: { encontros: readonly unknown[] } | null }): SituacaoPpe {
  if (p.status === 'APROVADO' || p.status === 'REPROVADO' || p.status === 'LANCADO_ACADEMICO') return 'resultado';
  if (p.modalidade === 'A_DEFINIR' || p.status === 'AGUARDANDO_PROFESSOR') return 'definir';
  // Prorrogação (Art. 124) é um aviso próprio: o PEI pronto pode já ter sido enviado com o prazo anterior.
  if (p.status === 'PRORROGADO' && p.modalidade === 'PEI' && p.pei) return 'prorrogacao';
  if (p.modalidade === 'PEI' && p.pei && p.pei.encontros.length > 0) return 'pei';
  return 'modalidade';
}

/** Quem recebe em cada momento, na ordem de envio. */
export const PUBLICOS_PPE: Record<SituacaoPpe, readonly PublicoPpe[]> = {
  definir: ['docente'],
  modalidade: ['estudante', 'ctp'],
  pei: ['estudante', 'ctp'],
  prorrogacao: ['estudante', 'ctp'],
  resultado: ['estudante', 'ctp'],
};

const nota = (n: number | null) => (n === null ? null : String(n).replace('.', ','));
const assinatura = 'Coordenação do Curso Técnico em Redes de Computadores';

export function assuntoPpe(p: PpeComunicavel, situacao: SituacaoPpe): string {
  const base = `PPE ${p.semestre} — ${p.disciplina}`;
  if (situacao === 'definir') return `[SGC-Redes] ${base}: definir a modalidade`;
  if (situacao === 'modalidade') return `[SGC-Redes] ${base}: modalidade definida`;
  if (situacao === 'pei') return `[SGC-Redes] ${base}: Plano de Estudo Individual`;
  if (situacao === 'prorrogacao') return `[SGC-Redes] ${base}: prazo do PEI prorrogado`;
  return `[SGC-Redes] ${base}: resultado`;
}

/** Corpo da mensagem, sem saudação (quem monta acrescenta a do destinatário). */
export function textoPpe(p: PpeComunicavel, situacao: SituacaoPpe, publico: PublicoPpe): string {
  const linhas: string[] = [];
  const doEstudante = publico === 'estudante';
  const quem = `${p.nomeEstudante} (matrícula ${p.matricula})`;

  if (situacao === 'definir') {
    linhas.push(
      `Há estudante com Progressão Parcial de Estudos (PPE) em *${p.disciplina}* (${p.semestre}) aguardando a definição da modalidade: PEI ou Dependência (Arts. 117–118 do ROD).`,
      'Acesse PPE / PEI no SGC-Redes para definir e, se for PEI, preencher o plano com o cronograma de encontros.',
    );
  } else if (situacao === 'modalidade') {
    linhas.push(
      doEstudante
        ? `Sua Progressão Parcial de Estudos (PPE) em *${p.disciplina}* (${p.semestre}) será cumprida na modalidade *${MODALIDADE_ESTUDANTE[p.modalidade]}*.`
        : `PPE de ${quem} em *${p.disciplina}* (${p.semestre}): modalidade definida — *${MODALIDADE_ESTUDANTE[p.modalidade]}*.`,
    );
    if (p.docente) linhas.push(`Docente responsável: ${p.docente}.`);
    if (p.modalidade === 'PEI') linhas.push(doEstudante ? 'O plano com as datas dos encontros será enviado assim que estiver pronto.' : 'O plano (PEI) está em preparação pelo docente.');
    else if (doEstudante) linhas.push('A Coordenação informará turma, horários e início das atividades.');
  } else if (situacao === 'pei' && p.pei) {
    linhas.push(
      doEstudante
        ? `Seu Plano de Estudo Individual (PEI) em *${p.disciplina}* (${p.semestre}) está pronto.`
        : `PEI de ${quem} em *${p.disciplina}* (${p.semestre}) está pronto.`,
    );
    if (p.docente) linhas.push(`Docente responsável: ${p.docente}.`);
    const praticas = p.pei.horasPraticas > 0 ? `, ${p.pei.horasPraticas}h práticas` : '';
    linhas.push(`Carga horária: ${p.pei.cargaHoraria}h (${p.pei.horasPresenciais}h presenciais${praticas}).`);
    if (p.pei.prorrogadoAte) linhas.push(`Prazo prorrogado até *${formatarData(p.pei.prorrogadoAte)}* (Art. 124).`);
    linhas.push('', '*Encontros:*', ...p.pei.encontros.map((e) => `• ${formatarData(e.data)} — ${e.conteudo}`));
    linhas.push('');
    linhas.push(doEstudante ? 'Compareça aos encontros e procure o docente em caso de dúvida. O plano impresso fica na Coordenação para assinatura.' : 'Acompanhamento disponível em PPE / PEI no SGC-Redes (Art. 127).');
  } else if (situacao === 'prorrogacao') {
    const prazo = p.pei?.prorrogadoAte ? ` até *${formatarData(p.pei.prorrogadoAte)}*` : '';
    linhas.push(
      doEstudante
        ? `O prazo do seu Plano de Estudo Individual (PEI) em *${p.disciplina}* (${p.semestre}) foi prorrogado${prazo} (Art. 124).`
        : `PEI de ${quem} em *${p.disciplina}* (${p.semestre}): prazo prorrogado${prazo} (Art. 124).`,
    );
    if (p.docente) linhas.push(`Docente responsável: ${p.docente}.`);
    const encontros = p.pei?.encontros ?? [];
    if (encontros.length > 0) linhas.push('', '*Encontros:*', ...encontros.map((e) => `• ${formatarData(e.data)} — ${e.conteudo}`));
    linhas.push('');
    linhas.push(doEstudante ? 'Continue os encontros com o docente e procure a Coordenação em caso de dúvida.' : 'Acompanhamento disponível em PPE / PEI no SGC-Redes (Art. 127).');
  } else {
    const n = nota(p.notaFinal);
    // Lançada no acadêmico: a situação anterior (aprovado/reprovado) não fica guardada, então não se presume.
    const resultado = p.status === 'REPROVADO' ? 'não aprovado(a)' : p.status === 'APROVADO' ? 'aprovado(a)' : 'concluída';
    linhas.push(
      doEstudante
        ? `Resultado da sua Progressão Parcial de Estudos (PPE) em *${p.disciplina}* (${p.semestre}): *${resultado}*${n ? `, nota ${n}` : ''}.`
        : `PPE de ${quem} em *${p.disciplina}* (${p.semestre}): *${resultado}*${n ? `, nota ${n}` : ''}.`,
    );
    if (p.status === 'LANCADO_ACADEMICO') linhas.push('O resultado já está lançado no sistema acadêmico.');
    else if (doEstudante) linhas.push('A Coordenação fará o lançamento no sistema acadêmico (Art. 125).');
    if (doEstudante && p.status === 'REPROVADO') linhas.push('Procure a Coordenação para saber os próximos passos.');
  }
  linhas.push('', assinatura);
  return linhas.join('\n');
}
