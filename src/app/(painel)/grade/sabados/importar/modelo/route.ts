import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, formatarData } from '@/lib/ausencias/regras';
import { NOME_DIA } from '@/lib/grade/regras';
import { respostaModelo } from '@/lib/importacao/planilha';
import { COLUNAS_SABADO, INSTRUCOES_SABADOS, OPCOES_DIA_PLANILHA } from '@/lib/importacao/sabados';

/** Modelo pré-preenchido com os sábados já cadastrados. */
export async function GET(request: Request) {
  await exigirPermissao('grade:editar');
  const sabados = await prisma.sabadoLetivo.findMany({ orderBy: { data: 'asc' } });
  return respostaModelo({
    formato: new URL(request.url).searchParams.get('formato'),
    nomeArquivo: 'sabados-letivos-sgc-redes',
    colunas: COLUNAS_SABADO.map((c) => ({ titulo: c.titulo, largura: c.largura, opcoes: c.campo === 'diaSemanaReferente' ? OPCOES_DIA_PLANILHA : undefined })),
    linhas: sabados.map((s) => [formatarData(dataDoBanco(s.data)), NOME_DIA[s.diaSemanaReferente], s.observacao ?? '']),
    instrucoes: INSTRUCOES_SABADOS,
  });
}
