import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { COLUNAS, NOME_COLUNA, NOME_TIPO, TIPOS } from '@/lib/processos/regras';
import { FormularioProcesso } from '../formularios';

export const metadata: Metadata = { title: 'Novo processo — SGC-Redes' };

export default async function PaginaNovoProcesso() {
  const { usuario } = await exigirPermissao('kanban:gerenciar');
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/processos" className="text-if-verde-700 underline underline-offset-2">Processos</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Novo item</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Novo processo ou atendimento</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioProcesso
          tipos={TIPOS.map((t) => ({ valor: t, rotulo: NOME_TIPO[t] }))}
          colunas={COLUNAS.map((c) => ({ valor: c, rotulo: NOME_COLUNA[c] }))}
          podeSigilo={temPermissao(usuario.role, 'kanban:ver-sigiloso')}
        />
      </div>
    </div>
  );
}
