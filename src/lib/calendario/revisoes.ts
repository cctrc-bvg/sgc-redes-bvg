import 'server-only';
import type { Prisma, TipoEventoCalendario } from '@prisma/client';
import { prisma } from '@/lib/db';
import { dataParaBanco } from '@/lib/ausencias/regras';
import { carregarAno } from './servidor';
import { assinatura, diferencaEntre, textoDaDiferenca, type EventoInst, type Instantaneo } from './editor';

type Db = Prisma.TransactionClient | typeof prisma;

export type OrigemRevisao = 'EDITOR' | 'EVENTO' | 'ETAPAS' | 'IMPORTACAO' | 'SABADO' | 'RESTAURACAO' | 'INICIAL';

export const NOME_ORIGEM: Record<string, string> = {
  EDITOR: 'Editor do calendário',
  EVENTO: 'Evento',
  ETAPAS: 'Etapas e semestres',
  IMPORTACAO: 'Importação de planilha',
  SABADO: 'Sábado letivo',
  RESTAURACAO: 'Restauração de revisão',
  INICIAL: 'Estado inicial',
};

/** O calendário vigente do ano, no formato da revisão. */
export async function instantaneoAtual(ano: number): Promise<Instantaneo> {
  const cal = await carregarAno(ano);
  return {
    eventos: cal.eventos.map((e) => ({ tipo: e.tipo, inicio: e.inicio, fim: e.fim, descricao: e.descricao ?? '', suspendeAulas: e.suspendeAulas, imprevisto: e.imprevisto, motivo: e.motivo ?? '' })),
    extras: cal.sabados.map((s) => ({ data: s.data, diaReferente: s.diaSemanaReferente, observacao: s.observacao ?? '' })),
    etapas: cal.etapas,
    semestres: cal.semestres,
  };
}

export async function ultimaRevisao(ano: number, db: Db = prisma) {
  return db.calendarioRevisao.findFirst({ where: { anoLetivo: ano }, orderBy: { numero: 'desc' } });
}

/**
 * Registra uma revisão se o calendário do ano mudou desde a última. Chamada depois de qualquer alteração do
 * calendário (editor, evento, etapas, importação, sábado letivo). Sem revisão anterior, a primeira é o estado atual.
 */
export async function registrarRevisaoSeMudou(p: { ano: number; autorId: string | null; origem: OrigemRevisao; motivo?: string | null }): Promise<number | null> {
  const atual = await instantaneoAtual(p.ano);
  return prisma.$transaction(async (tx) => {
    const ultima = await ultimaRevisao(p.ano, tx);
    const anterior = ultima ? (ultima.dados as unknown as Instantaneo) : null;
    if (anterior && assinatura(anterior) === assinatura(atual)) return null;
    const numero = (ultima?.numero ?? 0) + 1;
    const resumo = anterior ? textoDaDiferenca(diferencaEntre(anterior, atual)) : 'Primeira revisão registrada: estado do calendário nesta data.';
    await tx.calendarioRevisao.create({
      data: { anoLetivo: p.ano, numero, autorId: p.autorId, motivo: p.motivo?.trim() || null, resumo, origem: anterior ? p.origem : 'INICIAL', dados: atual as unknown as Prisma.InputJsonValue },
    });
    return numero;
  });
}

/** Garante que existe ao menos uma revisão (para o histórico começar no estado de hoje). */
export async function garantirRevisaoInicial(ano: number): Promise<void> {
  if (await prisma.calendarioRevisao.findFirst({ where: { anoLetivo: ano }, select: { id: true } })) return;
  const atual = await instantaneoAtual(ano);
  if (atual.eventos.length === 0 && atual.extras.length === 0 && atual.etapas.every((e) => !e) && atual.semestres.every((s) => !s)) return;
  await registrarRevisaoSeMudou({ ano, autorId: null, origem: 'INICIAL' });
}

export function listarRevisoes(ano: number) {
  return prisma.calendarioRevisao.findMany({
    where: { anoLetivo: ano },
    orderBy: { numero: 'desc' },
    select: { numero: true, resumo: true, motivo: true, origem: true, createdAt: true, autor: { select: { nome: true } } },
  });
}

export async function carregarRevisao(ano: number, numero: number) {
  const r = await prisma.calendarioRevisao.findUnique({
    where: { anoLetivo_numero: { anoLetivo: ano, numero } },
    select: { numero: true, resumo: true, motivo: true, origem: true, createdAt: true, dados: true, autor: { select: { nome: true } } },
  });
  return r ? { ...r, dados: r.dados as unknown as Instantaneo } : null;
}

const chaveEvento = (e: EventoInst) => `${e.tipo}|${e.inicio}|${e.fim}|${e.descricao}|${e.suspendeAulas ? 1 : 0}|${e.imprevisto ? 1 : 0}|${e.motivo}`;

/**
 * Faz as tabelas do ano ficarem como o instantâneo, mexendo só no que difere (eventos iguais e sábados iguais
 * ficam como estão, com o mesmo id). `tiposDoEditor` limita quais eventos podem sair; sem limite, qualquer tipo.
 */
