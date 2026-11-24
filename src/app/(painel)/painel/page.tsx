import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { exigirUsuario } from '@/lib/auth/dal';
import { modulosDoPerfil } from '@/lib/auth/rbac';
import { pendenciasDoPainel } from '@/lib/painel-pendencias';

export const metadata: Metadata = { title: 'Início — SGC-Redes' };

export default async function PaginaPainel({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirUsuario();
  const { aviso } = await searchParams;
  const modulos = modulosDoPerfil(usuario.role);
  const pendencias = await pendenciasDoPainel(usuario);
  const primeiroNome = usuario.nome.split(' ')[0];

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Olá, {primeiroNome}</h1>
      <p className="mt-1 text-slate-700">Estes são os módulos disponíveis para o seu perfil.</p>

      {aviso === 'sem-permissao' && (
        <div className="mt-4">
          <Alerta tipo="erro">Seu perfil não tem acesso à página solicitada. Se precisar dela, fale com a Coordenação.</Alerta>
        </div>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => (
          <li key={m.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{m.titulo}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-700">{m.descricao}</p>
            {pendencias[m.id] && (
              <ul className="mt-3 space-y-1">
                {pendencias[m.id].map((p) => (
                  <li key={p} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    <span aria-hidden="true">⚠</span> {p}
                  </li>
                ))}
              </ul>
            )}
            {m.href ? (
              <Link
                href={m.href}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800"
              >
                Abrir<span className="sr-only"> {m.titulo}</span>
              </Link>
            ) : (
              <p className="mt-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  <span aria-hidden="true">🛠</span> Em desenvolvimento · Fase {m.fase}
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
