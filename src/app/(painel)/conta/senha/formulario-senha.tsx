'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alerta, BotaoPrimario, Campo } from '@/components/campo';
import { SENHA_TAMANHO_MINIMO } from '@/lib/auth/validacao';
import { trocarSenha } from './actions';

export function FormularioSenha() {
  const [estado, acao, enviando] = useActionState(trocarSenha, undefined);

  if (estado?.sucesso) {
    return (
      <div className="space-y-4">
        <Alerta tipo="sucesso">Senha alterada. As sessões abertas em outros dispositivos foram encerradas.</Alerta>
        <Link
          href="/painel"
          className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800"
        >
          Ir para o início
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-5" noValidate>
      <Campo id="senhaAtual" rotulo="Senha atual" type="password" autoComplete="current-password" required erros={estado?.erros?.senhaAtual} />
      <Campo
        id="novaSenha"
        rotulo="Nova senha"
        dica={`Pelo menos ${SENHA_TAMANHO_MINIMO} caracteres, com letras e números.`}
        type="password"
        autoComplete="new-password"
        required
        minLength={SENHA_TAMANHO_MINIMO}
        erros={estado?.erros?.novaSenha}
      />
      <Campo id="confirmacao" rotulo="Confirme a nova senha" type="password" autoComplete="new-password" required erros={estado?.erros?.confirmacao} />
      <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</BotaoPrimario>
    </form>
  );
}
