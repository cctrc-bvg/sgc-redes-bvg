import * as z from 'zod';

export const SENHA_TAMANHO_MINIMO = 10;

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: 'Informe seu e-mail institucional.' })
    .pipe(z.email({ error: 'Informe um e-mail válido (ex.: nome@ifce.edu.br).' })),
  senha: z.string().min(1, { error: 'Informe sua senha.' }),
});

/** Política de senha (ARQUITETURA_LGPD.md, item 5). Mensagens dizem o que corrigir (Nielsen #9). */
export const NovaSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, { error: 'Informe sua senha atual.' }),
    novaSenha: z
      .string()
      .min(SENHA_TAMANHO_MINIMO, { error: `Use pelo menos ${SENHA_TAMANHO_MINIMO} caracteres.` })
      .max(72, { error: 'Use no máximo 72 caracteres.' }) // limite do bcrypt
      .regex(/[A-Za-zÀ-ÿ]/, { error: 'Inclua pelo menos uma letra.' })
      .regex(/[0-9]/, { error: 'Inclua pelo menos um número.' }),
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    error: 'A confirmação não é igual à nova senha.',
    path: ['confirmacao'],
  })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    error: 'A nova senha deve ser diferente da atual.',
    path: ['novaSenha'],
  });

/**
 * Aceita apenas caminhos internos para redirecionar após o login,
 * evitando redirecionamento aberto (ex.: "//site-malicioso.com" ou "https://...").
 */
export function destinoSeguro(destino: unknown, padrao = '/painel'): string {
  if (typeof destino !== 'string') return padrao;
  if (!destino.startsWith('/') || destino.startsWith('//') || destino.startsWith('/\\')) return padrao;
  if (destino.startsWith('/login')) return padrao;
  return destino;
}
