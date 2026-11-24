import { useState } from 'react';

/**
 * Número que muda a cada resposta de uma Server Action (identidade nova do estado do `useActionState`).
 *
 * Use como `key` do `<form>` quando ele tiver `<select>` ou campos controlados: depois da ação o React 19 limpa o
 * formulário e devolve cada `<select>` à opção marcada na primeira renderização, sem o valor que o usuário escolheu
 * (e um campo controlado fica com o estado diferente do que aparece na tela). Recriar o formulário aplica de novo
 * os valores devolvidos pela ação.
 */
export function useVersaoDoEstado(estado: unknown): number {
  const [atual, setAtual] = useState({ estado, versao: 0 });
  if (atual.estado !== estado) {
    const nova = { estado, versao: atual.versao + 1 };
    setAtual(nova);
    return nova.versao;
  }
  return atual.versao;
}
