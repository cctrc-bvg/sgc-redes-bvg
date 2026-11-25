/**
 * Papel de uma ação para quem acumula a docência a outro cargo: verde para o cargo (Coordenação, Direção, CTP, AE),
 * azul para a docência. A cor nunca vem sozinha: o selo escrito diz o papel (WCAG 1.4.1).
 */
export type Papel = 'cargo' | 'docencia';

export const ESTILO_PAPEL: Record<Papel, { selo: string; icone: string; botao: string; link: string; borda: string }> = {
  cargo: {
    selo: 'bg-if-verde-50 text-if-verde-800',
    icone: 'bg-if-verde-50 text-if-verde-800',
    botao: 'bg-if-verde-700 hover:bg-if-verde-800',
    link: 'text-if-verde-700 hover:text-if-verde-800',
    borda: 'border-if-verde-700',
  },
  docencia: {
    selo: 'bg-docencia-50 text-docencia-800',
    icone: 'bg-docencia-50 text-docencia-800',
    botao: 'bg-docencia-700 hover:bg-docencia-800',
    link: 'text-docencia-700 hover:text-docencia-800',
    borda: 'border-docencia-700',
  },
};

/** Selo "Docência" ou com o nome do cargo ("Coordenação", "Direção"...). */
export function SeloPapel({ papel, cargo, className = '' }: { papel: Papel; cargo: string; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_PAPEL[papel].selo} ${className}`}>
      {papel === 'docencia' ? 'Docência' : cargo}
    </span>
  );
}
