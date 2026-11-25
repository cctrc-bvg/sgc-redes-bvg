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
  /** De quem é a ação: do cargo ou da docência (distinguidos na tela de quem acumula os dois). */
  papel: 'cargo' | 'docencia';
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
  /** Reposições (ROD, Art. 37, § 2º) com prazo vencido, a repor e ainda não agendadas. */
  reposicoesVencidas: number;
  /** Reposições ainda não agendadas cujo prazo vence nos próximos 5 dias. */
  reposicoesAVencer: number;
  /** Das pendentes, quantas o próprio docente informou (RF02-A). */
  ausenciasInformadas: number;
  convitesPendentes: number;
  ppiEmAnalise: number;
  ppeRetencao: number;
  ppeParaDefinir: number;
  peiParaPreencher: number;
  diariosAtrasados: number;
  meusDiariosAtrasados: number;
  processosVencidos: number;
  /** Processos que vencem nos próximos 3 dias. */
  processosAVencer: number;
  etapasFaltando: boolean;
  /** Preparação do ano: datas do semestre atual não cadastradas (diários e calendário dependem delas). */
  semestreSemDatas: boolean;
  /** Preparação do ano: disciplinas da matriz sem professor nas turmas ativas. */
  disciplinasSemProfessor: number;
  /** Preparação do ano: turmas ativas sem nenhuma aula na grade do semestre. */
  turmasSemGrade: number;
  /** PPE com resultado (aprovado/reprovado) à espera do lançamento no sistema acadêmico (Art. 125). */
  ppeParaLancar: number;
  /** PPE à espera de o docente definir a modalidade (para a Coordenação acompanhar). */
  ppeAguardandoDocente: number;
  /** Docente: encontros de PEI com data passada ainda não registrados. */
  encontrosPeiAConfirmar: number;
  /** Docente: PEI com cronograma concluído ou prazo encerrado, à espera do resultado. */
  peiParaConcluir: number;
}

export const CONTAGENS_ZERADAS: ContagensPainel = {
  emergenciasRefeicao: 0,
  avisosRefeicao: 0,
  ausenciasPendentes: 0,
  ausenciasHojeOuAmanha: 0,
  reposicoesVencidas: 0,
  reposicoesAVencer: 0,
  ausenciasInformadas: 0,
  convitesPendentes: 0,
  ppiEmAnalise: 0,
  ppeRetencao: 0,
  ppeParaDefinir: 0,
  peiParaPreencher: 0,
  diariosAtrasados: 0,
  meusDiariosAtrasados: 0,
  processosVencidos: 0,
  processosAVencer: 0,
  etapasFaltando: false,
  semestreSemDatas: false,
  disciplinasSemProfessor: 0,
  turmasSemGrade: 0,
  ppeParaLancar: 0,
  ppeAguardandoDocente: 0,
  encontrosPeiAConfirmar: 0,
  peiParaConcluir: 0,
};

/** O que muda o texto: quem dá ciência das refeições (AE) ou quem acompanha (Coordenação). */
export interface PapelNoPainel {
  daCienciaRefeicao: boolean;
}

/** Ações que são da docência (o resto é do cargo). */
const DA_DOCENCIA = new Set(['convites', 'ppe-definir', 'pei-preencher', 'pei-encontros', 'pei-concluir', 'meus-diarios']);

const ORDEM: Record<NivelAcao, number> = { urgente: 0, atencao: 1, acompanhar: 2 };

export function ordenarAcoes(acoes: readonly AcaoPrioritaria[]): AcaoPrioritaria[] {
  return [...acoes].sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}

