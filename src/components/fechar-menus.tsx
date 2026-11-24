'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SELETOR = 'details[data-menu-cabecalho]';

/**
 * Complemento dos menus <details> do cabeçalho (que funcionam sem JavaScript): fecha os menus ao
 * navegar, ao clicar fora, ao escolher um item e com a tecla Esc.
 */
export function FecharMenus() {
  const caminho = usePathname();

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>(SELETOR).forEach((d) => (d.open = false));
  }, [caminho]);

  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Element | null;
      document.querySelectorAll<HTMLDetailsElement>(SELETOR).forEach((d) => {
        if (!d.open) return;
        const dentro = alvo ? d.contains(alvo) : false;
        // Clique num item do menu também fecha (a navegação no cliente não recarrega o cabeçalho).
        if (!dentro || alvo?.closest('a')) d.open = false;
      });
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll<HTMLDetailsElement>(SELETOR).forEach((d) => {
        if (d.open) {
          d.open = false;
          d.querySelector('summary')?.focus();
        }
      });
    };
    document.addEventListener('click', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('click', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  return null;
}
