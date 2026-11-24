import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { COLUNAS_OFERTA, INSTRUCOES_OFERTAS } from '@/lib/importacao/ofertas';
import { respostaModelo } from '@/lib/importacao/planilha';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';

/** Modelo pré-preenchido com a matriz de cada turma e as ofertas do ano (?ano=AAAA; padrão: ano corrente). */
export async function GET(request: Request) {
  await exigirPermissao('ofertas:gerenciar');
  const url = new URL(request.url);
  const ano = lerAnoLetivo(url.searchParams.get('ano')) ?? anoLetivoAtual();
  const [turmas, disciplinas, ofertas] = await Promise.all([
    prisma.turma.findMany({ where: { ativa: true, anoCurso: { not: null } }, orderBy: { codigo: 'asc' }, select: { id: true, codigo: true, anoCurso: true } }),
    prisma.disciplina.findMany({
      where: { ativa: true, anoCurso: { not: null } },
      orderBy: [{ anoCurso: 'asc' }, { semestreCurso: 'asc' }, { nome: 'asc' }],
      select: { id: true, nome: true, anoCurso: true },
    }),
    prisma.disciplinaOferta.findMany({
      where: { anoLetivo: ano },
      orderBy: [{ turma: { codigo: 'asc' } }, { disciplina: { nome: 'asc' } }],
      select: { turmaId: true, disciplinaId: true, turma: { select: { codigo: true } }, disciplina: { select: { nome: true } }, professor: { select: { email: true } } },
    }),
  ]);
  // Matriz curricular de cada turma (pelo ano do curso), com o professor das ofertas já lançadas;
  // depois, ofertas fora da matriz (ex.: disciplina de outro ano lançada pela tela).
  const professor = new Map(ofertas.map((o) => [`${o.turmaId}|${o.disciplinaId}`, o.professor.email]));
  const linhas: string[][] = [];
  const usadas = new Set<string>();
  for (const t of turmas) {
    for (const d of disciplinas.filter((d) => d.anoCurso === t.anoCurso)) {
      const chave = `${t.id}|${d.id}`;
      usadas.add(chave);
      linhas.push([String(ano), t.codigo, d.nome, professor.get(chave) ?? '']);
    }
  }
  for (const o of ofertas) {
    if (!usadas.has(`${o.turmaId}|${o.disciplinaId}`)) linhas.push([String(ano), o.turma.codigo, o.disciplina.nome, o.professor.email]);
  }
  return respostaModelo({
    formato: url.searchParams.get('formato'),
    nomeArquivo: `ofertas-${ano}-sgc-redes`,
    colunas: COLUNAS_OFERTA.map((c) => ({ titulo: c.titulo, largura: c.largura })),
    linhas,
    instrucoes: INSTRUCOES_OFERTAS,
  });
}