/** Monta as ações a partir das contagens; só entra o que tem quantidade. */
export function montarAcoes(c: ContagensPainel, papel: PapelNoPainel): AcaoPrioritaria[] {
  const acoes: AcaoPrioritaria[] = [];
  const add = (a: Omit<AcaoPrioritaria, 'papel'>) => {
    if (a.quantidade > 0) acoes.push({ ...a, papel: DA_DOCENCIA.has(a.id) ? 'docencia' : 'cargo' });
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
    detalhe: [
      c.ausenciasHojeOuAmanha > 0 ? `${c.ausenciasHojeOuAmanha} para hoje ou amanhã: decida a cobertura de cada horário.` : 'Decida a cobertura de cada horário.',
      c.ausenciasInformadas > 0 && `${c.ausenciasInformadas} informada(s) pelo próprio docente: dê ciência a ele.`,
    ]
      .filter(Boolean)
      .join(' '),
    href: '/ausencias',
    botao: 'Decidir',
  });
  add({
    id: 'reposicoes',
    nivel: c.reposicoesVencidas > 0 ? 'urgente' : 'atencao',
    icone: 'ausencias',
    quantidade: c.reposicoesVencidas + c.reposicoesAVencer,
    titulo: 'Reposições de aulas sem data agendada',
    detalhe: [
      c.reposicoesVencidas > 0 && `${c.reposicoesVencidas} com o prazo vencido.`,
      c.reposicoesAVencer > 0 && `${c.reposicoesAVencer} vencem em até 5 dias.`,
      'Prazo: 15 dias letivos ou o fim da etapa (ROD, Art. 37).',
    ]
      .filter(Boolean)
      .join(' '),
    href: '/ausencias',
    botao: 'Agendar',
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
    href: '/ppe?escopo=minhas',
    botao: 'Definir',
  });
  add({
    id: 'pei-preencher',
    nivel: 'atencao',
    icone: 'ppe',
    quantidade: c.peiParaPreencher,
    titulo: 'Planos de Estudo Individual para preencher',
    detalhe: 'Objetivos, conteúdos e o cronograma de encontros.',
    href: '/ppe?escopo=minhas',
    botao: 'Preencher',
  });
  add({
    id: 'pei-concluir',
    nivel: 'atencao',
    icone: 'ppe',
    quantidade: c.peiParaConcluir,
    titulo: 'PEI prontos para lançar o resultado',
    detalhe: 'Cronograma concluído ou prazo encerrado: registre aprovação ou reprovação (Art. 123).',
    href: '/ppe?escopo=minhas',
    botao: 'Lançar resultado',
  });
  add({
    id: 'pei-encontros',
    nivel: 'atencao',
    icone: 'ppe',
    quantidade: c.encontrosPeiAConfirmar,
    titulo: 'Encontros de PEI para confirmar',
    detalhe: 'A data já passou: marque no PEI os encontros realizados.',
    href: '/ppe?escopo=minhas',
    botao: 'Confirmar',
  });
  add({
    id: 'ppe-lancar',
    nivel: 'atencao',
    icone: 'ppe',
    quantidade: c.ppeParaLancar,
    titulo: 'PPE com resultado para lançar no acadêmico',
    detalhe: 'Aprovação ou reprovação já registrada: lance no sistema acadêmico e marque aqui (Art. 125).',
    href: '/ppe',
    botao: 'Lançar',
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
    href: '/diarios?escopo=meus',
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
    id: 'ppe-aguardando',
    nivel: 'acompanhar',
    icone: 'ppe',
    quantidade: c.ppeAguardandoDocente,
    titulo: 'PPE aguardando o docente definir a modalidade',
    detalhe: 'Se demorar, envie o lembrete pela página da PPE (Comunicar).',
    href: '/ppe',
    botao: 'Ver PPE',
  });
  add({
    id: 'processos-a-vencer',
    nivel: 'acompanhar',
    icone: 'processos',
    quantidade: c.processosAVencer,
    titulo: 'Processos que vencem em até 3 dias',
    detalhe: 'Prazo próximo no quadro de processos.',
    href: '/processos',
    botao: 'Abrir quadro',
  });
  add({
    id: 'semestre-datas',
    nivel: 'atencao',
    icone: 'calendario',
    quantidade: c.semestreSemDatas ? 1 : 0,
    titulo: 'Datas do semestre não cadastradas',
    detalhe: 'Sem início e fim do semestre, os diários não calculam as aulas esperadas.',
    href: '/calendario/etapas',
    botao: 'Cadastrar',
  });
  add({
    id: 'sem-professor',
    nivel: 'atencao',
    icone: 'ofertas',
    quantidade: c.disciplinasSemProfessor,
    titulo: 'Disciplinas sem professor no ano',
    detalhe: 'Distribua as disciplinas da matriz em Ofertas; sem professor, a aula não entra na grade.',
    href: '/ofertas',
    botao: 'Distribuir',
  });
  add({
    id: 'sem-grade',
    nivel: 'atencao',
    icone: 'grade',
    quantidade: c.turmasSemGrade,
    titulo: 'Turmas sem grade no semestre',
    detalhe: 'Monte a grade pela tela ou por planilha; sem ela, ausências e refeições não funcionam.',
    href: '/grade',
    botao: 'Montar grade',
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
