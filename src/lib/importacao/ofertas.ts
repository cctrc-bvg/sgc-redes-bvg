import { lerAnoLetivo, semestreLetivoDaDisciplina } from '@/lib/ofertas/regras';
import type { LinhaResultado as LinhaAnalisada } from './estado';

/** Colunas da planilha de distribuição (ofertas): uma disciplina de uma turma por linha. */
export const COLUNAS_OFERTA = [
  { campo: 'anoLetivo', titulo: 'Ano letivo', apelidos: ['ano'], obrigatoria: true, largura: 12 },
  { campo: 'turma', titulo: 'Turma', apelidos: ['codigo_da_turma', 'turma_codigo'], obrigatoria: true, largura: 12 },
  { campo: 'disciplina', titulo: 'Disciplina', apelidos: ['codigo', 'componente', 'codigo_da_disciplina'], obrigatoria: true, largura: 40 },
  { campo: 'professor', titulo: 'E-mail do professor', apelidos: ['email', 'professor', 'docente', 'email_do_docente'], obrigatoria: true, largura: 34 },
] as const;

export type CampoOferta = (typeof COLUNAS_OFERTA)[number]['campo'];
export type RegistroOferta = Record<CampoOferta, string>;

export interface Contexto {
  turmas: readonly { id: string; codigo: string; anoCurso: number | null; ativa: boolean }[];
  disciplinas: readonly { id: string; codigo: string | null; nome: string; anoCurso: number | null; semestreCurso: number | null; cargaHoraria: number; ativa: boolean }[];
  /** Docentes ativos (perfil Professor ou Coordenação), por e-mail em minúsculas. */
  docentes: readonly { id: string; email: string; nome: string }[];
  ofertas: readonly { id: string; anoLetivo: number; turmaId: string; disciplinaId: string; professorId: string }[];
}

export interface PlanoImportacaoOfertas {
  linhas: LinhaAnalisada[];
  criar: { anoLetivo: number; semestreLetivo: number | null; turmaId: string; disciplinaId: string; professorId: string; aulasPrevistas: number }[];
  alterar: { id: string; professorId: string; professorAnterior: string }[];
  temErros: boolean;
}

/**
 * Compara a planilha com as ofertas. A chave é ano + turma + disciplina; o professor é o que muda.
 * A disciplina precisa ser do ano do curso da turma (ou já estar ofertada ali). Nada é removido pela planilha.
 */
