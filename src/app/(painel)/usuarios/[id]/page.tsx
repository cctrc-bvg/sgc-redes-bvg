import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { formatarWhatsapp } from '@/lib/usuarios/regras';
import { FormularioUsuario } from '../formulario-usuario';

export const metadata: Metadata = { title: 'Editar usuário — SGC-Redes' };

export default async function PaginaEditarUsuario({ params }: { params: Promise<{ id: string }> }) {
  const { usuario: editor } = await exigirPermissao('usuarios:gerenciar');
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) notFound();
  const proprio = u.id === editor.id;

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/usuarios" className="text-if-verde-700 underline underline-offset-2">Usuários</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{u.nome}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{u.nome}</h1>

      <section aria-labelledby="dados" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="dados" className="mb-4 text-lg font-semibold text-slate-900">Dados e acesso</h2>
        <FormularioUsuario
          modo="editar"
          usuarioId={u.id}
          proprio={proprio}
          iniciais={{
            nome: u.nome,
            email: u.email,
            role: u.role,
            siape: u.siape ?? '',
            whatsapp: formatarWhatsapp(u.whatsapp),
            ativo: u.ativo,
            leciona: u.leciona,
          }}
        />
      </section>

      {!proprio && u.ativo && (
        <section aria-labelledby="senha" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="senha" className="text-lg font-semibold text-slate-900">Senha</h2>
          <p className="mt-1 text-sm text-slate-700">Se a pessoa esqueceu a senha, gere uma nova senha provisória.</p>
          <Link
            href={`/usuarios/${u.id}/senha`}
            className="mt-3 inline-flex min-h-11 items-center rounded-md border border-slate-400 px-4 font-semibold text-slate-800 hover:bg-slate-100"
          >
            Redefinir senha
          </Link>
        </section>
      )}
    </div>
  );
}
