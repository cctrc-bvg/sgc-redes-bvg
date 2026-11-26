/**
 * Editor visual do calendário: regras puras. O calendário continua guardado como eventos (intervalos), sábados e
 * domingos letivos e etapas; o editor trabalha dia a dia e converte de volta (dias iguais e seguidos viram um evento).
 * Também guarda o instantâneo de cada revisão (histórico) e conta os dias por categoria.
 */
import type { TipoEventoCalendario } from '@prisma/client';
import { contarDiasLetivos, datasEntre, dentro, diaDaSemanaISO, SEMPRE_NAO_LETIVO, somarDiasISO, SUSPENDE_POR_PADRAO, type Intervalo } from './regras';

/** Tipos de evento que o editor marca dia a dia; os demais (reunião, matrícula, acolhida…) ficam como estão. */
export const TIPOS_DO_EDITOR = ['FERIADO', 'PONTO_FACULTATIVO', 'FERIAS_DOCENTES', 'ENCONTRO_PEDAGOGICO', 'AVALIACOES_FINAIS', 'SUSPENSAO_AULAS'] as const satisfies readonly TipoEventoCalendario[];
export type TipoDoEditor = (typeof TIPOS_DO_EDITOR)[number];
export const ehTipoDoEditor = (t: string): t is TipoDoEditor => (TIPOS_DO_EDITOR as readonly string[]).includes(t);

/** O que se aplica à seleção: "dia letivo" limpa as marcações; "fim de semana letivo" liga sábado ou domingo à grade. */
export type Categoria = 'LETIVO' | 'FIM_DE_SEMANA_LETIVO' | TipoDoEditor;

export const NOME_CATEGORIA: Record<Categoria, string> = {
  LETIVO: 'Dia letivo',
  FIM_DE_SEMANA_LETIVO: 'Sábado/domingo letivo',
  FERIADO: 'Feriado',
  PONTO_FACULTATIVO: 'Ponto facultativo',
  FERIAS_DOCENTES: 'Férias / recesso',
  ENCONTRO_PEDAGOGICO: 'Encontro pedagógico',
  AVALIACOES_FINAIS: 'Avaliações finais',
  SUSPENSAO_AULAS: 'Suspensão (força maior)',
};

export interface Marca {
  tipo: TipoDoEditor;
  descricao: string;
  suspendeAulas: boolean;
  imprevisto: boolean;
  motivo: string;
}

export interface DiaExtra {
  /** Dia da semana (1=segunda … 5=sexta) cuja grade vale neste sábado ou domingo. */
  diaReferente: number;
  observacao: string;
}

export interface EventoInst {
  tipo: TipoEventoCalendario;
  inicio: string;
  fim: string;
  descricao: string;
  suspendeAulas: boolean;
  imprevisto: boolean;
  motivo: string;
}

export interface ExtraInst extends DiaExtra {
  data: string;
}

/** Foto do calendário de um ano: é o que cada revisão guarda. */
export interface Instantaneo {
  eventos: EventoInst[];
  extras: ExtraInst[];
  etapas: (Intervalo | null)[];
  semestres: (Intervalo | null)[];
}

export interface EstadoDosDias {
  marcas: Map<string, Marca>;
  extras: Map<string, DiaExtra>;
  /** Eventos que o editor não mexe (reunião, matrícula, acolhida…). */
  outros: EventoInst[];
}

const chaveMarca = (m: Marca) => `${m.tipo}|${m.descricao}|${m.suspendeAulas ? 1 : 0}|${m.imprevisto ? 1 : 0}|${m.motivo}`;