export function planejarImportacaoOfertas(params: { registros: { numero: number; valores: RegistroOferta }[]; contexto: Contexto }): PlanoImportacaoOfertas {
  const { turmas, disciplinas, docentes, ofertas } = params.contexto;
  const plano: PlanoImportacaoOfertas = { linhas: [], criar: [], alterar: [], temErros: false };
  const turmaPorCodigo = new Map(turmas.map((t) => [t.codigo.toUpperCase(), t]));
  const discPorCodigo = new Map(disciplinas.filter((d) => d.codigo).map((d) => [d.codigo!.toUpperCase(), d]));
  const discPorNome = new Map(disciplinas.map((d) => [d.nome.toLowerCase(), d]));
  const docentePorEmail = new Map(docentes.map((d) => [d.email.toLowerCase(), d]));
  // Nome completo (sem acento e caixa) como alternativa ao e-mail, só quando não há homônimos.
  const chaveNome = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const porNome = new Map<string, (typeof docentes)[number][]>();
  for (const d of docentes) porNome.set(chaveNome(d.nome), [...(porNome.get(chaveNome(d.nome)) ?? []), d]);
  const ofertaPorChave = new Map(ofertas.map((o) => [`${o.anoLetivo}|${o.turmaId}|${o.disciplinaId}`, o]));
  const nomeDocente = new Map(docentes.map((d) => [d.id, d.nome]));
  const vistas = new Map<string, number>();

  for (const { numero, valores } of params.registros) {
    const descricao = [valores.turma, valores.disciplina].filter(Boolean).join(' · ') || '(linha vazia)';
    // O modelo traz a matriz inteira de cada turma: sem professor, a linha fica para depois.
    if (!valores.professor.trim()) {
      plano.linhas.push({ numero, descricao, situacao: 'ignorar', detalhe: 'Sem professor: linha ignorada.' });
      continue;
    }
    const erros: string[] = [];
    const ano = lerAnoLetivo(valores.anoLetivo.trim());
    if (!ano) erros.push('Ano letivo: use 4 dígitos (ex.: 2026).');
    const turma = turmaPorCodigo.get(valores.turma.trim().toUpperCase());
    if (!turma) erros.push(`Turma "${valores.turma}" não encontrada (use o código, ex.: REDES-1).`);
    else if (!turma.ativa) erros.push(`Turma ${turma.codigo} está desativada.`);
    const chaveDisc = valores.disciplina.trim();
    const disc = discPorCodigo.get(chaveDisc.toUpperCase()) ?? discPorNome.get(chaveDisc.toLowerCase());
    if (!disc) erros.push(`Disciplina "${valores.disciplina}" não encontrada (use o código ou o nome do catálogo).`);
    const homonimos = porNome.get(chaveNome(valores.professor)) ?? [];
    const docente = docentePorEmail.get(valores.professor.trim().toLowerCase()) ?? (homonimos.length === 1 ? homonimos[0] : undefined);
    if (!docente) {
      erros.push(
        homonimos.length > 1
          ? `Há mais de um docente chamado "${valores.professor}": use o e-mail do cadastro.`
          : `Professor "${valores.professor}" não encontrado entre os docentes ativos (use o e-mail ou o nome completo do cadastro).`,
      );
    }
    if (erros.length || !ano || !turma || !disc || !docente) {
      plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe: erros.join(' ') });
      plano.temErros = true;
      continue;
    }
    const chave = `${ano}|${turma.id}|${disc.id}`;
    const existente = ofertaPorChave.get(chave);
    if (!existente && (!disc.ativa || disc.anoCurso !== turma.anoCurso)) {
      plano.linhas.push({
        numero,
        descricao,
        situacao: 'erro',
        detalhe: !disc.ativa ? 'Disciplina desativada no catálogo.' : `Disciplina do ${disc.anoCurso ?? '?'}º ano; a turma ${turma.codigo} é do ${turma.anoCurso ?? '?'}º ano.`,
      });
      plano.temErros = true;
      continue;
    }
    if (vistas.has(chave)) {
      plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe: `Repete a linha ${vistas.get(chave)} (mesmo ano, turma e disciplina).` });
      plano.temErros = true;
      continue;
    }
    vistas.set(chave, numero);
    const desc = `${ano} · ${turma.codigo} · ${disc.nome} → ${docente.nome}`;
    if (!existente) {
      plano.criar.push({
        anoLetivo: ano,
        semestreLetivo: semestreLetivoDaDisciplina(disc.semestreCurso),
        turmaId: turma.id,
        disciplinaId: disc.id,
        professorId: docente.id,
        aulasPrevistas: disc.cargaHoraria,
      });
      plano.linhas.push({ numero, descricao: desc, situacao: 'criar' });
    } else if (existente.professorId === docente.id) {
      plano.linhas.push({ numero, descricao: desc, situacao: 'igual' });
    } else {
      plano.alterar.push({ id: existente.id, professorId: docente.id, professorAnterior: existente.professorId });
      plano.linhas.push({ numero, descricao: desc, situacao: 'atualizar', detalhe: `Troca o professor (antes: ${nomeDocente.get(existente.professorId) ?? 'docente inativo'}).` });
    }
  }
  return plano;
}

export const INSTRUCOES_OFERTAS = [
  'Importação da distribuição de disciplinas (ofertas) — SGC-Redes',
  'Preencha a aba "Dados", uma disciplina de uma turma por linha, e envie em Ofertas › Importar planilha. Antes de gravar, o sistema mostra a prévia.',
  'Este modelo já vem com todas as disciplinas da matriz curricular para cada turma ativa (pelo ano do curso), com o professor das ofertas já lançadas.',
  'Preencha o e-mail do professor nas linhas que faltam. Linhas sem professor são ignoradas: preencha só o que já estiver definido.',
  'Ano letivo: 4 dígitos. Turma: o código (ex.: REDES-1). Disciplina: o nome exato do catálogo (como no modelo) ou o código (ex.: BIO.1).',
  'E-mail do professor: o do cadastro de usuários (docentes ativos, inclusive a Coordenação).',
  'A disciplina precisa ser do ano do curso da turma. Técnicas entram no semestre certo automaticamente; as aulas previstas são a carga horária.',
  'Linhas iguais às ofertas atuais não mudam nada. A planilha nunca remove ofertas: para isso, use a tela de distribuição. Máximo de 500 linhas.',
];
