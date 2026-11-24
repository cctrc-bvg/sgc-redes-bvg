import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { MATRIZ_REDES } from '@/lib/disciplinas/matriz-curricular';
import { COLUNAS_DISCIPLINA, INSTRUCOES_DISCIPLINAS, OPCOES_NUCLEO_PLANILHA, linhaModeloDisciplina } from '@/lib/importacao/disciplinas';
import { respostaModelo } from '@/lib/importacao/planilha';

const OPCOES: Partial<Record<string, readonly string[]>> = {
  nucleo: OPCOES_NUCLEO_PLANILHA,
  anoCurso: ['1', '2', '3'],
  semestreCurso: ['Anual', '1', '2', '3', '4', '5', '6'],
  exigePratica: ['Sim', 'Não'],
  ativa: ['Sim', 'Não'],
};

/** Modelo pré-preenchido com o catálogo atual (ou com a matriz do PPC, se o catálogo estiver vazio). */
export async function GET(request: Request) {
  await exigirPermissao('disciplinas:gerenciar');
  const catalogo = await prisma.disciplina.findMany({
    orderBy: [
      { anoCurso: { sort: 'asc', nulls: 'last' } },
      { semestreCurso: { sort: 'asc', nulls: 'first' } },
      { nucleo: { sort: 'asc', nulls: 'last' } },
      { nome: 'asc' },
    ],
  });
  const linhas = catalogo.length
    ? catalogo.map(linhaModeloDisciplina)
    : MATRIZ_REDES.map((d) => linhaModeloDisciplina({ ...d, exigePratica: d.nucleo === 'TECNICO', ementaUrl: null }));
  return respostaModelo({
    formato: new URL(request.url).searchParams.get('formato'),
    nomeArquivo: 'disciplinas-sgc-redes',
    colunas: COLUNAS_DISCIPLINA.map((c) => ({ titulo: c.titulo, largura: c.largura, opcoes: OPCOES[c.campo] })),
    linhas,
    instrucoes: INSTRUCOES_DISCIPLINAS,
  });
}
