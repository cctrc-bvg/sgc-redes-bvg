/**
 * Ações prioritárias do painel: o que pede atenção do usuário agora, por perfil, da mais urgente para a menos.
 * Funções puras: o servidor (servidor.ts) só conta; aqui se decide texto, nível e ordem. Nunca expõe nomes
 * (LGPD): só quantidades e o caminho para resolver.
 */
import type { NomeIcone } from '@/lib/navegacao';

export type NivelAcao = 'urgente' | 'atencao' | 'acompanhar';

export interface AcaoPrioritaria {
  id: string;
  nivel: NivelAcao;
  icone: NomeIcone;
  quantidade: number;
  titulo: string;
  detalhe: string;
  href: string;
  /** Texto do botão: o verbo do que se faz ao abrir. */
  botao: string;
}

/** Contagens feitas no servidor. Zero quando o perfil não pode ver aquilo. */
export interface ContagensPainel {
  emergenciasRefeicao: number;
  avisosRefeicao: number;
  ausenciasPendentes: number;
  ausenciasHojeOuAmanha: number;
  convitesPendentes: number;
  ppiEmAnalise: number;
  ppeRetencao: number;
  ppeParaDefinir: number;
  peiParaPreencher: number;
  diariosAtrasados: number;
  meusDiariosAtrasados: number;
  processosVencidos: number;
  etapasFaltando: boolean;
}

export const CONTAGENS_ZERADAS: ContagensPainel = {
  emergenciasRefeicao: 0,
  avisosRefeicao: 0,
  ausenciasPendentes: 0,
  ausenciasHojeOuAmanha: 0,
  convitesPendentes: 0,
  ppiEmAnalise: 0,
  ppeRetencao: 0,
  ppeParaDefinir: 0,
  peiParaPreencher: 0,
  diariosAtrasados: 0,
  meusDiariosAtrasados: 0,
  processosVencidos: 0,
  etapasFaltando: false,
};

/** O que muda o texto: quem dá ciência das refeições (AE) ou quem acompanha (Coordenação). */
export interface PapelNoPainel {
  daCienciaRefeicao: boolean;
}

const ORDEM: Record<NivelAcao, number> = { urgente: 0, atencao: 1, acompanhar: 2 };

export function ordenarAcoes(acoes: readonly AcaoPrioritaria[]): AcaoPrioritaria[] {
  return [...acoes].sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}

