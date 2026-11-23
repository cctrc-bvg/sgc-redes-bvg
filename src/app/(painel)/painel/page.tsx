import type { Metadata } from 'next';
import { Alerta } from '@/components/campo';
import { exigirUsuario } from '@/lib/auth/dal';
import { modulosDoPerfil } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'Início — SGC-Redes' };

export default async function PaginaPainel({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirUsuario();
  const { aviso } = await searchParams;
  const modulos = modulosDoPerfil(usuario.role);
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
            <p className="mt-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                <span aria-hidden="true">🛠</span> Em desenvolvimento · Fase {m.fase}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
