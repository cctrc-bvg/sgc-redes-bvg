import 'server-only';
import type { CanalWhatsapp } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CAMPO_SAUDACAO, NOME_CANAL } from '@/lib/ausencias/mensagens';
import { descreverBloco } from '@/lib/ausencias/regras';
import { anoLetivoAtual, ONDE_DOCENTES } from '@/lib/ofertas/regras';
import { lerTipoInteracao, MODELOS_TEXTO, type ModeloTexto } from './modelos';
import { contatoDoUsuario, preencherCampos, primeiroNome, saudacao, type MensagemPronta } from './mensagem';

/** Texto que já começa com saudação (ex.: vindo de um texto-padrão) não ganha outra. */
const temSaudacao = (texto: string) => /^(olá|ola|oi|prezad|car[oa]s?\b|bom dia|boa tarde|boa noite|📢|\*)/i.test(texto.trim());

const ANO_ORDINAL = (n: number) => `${n}º ano`;

/**
 * Destinatários da mensagem avulsa: grupos/setores ativos ("canal:X"), grupos de docentes montados pelas
 * ofertas do ano ("docentes:todos", "docentes:turma:REDES-1", "docentes:ano:2") e usuários ("usuario:<id>").
 */
export async function opcoesDeDestino(anoLetivo = anoLetivoAtual()) {
  const [canais, usuarios, turmas] = await Promise.all([
    prisma.configuracaoCanal.findMany({ where: { ativo: true }, orderBy: { canal: 'asc' }, select: { canal: true } }),
    prisma.user.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    prisma.turma.findMany({
      where: { ativa: true },
      orderBy: { codigo: 'asc' },
      select: { codigo: true, nome: true, anoCurso: true, ofertas: { where: { anoLetivo }, select: { professorId: true } } },
    }),
  ]);
  const anos = [...new Set(turmas.map((t) => t.anoCurso).filter((a): a is number => a !== null))].sort();
  const contar = (lista: { ofertas: { professorId: string }[] }[]) => new Set(lista.flatMap((t) => t.ofertas.map((o) => o.professorId))).size;
  return {
    canais: canais.map((c) => ({ valor: `canal:${c.canal}`, rotulo: NOME_CANAL[c.canal] })),
    docentes: [
      { valor: 'docentes:todos', rotulo: 'Todos os docentes' },
      ...anos.map((a) => {
        const qtd = contar(turmas.filter((t) => t.anoCurso === a));
        return { valor: `docentes:ano:${a}`, rotulo: `Professores das turmas do ${ANO_ORDINAL(a)} (${qtd} em ${anoLetivo})` };
      }),
      ...turmas.map((t) => ({ valor: `docentes:turma:${t.codigo}`, rotulo: `Professores da ${t.nome} (${contar([t])} em ${anoLetivo})` })),
    ],
    usuarios: usuarios.map((u) => ({ valor: `usuario:${u.id}`, rotulo: u.nome })),
  };
}

/** Docentes ativos de um grupo "docentes:..." (pelas ofertas do ano letivo). */
async function docentesDoGrupo(grupo: string, anoLetivo: number) {
  const select = { id: true, email: true } as const;
  if (grupo === 'todos') return { rotulo: 'docentes', pessoas: await prisma.user.findMany({ where: ONDE_DOCENTES, select, orderBy: { nome: 'asc' } }) };
  const [tipo, valor] = grupo.split(':', 2);
  const turma =
    tipo === 'turma' ? { codigo: valor } : tipo === 'ano' && /^[123]$/.test(valor ?? '') ? { anoCurso: Number(valor) } : null;
  if (!turma) return null;
  const pessoas = await prisma.user.findMany({
    where: { ativo: true, disciplinasMinistradas: { some: { anoLetivo, turma: { ...turma, ativa: true } } } },
    select,
    orderBy: { nome: 'asc' },
  });
  if (tipo === 'turma') {
    const t = await prisma.turma.findUnique({ where: { codigo: valor }, select: { nome: true } });
    if (!t) return null;
    return { rotulo: `professores(as) da ${t.nome}`, titulo: `Professores da ${t.nome}`, pessoas };
  }
  return { rotulo: `professores(as) das turmas do ${ANO_ORDINAL(Number(valor))}`, titulo: `Professores das turmas do ${ANO_ORDINAL(Number(valor))}`, pessoas };
}

/** Monta a mensagem avulsa com saudação e contato do destinatário; null se o destino não existir. */
export async function mensagemAvulsa(destino: string, assunto: string, texto: string, anoLetivo = anoLetivoAtual()): Promise<MensagemPronta | null> {
  const m = await montarAvulsa(destino, assunto, texto, anoLetivo);
  if (!m) return null;
  const v = m.variaveis ?? {};
  return { ...m, assunto: preencherCampos(m.assunto, v), texto: preencherCampos(m.texto, v) };
}

