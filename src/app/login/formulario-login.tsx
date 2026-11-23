'use client';

import { useActionState } from 'react';
import { Alerta, BotaoPrimario, Campo } from '@/components/campo';
import { entrar } from './actions';

export function FormularioLogin({ proximo }: { proximo?: string }) {
  const [estado, acao, enviando] = useActionState(entrar, undefined);

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      {proximo && <input type="hidden" name="proximo" value={proximo} />}

      <Campo
        id="email"
        rotulo="E-mail institucional"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        defaultValue={estado?.email}
        erros={estado?.erros?.email}
        autoFocus
      />
      <Campo
        id="senha"
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        required
        erros={estado?.erros?.senha}
      />

      <BotaoPrimario carregando={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</BotaoPrimario>

      <p className="text-sm text-slate-600">
        Esqueceu a senha ou ainda não tem acesso? Fale com a Coordenação do curso.
      </p>
    </form>
  );
}
