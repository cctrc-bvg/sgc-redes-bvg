import Link from 'next/link';
import { exigirUsuario } from '@/lib/auth/dal';
import { NOME_PERFIL, temPermissao, type Permissao } from '@/lib/auth/rbac';
import { FecharMenus } from '@/components/fechar-menus';
import { sair } from './actions';

/**
 * Moldura das páginas logadas. Busca o usuário só para exibir o cabeçalho;
 * cada página faz a própria verificação de acesso pelo DAL (o layout não re-renderiza
 * a cada navegação, então não é um ponto seguro de controle).
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirUsuario({ permitirSenhaProvisoria: true });
  // Links do cabeçalho por permissão. Com muitos (Coordenação), agrupa em menus <details>, que funcionam sem JavaScript.
  const LINKS: { href: string; rotulo: string; permissao: Permissao; grupo: 'Operação' | 'Cadastros' }[] = [
    { href: '/grade', rotulo: 'Grade', permissao: 'grade:ver', grupo: 'Operação' },
    { href: '/ausencias', rotulo: 'Ausências', permissao: 'ausencias:registrar', grupo: 'Operação' },
    { href: '/alimentacao', rotulo: 'Alimentação', permissao: 'alimentacao:ver', grupo: 'Operação' },
    { href: '/comunicacao', rotulo: 'Comunicação', permissao: 'comunicacao:enviar', grupo: 'Operação' },
    { href: '/usuarios', rotulo: 'Usuários', permissao: 'usuarios:gerenciar', grupo: 'Cadastros' },
    { href: '/turmas', rotulo: 'Turmas', permissao: 'turmas:gerenciar', grupo: 'Cadastros' },
    { href: '/disciplinas', rotulo: 'Disciplinas', permissao: 'disciplinas:ver', grupo: 'Cadastros' },
    { href: '/ofertas', rotulo: 'Ofertas', permissao: 'ofertas:gerenciar', grupo: 'Cadastros' },
    { href: '/auditoria', rotulo: 'Auditoria', permissao: 'auditoria:ver', grupo: 'Cadastros' },
  ];
  const links = LINKS.filter((l) => temPermissao(usuario.role, l.permissao));
  const grupos =
    links.length > 4
      ? (['Operação', 'Cadastros'] as const).map((titulo) => ({ titulo, links: links.filter((l) => l.grupo === titulo) })).filter((g) => g.links.length > 0)
      : [];
  const classeLink = 'inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b-4 border-if-verde bg-white">
        <FecharMenus />
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/painel" className="rounded-sm">
            <span className="block text-xl font-bold text-if-verde-800">SGC-Redes</span>
            <span className="block text-sm text-slate-600">IFCE · Campus Boa Viagem</span>
          </Link>
          <nav aria-label="Conta" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-slate-700">
              <span className="font-semibold">{usuario.nome}</span>
              <span className="text-slate-600"> · {NOME_PERFIL[usuario.role]}</span>
            </span>
            {grupos.length > 1 ? (
              grupos.map((g) => (
                // name: só um menu aberto por vez (nativo, sem JS); FecharMenus fecha ao navegar ou clicar fora.
                <details key={g.titulo} name="menu-cabecalho" data-menu-cabecalho="" className="relative">
                  <summary className={`${classeLink} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                    {g.titulo} <span aria-hidden="true">▾</span>
                  </summary>
                  <ul className="absolute left-0 z-20 mt-1 min-w-48 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                    {g.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className={`${classeLink} w-full whitespace-nowrap px-2`}>
                          {l.rotulo}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            ) : (
              links.map((l) => (
                <Link key={l.href} href={l.href} className={classeLink}>
                  {l.rotulo}
                </Link>
              ))
            )}
            <Link href="/conta/contato" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
              Meu contato
            </Link>
            <Link href="/conta/senha" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
              Alterar senha
            </Link>
            <form action={sair}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md border border-slate-400 px-3 font-semibold text-slate-800 hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
