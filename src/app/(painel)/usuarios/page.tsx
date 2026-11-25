import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkExportar } from '@/components/barra-impressao';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { NOME_PERFIL } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'Usuários — SGC-Redes' };

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' });

export default async function PaginaUsuarios() {
  await exigirPermissao('usuarios:gerenciar');
  const usuarios = await prisma.user.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: { id: true, nome: true, email: true, role: true, leciona: true, ativo: true, deveTrocarSenha: true, ultimoLoginEm: true },
  });
  const ativos = usuarios.filter((u) => u.ativo).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="mt-1 text-slate-700">
            {ativos} com acesso ativo{usuarios.length > ativos ? ` · ${usuarios.length - ativos} desativado(s)` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkExportar href="/exportar/usuarios" />
          <Link
            href="/usuarios/importar"
            className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100"
          >
            Importar planilha
          </Link>
          <Link href="/usuarios/novo" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Cadastrar usuário
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Usuários do sistema, com perfil, situação e último acesso</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Nome</th>
              <th scope="col" className="px-4 py-3 font-semibold">Perfil</th>
              <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              <th scope="col" className="px-4 py-3 font-semibold">Último acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id} className={u.ativo ? '' : 'bg-slate-50 text-slate-600'}>
                <th scope="row" className="px-4 py-3 font-normal">
                  <Link href={`/usuarios/${u.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                    {u.nome}
                  </Link>
                  <span className="block text-slate-600">{u.email}</span>
                </th>
                <td className="px-4 py-3">
                  {NOME_PERFIL[u.role]}
                  {u.leciona && u.role !== 'PROFESSOR' && <span className="ml-1 font-semibold text-docencia-800">+ Docência</span>}
                </td>
                <td className="px-4 py-3">
                  {!u.ativo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                      <span aria-hidden="true">⏸</span> Desativado
                    </span>
                  ) : u.deveTrocarSenha ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      <span aria-hidden="true">🔑</span> Senha provisória
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-if-verde-50 px-2.5 py-0.5 text-xs font-semibold text-if-verde-800">
                      <span aria-hidden="true">✔</span> Ativo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{u.ultimoLoginEm ? dataHora.format(u.ultimoLoginEm) : 'Nunca acessou'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
