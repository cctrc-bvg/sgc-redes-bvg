'use client';

import { useActionState } from 'react';
import { CampoTelefone } from '@/components/campo-telefone';
import { Alerta, BotaoPrimario, Campo } from '@/components/campo';
import { salvarContato, type EstadoContato } from './actions';

export function FormularioContato({ whatsapp, usaWhatsapp }: { whatsapp: string; usaWhatsapp: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoContato | undefined, FormData>(salvarContato, undefined);
  const v = estado?.valores;
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <div className="flex items-start gap-3">
        <input id="usaWhatsapp" name="usaWhatsapp" type="checkbox" defaultChecked={v ? v.usaWhatsapp : usaWhatsapp} className="mt-1 size-5 accent-if-verde-700" />
        <label htmlFor="usaWhatsapp" className="text-slate-800">
          Usar meu WhatsApp no sistema
          <span className="block text-sm text-slate-600">
            Desmarcado: as mensagens para você só oferecem o e-mail institucional, e você não vê botões de WhatsApp ao comunicar.
          </span>
        </label>
      </div>
      <CampoTelefone
        id="whatsapp"
        rotulo="WhatsApp (opcional)"
        autoComplete="tel"
        defaultValue={v?.whatsapp ?? whatsapp}
        erros={estado?.erros?.whatsapp ? [estado.erros.whatsapp] : undefined}
        dica="DDD + número. Deixe vazio para não informar."
      />
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar preferência'}</BotaoPrimario>
      </div>
    </form>
  );
}