/** Expande os eventos do editor em marcas por dia (em sobreposição, vale o último). */
export function estadoDoInstantaneo(i: Instantaneo): EstadoDosDias {
  const marcas = new Map<string, Marca>();
  const outros: EventoInst[] = [];
  for (const e of i.eventos) {
    if (!ehTipoDoEditor(e.tipo)) {
      outros.push(e);
      continue;
    }
    const m: Marca = { tipo: e.tipo, descricao: e.descricao, suspendeAulas: e.suspendeAulas, imprevisto: e.imprevisto, motivo: e.motivo };
    for (const d of datasEntre(e.inicio, e.fim)) marcas.set(d, m);
  }
  return { marcas, extras: new Map(i.extras.map((x) => [x.data, { diaReferente: x.diaReferente, observacao: x.observacao }])), outros };
}

/** Faz o caminho inverso: dias seguidos com a mesma marcação viram um só evento. */
export function instantaneoDoEstado(e: EstadoDosDias, etapas: (Intervalo | null)[], semestres: (Intervalo | null)[]): Instantaneo {
  const datas = [...e.marcas.keys()].sort();
  const eventos: EventoInst[] = [...e.outros];
  let atual: { m: Marca; inicio: string; fim: string } | null = null;
  const fechar = () => {
    if (atual) eventos.push({ tipo: atual.m.tipo, inicio: atual.inicio, fim: atual.fim, descricao: atual.m.descricao, suspendeAulas: atual.m.suspendeAulas, imprevisto: atual.m.imprevisto, motivo: atual.m.motivo });
    atual = null;
  };
  for (const d of datas) {
    const m = e.marcas.get(d)!;
    if (atual && chaveMarca(atual.m) === chaveMarca(m) && somarDiasISO(atual.fim, 1) === d) atual.fim = d;
    else {
      fechar();
      atual = { m, inicio: d, fim: d };
    }
  }
  fechar();
  eventos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.tipo.localeCompare(b.tipo));
  const extras = [...e.extras].map(([data, x]) => ({ data, ...x })).sort((a, b) => a.data.localeCompare(b.data));
  return { eventos, extras, etapas, semestres };
}

export interface OpcoesDeAplicacao {
  /** Rótulo opcional ("Natal", "Recesso de julho"). */
  descricao?: string;
  /** Suspensão: motivo de uma lista fechada. */
  motivo?: string;
  /** Sábado/domingo letivo: dia da semana cuja grade vale. */
  diaReferente?: number;
  /** Suspensão não prevista (a repor). */
  imprevisto?: boolean;
}

/** Aplica uma categoria aos dias; devolve o novo estado sem mexer no anterior. */
export function aplicarCategoria(e: EstadoDosDias, datas: Iterable<string>, categoria: Categoria, o: OpcoesDeAplicacao = {}): EstadoDosDias {
  const marcas = new Map(e.marcas);
  const extras = new Map(e.extras);
  for (const d of datas) {
    const fimDeSemana = [0, 6].includes(diaDaSemanaISO(d));
    if (categoria === 'LETIVO') {
      marcas.delete(d);
      // Em dia de semana, "letivo" é o normal; no fim de semana, vira letivo de verdade (precisa do dia da grade).
      if (fimDeSemana) extras.set(d, { diaReferente: o.diaReferente ?? 1, observacao: extras.get(d)?.observacao ?? '' });
    } else if (categoria === 'FIM_DE_SEMANA_LETIVO') {
      if (fimDeSemana) extras.set(d, { diaReferente: o.diaReferente ?? 1, observacao: extras.get(d)?.observacao ?? '' });
    } else {
      marcas.set(d, {
        tipo: categoria,
        descricao: (o.descricao ?? '').trim(),
        suspendeAulas: SEMPRE_NAO_LETIVO.includes(categoria) || SUSPENDE_POR_PADRAO[categoria],
        imprevisto: categoria === 'SUSPENSAO_AULAS' ? (o.imprevisto ?? true) : false,
        motivo: categoria === 'SUSPENSAO_AULAS' ? (o.motivo ?? '') : '',
      });
    }
  }
  return { marcas, extras, outros: e.outros };
}

