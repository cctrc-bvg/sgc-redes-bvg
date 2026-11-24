/** Tipos compartilhados entre as Server Actions de importação e o componente de tela (sem código de servidor). */

export interface LinhaResultado {
  numero: number;
  descricao: string;
  situacao: 'criar' | 'atualizar' | 'igual' | 'ignorar' | 'erro';
  detalhe?: string;
}

export interface EstadoImportacao {
  mensagem?: string;
  sucesso?: boolean;
  /** Prévia da planilha analisada. */
  linhas?: LinhaResultado[];
  /** Dados da prévia para a confirmação (revalidados no servidor; nunca confiáveis). */
  dados?: string;
  avisos?: string[];
  concluido?: boolean;
  /** Importação de usuários: senhas provisórias, exibidas uma única vez. */
  credenciais?: { nome: string; email: string; senha: string }[];
  credenciaisCsv?: string;
}
