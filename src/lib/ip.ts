/**
 * IP de origem a partir dos cabeçalhos do proxy reverso. O app fica atrás de UM proxy (Caddy ou Nginx), que
 * acrescenta o endereço real de quem conectou ao FIM de X-Forwarded-For. O começo da lista pode ter sido escrito pelo
 * próprio cliente (e burlaria o limite de tentativas de login e falsificaria o IP da trilha de auditoria), então vale
 * o último valor. Com mais de um proxy na frente, ajuste `PROXY_SALTOS`.
 */
export function ipDeOrigem(forwardedFor: string | null, realIp: string | null, saltos = 1): string | null {
  const lista = (forwardedFor ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const n = Number.isInteger(saltos) && saltos >= 1 ? saltos : 1;
  const ip = lista.length ? lista[Math.max(0, lista.length - n)] : realIp?.trim();
  return ip && ip.length <= 64 ? ip : null;
}