/** Limpa as marcações dos dias: dia de semana volta a ser letivo e fim de semana volta a ser comum (sem aula). */
export function voltarAoPadrao(e: EstadoDosDias, datas: Iterable<string>): EstadoDosDias {
  const marcas = new Map(e.marcas);
  const extras = new Map(e.extras);
  for (const d of datas) {
    marcas.delete(d);
    extras.delete(d);
  }
  return { marcas, extras, outros: e.outros };
}

/** Categoria que o dia mostra: a marcação, o fim de semana letivo ou o padrão do dia da semana. */
export type SituacaoDoDia = Categoria | 'FIM_DE_SEMANA';
export function situacaoDoDia(e: EstadoDosDias, data: string): SituacaoDoDia {
  const m = e.marcas.get(data);
  if (m) return m.tipo;
  if (e.extras.has(data)) return 'FIM_DE_SEMANA_LETIVO';
  return [0, 6].includes(diaDaSemanaISO(data)) ? 'FIM_DE_SEMANA' : 'LETIVO';
}

// ---------------------------------------------------------------------------------------------------------------
// Seleção de dias (clique, Shift e Ctrl)
// ---------------------------------------------------------------------------------------------------------------

export interface Selecao {
  dias: ReadonlySet<string>;
  /** Último dia clicado sem Shift: começa os intervalos. */
  ancora: string | null;
}
export const SELECAO_VAZIA: Selecao = { dias: new Set(), ancora: null };

/**
 * Comportamento de passagem aérea: clique seleciona um dia; Shift+clique seleciona o intervalo desde a âncora;
 * Ctrl+clique (ou Cmd) liga e desliga dias soltos; Ctrl+Shift+clique soma o intervalo ao que já estava selecionado.
 */
export function clicarNoDia(s: Selecao, data: string, t: { shift?: boolean; ctrl?: boolean }): Selecao {
  if (t.shift && s.ancora) {
    const [de, ate] = s.ancora <= data ? [s.ancora, data] : [data, s.ancora];
    const intervalo = [...datasEntre(de, ate)];
    return { dias: new Set(t.ctrl ? [...s.dias, ...intervalo] : intervalo), ancora: s.ancora };
  }
  if (t.ctrl) {
    const dias = new Set(s.dias);
    if (dias.has(data)) {
      dias.delete(data);
      return { dias, ancora: s.ancora === data ? null : s.ancora };
    }
    dias.add(data);
    return { dias, ancora: data };
  }
  return { dias: new Set([data]), ancora: data };
}

/** Seleciona todos os dias de um mês ("aaaa-mm") ou o intervalo dado. */
export function selecionarIntervalo(de: string, ate: string): Selecao {
  return { dias: new Set(datasEntre(de, ate)), ancora: de };
}

// ---------------------------------------------------------------------------------------------------------------
// Contadores
// ---------------------------------------------------------------------------------------------------------------

export interface Contadores {
  letivos: number;
  porEtapa: (number | null)[];
  porSemestre: (number | null)[];
  sabadosLetivos: number;
  domingosLetivos: number;
  /** Dias úteis (segunda a sexta) por categoria. */
  feriados: number;
  pontosFacultativos: number;
  feriasDocentes: number;
  encontrosPedagogicos: number;
  avaliacoesFinais: number;
  suspensoes: number;
  /** Dias úteis que seriam letivos mas foram suspensos por imprevisto (a repor). */
  perdidosImprevistos: number;
}

