import type { NucleoDisciplina } from '@prisma/client';
import * as z from 'zod';
import { DisciplinaSchema, NOME_NUCLEO } from '@/lib/disciplinas/regras';
import type { LinhaResultado as LinhaAnalisada } from './estado';
import { lerSimNao, normalizarCabecalho } from './tabela';

/** Colunas da planilha de disciplinas (o programa/ementa em texto fica de fora: edite na tela). */
export const COLUNAS_DISCIPLINA = [
  { campo: 'codigo', titulo: 'Código', apelidos: ['sigla', 'cod'], largura: 14 },
  { campo: 'nome', titulo: 'Disciplina', apelidos: ['nome', 'nome_da_disciplina'], obrigatoria: true, largura: 42 },
  { campo: 'cargaHoraria', titulo: 'Carga horária', apelidos: ['ch', 'carga_horaria_h', 'horas'], obrigatoria: true, largura: 15 },
  { campo: 'nucleo', titulo: 'Núcleo', apelidos: ['tipo'], obrigatoria: true, largura: 16 },
  { campo: 'anoCurso', titulo: 'Ano', apelidos: ['ano_do_curso', 'serie'], obrigatoria: true, largura: 8 },
  { campo: 'semestreCurso', titulo: 'Semestre', apelidos: ['semestre_do_curso', 'periodo'], largura: 12 },
  { campo: 'exigePratica', titulo: 'Exige prática', apelidos: ['pratica'], largura: 14 },
  { campo: 'ementaUrl', titulo: 'Link da ementa', apelidos: ['ementa', 'ementa_url', 'url'], largura: 40 },
  { campo: 'ativa', titulo: 'Ativa', apelidos: ['situacao'], largura: 8 },
] as const;

export type CampoDisciplina = (typeof COLUNAS_DISCIPLINA)[number]['campo'];
export type RegistroDisciplina = Record<CampoDisciplina, string>;

export const OPCOES_NUCLEO_PLANILHA = ['Propedêutica', 'Diversificada', 'Técnica'];

/** Disciplina já cadastrada, com os campos que a planilha pode alterar. */
export interface DisciplinaExistente {
  id: string;
  codigo: string | null;
  nome: string;
  cargaHoraria: number;
  nucleo: NucleoDisciplina | null;
  anoCurso: number | null;
  semestreCurso: number | null;
  exigePratica: boolean;
  ementaUrl: string | null;
  ativa: boolean;
}

type Dados = Omit<DisciplinaExistente, 'id'>;

export type { LinhaResultado as LinhaAnalisada } from './estado';

export interface PlanoImportacaoDisciplinas {
  linhas: LinhaAnalisada[];
  criar: Dados[];
  atualizar: { id: string; dados: Partial<Dados>; campos: string[] }[];
  temErros: boolean;
}

const ROTULO_CAMPO: Record<string, string> = {
  codigo: 'código',
  nome: 'nome',
  cargaHoraria: 'carga horária',
  nucleo: 'núcleo',
  anoCurso: 'ano',
  semestreCurso: 'semestre',
  exigePratica: 'prática',
  ementaUrl: 'ementa',
  ativa: 'situação',
};

/** Linha da planilha → dados validados (mesmas regras do formulário) ou mensagens de erro. */
export function converterDisciplina(v: RegistroDisciplina, presentes: ReadonlySet<CampoDisciplina>): { dados: Dados } | { erros: string[] } {
  const erros: string[] = [];
  const nucleoNorm = normalizarCabecalho(v.nucleo);
  const nucleo = nucleoNorm.startsWith('prop') ? 'PROPEDEUTICO' : nucleoNorm.startsWith('div') ? 'DIVERSIFICADO' : nucleoNorm.startsWith('tec') ? 'TECNICO' : v.nucleo;
  const digito = (s: string) => /^\s*(\d)/.exec(s)?.[1] ?? (normalizarCabecalho(s) === 'anual' ? '' : s);
  const pratica = lerSimNao(v.exigePratica);
  const ativa = presentes.has('ativa') && v.ativa !== '' ? lerSimNao(v.ativa) : true;
  if (pratica === null) erros.push('Exige prática: use "Sim" ou "Não".');
  if (ativa === null) erros.push('Ativa: use "Sim" ou "Não".');

  const r = DisciplinaSchema.safeParse({
    codigo: v.codigo,
    nome: v.nome,
    cargaHoraria: v.cargaHoraria.replace(/\s*h$/i, ''),
    nucleo,
    anoCurso: digito(v.anoCurso),
    semestreCurso: digito(v.semestreCurso),
    exigePratica: pratica ? 'on' : '',
    ementaUrl: v.ementaUrl,
  });
  if (!r.success) {
    const porCampo = z.flattenError(r.error).fieldErrors as Record<string, string[] | undefined>;
    for (const [campo, msgs] of Object.entries(porCampo)) {
      const rotulo = ROTULO_CAMPO[campo] ?? campo;
      if (msgs?.length) erros.push(`${rotulo[0].toUpperCase()}${rotulo.slice(1)}: ${msgs[0]}`);
    }
  }
  if (erros.length || !r.success) return { erros };
  const d = r.data;
  return {
    dados: {
      codigo: d.codigo ?? null,
      nome: d.nome,
      cargaHoraria: d.cargaHoraria,
      nucleo: d.nucleo,
      anoCurso: d.anoCurso,
      semestreCurso: d.semestreCurso ?? null,
      exigePratica: d.exigePratica,
      ementaUrl: d.ementaUrl ?? null,
      ativa: ativa ?? true,
    },
  };
}