/** Monta as ações a partir das contagens; só entra o que tem quantidade. */
export function montarAcoes(c: ContagensPainel, papel: PapelNoPainel): AcaoPrioritaria[] {
  const acoes: AcaoPrioritaria[] = [];
  const add = (a: AcaoPrioritaria) => {
    if (a.quantidade > 0) acoes.push(a);
  };

  add(
    papel.daCienciaRefeicao
      ? {
          id: 'refeicao-emergencia',
          nivel: 'urgente',
          icone: 'alimentacao',
          quantidade: c.emergenciasRefeicao,
          titulo: 'Avisos de refeição urgentes',
          detalhe: 'A refeição é em menos de 4 horas: dê ciência agora.',
          href: '/alimentacao',
          botao: 'Dar ciência',
        }
      : {
          id: 'refeicao-emergencia',
          nivel: 'urgente',
          icone: 'alimentacao',
          quantidade: c.emergenciasRefeicao,
          titulo: 'Refeições com menos de 4h sem ciência da AE',
          detalhe: 'Ligue para a Assistência Estudantil e confirme o aviso (G06).',
          href: '/alimentacao',
          botao: 'Ver avisos',
        },
  );
  add({
    id: 'convites',
    nivel: 'urgente',
    icone: 'minha-grade',
    quantidade: c.convitesPendentes,
    titulo: 'Convites de substituição para responder',
    detalhe: 'A Coordenação aguarda sua resposta para cobrir a aula.',
    href: '/grade/minha',
    botao: 'Responder',
  });
  add({
    id: 'ausencias',
    nivel: c.ausenciasHojeOuAmanha > 0 ? 'urgente' : 'atencao',
    icone: 'ausencias',
    quantidade: c.ausenciasPendentes,
    titulo: 'Ausências aguardando decisão',
    detalhe: c.ausenciasHojeOuAmanha > 0 ? `${c.ausenciasHojeOuAmanha} para hoje ou amanhã: decida a cobertura de cada horário.` : 'Decida a cobertura de cada horário.',
    href: '/ausencias',
    botao: 'Decidir',
  });
  add(
    papel.daCienciaRefeicao
      ? {
          id: 'refeicao-avisos',
          nivel: 'atencao',
          icone: 'alimentacao',
          quantidade: c.avisosRefeicao,
          titulo: 'Avisos de refeição para dar ciência',
          detalhe: 'Confirme que a cozinha foi avisada.',
          href: '/alimentacao',
          botao: 'Dar ciência',
        }
      : {
          id: 'refeicao-avisos',
          nivel: 'acompanhar',
          icone: 'alimentacao',
          quantidade: c.avisosRefeicao,
          titulo: 'Avisos aguardando a ciência da AE',
          detalhe: 'No prazo; a Assistência Estudantil ainda não confirmou.',
          href: '/alimentacao',
          botao: 'Ver avisos',
        },
  );
  add({
    id: 'ppe-definir',
    nivel: 'atencao',
    icone: 'ppe',
    quantidade: c.ppeParaDefinir,
    titulo: 'PPE aguardando você definir a modalidade',
    detalhe: 'Escolha PEI ou Dependência para cada estudante (Arts. 117–118).',
    href: '/ppe',
    botao: 'Definir',
  });
  add({
    id: 'pei-preencher',
    nivel: 'atencao',
    icone: 'ppe',
    quantidade: c.peiParaPreencher,
    titulo: 'Planos de Estudo Individual para preencher',
    detalhe: 'Objetivos, conteúdos e o cronograma de encontros.',
    href: '/ppe',
    botao: 'Preencher',
  });
  add({
    id: 'ppi',
    nivel: 'atencao',
    icone: 'ppi',
    quantidade: c.ppiEmAnalise,
    titulo: 'Solicitações de PPI para analisar',
    detalhe: 'Confira os comprovantes e decida.',
    href: '/ppi',
    botao: 'Analisar',
  });
  add({
    id: 'retencao',
    nivel: 'atencao',
    icone: 'ppe',
    quantidade: c.ppeRetencao,
    titulo: 'PPE com alerta de retenção',
    detalhe: 'Estudantes com 3 ou mais componentes pendentes no semestre (Art. 115).',
    href: '/ppe',
    botao: 'Ver',
  });
  add({
    id: 'processos',
    nivel: 'atencao',
    icone: 'processos',
    quantidade: c.processosVencidos,
    titulo: 'Processos com prazo vencido',
    detalhe: 'Atualize a etapa ou o prazo no quadro.',
    href: '/processos',
    botao: 'Abrir quadro',
  });
  add({
    id: 'meus-diarios',
    nivel: 'atencao',
    icone: 'diarios',
    quantidade: c.meusDiariosAtrasados,
    titulo: 'Seus diários marcados como atrasados',
    detalhe: 'Lance frequências e conteúdos no sistema acadêmico.',
    href: '/diarios',
    botao: 'Ver diários',
  });
  add({
    id: 'diarios',
    nivel: 'acompanhar',
    icone: 'diarios',
    quantidade: c.diariosAtrasados,
    titulo: 'Diários atrasados',
    detalhe: 'Disciplinas com diário fora do dia; dá para enviar lembrete ao docente.',
    href: '/diarios',
    botao: 'Ver diários',
  });
  add({
    id: 'etapas',
    nivel: 'atencao',
    icone: 'calendario',
    quantidade: c.etapasFaltando ? 1 : 0,
    titulo: 'Etapas do ano letivo não cadastradas',
    detalhe: 'Sem as etapas N1–N4, o sistema não conta os dias letivos.',
    href: '/calendario/etapas',
    botao: 'Cadastrar',
  });
  return ordenarAcoes(acoes);
}

/** Separa o que pede ação (urgente/atenção) do que é só para acompanhar. */
export function separarAcoes(acoes: readonly AcaoPrioritaria[]) {
  return {
    agir: acoes.filter((a) => a.nivel !== 'acompanhar'),
    acompanhar: acoes.filter((a) => a.nivel === 'acompanhar'),
  };
}
