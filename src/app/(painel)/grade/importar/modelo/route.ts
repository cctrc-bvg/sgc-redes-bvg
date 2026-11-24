import { exigirPermissao } from '@/lib/auth/dal';
import { aulasSemanaisPrevistas, periodoDaUrl } from '@/lib/grade/regras';
import { COLUNAS_GRADE, instrucoesGrade, linhaDaGrade, OPCOES_GRADE } from '@/lib/importacao/grade';
import { dadosDaGrade } from '@/lib/importacao/grade-servidor';
import { respostaModelo } from '@/lib/importacao/planilha';

/**
 * Modelo da grade do semestre: a grade cadastrada ou, para turmas ainda sem grade, uma linha por aula
 * semanal prevista de cada oferta (dia e horário em branco, para preencher).
 */
export async function GET(request: Request) {
  await exigirPermissao('grade:editar');
  const sp = new URL(request.url).searchParams;
  const { anoLetivo, semestreLetivo } = periodoDaUrl({ ano: sp.get('ano') ?? undefined, sem: sp.get('sem') ?? undefined });
  const d = await dadosDaGrade(anoLetivo, semestreLetivo);
  const bloco = new Map(d.blocos.map((b) => [b.id, b]));
  const oferta = new Map(d.ofertasBd.map((o) => [o.id, o]));
  const comGrade = new Set(d.atuais.filter((c) => c.ofertaId).map((c) => c.turmaId));
  const ordemBloco = (id: string) => d.blocos.findIndex((b) => b.id === id);
  const preenchidas = d.atuais
    .filter((c) => c.ofertaId && oferta.has(c.ofertaId))
    .sort((a, b) => {
      const ta = oferta.get(a.ofertaId!)!.turma.codigo;
      const tb = oferta.get(b.ofertaId!)!.turma.codigo;
      return ta.localeCompare(tb) || a.diaSemana - b.diaSemana || ordemBloco(a.blocoId) - ordemBloco(b.blocoId);
    })
    .map((c) => {
      const o = oferta.get(c.ofertaId!)!;
      return linhaDaGrade({ turma: o.turma.codigo, diaSemana: c.diaSemana, bloco: bloco.get(c.blocoId) ?? null, disciplina: o.disciplina.nome, professor: o.professor.nome });
    });
  const aDistribuir = d.ofertasBd
    .filter((o) => !comGrade.has(o.turmaId))
    .flatMap((o) =>
      Array.from({ length: Math.max(1, aulasSemanaisPrevistas(o.disciplina.cargaHoraria, o.semestreLetivo)) }, () =>
        linhaDaGrade({ turma: o.turma.codigo, diaSemana: null, bloco: null, disciplina: o.disciplina.nome, professor: o.professor.nome }),
      ),
    );
  return respostaModelo({
    formato: sp.get('formato'),
    nomeArquivo: `grade-${anoLetivo}-${semestreLetivo}-sgc-redes`,
    colunas: COLUNAS_GRADE.map((c) => ({ titulo: c.titulo, largura: c.largura, opcoes: OPCOES_GRADE[c.campo] })),
    linhas: [...preenchidas, ...aDistribuir],
    instrucoes: instrucoesGrade(anoLetivo, semestreLetivo, d.blocos.map((b) => b.horaInicio).join(', ')),
  });
}
