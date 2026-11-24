/**
 * Utilitários puros para importação em lote: leitura de CSV, normalização de cabeçalhos e valores
 * e geração de CSV seguro. A leitura de .xlsx fica em `planilha.ts` (servidor).
 */

/** Limites para não sobrecarregar o servidor (4 GB de RAM) nem a Server Action (corpo de 2 MB). */
export const TAMANHO_MAXIMO_ARQUIVO = 1024 * 1024; // 1 MB
export const LINHAS_MAXIMAS = 500;

export interface Tabela {
  cabecalho: string[];
  /** Linhas de dados (sem o cabeçalho), já sem linhas totalmente vazias. */
  linhas: { numero: number; celulas: string[] }[];
}

/** "Carga Horária (h)" → "carga_horaria_h": minúsculas, sem acento, separador "_". */
export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Detecta o separador pela primeira linha: ";" (Excel em português) ou ",". */
/** Ponto e vírgula (Excel em português), vírgula ou tabulação ("Texto separado por tabulações" salvo como .csv). */
function detectarSeparador(primeiraLinha: string): ';' | ',' | '\t' {
  const contar = (c: string) => primeiraLinha.split(c).length - 1;
  const [melhor] = ([';', '\t', ','] as const).map((c) => [c, contar(c)] as const).sort((a, b) => b[1] - a[1]);
  return melhor[1] > 0 ? melhor[0] : ';';
}

/**
 * Lê CSV (RFC 4180): aspas duplas, aspas escapadas ("") e quebras de linha dentro de aspas.
 * Remove o BOM do UTF-8 que o Excel grava. Linhas totalmente vazias são descartadas.
 */
export function lerCsv(conteudo: string): Tabela {
  const texto = conteudo.replace(/^﻿/, '');
  const sep = detectarSeparador(texto.split(/\r?\n/, 1)[0] ?? '');
  const registros: string[][] = [];
  let campo = '';
  let registro: string[] = [];
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"' && campo === '') {
      entreAspas = true;
    } else if (c === sep) {
      registro.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || registro.length > 0) {
    registro.push(campo);
    registros.push(registro);
  }
  return montarTabela(registros);
}

/** Separa cabeçalho e dados, numerando as linhas como na planilha (cabeçalho = linha 1). */
export function montarTabela(registros: string[][]): Tabela {
  const [cabecalho = [], ...dados] = registros;
  return {
    cabecalho: cabecalho.map((c) => c.trim()),
    linhas: dados
      .map((celulas, i) => ({ numero: i + 2, celulas: celulas.map((c) => c.trim()) }))
      .filter((l) => l.celulas.some((c) => c !== '')),
  };
}

/**
 * Converte as linhas em objetos {campo: valor} usando os apelidos aceitos para cada coluna.
 * Retorna as colunas obrigatórias ausentes (pelo nome amigável) e as colunas desconhecidas.
 */
export function mapearColunas<C extends string>(
  tabela: Tabela,
  colunas: readonly { campo: C; titulo: string; apelidos: readonly string[]; obrigatoria?: boolean }[],
): { registros: { numero: number; valores: Record<C, string> }[]; faltando: string[]; desconhecidas: string[]; presentes: Set<C> } {
  const indice = new Map<C, number>();
  const desconhecidas: string[] = [];
  tabela.cabecalho.forEach((titulo, i) => {
    const norm = normalizarCabecalho(titulo);
    if (!norm) return;
    const coluna = colunas.find((c) => [c.campo, c.titulo, ...c.apelidos].some((a) => normalizarCabecalho(a) === norm));
    if (coluna && !indice.has(coluna.campo)) indice.set(coluna.campo, i);
    else if (!coluna) desconhecidas.push(titulo);
  });
  const faltando = colunas.filter((c) => c.obrigatoria && !indice.has(c.campo)).map((c) => c.titulo);
  const registros = tabela.linhas.map((l) => ({
    numero: l.numero,
    valores: Object.fromEntries(colunas.map((c) => [c.campo, indice.has(c.campo) ? (l.celulas[indice.get(c.campo)!] ?? '') : ''])) as Record<
      C,
      string
    >,
  }));
  return { registros, faltando, desconhecidas, presentes: new Set(indice.keys()) };
}

/** "Sim", "s", "x", "1", "verdadeiro" → true; vazio, "Não", "n", "0" → false; outro → null (inválido). */
export function lerSimNao(valor: string): boolean | null {
  const v = normalizarCabecalho(valor);
  if (['sim', 's', 'x', '1', 'true', 'verdadeiro', 'yes', 'y'].includes(v)) return true;
  if (['', 'nao', 'n', '0', 'false', 'falso', 'no'].includes(v)) return false;
  return null;
}

/**
 * Evita injeção de fórmula ao abrir o CSV no Excel/LibreOffice: célula que começa com = + - @ ou
 * tabulação ganha um apóstrofo na frente.
 */
export function celulaSegura(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

/** CSV com ";" e BOM, que o Excel em português abre com acentos e colunas certas. */
export function gerarCsv(cabecalho: readonly string[], linhas: readonly (readonly string[])[]): string {
  const escapar = (v: string) => {
    const s = celulaSegura(v);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(escapar).join(';')).join('\r\n') + '\r\n';
}
