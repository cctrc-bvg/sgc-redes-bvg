'use client';

import { useActionState } from 'react';
import { Alerta, BotaoSecundario } from '@/components/campo';
import { redefinirSenha, type EstadoUsuario } from './actions';
import { SenhaProvisoria } from './senha-provisoria';

export function FormularioRedefinirSenha({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const [estado, acao, enviando] = useActionState<EstadoUsuario | undefined, FormData>(redefinirSenha, undefined);

  if (estado?.sucesso && estado.senhaProvisoria) return <SenhaProvisoria senha={estado.senhaProvisoria} nome={nome} />;

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <p className="text-sm text-slate-700">
        Gera uma nova senha provisória e encerra as sessões abertas de {nome}. Use quando a pessoa esquecer a senha.
      </p>
      <div className="flex items-start gap-3">
        <input id="confirmo" name="confirmo" type="checkbox" required className="mt-1 size-5 accent-if-verde-700" />
        <label htmlFor="confirmo" className="text-sm text-slate-800">
          Confirmo que quero redefinir a senha de {nome}.
        </label>
      </div>
      <BotaoSecundario disabled={enviando}>{enviando ? 'Gerando…' : 'Redefinir senha'}</BotaoSecundario>
    </form>
  );
}
