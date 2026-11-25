import Link from 'next/link';

/**
 * Alterna entre "todas" (o que o cargo vê) e "minhas" (o recorte da docência) nas telas que existem nos dois papéis.
 * Só aparece para quem acumula cargo e docência; "Minhas" leva a cor da docência.
 */
export function AlternarEscopo({ hrefTodas, hrefMinhas, minhas, rotuloTodas, rotuloMinhas }: { hrefTodas: string; hrefMinhas: string; minhas: boolean; rotuloTodas: string; rotuloMinhas: string }) {
  const base = 'inline-flex min-h-11 items-center px-4 font-semibold';
  return (
    <nav aria-label="Escopo da lista" className="mt-4 inline-flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
      <Link href={hrefTodas} aria-current={minhas ? undefined : 'page'} className={`${base} ${minhas ? 'text-slate-700 hover:bg-slate-100' : 'bg-if-verde-700 text-white'}`}>
        {rotuloTodas}
      </Link>
      <Link
        href={hrefMinhas}
        aria-current={minhas ? 'page' : undefined}
        className={`${base} border-l border-slate-300 ${minhas ? 'bg-docencia-700 text-white' : 'text-docencia-800 hover:bg-docencia-50'}`}
      >
        {rotuloMinhas}
      </Link>
    </nav>
  );
}
