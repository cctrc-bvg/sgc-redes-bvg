'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataParaBanco } from '@/lib/ausencias/regras';
import { ETAPAS, EventoSchema, nomeEtapa, validarSequencia, type Intervalo } from '@/lib/calendario/regras';
import { lerAnoLetivo } from '@/lib/ofertas/regras';
import { temPermissao } from '@/lib/auth/rbac';
import { pedeComunicacao } from '@/lib/calendario/mensagens';
import { lerModoEnvio, NOME_MODO } from '@/lib/comunicacao/mensagem';
import { mensagensDoEvento } from '@/lib/calendario/comunicar';

type CampoEvento = 'tipo' | 'inicio' | 'fim' | 'descricao' | 'motivo';
export type EstadoEvento = { mensagem?: string; sucesso?: boolean; erros?: Partial<Record<CampoEvento, string>>; valores?: Record<string, string> };

function lerEvento(formData: FormData) {
  const valores = {
    tipo: String(formData.get('tipo') ?? ''),
    inicio: String(formData.get('inicio') ?? ''),
    fim: String(formData.get('fim') ?? ''),
    descricao: String(formData.get('descricao') ?? ''),
    motivo: String(formData.get('motivo') ?? ''),
    suspendeAulas: formData.get('suspendeAulas') === 'on' ? 'on' : '',
    imprevisto: formData.get('imprevisto') === 'on' ? 'on' : '',
  };
  const r = EventoSchema.safeParse({ ...valores, suspendeAulas: valores.suspendeAulas === 'on', imprevisto: valores.imprevisto === 'on' });
  if (r.success) return { dados: r.data, valores } as const;
  const erros: EstadoEvento['erros'] = {};
  for (const i of r.error.issues) erros[i.path[0] as CampoEvento] ??= i.message;
  return { erros, valores } as const;
}

const paraBanco = (d: { tipo: string; inicio: string; fim: string; descricao: string; suspendeAulas: boolean; imprevisto: boolean; motivo: string }) => ({
  tipo: d.tipo as never,
  inicio: dataParaBanco(d.inicio),
  fim: dataParaBanco(d.fim),
  descricao: d.descricao || null,
  suspendeAulas: d.suspendeAulas,
  imprevisto: d.imprevisto,
  motivo: d.tipo === 'SUSPENSAO_AULAS' ? d.motivo : null,
});

function revalidar() {
  revalidatePath('/calendario');
  revalidatePath('/alimentacao');
  revalidatePath('/ausencias');
}

export async function criarEvento(_e: EstadoEvento | undefined, formData: FormData): Promise<EstadoEvento> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const lido = lerEvento(formData);
  if ('erros' in lido) return { erros: lido.erros, valores: lido.valores };
  const criado = await prisma.eventoCalendario.create({ data: paraBanco(lido.dados) });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'CRIOU_EVENTO_CALENDARIO',
    entidade: 'EventoCalendario',
    entidadeId: criado.id,
    detalhes: { tipo: lido.dados.tipo, inicio: lido.dados.inicio, fim: lido.dados.fim, suspendeAulas: lido.dados.suspendeAulas },
  });
  revalidar();
  // Alteração não prevista: leva direto às mensagens prontas para avisar docentes, CAE, nutricionista, Gestão e turmas.
  if (pedeComunicacao(lido.dados) && temPermissao(usuario.role, 'comunicacao:enviar')) redirect(`/calendario/eventos/${criado.id}/comunicar?aviso=criado`);
  redirect(`/calendario?ano=${lido.dados.inicio.slice(0, 4)}&mes=${Number(lido.dados.inicio.slice(5, 7))}&aviso=criado`);
}

export async function atualizarEvento(_e: EstadoEvento | undefined, formData: FormData): Promise<EstadoEvento> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const id = String(formData.get('eventoId') ?? '');
  if (!(await prisma.eventoCalendario.findUnique({ where: { id }, select: { id: true } }))) return { mensagem: 'Evento não encontrado.' };
  const lido = lerEvento(formData);
  if ('erros' in lido) return { erros: lido.erros, valores: lido.valores };
  await prisma.eventoCalendario.update({ where: { id }, data: paraBanco(lido.dados) });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'EDITOU_EVENTO_CALENDARIO',
    entidade: 'EventoCalendario',
    entidadeId: id,
    detalhes: { tipo: lido.dados.tipo, inicio: lido.dados.inicio, fim: lido.dados.fim, suspendeAulas: lido.dados.suspendeAulas },
  });
  revalidar();
  if (pedeComunicacao(lido.dados) && temPermissao(usuario.role, 'comunicacao:enviar')) redirect(`/calendario/eventos/${id}/comunicar?aviso=editado`);
  return { sucesso: true, mensagem: 'Evento salvo.', valores: lido.valores };
}

export type EstadoSimples = { mensagem?: string };

export async function removerEvento(_e: EstadoSimples | undefined, formData: FormData): Promise<EstadoSimples> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const id = String(formData.get('eventoId') ?? '');
  if (formData.get('confirmo') !== 'on') return { mensagem: 'Marque a confirmação para remover.' };
  const atual = await prisma.eventoCalendario.findUnique({ where: { id } });
  if (!atual) return { mensagem: 'Evento não encontrado.' };
  await prisma.eventoCalendario.delete({ where: { id } });
  await registrarAuditoria({ userId: usuario.id, acao: 'REMOVEU_EVENTO_CALENDARIO', entidade: 'EventoCalendario', entidadeId: id, detalhes: { tipo: atual.tipo } });
  revalidar();
  const iso = atual.inicio.toISOString();
  redirect(`/calendario?ano=${iso.slice(0, 4)}&mes=${Number(iso.slice(5, 7))}&aviso=removido`);
}

