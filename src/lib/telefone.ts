/**
 * Máscara de telefone brasileiro enquanto a pessoa digita: (88) 99999-8888 ou (88) 3333-4444.
 * Aceita o DDI 55 colado junto (ex.: "+55 88 99999-8888") e o descarta. O servidor valida de novo.
 */
export function mascararTelefone(digitado: string): string {
  let d = digitado.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  // Celular (9 dígitos) quebra em 5+4; fixo (8 dígitos), em 4+4.
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
