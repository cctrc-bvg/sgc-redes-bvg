/**
 * Política de migrações seguras (atualização sem perda de dados; docs/IMPLANTACAO.md, seção 8).
 *
 * Toda mudança de esquema segue "expandir → migrar dados → contrair", em versões separadas: primeiro só acrescenta
 * (tabela, coluna anulável ou com padrão, índice); o código novo passa a usar o que foi acrescentado; só numa versão
 * seguinte, com backup e ensaio, remove o que ficou sem uso. Assim, a versão anterior do app continua funcionando
 * sobre o banco já migrado (dá para voltar atrás sem restaurar backup).
 *
 * Esta checagem roda nos testes (e no CI): uma migração nova com comando destrutivo só passa se trouxer a linha
 * `-- sgc:destrutiva-aprovada: <motivo e referência do backup/ensaio>`.
 */

/** Migrações anteriores à política (feitas antes da produção). As novas são checadas. */
export const ULTIMA_MIGRACAO_ANTERIOR_A_POLITICA = '20261125120000_docencia_acumulada';

export const MARCA_APROVADA = '-- sgc:destrutiva-aprovada:';

const DESTRUTIVOS: readonly { padrao: RegExp; motivo: string }[] = [
  { padrao: /\bDROP\s+TABLE\b/i, motivo: 'apaga uma tabela' },
  { padrao: /\bDROP\s+COLUMN\b/i, motivo: 'apaga uma coluna' },
  { padrao: /\bRENAME\b/i, motivo: 'renomeia (a versão anterior do app deixa de achar o nome antigo)' },
  { padrao: /\bALTER\s+COLUMN\b[^;]*\b(SET\s+DATA\s+)?TYPE\b/i, motivo: 'muda o tipo de uma coluna' },
  { padrao: /\bSET\s+NOT\s+NULL\b/i, motivo: 'torna obrigatória uma coluna (falha se houver linha vazia)' },
  { padrao: /\bDROP\s+TYPE\b/i, motivo: 'apaga um tipo (enum)' },
  { padrao: /\bTRUNCATE\b/i, motivo: 'esvazia uma tabela' },
  { padrao: /\bDELETE\s+FROM\b/i, motivo: 'apaga linhas' },
];

/** Tira comentários de linha para não acusar texto explicativo. */
const semComentarios = (sql: string) =>
  sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

export interface ProblemaMigracao {
  migracao: string;
  motivo: string;
}

/** Problemas de uma migração nova (vazio = segura ou aprovada). */
export function analisarMigracao(nome: string, sql: string): ProblemaMigracao[] {
  if (nome <= ULTIMA_MIGRACAO_ANTERIOR_A_POLITICA) return [];
  if (sql.includes(MARCA_APROVADA)) return [];
  const corpo = semComentarios(sql);
  const problemas = DESTRUTIVOS.filter((d) => d.padrao.test(corpo)).map((d) => ({ migracao: nome, motivo: d.motivo }));
  // Coluna nova obrigatória sem valor padrão: falha (ou exige apagar dados) numa tabela que já tem linhas.
  const obrigatoriaSemPadrao = corpo
    .split(/[;,]/)
    .some((trecho) => /\bADD\s+COLUMN\b/i.test(trecho) && /\bNOT\s+NULL\b/i.test(trecho) && !/\bDEFAULT\b/i.test(trecho));
  if (obrigatoriaSemPadrao) problemas.push({ migracao: nome, motivo: 'acrescenta coluna obrigatória sem valor padrão (falha em tabela com dados)' });
  return problemas;
}
