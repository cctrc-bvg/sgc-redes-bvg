import 'server-only';
import { STATUS_COM_REPOSICAO } from '@/lib/reposicao/regras';
import { prisma } from '@/lib/db';
import { dataDoBanco, dataParaBanco, NOME_STATUS } from '@/lib/ausencias/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { NOME_TIPO_EVENTO, prazoDeReposicao, somarDiasISO, suspensaoNaData } from '@/lib/calendario/regras';
import { diaDaGradeNaData } from '@/lib/grade/regras';
import { ONDE_DOCENTES } from '@/lib/ofertas/regras';
import { contatoDoUsuario, primeiroNome, type MensagemPronta } from './mensagem';
import { avisoFechamento, avisoFimDeEtapa, avisosDoPeriodo, chaveAviso, chaveResumoSemanal, DIAS_LETIVOS_FREQUENCIA, diasDaSemana, etapasComPrazo, nesimoDiaLetivoDepois, resumoSemanal, type AvisoDoPeriodo, type DadosResumo } from './periodicas';

export interface ResumoDoDocente {
  mensagem: MensagemPronta;
  /** Já registrado como enviado para esta semana. */
  enviado: boolean;
  /** Tem algo além da grade (mudança ou prazo): ajuda a Coordenação a priorizar. */
  temAvisos: boolean;
}