export async function aplicarInstantaneo(tx: Prisma.TransactionClient, ano: number, alvo: Instantaneo, tiposDoEditor?: readonly TipoEventoCalendario[]): Promise<{ criados: { id: string; tipo: TipoEventoCalendario; imprevisto: boolean }[] }> {
  const de = dataParaBanco(`${ano}-01-01`);
  const ate = dataParaBanco(`${ano}-12-31`);
  const noBanco = await tx.eventoCalendario.findMany({ where: { inicio: { lte: ate }, fim: { gte: de } } });
  const eventoDoBanco = (e: (typeof noBanco)[number]): EventoInst => ({
    tipo: e.tipo,
    inicio: e.inicio.toISOString().slice(0, 10),
    fim: e.fim.toISOString().slice(0, 10),
    descricao: e.descricao ?? '',
    suspendeAulas: e.suspendeAulas,
    imprevisto: e.imprevisto,
    motivo: e.motivo ?? '',
  });
  const mexiveis = noBanco.filter((e) => !tiposDoEditor || tiposDoEditor.includes(e.tipo));
  const alvoMexivel = alvo.eventos.filter((e) => !tiposDoEditor || tiposDoEditor.includes(e.tipo));
  const restantes = new Map<string, number>();
  for (const e of alvoMexivel) restantes.set(chaveEvento(e), (restantes.get(chaveEvento(e)) ?? 0) + 1);
  const sair: string[] = [];
  for (const e of mexiveis) {
    const k = chaveEvento(eventoDoBanco(e));
    const n = restantes.get(k) ?? 0;
    if (n > 0) restantes.set(k, n - 1);
    else sair.push(e.id);
  }
  if (sair.length) await tx.eventoCalendario.deleteMany({ where: { id: { in: sair } } });
  const criados: { id: string; tipo: TipoEventoCalendario; imprevisto: boolean }[] = [];
  for (const e of alvoMexivel) {
    const n = restantes.get(chaveEvento(e)) ?? 0;
    if (n <= 0) continue;
    restantes.set(chaveEvento(e), n - 1);
    const c = await tx.eventoCalendario.create({
      data: { tipo: e.tipo, inicio: dataParaBanco(e.inicio), fim: dataParaBanco(e.fim), descricao: e.descricao || null, suspendeAulas: e.suspendeAulas, imprevisto: e.imprevisto, motivo: e.tipo === 'SUSPENSAO_AULAS' ? e.motivo || null : null },
    });
    criados.push({ id: c.id, tipo: c.tipo, imprevisto: c.imprevisto });
  }

  const sabadosBanco = await tx.sabadoLetivo.findMany({ where: { data: { gte: de, lte: ate } } });
  const alvoPorData = new Map(alvo.extras.map((x) => [x.data, x]));
  for (const s of sabadosBanco) {
    const data = s.data.toISOString().slice(0, 10);
    const novo = alvoPorData.get(data);
    if (!novo) await tx.sabadoLetivo.delete({ where: { id: s.id } });
    else {
      if (novo.diaReferente !== s.diaSemanaReferente || (novo.observacao || null) !== (s.observacao ?? null)) {
        await tx.sabadoLetivo.update({ where: { id: s.id }, data: { diaSemanaReferente: novo.diaReferente, observacao: novo.observacao || null } });
      }
      alvoPorData.delete(data);
    }
  }
  for (const x of alvoPorData.values()) await tx.sabadoLetivo.create({ data: { data: dataParaBanco(x.data), diaSemanaReferente: x.diaReferente, observacao: x.observacao || null } });
  return { criados };
}

/** Etapas e semestres do ano como no instantâneo (só na restauração). */
export async function aplicarPeriodos(tx: Prisma.TransactionClient, ano: number, alvo: Instantaneo): Promise<void> {
  for (const [i, e] of alvo.etapas.entries()) {
    const numero = i + 1;
    if (e) {
      const data = { inicio: dataParaBanco(e.inicio), fim: dataParaBanco(e.fim) };
      await tx.etapaLetiva.upsert({ where: { anoLetivo_numero: { anoLetivo: ano, numero } }, create: { anoLetivo: ano, numero, ...data }, update: data });
    } else await tx.etapaLetiva.deleteMany({ where: { anoLetivo: ano, numero } });
  }
  for (const [i, s] of alvo.semestres.entries()) {
    const semestreLetivo = i + 1;
    if (s) {
      const data = { inicio: dataParaBanco(s.inicio), fim: dataParaBanco(s.fim) };
      await tx.periodoLetivo.upsert({ where: { anoLetivo_semestreLetivo: { anoLetivo: ano, semestreLetivo } }, create: { anoLetivo: ano, semestreLetivo, ...data }, update: data });
    } else await tx.periodoLetivo.deleteMany({ where: { anoLetivo: ano, semestreLetivo } });
  }
}