/**
 * Compara a planilha com o catálogo. Cada linha casa com uma disciplina existente pelo código (se
 * informado) ou pelo nome (sem diferenciar maiúsculas); sem correspondência, é criada.
 * Colunas ausentes na planilha não alteram nada; código em branco mantém o código atual.
 */
export function planejarImportacaoDisciplinas(params: {
  registros: { numero: number; valores: RegistroDisciplina }[];
  presentes: ReadonlySet<CampoDisciplina>;
  existentes: readonly DisciplinaExistente[];
}): PlanoImportacaoDisciplinas {
  const plano: PlanoImportacaoDisciplinas = { linhas: [], criar: [], atualizar: [], temErros: false };
  const porCodigo = new Map(params.existentes.filter((e) => e.codigo).map((e) => [e.codigo!, e]));
  const porNome = new Map(params.existentes.map((e) => [e.nome.toLowerCase(), e]));
  const vistosCodigo = new Map<string, number>();
  const vistosNome = new Map<string, number>();
  const erro = (numero: number, descricao: string, detalhe: string) => {
    plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe });
    plano.temErros = true;
  };

  for (const { numero, valores } of params.registros) {
    const descricao = valores.nome || valores.codigo || '(sem nome)';
    const conv = converterDisciplina(valores, params.presentes);
    if ('erros' in conv) {
      erro(numero, descricao, conv.erros.join(' '));
      continue;
    }
    const d = conv.dados;
    const repetida = (d.codigo && vistosCodigo.get(d.codigo)) || vistosNome.get(d.nome.toLowerCase());
    if (repetida) {
      erro(numero, descricao, `Repete a disciplina da linha ${repetida} desta planilha.`);
      continue;
    }
    if (d.codigo) vistosCodigo.set(d.codigo, numero);
    vistosNome.set(d.nome.toLowerCase(), numero);

    const existente = d.codigo ? porCodigo.get(d.codigo) : porNome.get(d.nome.toLowerCase());
    if (!existente) {
      const nomeEmUso = d.codigo ? porNome.get(d.nome.toLowerCase()) : undefined;
      if (nomeEmUso) {
        erro(numero, descricao, `Já existe "${nomeEmUso.nome}" com o código ${nomeEmUso.codigo ?? '(sem código)'}. Use o mesmo código para atualizá-la.`);
        continue;
      }
      plano.criar.push(d);
      plano.linhas.push({ numero, descricao, situacao: 'criar' });
      continue;
    }

    // Só os campos presentes na planilha; código em branco mantém o atual.
    const mudancas: Partial<Dados> = {};
    for (const campo of Object.keys(d) as (keyof Dados)[]) {
      if (!params.presentes.has(campo as CampoDisciplina)) continue;
      if (campo === 'codigo' && d.codigo === null) continue;
      if (d[campo] !== existente[campo]) (mudancas as Record<string, unknown>)[campo] = d[campo];
    }
    const campos = Object.keys(mudancas);
    if (campos.length === 0) {
      plano.linhas.push({ numero, descricao, situacao: 'igual' });
    } else {
      plano.atualizar.push({ id: existente.id, dados: mudancas, campos });
      plano.linhas.push({ numero, descricao, situacao: 'atualizar', detalhe: `Altera: ${campos.map((c) => ROTULO_CAMPO[c] ?? c).join(', ')}.` });
    }
  }
  return plano;
}

/** Linha do modelo a partir de uma disciplina (cadastrada ou da matriz). */
export function linhaModeloDisciplina(d: Omit<Dados, 'ativa'> & { ativa?: boolean }): string[] {
  return [
    d.codigo ?? '',
    d.nome,
    String(d.cargaHoraria),
    d.nucleo ? NOME_NUCLEO[d.nucleo] : '',
    d.anoCurso ? String(d.anoCurso) : '',
    d.semestreCurso ? String(d.semestreCurso) : 'Anual',
    d.exigePratica ? 'Sim' : 'Não',
    d.ementaUrl ?? '',
    d.ativa === false ? 'Não' : 'Sim',
  ];
}

export const INSTRUCOES_DISCIPLINAS = [
  'Importação de disciplinas — SGC-Redes',
  'Preencha a aba "Dados", uma disciplina por linha, e envie o arquivo em Disciplinas › Importar planilha. Antes de gravar, o sistema mostra o que será criado e alterado.',
  'Este modelo já vem com o catálogo atual: edite o que precisar, acrescente linhas para disciplinas novas e envie. Linhas iguais ao catálogo não mudam nada.',
  'Uma linha atualiza a disciplina com o mesmo Código; sem código, a de mesmo nome. Se não houver nenhuma, a disciplina é criada. Nada é excluído pela planilha.',
  'Código: opcional, 2 a 20 caracteres (letras, números, ponto, hífen ou barra). Ex.: BIO.1, SEGR.',
  'Carga horária: número de horas, sem "h". Ex.: 80.',
  'Núcleo: Propedêutica, Diversificada ou Técnica.',
  'Ano: 1, 2 ou 3. Semestre: "Anual" para propedêuticas e diversificadas; para técnicas, o semestre do curso (1º ano: 1 ou 2; 2º ano: 3 ou 4; 3º ano: 5 ou 6).',
  'Exige prática e Ativa: Sim ou Não. Técnicas têm metade da carga prática (Sim).',
  'Link da ementa: endereço completo começando com https://. O programa em texto é editado na tela de cada disciplina.',
  'Pode salvar como .xlsx ou .csv. Máximo de 500 linhas por envio.',
];