/** Dias letivos do instantâneo (o intervalo vem das etapas ou, sem elas, dos semestres). */
export function contagemDoInstantaneo(i: Instantaneo, ano: number) {
  const todos = [...i.etapas, ...i.semestres].filter((x): x is Intervalo => x !== null);
  const doAno: Intervalo = todos.length
    ? { inicio: todos.map((x) => x.inicio).sort()[0]!, fim: todos.map((x) => x.fim).sort().at(-1)! }
    : { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  const periodos = (i.etapas.some(Boolean) ? i.etapas : i.semestres).filter((x): x is Intervalo => x !== null);
  return contarDiasLetivos({
    ...doAno,
    eventos: i.eventos,
    sabadosLetivos: new Set(i.extras.map((x) => x.data)),
    periodos: todos.length ? periodos : undefined,
  });
}

/** Conta os dias do ano por categoria. */
export function contarInstantaneo(i: Instantaneo, ano: number): Contadores {
  const c = contagemDoInstantaneo(i, ano);
  const util = (d: string) => !['0', '6'].includes(String(diaDaSemanaISO(d)));
  const diasDo = (tipo: TipoEventoCalendario) => {
    const dias = new Set<string>();
    for (const e of i.eventos) if (e.tipo === tipo) for (const d of datasEntre(e.inicio, e.fim)) if (d.startsWith(`${ano}`) && util(d)) dias.add(d);
    return dias.size;
  };
  return {
    letivos: c.letivos.length,
    porEtapa: i.etapas.map((e) => (e ? dentro(c.letivos, e) : null)),
    porSemestre: i.semestres.map((s) => (s ? dentro(c.letivos, s) : null)),
    sabadosLetivos: c.sabados.length,
    domingosLetivos: c.domingos.length,
    feriados: diasDo('FERIADO'),
    pontosFacultativos: diasDo('PONTO_FACULTATIVO'),
    feriasDocentes: diasDo('FERIAS_DOCENTES'),
    encontrosPedagogicos: diasDo('ENCONTRO_PEDAGOGICO'),
    avaliacoesFinais: diasDo('AVALIACOES_FINAIS'),
    suspensoes: diasDo('SUSPENSAO_AULAS'),
    perdidosImprevistos: c.perdidosImprevistos.length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Histórico: comparação entre revisões
// ---------------------------------------------------------------------------------------------------------------

/** Texto estável do instantâneo, para saber se algo mudou. */
export function assinatura(i: Instantaneo): string {
  const ev = [...i.eventos].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.tipo.localeCompare(b.tipo) || a.fim.localeCompare(b.fim) || a.descricao.localeCompare(b.descricao));
  const ex = [...i.extras].sort((a, b) => a.data.localeCompare(b.data));
  return JSON.stringify({ ev, ex, et: i.etapas, se: i.semestres });
}

export interface Diferenca {
  rotulo: string;
  adicionados: number;
  removidos: number;
}

/** O que mudou de uma revisão para outra, por categoria (em dias). */
export function diferencaEntre(antes: Instantaneo, depois: Instantaneo): Diferenca[] {
  const a = estadoDoInstantaneo(antes);
  const b = estadoDoInstantaneo(depois);
  const mapa = new Map<string, Diferenca>();
  const item = (rotulo: string) => {
    const x = mapa.get(rotulo) ?? { rotulo, adicionados: 0, removidos: 0 };
    mapa.set(rotulo, x);
    return x;
  };
  for (const d of new Set([...a.marcas.keys(), ...b.marcas.keys()])) {
    const x = a.marcas.get(d);
    const y = b.marcas.get(d);
    if (x && y && chaveMarca(x) === chaveMarca(y)) continue;
    if (x) item(NOME_CATEGORIA[x.tipo]).removidos++;
    if (y) item(NOME_CATEGORIA[y.tipo]).adicionados++;
  }
  for (const d of new Set([...a.extras.keys(), ...b.extras.keys()])) {
    const x = a.extras.get(d);
    const y = b.extras.get(d);
    if (x && y && chaveExtra(x) === chaveExtra(y)) continue;
    if (x) item(NOME_CATEGORIA.FIM_DE_SEMANA_LETIVO).removidos++;
    if (y) item(NOME_CATEGORIA.FIM_DE_SEMANA_LETIVO).adicionados++;
  }
  const doOutros = (s: Instantaneo) => s.eventos.filter((e) => !ehTipoDoEditor(e.tipo)).map((e) => `${e.tipo}|${e.inicio}|${e.fim}|${e.descricao}|${e.suspendeAulas ? 1 : 0}|${e.imprevisto ? 1 : 0}|${e.motivo}`);
  const oa = new Set(doOutros(antes));
  const ob = new Set(doOutros(depois));
  const novos = [...ob].filter((x) => !oa.has(x)).length;
  const saiu = [...oa].filter((x) => !ob.has(x)).length;
  if (novos || saiu) Object.assign(item('Outros eventos'), { adicionados: novos, removidos: saiu });
  const periodos = (s: Instantaneo) => JSON.stringify([s.etapas, s.semestres]);
  if (periodos(antes) !== periodos(depois)) item('Etapas e semestres').adicionados = 1;
  // Mudança que o dia a dia não mostra (ex.: eventos sobrepostos): ainda assim é uma revisão e precisa de texto.
  if (mapa.size === 0 && assinatura(antes) !== assinatura(depois)) item('Outras alterações').adicionados = 1;
  return [...mapa.values()];
}

/** "Feriado: +2 dias; Sábado/domingo letivo: +1, −1" */
export function textoDaDiferenca(d: readonly Diferenca[]): string {
  if (d.length === 0) return 'Sem mudança nos dias.';
  return d
    .map((x) => {
      if (x.rotulo === 'Etapas e semestres') return 'Etapas e semestres alterados';
      if (x.rotulo === 'Outras alterações') return 'Outras alterações nos eventos do calendário';
      if (x.rotulo === 'Outros eventos') return `Outros eventos: ${[x.adicionados ? `+${x.adicionados}` : '', x.removidos ? `−${x.removidos}` : ''].filter(Boolean).join(', ')}`;
      const partes = [x.adicionados ? `+${x.adicionados}` : '', x.removidos ? `−${x.removidos}` : ''].filter(Boolean).join(', ');
      return `${x.rotulo}: ${partes} ${x.adicionados + x.removidos === 1 ? 'dia' : 'dias'}`;
    })
    .join('; ');
}

// ---------------------------------------------------------------------------------------------------------------
// Modelo para um calendário novo
// ---------------------------------------------------------------------------------------------------------------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em "aaaa-mm-dd". */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export interface FeriadoNacional {
  data: string;
  nome: string;
  tipo: 'FERIADO' | 'PONTO_FACULTATIVO';
}

/** Feriados nacionais e pontos facultativos usuais do ano, só em dia de semana (fim de semana já não é letivo). */
export function feriadosNacionais(ano: number): FeriadoNacional[] {
  const p = pascoa(ano);
  const fixos: [string, string][] = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Consciência Negra'],
    ['12-25', 'Natal'],
  ];
  const lista: FeriadoNacional[] = [
    ...fixos.map(([md, nome]) => ({ data: `${ano}-${md}`, nome, tipo: 'FERIADO' as const })),
    { data: somarDiasISO(p, -2), nome: 'Sexta-feira Santa', tipo: 'FERIADO' },
    { data: somarDiasISO(p, -48), nome: 'Carnaval', tipo: 'PONTO_FACULTATIVO' },
    { data: somarDiasISO(p, -47), nome: 'Carnaval', tipo: 'PONTO_FACULTATIVO' },
    { data: somarDiasISO(p, 60), nome: 'Corpus Christi', tipo: 'PONTO_FACULTATIVO' },
  ];
  return lista.filter((f) => ![0, 6].includes(diaDaSemanaISO(f.data))).sort((a, b) => a.data.localeCompare(b.data));
}

