import { Selecao } from '@/components/campo';

/** Por onde a mensagem foi enviada; sem a opção WhatsApp para quem desligou o WhatsApp no sistema. */
export function SeletorModo({ id, mostrarWhatsapp, erro }: { id: string; mostrarWhatsapp: boolean; erro?: string }) {
  return (
    <Selecao
      id={id}
      name="modo"
      rotulo="Enviado por"
      defaultValue="EMAIL_MANUAL"
      erros={erro ? [erro] : undefined}
      opcoes={[
        { valor: 'EMAIL_MANUAL', rotulo: 'E-mail' },
        ...(mostrarWhatsapp ? [{ valor: 'WHATSAPP_WEB_MANUAL', rotulo: 'WhatsApp' }] : []),
        { valor: 'OUTRO_MANUAL', rotulo: 'Outro meio (copiado e colado)' },
      ]}
    />
  );
}
