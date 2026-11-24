import Link from 'next/link';

/** Barra das páginas de impressão (some no papel/PDF): voltar e orientação para salvar em PDF. */
export function BarraImpressao({ voltar, rotulo, paisagem = false }: { voltar: string; rotulo: string; paisagem?: boolean }) {
  return (
    <>
      {/* Tamanho da página no PDF/papel. */}
      <style>{`@page { size: A4 ${paisagem ? 'landscape' : 'portrait'}; margin: 10mm; }`}</style>
      <p className="mb-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800 print:hidden">
        <Link href={voltar} className="text-if-verde-700 underline underline-offset-2">
          ← {rotulo}
        </Link>{' '}
        · Para gerar o PDF, use <kbd className="rounded border border-slate-300 px-1">Ctrl</kbd>+<kbd className="rounded border border-slate-300 px-1">P</kbd> e
        escolha <strong>Salvar como PDF</strong>{paisagem ? ' (já em paisagem)' : ''}.
      </p>
    </>
  );
}

export function LinkImpressao({ href, children = 'Imprimir / PDF' }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
      {children}
    </Link>
  );
}

/**
 * Baixa a listagem em planilha: dois botões do mesmo peso, .xlsx (Excel/LibreOffice) e .csv (texto, para outros
 * sistemas). Links comuns estilizados como botão: funcionam sem JavaScript.
 */
export function LinkExportar({ href, children = 'Exportar planilha' }: { href: string; children?: React.ReactNode }) {
  const csv = `${href}${href.includes('?') ? '&' : '?'}formato=csv`;
  const classe = 'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100';
  return (
    <span role="group" aria-label="Formatos de exportação" className="inline-flex flex-wrap items-center gap-2">
      <a href={href} className={classe}>
        {children} (.xlsx)
      </a>
      <a href={csv} className={classe}>
        {children} (.csv)
      </a>
    </span>
  );
}