/** Insere os feriados do ano sem sobrescrever o que já foi marcado. */
export function inserirFeriadosNacionais(e: EstadoDosDias, ano: number): { estado: EstadoDosDias; inseridos: number } {
  const marcas = new Map(e.marcas);
  let inseridos = 0;
  for (const f of feriadosNacionais(ano)) {
    if (marcas.has(f.data)) continue;
    marcas.set(f.data, { tipo: f.tipo, descricao: f.nome, suspendeAulas: true, imprevisto: false, motivo: '' });
    inseridos++;
  }
  return { estado: { marcas, extras: e.extras, outros: e.outros }, inseridos };
}

// ---------------------------------------------------------------------------------------------------------------
// Edições enviadas pela tela (só os dias que mudaram) e validação no servidor
// ---------------------------------------------------------------------------------------------------------------

export interface EdicaoDia {
  data: string;
  marca: Marca | null;
  extra: DiaExtra | null;
}

const chaveExtra = (x: DiaExtra | undefined) => (x ? `${x.diaReferente}|${x.observacao}` : '');

/** Dias que diferem entre o estado carregado e o editado (o que a tela envia ao salvar). */
export function edicoesEntre(base: EstadoDosDias, novo: EstadoDosDias): EdicaoDia[] {
  const datas = new Set([...base.marcas.keys(), ...novo.marcas.keys(), ...base.extras.keys(), ...novo.extras.keys()]);
  const lista: EdicaoDia[] = [];
  for (const data of [...datas].sort()) {
    const a = base.marcas.get(data);
    const b = novo.marcas.get(data);
    const mudouMarca = (a ? chaveMarca(a) : '') !== (b ? chaveMarca(b) : '');
    const mudouExtra = chaveExtra(base.extras.get(data)) !== chaveExtra(novo.extras.get(data));
    if (mudouMarca || mudouExtra) lista.push({ data, marca: b ?? null, extra: novo.extras.get(data) ?? null });
  }
  return lista;
}

