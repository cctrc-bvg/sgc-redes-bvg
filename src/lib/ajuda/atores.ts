/**
 * Tipo de quem faz uma etapa dos fluxos (Ajuda, manual e docs/FLUXOS.md): dá a cor do diagrama. Gestão em verde,
 * docência em azul (as mesmas cores da tela de quem acumula os dois), sistema em cinza, setores em âmbar.
 */
export type TipoAtor = 'gestao' | 'docencia' | 'sistema' | 'setor' | 'todos';

export function tipoDeAtor(ator: string): TipoAtor {
  const a = ator.toLocaleLowerCase('pt-BR');
  if (a.startsWith('sistema')) return 'sistema';
  if (/professor|docente/.test(a)) return 'docencia';
  if (/coordena|dire[cç][aã]o|ctp/.test(a)) return 'gestao';
  if (/assist[eê]ncia|cae|setor|interessado|nutricion/.test(a)) return 'setor';
  return 'todos';
}
