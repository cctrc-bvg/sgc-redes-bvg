import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { formatarData } from '@/lib/ausencias/regras';
import { NOME_TIPO_PERIODO } from '@/lib/periodos/regras';
import { listarPeriodos } from '@/lib/periodos/servidor';
import { FormularioPeriodo } from './formularios';

export const metadata: Metadata = { title: 'Períodos especiais — SGC-Redes' };

export default async function PaginaPeriodos() {
  const { usuario } = await exigirPermissao('calendario:ver');
  const gerencia = temPermissao(usuario, 'calendario:gerenciar');
  const periodos = await listarPeriodos();
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Períodos especiais</h1>
      <p className="mt-1 max-w-3xl text-slate-700">
        Jogos internos, encontro dos servidores, Universo IFCE, semanas de cursos, encontros de extensão e de pesquisa e outros eventos mudam a rotina por alguns dias: parte da turma sai, alguns docentes se ausentam. Aqui a
        Coordenação cria o período, monta a <strong>grade temporária</strong> de cada turma, informa quantos estudantes ficam no campus e gera o
        <strong> resumo de refeições</strong> para a Assistência Estudantil e a nutricionista.
      </p>

      {periodos.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">Nenhum período especial cadastrado.</Alerta>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {periodos.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <Link href={`/periodos/${p.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2">{p.nome}</Link>
              <p className="text-sm text-slate-700">
                {NOME_TIPO_PERIODO[p.tipo]} · {formatarData(p.inicio)} a {formatarData(p.fim)} · {p.comGrade ? 'com grade especial' : 'sem grade especial ainda'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {gerencia && (
        <section aria-labelledby="novo" className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="novo" className="mb-4 text-lg font-semibold text-slate-900">Novo período</h2>
          <FormularioPeriodo />
        </section>
      )}
    </>
  );
}
