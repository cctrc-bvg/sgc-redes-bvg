import 'server-only';
import { prisma } from '@/lib/db';
import { dataDoBanco } from '@/lib/ausencias/regras';
import { mensagemSemCadastro, type MensagemPronta } from '@/lib/comunicacao/mensagem';
import { mensagemAvulsa } from '@/lib/comunicacao/servidor';
import { assuntoPpe, PUBLICOS_PPE, situacaoDaPpe, textoPpe, type PpeComunicavel } from './mensagens';
import { anoDoSemestre } from './regras';

/** PPE e as mensagens prontas do momento atual (definir, modalidade, PEI pronto ou resultado); null se não existe. */
export async function mensagensDaPpe(id: string) {
  const bd = await prisma.registroPPE.findUnique({
    where: { id },
    include: { disciplina: true, pei: { include: { encontros: { orderBy: { data: 'asc' } }, docente: { select: { nome: true } } } } },
  });
  if (!bd) return null;
  const ano = anoDoSemestre(bd.semestre);
  const docentes = await prisma.user.findMany({
    where: { ativo: true, disciplinasMinistradas: { some: { disciplinaId: bd.disciplinaId, anoLetivo: ano } } },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });
  const ppe: PpeComunicavel = {
    semestre: bd.semestre,
    nomeEstudante: bd.nomeEstudante,
    matricula: bd.matricula,
    disciplina: bd.disciplina.nome,
    modalidade: bd.modalidade,
    status: bd.status,
    notaFinal: bd.notaFinal,
    docente: bd.pei?.docente.nome ?? docentes[0]?.nome ?? null,
    pei: bd.pei
      ? {
          cargaHoraria: bd.pei.cargaHorariaPei,
          horasPresenciais: bd.pei.horasPresenciais,
          horasPraticas: bd.pei.horasPraticas,
          prorrogadoAte: bd.pei.prorrogadoAte ? dataDoBanco(bd.pei.prorrogadoAte) : null,
          encontros: bd.pei.encontros.map((e) => ({ data: dataDoBanco(e.data), conteudo: e.conteudo })),
        }
      : null,
  };
  const situacao = situacaoDaPpe(ppe);
  const mensagens: MensagemPronta[] = [];
  const assunto = assuntoPpe(ppe, situacao);
  const variaveis = { disciplina: ppe.disciplina };
  for (const publico of PUBLICOS_PPE[situacao]) {
    const corpo = textoPpe(ppe, situacao, publico);
    if (publico === 'estudante') {
      mensagens.push(
        mensagemSemCadastro({ chave: 'estudante', titulo: `Estudante: ${ppe.nomeEstudante}`, destino: 'Estudante (PPE)', nome: ppe.nomeEstudante, assunto, texto: corpo, tipo: 'ppe', variaveis }),
      );
    } else if (publico === 'ctp') {
      const m = await mensagemAvulsa('canal:CTP', assunto, corpo, ano);
      if (m) mensagens.push({ ...m, chave: 'canal:CTP', tipo: 'ppe', variaveis: { ...m.variaveis, ...variaveis } });
    } else {
      for (const d of docentes) {
        const m = await mensagemAvulsa(`usuario:${d.id}`, assunto, corpo, ano);
        if (m) mensagens.push({ ...m, chave: `docente:${d.id}`, destino: 'Docente da disciplina', tipo: 'ppe', variaveis: { ...m.variaveis, ...variaveis } });
      }
    }
  }
  return { id: bd.id, ppe, situacao, mensagens };
}

/** Chave do envio no histórico: muda com o momento, para o mesmo destinatário ser avisado de novo em cada etapa. */
export const chaveEnvioPpe = (situacao: string, chave: string, id: string) => `ppe:${situacao}:${chave}:${id}`;
