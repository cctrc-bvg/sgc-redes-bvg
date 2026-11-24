'use client';

import type { ComponentProps } from 'react';
import { Campo } from '@/components/campo';
import { mascararTelefone } from '@/lib/telefone';

/** Campo de telefone com máscara automática "(88) 99999-8888". Sem JavaScript, aceita qualquer formato. */
export function CampoTelefone(props: Omit<ComponentProps<typeof Campo>, 'type' | 'inputMode' | 'onInput'>) {
  return (
    <Campo
      {...props}
      type="tel"
      inputMode="tel"
      maxLength={16}
      placeholder={props.placeholder ?? '(88) 99999-8888'}
      onInput={(e) => {
        const campo = e.currentTarget;
        campo.value = mascararTelefone(campo.value);
      }}
    />
  );
}
