import 'server-only';
import ExcelJS from 'exceljs';
import { LINHAS_MAXIMAS, TAMANHO_MAXIMO_ARQUIVO, gerarCsv, lerCsv, montarTabela, type Tabela } from './tabela';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Lê o arquivo enviado (.csv ou .xlsx) e devolve a tabela, ou uma mensagem de erro em português.
 * CSV salvo pelo Excel como "CSV (separado por vírgulas)" vem em Windows-1252: detectado e convertido.
 */
export async function lerArquivo(arquivo: FormDataEntryValue | null): Promise<Tabela | { erro: string }> {
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha um arquivo .xlsx ou .csv para enviar.' };
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) return { erro: 'O arquivo passa de 1 MB. Divida a planilha em partes menores.' };
  const nome = arquivo.name.toLowerCase();
  const bytes = Buffer.from(await arquivo.arrayBuffer());

  let tabela: Tabela;
  if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
    let texto = new TextDecoder('utf-8').decode(bytes);
    if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(bytes);
    tabela = lerCsv(texto);
  } else if (nome.endsWith('.xlsx')) {
    try {
      const lida = await lerXlsx(bytes);
      if ('erro' in lida) return lida;
      tabela = lida;
    } catch {
      return { erro: 'Não foi possível ler a planilha. Salve-a como .xlsx (Excel ou LibreOffice) ou como .csv e tente de novo.' };
    }
  } else {
    return { erro: 'Formato não aceito. Envie um arquivo .xlsx ou .csv (o modelo para baixar está nesta página).' };
  }

  if (tabela.cabecalho.every((c) => c === '')) return { erro: 'A planilha está vazia ou sem a linha de títulos das colunas.' };
  if (tabela.linhas.length === 0) return { erro: 'A planilha não tem nenhuma linha de dados abaixo dos títulos.' };
  if (tabela.linhas.length > LINHAS_MAXIMAS) return { erro: `A planilha tem ${tabela.linhas.length} linhas; o máximo é ${LINHAS_MAXIMAS} por envio.` };
  return tabela;
}

/** Primeira aba com dados (a aba "Instruções" do modelo é ignorada). Usa o texto exibido de cada célula. */
async function lerXlsx(bytes: Buffer): Promise<Tabela | { erro: string }> {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(bytes as unknown as ArrayBuffer);
  const aba = livro.worksheets.find((a) => !/instru/i.test(a.name) && a.actualRowCount > 0) ?? livro.worksheets[0];
  if (!aba) return { cabecalho: [], linhas: [] };
  // actualRowCount conta só linhas com conteúdo (rowCount inclui as apenas formatadas).
  if (aba.actualRowCount > LINHAS_MAXIMAS + 1) {
    return { erro: `A planilha tem mais de ${LINHAS_MAXIMAS} linhas; o máximo é ${LINHAS_MAXIMAS} por envio.` };
  }
  const colunas = Math.min(aba.actualColumnCount, 50);
  // Mantém a numeração da planilha: linhas vazias no meio viram registros vazios (descartados depois).
  const registros: string[][] = [];
  aba.eachRow({ includeEmpty: false }, (linha, numero) => {
    while (registros.length < numero - 1) registros.push([]);
    registros.push(Array.from({ length: colunas }, (_, c) => textoDaCelula(linha.getCell(c + 1))));
  });
  return montarTabela(registros);
}

function textoDaCelula(celula: ExcelJS.Cell): string {
  const v = celula.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Hiperlink, texto rico ou fórmula: o texto exibido.
  return celula.text ?? '';
}

export interface ColunaModelo {
  titulo: string;
  largura: number;
  /** Lista suspensa no Excel (validação de dados). */
  opcoes?: readonly string[];
}

/** Planilha-modelo .xlsx: aba "Dados" (títulos em destaque, linha congelada, listas) + aba "Instruções". */
export async function gerarXlsx(params: {
  colunas: readonly ColunaModelo[];
  linhas: readonly (readonly string[])[];
  instrucoes: readonly string[];
}): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = 'SGC-Redes';
  const dados = livro.addWorksheet('Dados', { views: [{ state: 'frozen', ySplit: 1 }] });
  dados.columns = params.colunas.map((c) => ({ header: c.titulo, width: c.largura }));
  const cabecalho = dados.getRow(1);
  cabecalho.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecalho.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E6E2E' } };
  // Texto puro (nunca fórmula): o valor vai como string.
  params.linhas.forEach((l) => dados.addRow([...l]));
  const ultimaLinha = Math.max(params.linhas.length + 1, 200);
  params.colunas.forEach((c, i) => {
    if (!c.opcoes) return;
    for (let r = 2; r <= ultimaLinha; r++) {
      dados.getCell(r, i + 1).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${c.opcoes.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Valor não aceito',
        error: `Use: ${c.opcoes.join(', ')}`,
      };
    }
  });
  const instrucoes = livro.addWorksheet('Instruções');
  instrucoes.getColumn(1).width = 110;
  params.instrucoes.forEach((t, i) => {
    const celula = instrucoes.getCell(i + 1, 1);
    celula.value = t;
    celula.alignment = { wrapText: true, vertical: 'top' };
    if (i === 0) celula.font = { bold: true, size: 14 };
  });
  return Buffer.from(await livro.xlsx.writeBuffer());
}

/** Resposta HTTP de download do modelo em .xlsx ou .csv. */
export async function respostaModelo(params: {
  formato: string | null;
  nomeArquivo: string;
  colunas: readonly ColunaModelo[];
  linhas: readonly (readonly string[])[];
  instrucoes: readonly string[];
}): Promise<Response> {
  const cabecalhos = (tipo: string, ext: string) => ({
    'Content-Type': tipo,
    'Content-Disposition': `attachment; filename="${params.nomeArquivo}.${ext}"`,
    'Cache-Control': 'no-store',
  });
  if (params.formato === 'csv') {
    const csv = gerarCsv(params.colunas.map((c) => c.titulo), params.linhas);
    return new Response(csv, { headers: cabecalhos('text/csv; charset=utf-8', 'csv') });
  }
  const xlsx = await gerarXlsx(params);
  return new Response(new Uint8Array(xlsx), { headers: cabecalhos(MIME_XLSX, 'xlsx') });
}
