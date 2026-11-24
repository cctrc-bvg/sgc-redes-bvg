import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioModelo } from '../formulario-modelo';

export const metadata: Metadata = { title: 'Novo texto-padrão — SGC-Redes' };

export default async function PaginaNovoModelo() {
  await exigirPermissao('comunicacao:enviar');
  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/comunicacao/modelos" className="text-if-verde-700 underline underline-offset-2">
          Textos-padrão
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Novo</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Novo texto-padrão</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioModelo inicial={{ tipo: 'comunicado', rotulo: '', assunto: '[SGC-Redes] ', texto: 'Prezados(as) {{destinatarios}},\n\n', destinos: [] }} />
      </div>
    </div>
  );
}
