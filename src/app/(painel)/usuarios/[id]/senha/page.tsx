import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioRedefinirSenha } from '../../formulario-redefinir-senha';

export const metadata: Metadata = { title: 'Redefinir senha — SGC-Redes' };

export default async function PaginaRedefinirSenha({ params }: { params: Promise<{ id: string }> }) {
  const { usuario: editor } = await exigirPermissao('usuarios:gerenciar');
  const { id } = await params;
  if (id === editor.id) redirect('/conta/senha');
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true } });
  if (!u) notFound();

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/usuarios" className="text-if-verde-700 underline underline-offset-2">Usuários</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <Link href={`/usuarios/${u.id}`} className="text-if-verde-700 underline underline-offset-2">{u.nome}</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Redefinir senha</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Redefinir senha</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {u.ativo ? (
          <FormularioRedefinirSenha usuarioId={u.id} nome={u.nome.split(' ')[0]} />
        ) : (
          <p className="text-slate-700">Este acesso está desativado. Reative-o na página do usuário antes de gerar uma nova senha.</p>
        )}
      </div>
    </div>
  );
}
