import Link from 'next/link';
import { exigirUsuario } from '@/lib/auth/dal';
import { acumulaDocencia, NOME_PERFIL } from '@/lib/auth/rbac';
import { FecharMenus } from '@/components/fechar-menus';
import { Icone } from '@/components/icone';
import { FUNCOES_DA_CONTA, funcoesDoPerfil, funcoesPorGrupo, type NomeIcone } from '@/lib/navegacao';
import { sair } from './actions';

const classeLink = 'inline-flex min-h-11 items-center gap-1.5 text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800';
// Docência acumulada ao cargo: menu em azul, com o nome "Docência" escrito (src/components/papel.tsx).
const classeLinkDocencia = 'inline-flex min-h-11 items-center gap-1.5 text-docencia-700 underline underline-offset-2 hover:text-docencia-800';
const classeSummary = `${classeLink} cursor-pointer list-none [&::-webkit-details-marker]:hidden`;
const classePainelMenu = 'absolute z-20 mt-1 min-w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg';

/** Item de menu com o mesmo ícone usado no painel. */
function ItemMenu({ href, rotulo, icone, docencia = false }: { href: string; rotulo: string; icone: NomeIcone; docencia?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className={`${docencia ? classeLinkDocencia : classeLink} w-full whitespace-nowrap px-2 no-underline hover:underline`}
      >
        <Icone nome={icone} className={`size-4 ${docencia ? 'text-docencia-700' : 'text-slate-500'}`} />
        {rotulo}
      </Link>
    </li>
  );
}

/** Ajuda, menu da conta (Meu contato, Alterar senha) e Sair. */
function NavConta({ nome, perfil }: { nome: string; perfil: string }) {
  return (
    <nav aria-label="Conta" className="flex items-center gap-x-3 text-sm sm:gap-x-4">
      <Link href="/ajuda" className={classeLink}>
        <Icone nome="ajuda" className="size-4" />
        Ajuda
      </Link>
      <details name="menu-cabecalho" data-menu-cabecalho="" className="relative">
        <summary className={`${classeSummary} text-slate-800 no-underline`}>
          <span className="max-w-[8rem] truncate font-semibold sm:max-w-none">{nome}</span>
          <span className="hidden text-slate-600 sm:inline">· {perfil}</span> <span aria-hidden="true">▾</span>
        </summary>
        <ul className={`${classePainelMenu} right-0`}>
          {FUNCOES_DA_CONTA.filter((f) => f.id !== 'ajuda').map((f) => (
            <ItemMenu key={f.id} href={f.href} rotulo={f.rotulo} icone={f.icone} />
          ))}
        </ul>
      </details>
      <form action={sair}>
        <button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 px-3 font-semibold text-slate-800 hover:bg-slate-100">
          Sair
        </button>
      </form>
    </nav>
  );
}

/**
 * Moldura das páginas logadas. Busca o usuário só para exibir o cabeçalho;
 * cada página faz a própria verificação de acesso pelo DAL (o layout não re-renderiza
 * a cada navegação, então não é um ponto seguro de controle).
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirUsuario({ permitirSenhaProvisoria: true });
  // Menus do cabeçalho pela mesma lista do painel (src/lib/navegacao.ts). Com muitas funções, agrupa em menus
  // <details>, que funcionam sem JavaScript.
  const funcoes = funcoesDoPerfil(usuario);
  const grupos = funcoes.length > 4 ? funcoesPorGrupo(usuario) : [];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b-4 border-if-verde bg-white print:hidden">
        <FecharMenus />
        {/* Linha 1: sistema e conta. Linha 2: o menu principal, começando por Início. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-3">
          <Link href="/painel" className="rounded-sm">
            <span className="block text-xl font-bold text-if-verde-800">SGC-Redes</span>
            <span className="block text-sm text-slate-600">IFCE · Campus Boa Viagem</span>
          </Link>
          <NavConta nome={usuario.nome} perfil={acumulaDocencia(usuario) ? `${NOME_PERFIL[usuario.role]} e Docência` : NOME_PERFIL[usuario.role]} />
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-1">
          <nav aria-label="Menu principal" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <Link href="/painel" className={`${classeLink} font-semibold`}>
              <Icone nome="inicio" className="size-4" />
              Início
            </Link>
            {grupos.length > 1
              ? grupos.map((g) => (
                  // name: só um menu aberto por vez (nativo, sem JS); FecharMenus fecha ao navegar ou clicar fora.
                  <details key={g.grupo} name="menu-cabecalho" data-menu-cabecalho="" className="relative">
                    <summary
                      className={
                        g.grupo === 'Docência'
                          ? `${classeSummary.replace(classeLink, classeLinkDocencia)} rounded-md bg-docencia-50 px-2 font-semibold`
                          : classeSummary
                      }
                    >
                      {g.grupo === 'Docência' && <Icone nome="minha-grade" className="size-4" />}
                      {g.grupo} <span aria-hidden="true">▾</span>
                    </summary>
                    <ul className={`${classePainelMenu} left-0 ${g.grupo === 'Docência' ? 'border-t-4 border-t-docencia-700' : ''}`}>
                      {g.funcoes.map((f) => (
                        <ItemMenu key={f.id} href={f.href} rotulo={f.rotulo} icone={f.icone} docencia={g.grupo === 'Docência'} />
                      ))}
                    </ul>
                  </details>
                ))
              : funcoes.map((f) => (
                  <Link key={f.id} href={f.href} className={classeLink}>
                    <Icone nome={f.icone} className="size-4" />
                    {f.rotulo}
                  </Link>
                ))}
          </nav>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
