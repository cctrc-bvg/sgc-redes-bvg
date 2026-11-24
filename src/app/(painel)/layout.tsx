import Link from 'next/link';
import { exigirUsuario } from '@/lib/auth/dal';
import { NOME_PERFIL, temPermissao } from '@/lib/auth/rbac';
import { sair } from './actions';

/**
 * Moldura das páginas logadas. Busca o usuário só para exibir o cabeçalho;
 * cada página faz a própria verificação de acesso pelo DAL (o layout não re-renderiza
 * a cada navegação, então não é um ponto seguro de controle).
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirUsuario({ permitirSenhaProvisoria: true });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b-4 border-if-verde bg-white">
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
            {temPermissao(usuario.role, 'grade:ver') && (
              <Link href="/grade" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Grade
              </Link>
            )}
            {temPermissao(usuario.role, 'alimentacao:ver') && (
              <Link href="/alimentacao" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Alimentação
              </Link>
            )}
            {temPermissao(usuario.role, 'ausencias:registrar') && (
              <Link href="/ausencias" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Ausências
              </Link>
            )}
            {temPermissao(usuario.role, 'comunicacao:enviar') && (
              <Link href="/comunicacao" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Comunicação
              </Link>
            )}
            {temPermissao(usuario.role, 'usuarios:gerenciar') && (
              <Link href="/usuarios" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Usuários
              </Link>
            )}
            {temPermissao(usuario.role, 'disciplinas:ver') && (
              <Link href="/disciplinas" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Disciplinas
              </Link>
            )}
            {temPermissao(usuario.role, 'turmas:gerenciar') && (
              <Link href="/turmas" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Turmas
              </Link>
            )}
            {temPermissao(usuario.role, 'ofertas:gerenciar') && (
              <Link href="/ofertas" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Ofertas
              </Link>
            )}
            {temPermissao(usuario.role, 'auditoria:ver') && (
              <Link href="/auditoria" className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                Auditoria
              </Link>
            )}
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