export function aplicarEdicoes(e: EstadoDosDias, edicoes: readonly EdicaoDia[]): EstadoDosDias {
  const marcas = new Map(e.marcas);
  const extras = new Map(e.extras);
  for (const x of edicoes) {
    if (x.marca) marcas.set(x.data, x.marca);
    else marcas.delete(x.data);
    if (x.extra) extras.set(x.data, x.extra);
    else extras.delete(x.data);
  }
  return { marcas, extras, outros: e.outros };
}

/**
 * Aplica as edições direto nos eventos do instantâneo, sem achatar o calendário em marcas por dia: eventos que a
 * edição não toca (inclusive sobrepostos ou que atravessam a virada do ano) ficam exatamente como estão. Os dias
 * editados saem dos eventos do editor (que são partidos se preciso) e entram as novas marcas, agrupadas em dias seguidos.
 */
export function aplicarEdicoesAosEventos(i: Instantaneo, edicoes: readonly EdicaoDia[]): Instantaneo {
  const editados = new Set(edicoes.map((x) => x.data));
  const eventos: EventoInst[] = [];
  for (const e of i.eventos) {
    if (!ehTipoDoEditor(e.tipo)) {
      eventos.push(e);
      continue;
    }
    const dias = [...datasEntre(e.inicio, e.fim)];
    if (!dias.some((d) => editados.has(d))) {
      eventos.push(e);
      continue;
    }
    let trecho: { inicio: string; fim: string } | null = null;
    const fechar = () => {
      if (trecho) eventos.push({ ...e, ...trecho });
      trecho = null;
    };
    for (const d of dias) {
      if (editados.has(d)) fechar();
      else if (trecho) trecho.fim = d;
      else trecho = { inicio: d, fim: d };
    }
    fechar();
  }
  const novas = edicoes.filter((x) => x.marca).sort((a, b) => a.data.localeCompare(b.data));
  let atual: { m: Marca; inicio: string; fim: string } | null = null;
  const fecharNova = () => {
    if (atual) eventos.push({ tipo: atual.m.tipo, inicio: atual.inicio, fim: atual.fim, descricao: atual.m.descricao, suspendeAulas: atual.m.suspendeAulas, imprevisto: atual.m.imprevisto, motivo: atual.m.motivo });
    atual = null;
  };
  for (const x of novas) {
    const m = x.marca!;
    if (atual && chaveMarca(atual.m) === chaveMarca(m) && somarDiasISO(atual.fim, 1) === x.data) atual.fim = x.data;
    else {
      fecharNova();
      atual = { m, inicio: x.data, fim: x.data };
    }
  }
  fecharNova();
  eventos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.tipo.localeCompare(b.tipo));
  const extras = new Map(i.extras.map((x) => [x.data, { diaReferente: x.diaReferente, observacao: x.observacao }] as const));
  for (const x of edicoes) {
    if (x.extra) extras.set(x.data, x.extra);
    else extras.delete(x.data);
  }
  return { eventos, extras: [...extras].map(([data, x]) => ({ data, ...x })).sort((a, b) => a.data.localeCompare(b.data)), etapas: i.etapas, semestres: i.semestres };
}

