import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { COLUNAS_OFERTA, INSTRUCOES_OFERTAS } from '@/lib/importacao/ofertas';
import { respostaModelo } from '@/lib/importacao/planilha';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';

/** Modelo pré-preenchido com as ofertas do ano (?ano=AAAA; padrão: ano corrente). */
export async function GET(request: Request) {
  await exigirPermissao('ofertas:gerenciar');
  const url = new URL(request.url);
  const ano = lerAnoLetivo(url.searchParams.get('ano')) ?? anoLetivoAtual();
  const ofertas = await prisma.disciplinaOferta.findMany({
    where: { anoLetivo: ano },
    orderBy: [{ turma: { codigo: 'asc' } }, { disciplina: { nome: 'asc' } }],
    select: { turma: { select: { codigo: true } }, disciplina: { select: { codigo: true, nome: true } }, professor: { select: { email: true } } },
  });
  return respostaModelo({
    formato: url.searchParams.get('formato'),
    nomeArquivo: `ofertas-${ano}-sgc-redes`,
    colunas: COLUNAS_OFERTA.map((c) => ({ titulo: c.titulo, largura: c.largura })),
    linhas: ofertas.map((o) => [String(ano), o.turma.codigo, o.disciplina.codigo ?? o.disciplina.nome, o.professor.email]),
    instrucoes: INSTRUCOES_OFERTAS,
  });
}