export type EstadoEtapas = { mensagem?: string; erros?: Record<string, string>; valores?: Record<string, string> };

/**
 * Etapas N1–N4 e semestres do ano. Linha vazia apaga o período; os semestres são os mesmos
 * usados pelos diários (aulas esperadas).
 */
export async function salvarEtapas(_e: EstadoEtapas | undefined, formData: FormData): Promise<EstadoEtapas> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const ano = lerAnoLetivo(formData.get('anoLetivo'));
  if (!ano) return { mensagem: 'Ano inválido. Recarregue a página.' };
  const valores: Record<string, string> = {};
  const ler = (prefixo: string): Intervalo | null | 'incompleto' => {
    const inicio = String(formData.get(`${prefixo}:inicio`) ?? '').trim();
    const fim = String(formData.get(`${prefixo}:fim`) ?? '').trim();
    valores[`${prefixo}:inicio`] = inicio;
    valores[`${prefixo}:fim`] = fim;
    if (!inicio && !fim) return null;
    if (!inicio || !fim) return 'incompleto';
    return { inicio, fim };
  };
  const etapas = ETAPAS.map((n) => ler(`etapa${n}`));
  const semestres = [1, 2].map((n) => ler(`semestre${n}`));
  const erros: Record<string, string> = {};
  const checar = (prefixo: string, rotulos: string[], lista: (Intervalo | null | 'incompleto')[]) => {
    lista.forEach((x, i) => {
      if (x === 'incompleto') erros[`${prefixo}${i + 1}`] = 'Informe início e término (ou deixe os dois vazios).';
    });
    const ok = lista.map((x) => (x === 'incompleto' ? null : x));
    for (const [k, msg] of Object.entries(validarSequencia(rotulos, ok))) erros[`${prefixo}${Number(k) + 1}`] ??= msg;
    for (const x of ok) if (x && !(x.inicio.startsWith(`${ano}`) || x.fim.startsWith(`${ano}`))) erros[`${prefixo}${ok.indexOf(x) + 1}`] ??= `Use datas de ${ano}.`;
  };
  checar('etapa', ETAPAS.map(nomeEtapa), etapas);
  checar('semestre', ['1º semestre', '2º semestre'], semestres);
  if (Object.keys(erros).length > 0) return { erros, valores };

  await prisma.$transaction(async (tx) => {
    for (const [i, x] of etapas.entries()) {
      const numero = i + 1;
      if (x && x !== 'incompleto') {
        const data = { inicio: dataParaBanco(x.inicio), fim: dataParaBanco(x.fim) };
        await tx.etapaLetiva.upsert({ where: { anoLetivo_numero: { anoLetivo: ano, numero } }, create: { anoLetivo: ano, numero, ...data }, update: data });
      } else await tx.etapaLetiva.deleteMany({ where: { anoLetivo: ano, numero } });
    }
    for (const [i, x] of semestres.entries()) {
      const semestreLetivo = i + 1;
      if (x && x !== 'incompleto') {
        const data = { inicio: dataParaBanco(x.inicio), fim: dataParaBanco(x.fim) };
        await tx.periodoLetivo.upsert({
          where: { anoLetivo_semestreLetivo: { anoLetivo: ano, semestreLetivo } },
          create: { anoLetivo: ano, semestreLetivo, ...data },
          update: data,
        });
      } else await tx.periodoLetivo.deleteMany({ where: { anoLetivo: ano, semestreLetivo } });
    }
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'DEFINIU_ETAPAS', entidade: 'EtapaLetiva', entidadeId: String(ano), detalhes: { ano } });
  revalidatePath('/calendario');
  revalidatePath('/diarios');
  redirect(`/calendario?ano=${ano}&aviso=etapas`);
}

export type EstadoEnvioEvento = { mensagem?: string; sucesso?: boolean };

/** Registra o envio de uma mensagem da alteração do calendário (texto regenerado no servidor). */
export async function registrarEnvioEvento(_e: EstadoEnvioEvento | undefined, formData: FormData): Promise<EstadoEnvioEvento> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde a mensagem foi enviada.' };
  const id = String(formData.get('eventoId') ?? '');
  const dados = await mensagensDoEvento(id);
  if (!dados) return { mensagem: 'Evento não encontrado.' };
  const m = dados.mensagens.find((x) => x.chave === String(formData.get('chave') ?? ''));
  if (!m) return { mensagem: 'Esta mensagem não se aplica mais. Recarregue a página.' };
  const log = await prisma.logComunicacao.create({
    data: { canal: m.canal, destino: m.destino, chave: `${m.chave}:${id}`, assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'REGISTROU_ENVIO_MENSAGEM', entidade: 'LogComunicacao', entidadeId: log.id, detalhes: { canal: m.canal, modo, origem: 'calendario' } });
  revalidatePath(`/calendario/eventos/${id}/comunicar`);
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Envio por ${NOME_MODO[modo].toLowerCase()} registrado no histórico.` };
}
