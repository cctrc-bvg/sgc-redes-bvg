import { createHash, randomBytes } from 'node:crypto';

/** Token de sessão: 32 bytes aleatórios (256 bits), seguro para cookie. */
export function gerarTokenSessao(): string {
  return randomBytes(32).toString('base64url');
}

/** Identificador da sessão no banco: o banco nunca guarda o token em si. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
