import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterSessao } from '@/lib/auth/dal';
import { destinoSeguro } from '@/lib/auth/validacao';
import { FormularioLogin } from './formulario-login';

export const metadata: Metadata = { title: 'Entrar — SGC-Redes' };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo } = await searchParams;
  if (await obterSessao()) redirect(destinoSeguro(proximo));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b-4 border-if-verde bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <p className="text-xl font-bold text-if-verde-800">SGC-Redes</p>
          <p className="text-sm text-slate-600">IFCE · Campus Boa Viagem</p>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Entrar</h1>
        <p className="mt-1 mb-6 text-slate-700">Painel da Coordenação do Curso Técnico em Redes de Computadores.</p>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <FormularioLogin proximo={proximo ? destinoSeguro(proximo) : undefined} />
        </div>
      </main>
    </div>
  );
}
