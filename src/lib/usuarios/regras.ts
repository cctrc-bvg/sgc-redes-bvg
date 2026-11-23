import { randomInt } from 'node:crypto';
import type { Role } from '@prisma/client';
import * as z from 'zod';
import { PERFIS } from '@/lib/auth/rbac';

const textoOpcional = (schema: z.ZodType<string>) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

/** Dados do formulário de usuário (criação e edição). */
export const UsuarioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, { error: 'Informe o nome completo.' })
    .max(120, { error: 'Use no máximo 120 caracteres.' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: 'Informe o e-mail.' })
    .pipe(z.email({ error: 'Informe um e-mail válido (ex.: nome@ifce.edu.br).' })),
  role: z.enum(PERFIS as [Role, ...Role[]], { error: 'Escolha um perfil.' }),
  siape: textoOpcional(
    z
      .string()
      .trim()
      .regex(/^\d{7}$/, { error: 'A matrícula SIAPE tem 7 dígitos (somente números).' }),
  ),
  // Guardado só com dígitos, com DDI 55 (ex.: 5588999998888).
  whatsapp: textoOpcional(
    z
      .string()
      .transform((v) => v.replace(/\D/g, ''))
      .transform((d) => (d.length === 10 || d.length === 11 ? `55${d}` : d))
      .pipe(z.string().regex(/^55\d{10,11}$/, { error: 'Informe DDD + número (ex.: (88) 99999-8888).' })),
  ),
});

export type DadosUsuario = z.infer<typeof UsuarioSchema>;

// Sem caracteres ambíguos (0/O, 1/l/I) para ditar a senha por telefone ou WhatsApp.
const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const NUMEROS = '23456789';

/**
 * Senha provisória legível no formato "xxxx-xxxx-xxxx" (12 caracteres úteis),
 * sempre com letras e números, atendendo à política de senha.
 */
export function gerarSenhaProvisoria(): string {
  const todos = LETRAS + NUMEROS;
  const chars = Array.from({ length: 12 }, () => todos[randomInt(todos.length)]);
  chars[randomInt(12)] = NUMEROS[randomInt(NUMEROS.length)];
  let posLetra = randomInt(12);
  while (NUMEROS.includes(chars[posLetra])) posLetra = (posLetra + 1) % 12;
  if (!LETRAS.includes(chars[posLetra])) chars[posLetra] = LETRAS[randomInt(LETRAS.length)];
  const s = chars.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** Formata o WhatsApp guardado (5588999998888) para exibição: (88) 99999-8888. */
export function formatarWhatsapp(digitos: string | null | undefined): string {
  if (!digitos) return '';
  const d = digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

/**
 * Impede que a Coordenação se tranque fora do sistema: ninguém altera o próprio perfil
 * ou desativa a própria conta, e sempre resta ao menos um coordenador ativo.
 * Retorna a mensagem de erro, ou null se a alteração é permitida.
 */
export function verificarAlteracao(params: {
  editorId: string;
  alvoId: string;
  perfilAtual: Role;
  ativoAtual: boolean;
  novoPerfil: Role;
  novoAtivo: boolean;
  coordenadoresAtivos: number;
}): string | null {
  const { editorId, alvoId, perfilAtual, ativoAtual, novoPerfil, novoAtivo, coordenadoresAtivos } = params;
  const proprio = editorId === alvoId;

  if (proprio && !novoAtivo) return 'Você não pode desativar a sua própria conta.';
  if (proprio && novoPerfil !== perfilAtual) return 'Você não pode alterar o seu próprio perfil. Peça a outro coordenador.';

  const eraCoordenadorAtivo = perfilAtual === 'COORDENADOR' && ativoAtual;
  const continuaCoordenadorAtivo = novoPerfil === 'COORDENADOR' && novoAtivo;
  if (eraCoordenadorAtivo && !continuaCoordenadorAtivo && coordenadoresAtivos <= 1) {
    return 'É preciso manter pelo menos um coordenador ativo no sistema.';
  }
  return null;
}