export const MAXIMO_DE_EDICOES = 800;

/** Confere o que veio da tela: tipos, datas do ano, motivo da suspensão e dia de referência dos fins de semana letivos. */
export function validarEdicoes(bruto: unknown, ano: number, motivosValidos: readonly string[]): { ok: true; edicoes: EdicaoDia[] } | { ok: false; erro: string } {
  if (!Array.isArray(bruto)) return { ok: false, erro: 'Edições inválidas. Recarregue a página.' };
  if (bruto.length === 0) return { ok: false, erro: 'Nenhuma alteração para salvar.' };
  if (bruto.length > MAXIMO_DE_EDICOES) return { ok: false, erro: `Muitas alterações de uma vez (máximo ${MAXIMO_DE_EDICOES} dias). Salve em partes.` };
  const edicoes: EdicaoDia[] = [];
  const vistas = new Set<string>();
  for (const item of bruto as Record<string, unknown>[]) {
    const data = typeof item?.data === 'string' ? item.data : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`)) || new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data) return { ok: false, erro: 'Data inválida nas alterações.' };
    if (!data.startsWith(`${ano}-`)) return { ok: false, erro: `Só é possível alterar dias de ${ano} nesta tela.` };
    if (vistas.has(data)) return { ok: false, erro: 'Dia repetido nas alterações.' };
    vistas.add(data);
    let marca: Marca | null = null;
    const m = item.marca as Record<string, unknown> | null | undefined;
    if (m) {
      if (typeof m.tipo !== 'string' || !ehTipoDoEditor(m.tipo)) return { ok: false, erro: 'Tipo de marcação inválido.' };
      const descricao = typeof m.descricao === 'string' ? m.descricao.trim() : '';
      if (descricao.length > 120) return { ok: false, erro: 'O rótulo pode ter até 120 caracteres.' };
      const motivo = typeof m.motivo === 'string' ? m.motivo : '';
      if (m.tipo === 'SUSPENSAO_AULAS' && !motivosValidos.includes(motivo)) return { ok: false, erro: 'Escolha o motivo da suspensão.' };
      marca = {
        tipo: m.tipo,
        descricao,
        suspendeAulas: SEMPRE_NAO_LETIVO.includes(m.tipo) ? true : Boolean(m.suspendeAulas),
        imprevisto: m.tipo === 'SUSPENSAO_AULAS' ? Boolean(m.imprevisto) : false,
        motivo: m.tipo === 'SUSPENSAO_AULAS' ? motivo : '',
      };
    }
    let extra: DiaExtra | null = null;
    const x = item.extra as Record<string, unknown> | null | undefined;
    if (x) {
      const dia = Number(x.diaReferente);
      if (![0, 6].includes(diaDaSemanaISO(data))) return { ok: false, erro: 'Só sábado e domingo podem ser letivos.' };
      if (!Number.isInteger(dia) || dia < 1 || dia > 5) return { ok: false, erro: 'Escolha o dia da semana cuja grade vale no fim de semana letivo.' };
      const observacao = typeof x.observacao === 'string' ? x.observacao.trim().slice(0, 200) : '';
      extra = { diaReferente: dia, observacao };
    }
    edicoes.push({ data, marca, extra });
  }
  return { ok: true, edicoes };
}