/** Um resumo por docente para a semana que começa em `segunda` (G27); sem dados sensíveis (só aulas e prazos). */
export async function resumosDaSemana(segunda: string, hojeISO: string): Promise<ResumoDoDocente[]> {
  const ano = Number(segunda.slice(0, 4));
  const dias = diasDaSemana(segunda);
  const sexta = dias[4]!;
  const cal = await carregarAno(ano);
  const letivos = new Set(cal.contagem.letivos);
  const sabadosLetivos = new Map(cal.sabados.map((s) => [s.data, s.diaSemanaReferente]));
  const semestre = cal.semestres[0] && segunda <= cal.semestres[0].fim ? 1 : cal.semestres[0] || cal.semestres[1] ? 2 : Number(segunda.slice(5, 7)) <= 6 ? 1 : 2;

  const [docentes, ofertas, celulas, periodosEspeciais, coberturas, ausencias, dispensadas, enviados] = await Promise.all([
    prisma.user.findMany({ where: ONDE_DOCENTES, select: { id: true, nome: true, email: true, whatsapp: true, usaWhatsapp: true }, orderBy: { nome: 'asc' } }),
    prisma.disciplinaOferta.findMany({
      where: { anoLetivo: ano, OR: [{ semestreLetivo: null }, { semestreLetivo: semestre }] },
      select: { id: true, professorId: true, disciplina: { select: { nome: true } }, turma: { select: { codigo: true } } },
    }),
    prisma.gradeHorario.findMany({ where: { anoLetivo: ano, semestreLetivo: semestre, ofertaId: { not: null } }, select: { ofertaId: true, diaSemana: true, turmaId: true } }),
    prisma.periodoEspecial.findMany({
      where: { inicio: { lte: dataParaBanco(sexta) }, fim: { gte: dataParaBanco(segunda) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, inicio: true, fim: true, grades: { select: { ofertaId: true, diaSemana: true, turmaId: true } } },
    }),
    prisma.coberturaBloco.findMany({
      where: { tipo: 'SUBSTITUICAO', substitutoId: { not: null }, ausencia: { dataAula: { gte: dataParaBanco(segunda), lte: dataParaBanco(sexta) } } },
      select: { substitutoId: true, ausencia: { select: { dataAula: true, oferta: { select: { disciplina: { select: { nome: true } }, turma: { select: { codigo: true } } } } } } },
    }),
    prisma.ausenciaDocente.findMany({
      where: { dataAula: { gte: dataParaBanco(segunda), lte: dataParaBanco(sexta) } },
      select: { dataAula: true, status: true, professorAusenteId: true, oferta: { select: { disciplina: { select: { nome: true } }, turma: { select: { codigo: true } } } } },
    }),
    prisma.ausenciaDocente.findMany({
      where: { status: { in: [...STATUS_COM_REPOSICAO] }, reposicaoEm: null, dataAula: { gte: dataParaBanco(somarDiasISO(hojeISO, -90)), lte: dataParaBanco(hojeISO) } },
      select: { dataAula: true, professorAusenteId: true, oferta: { select: { disciplina: { select: { nome: true } }, turma: { select: { codigo: true } } } } },
    }),
    prisma.logComunicacao.findMany({ where: { chave: { startsWith: `resumo:${segunda}:` }, sucesso: true }, select: { chave: true } }),
  ]);
  const jaEnviados = new Set(enviados.map((e) => e.chave));
  const etapas = etapasComPrazo(cal.etapas, cal.contagem.letivos, segunda);
  const eventos = cal.eventos;

  const resultado: ResumoDoDocente[] = [];
  for (const u of docentes) {
    const minhas = ofertas.filter((o) => o.professorId === u.id);
    const porOferta = new Map(minhas.map((o) => [o.id, o]));
    const diasResumo: DadosResumo['dias'] = dias.map((data) => {
      if (!letivos.has(data)) {
        const e = suspensaoNaData(data, eventos);
        return { data, semAula: e ? e.descricao ?? NOME_TIPO_EVENTO[e.tipo] : 'fora do período letivo', aulas: [] };
      }
      const dia = diaDaGradeNaData(data, sabadosLetivos);
      // Período especial na data: a grade especial vale nas turmas que a têm (jogos internos etc.).
      const especial = periodosEspeciais.find((p) => dataDoBanco(p.inicio) <= data && data <= dataDoBanco(p.fim));
      const turmasEspeciais = new Set(especial?.grades.map((g) => g.turmaId));
      const doDia = especial ? [...celulas.filter((c) => !turmasEspeciais.has(c.turmaId)), ...especial.grades.filter((g) => g.ofertaId)] : celulas;
      const contagem = new Map<string, number>();
      for (const c of doDia) if (c.diaSemana === dia && porOferta.has(c.ofertaId!)) contagem.set(c.ofertaId!, (contagem.get(c.ofertaId!) ?? 0) + 1);
      return { data, semAula: null, aulas: [...contagem].map(([id, quantidade]) => ({ disciplina: porOferta.get(id)!.disciplina.nome, turma: porOferta.get(id)!.turma.codigo, quantidade })) };
    });
    const substituicoes = coberturas
      .filter((c) => c.substitutoId === u.id)
      .map((c) => {
        const data = dataDoBanco(c.ausencia.dataAula);
        return { data, disciplina: c.ausencia.oferta.disciplina.nome, turma: c.ausencia.oferta.turma.codigo, frequenciaAte: nesimoDiaLetivoDepois(data, cal.contagem.letivos, DIAS_LETIVOS_FREQUENCIA) };
      });
    const minhasAusencias = ausencias
      .filter((a) => a.professorAusenteId === u.id)
      .map((a) => ({ data: dataDoBanco(a.dataAula), disciplina: a.oferta.disciplina.nome, turma: a.oferta.turma.codigo, situacao: NOME_STATUS[a.status] }));
    const reposicoes = dispensadas
      .filter((a) => a.professorAusenteId === u.id)
      .flatMap((a) => {
        const dataAula = dataDoBanco(a.dataAula);
        const ate = prazoDeReposicao(dataAula, cal.contagem.letivos, cal.etapas)?.prazo;
        return ate && ate >= hojeISO ? [{ dataAula, disciplina: a.oferta.disciplina.nome, turma: a.oferta.turma.codigo, ate }] : [];
      });
    const temAula = diasResumo.some((d) => d.aulas.length > 0);
    if (!temAula && substituicoes.length === 0 && minhasAusencias.length === 0 && reposicoes.length === 0 && minhas.length === 0) continue;

    const { assunto, texto } = resumoSemanal({ nome: primeiroNome(u.nome), segunda, dias: diasResumo, substituicoes, ausencias: minhasAusencias, reposicoes, etapas: minhas.length > 0 ? etapas : [] });
    const chave = chaveResumoSemanal(segunda, u.id);
    resultado.push({
      mensagem: { chave, titulo: `Docente: ${u.nome}`, canal: null, destino: 'Docente (resumo semanal)', ...contatoDoUsuario(u), assunto, texto },
      enviado: jaEnviados.has(chave),
      temAvisos: substituicoes.length + minhasAusencias.length + reposicoes.length > 0 || (minhas.length > 0 && etapas.length > 0),
    });
  }
  return resultado;
}

export interface AvisoComMensagens {
  aviso: AvisoDoPeriodo;
  titulo: string;
  mensagens: ResumoDoDocente[];
}

/** Avisos de fim de etapa e de fechamento do semestre, com uma mensagem por docente que tem oferta no semestre. */
export async function avisosDoPeriodoComMensagens(hojeISO: string): Promise<AvisoComMensagens[]> {
  const ano = Number(hojeISO.slice(0, 4));
  const cal = await carregarAno(ano);
  const avisos = avisosDoPeriodo(ano, cal.etapas, cal.semestres, cal.contagem.letivos, hojeISO);
  if (avisos.length === 0) return [];
  const [docentes, ofertas, pendentes, enviados] = await Promise.all([
    prisma.user.findMany({ where: ONDE_DOCENTES, select: { id: true, nome: true, email: true, whatsapp: true, usaWhatsapp: true }, orderBy: { nome: 'asc' } }),
    prisma.disciplinaOferta.findMany({
      where: { anoLetivo: ano },
      select: { professorId: true, semestreLetivo: true, disciplina: { select: { nome: true } }, turma: { select: { codigo: true } } },
    }),
    prisma.ausenciaDocente.findMany({
      where: { status: { in: [...STATUS_COM_REPOSICAO] }, reposicaoEm: null, dataAula: { gte: dataParaBanco(`${ano}-01-01`), lte: dataParaBanco(hojeISO) } },
      select: { dataAula: true, professorAusenteId: true, oferta: { select: { semestreLetivo: true, disciplina: { select: { nome: true } }, turma: { select: { codigo: true } } } } },
    }),
    prisma.logComunicacao.findMany({ where: { chave: { startsWith: 'aviso:' }, sucesso: true }, select: { chave: true } }),
  ]);
  const jaEnviados = new Set(enviados.map((e) => e.chave));
  return avisos.map((aviso) => {
    const mensagens: ResumoDoDocente[] = [];
    for (const u of docentes) {
      const minhas = ofertas.filter((o) => o.professorId === u.id && (o.semestreLetivo === null || o.semestreLetivo === aviso.semestre));
      if (minhas.length === 0) continue;
      const disciplinas = minhas.map((o) => `${o.disciplina.nome} (${o.turma.codigo})`);
      const nome = primeiroNome(u.nome);
      const { assunto, texto } =
        aviso.tipo === 'ETAPA'
          ? avisoFimDeEtapa({ nome, etapa: aviso.numero, fim: aviso.fim, entregaAte: aviso.entregaAte, hojeISO, disciplinas })
          : avisoFechamento({
              nome,
              ano,
              semestre: aviso.semestre,
              fim: aviso.fim,
              disciplinas,
              reposicoes: pendentes
                .filter((a) => a.professorAusenteId === u.id && (a.oferta.semestreLetivo === null || a.oferta.semestreLetivo === aviso.semestre))
                .map((a) => ({ dataAula: dataDoBanco(a.dataAula), disciplina: a.oferta.disciplina.nome, turma: a.oferta.turma.codigo })),
            });
      const chave = chaveAviso(aviso.id, u.id);
      mensagens.push({
        mensagem: { chave, titulo: `Docente: ${u.nome}`, canal: null, destino: aviso.tipo === 'ETAPA' ? 'Docente (fim de etapa)' : 'Docente (fechamento)', ...contatoDoUsuario(u), assunto, texto },
        enviado: jaEnviados.has(chave),
        temAvisos: true,
      });
    }
    return { aviso, titulo: aviso.tipo === 'ETAPA' ? `Fim da N${aviso.numero} (${aviso.fim.split('-').reverse().join('/')})` : `Fechamento do semestre ${ano}.${aviso.semestre} (${aviso.fim.split('-').reverse().join('/')})`, mensagens };
  });
}
