import 'server-only';
import type { TipoEventoCalendario } from '@prisma/client';
import { prisma } from '@/lib/db';
import { dataDoBanco, dataParaBanco } from '@/lib/ausencias/regras';
import { contarDiasLetivos, dentro, ETAPAS, intervaloDoAno, porMes, suspensaoNaData, type Intervalo } from './regras';

export interface EventoAno {
  id: string;
  tipo: TipoEventoCalendario;
  inicio: string;
  fim: string;
  descricao: string | null;
  suspendeAulas: boolean;
  imprevisto: boolean;
  motivo: string | null;
}

/** Tudo do ano letivo: etapas, semestres, eventos, sábados letivos e a contagem de dias letivos. */
export async function carregarAno(ano: number) {
  const de = dataParaBanco(`${ano}-01-01`);
  const ate = dataParaBanco(`${ano}-12-31`);
  const [etapasBd, semestresBd, eventosBd, sabadosBd] = await Promise.all([
    prisma.etapaLetiva.findMany({ where: { anoLetivo: ano }, orderBy: { numero: 'asc' } }),
    prisma.periodoLetivo.findMany({ where: { anoLetivo: ano }, orderBy: { semestreLetivo: 'asc' } }),
    prisma.eventoCalendario.findMany({ where: { inicio: { lte: ate }, fim: { gte: de } }, orderBy: [{ inicio: 'asc' }, { tipo: 'asc' }] }),
    prisma.sabadoLetivo.findMany({ where: { data: { gte: de, lte: ate } }, orderBy: { data: 'asc' } }),
  ]);
  const intervalo = (x: { inicio: Date; fim: Date }): Intervalo => ({ inicio: dataDoBanco(x.inicio), fim: dataDoBanco(x.fim) });
  const etapas = ETAPAS.map((n) => {
    const e = etapasBd.find((x) => x.numero === n);
    return e ? intervalo(e) : null;
  });
  const semestres = [1, 2].map((n) => {
    const s = semestresBd.find((x) => x.semestreLetivo === n);
    return s ? intervalo(s) : null;
  });
  const eventos: EventoAno[] = eventosBd.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    ...intervalo(e),
    descricao: e.descricao,
    suspendeAulas: e.suspendeAulas,
    imprevisto: e.imprevisto,
    motivo: e.motivo,
  }));
  const sabados = sabadosBd.map((s) => ({ data: dataDoBanco(s.data), diaSemanaReferente: s.diaSemanaReferente, observacao: s.observacao }));
  const doAno = intervaloDoAno(etapas, semestres);
  const periodos = (etapas.some(Boolean) ? etapas : semestres).filter((x): x is Intervalo => x !== null);
  const contagem = doAno
    ? contarDiasLetivos({ ...doAno, eventos, sabadosLetivos: new Set(sabados.map((s) => s.data)), periodos })
    : { letivos: [], perdidosImprevistos: [], sabados: [] };
  return {
    ano,
    etapas,
    semestres,
    eventos,
    sabados,
    intervalo: doAno,
    contagem,
    porMes: porMes(contagem.letivos),
    porEtapa: etapas.map((e) => (e ? dentro(contagem.letivos, e) : null)),
    porSemestre: semestres.map((s) => (s ? dentro(contagem.letivos, s) : null)),
  };
}

/** Evento que suspende aulas na data (feriado, ponto facultativo, força maior…), se houver. */
export async function suspensaoDoDia(dataISO: string, db: Pick<typeof prisma, 'eventoCalendario'> = prisma) {
  const d = dataParaBanco(dataISO);
  const eventos = await db.eventoCalendario.findMany({ where: { suspendeAulas: true, inicio: { lte: d }, fim: { gte: d } } });
  const lista = eventos.map((e) => ({ ...e, inicio: dataDoBanco(e.inicio), fim: dataDoBanco(e.fim) }));
  return suspensaoNaData(dataISO, lista);
}
