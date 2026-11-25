import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/lib/auth/dal';
import { NOME_PERFIL, PERFIS } from '@/lib/auth/rbac';
import { matrizDeAcesso, topicoDoPerfil } from '@/lib/ajuda/acesso';
import { TOPICOS } from '@/lib/ajuda/topicos';

export const metadata: Metadata = { title: 'Ajuda — SGC-Redes' };

/** Manual do usuário: o que o sistema faz, quem vê o quê e um tópico por funcionalidade. */
export default async function PaginaAjuda({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { usuario } = await exigirUsuario();
  const todos = (await searchParams).todos === '1';
  const lista = TOPICOS.filter((t) => todos || topicoDoPerfil(t, usuario));
  const matriz = matrizDeAcesso();
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Ajuda — como usar o SGC-Redes</h1>
      <p className="mt-2 text-slate-700">
        O SGC-Redes apoia a rotina da Coordenação do Curso Técnico Integrado em Redes de Computadores do IFCE Campus Boa Viagem: calendário, grade,
        ausências e substituições, refeições, comunicação por e-mail ou WhatsApp, PPE/PEI, PPI, diários, processos e relatórios. Ele complementa os sistemas
        oficiais (SUAP/Q-Acadêmico, SEI), sem substituí-los.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/ajuda/manual" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
          Manual completo (imprimir / PDF)
        </Link>
        <Link href="/ajuda/primeiros-passos" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
          Começar pelos primeiros passos
        </Link>
      </div>

      <section aria-labelledby="topicos" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="topicos" className="text-lg font-semibold text-slate-900">
            {todos ? 'Todos os tópicos' : `Tópicos para o seu perfil (${NOME_PERFIL[usuario.role]})`}
          </h2>
          <Link href={todos ? '/ajuda' : '/ajuda?todos=1'} className="text-sm text-if-verde-700 underline underline-offset-2">
            {todos ? 'Mostrar só os do meu perfil' : 'Ver todos os tópicos'}
          </Link>
        </div>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          {lista.map((t) => (
            <li key={t.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-slate-900">
                <Link href={`/ajuda/${t.id}`} className="text-if-verde-700 underline underline-offset-2">
                  {t.titulo}
                </Link>
              </h3>
              <p className="mt-1 flex-1 text-sm text-slate-700">{t.resumo}</p>
              {!topicoDoPerfil(t, usuario) && <p className="mt-2 text-xs font-semibold text-slate-600">Não disponível para o seu perfil.</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="acesso" className="mt-10">
        <h2 id="acesso" className="text-lg font-semibold text-slate-900">
          Quem vê o quê
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Cada perfil acessa só o necessário para o seu trabalho (LGPD). Cadastros, auditoria e mensagens são da Coordenação.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Módulos acessíveis por perfil</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Módulo
                </th>
                {PERFIS.map((p) => (
                  <th key={p} scope="col" className="px-3 py-2 text-center">
                    {NOME_PERFIL[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matriz.map(({ modulo, perfis }) => (
                <tr key={modulo.id}>
                  <th scope="row" className="px-3 py-2 font-semibold">
                    {modulo.titulo}
                  </th>
                  {perfis.map((ok, i) => (
                    <td key={PERFIS[i]} className="px-3 py-2 text-center">
                      {ok ? <span aria-label="sim">✔</span> : <span aria-label="não" className="text-slate-400">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