async function montarAvulsa(destino: string, assunto: string, texto: string, anoLetivo: number): Promise<MensagemPronta | null> {
  if (destino.startsWith('docentes:')) {
    const grupo = await docentesDoGrupo(destino.slice('docentes:'.length), anoLetivo);
    if (!grupo || grupo.pessoas.length === 0) return null;
    const rotulo = 'titulo' in grupo && grupo.titulo ? grupo.titulo : 'Todos os docentes';
    return {
      chave: `avulsa:${destino}`,
      titulo: `${rotulo} (${grupo.pessoas.length})`,
      canal: null,
      destino: rotulo,
      para: grupo.pessoas.map((p) => p.email).join(', '),
      whatsapp: null,
      aceitaWhatsapp: true,
      assunto,
      texto: temSaudacao(texto) ? texto : `${saudacao(grupo.rotulo, 'destinatários')}\n\n${texto}`,
      variaveis: { destinatarios: grupo.rotulo },
    };
  }
  const [tipo, id] = destino.split(':', 2);
  if (tipo === 'canal' && id && id in NOME_CANAL) {
    const canal = id as CanalWhatsapp;
    const cfg = await prisma.configuracaoCanal.findUnique({ where: { canal } });
    if (!cfg?.ativo) return null;
    return {
      chave: `avulsa:canal:${canal}`,
      titulo: NOME_CANAL[canal],
      canal,
      destino: NOME_CANAL[canal],
      para: cfg.email,
      whatsapp: null,
      aceitaWhatsapp: true,
      assunto,
      texto: temSaudacao(texto) ? texto : `${saudacao(cfg.saudacao, CAMPO_SAUDACAO[canal])}\n\n${texto}`,
      variaveis: cfg.saudacao ? { destinatarios: cfg.saudacao } : {},
    };
  }
  if (tipo === 'usuario' && id) {
    const u = await prisma.user.findFirst({ where: { id, ativo: true }, select: { nome: true, email: true, whatsapp: true, usaWhatsapp: true } });
    if (!u) return null;
    return {
      chave: `avulsa:usuario:${id}`,
      titulo: u.nome,
      canal: null,
      destino: 'Usuário do sistema',
      ...contatoDoUsuario(u),
      assunto,
      texto: temSaudacao(texto) ? texto : `${saudacao(primeiroNome(u.nome), 'nome do destinatário')}\n\n${texto}`,
      variaveis: { nome: primeiroNome(u.nome) },
    };
  }
  return null;
}

/** Grava os textos-padrão iniciais quando a tabela está vazia (primeiro uso). */
async function garantirModelosIniciais() {
  if ((await prisma.modeloMensagem.count()) > 0) return;
  await prisma.modeloMensagem.createMany({
    data: MODELOS_TEXTO.map((m, i) => ({ tipo: m.tipo, rotulo: m.rotulo, assunto: m.assunto, texto: m.texto, destinos: m.destinos, ordem: i })),
  });
}

/** Textos-padrão ativos, na ordem de exibição. */
export async function carregarModelos(): Promise<ModeloTexto[]> {
  await garantirModelosIniciais();
  const linhas = await prisma.modeloMensagem.findMany({ where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }] });
  return linhas.flatMap((l) => {
    const tipo = lerTipoInteracao(l.tipo);
    return tipo ? [{ id: l.id, tipo, rotulo: l.rotulo, assunto: l.assunto, texto: l.texto, destinos: l.destinos }] : [];
  });
}

/** Repõe os textos-padrão originais que não existem mais (mesmo tipo e rótulo). Retorna quantos voltaram. */
export async function restaurarModelosIniciais(): Promise<number> {
  const atuais = await prisma.modeloMensagem.findMany({ select: { tipo: true, rotulo: true } });
  const existe = new Set(atuais.map((a) => `${a.tipo}|${a.rotulo}`));
  const faltam = MODELOS_TEXTO.filter((m) => !existe.has(`${m.tipo}|${m.rotulo}`));
  if (faltam.length === 0) return 0;
  const base = await prisma.modeloMensagem.count();
  await prisma.modeloMensagem.createMany({
    data: faltam.map((m, i) => ({ tipo: m.tipo, rotulo: m.rotulo, assunto: m.assunto, texto: m.texto, destinos: m.destinos, ordem: base + i })),
  });
  return faltam.length;
}

/** Dados cadastrados para os campos da mensagem avulsa (listas de turmas, disciplinas e horários). */
export async function opcoesDosCampos() {
  const [turmas, disciplinas, blocos] = await Promise.all([
    prisma.turma.findMany({ where: { ativa: true }, orderBy: { codigo: 'asc' }, select: { codigo: true, nome: true } }),
    prisma.disciplina.findMany({ where: { ativa: true }, orderBy: { nome: 'asc' }, select: { nome: true } }),
    prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] }),
  ]);
  return {
    turmas: turmas.map((t) => ({ valor: t.codigo, rotulo: t.nome })),
    disciplinas: disciplinas.map((d) => d.nome),
    horarios: blocos.map((b) => descreverBloco(b)),
  };
}
