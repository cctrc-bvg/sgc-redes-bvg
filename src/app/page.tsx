export default function Home() {
  return (
    <>
      <header className="border-b-4 border-if-verde bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          {/* A assinatura oficial IFCE Campus Boa Viagem entra aqui (public/marca/), sem redesenho. */}
          <p className="text-xl font-bold text-if-verde-800">SGC-Redes</p>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Sistema de Gestão da Coordenação</h1>
        <p className="mt-2 text-slate-700">
          Curso Técnico Integrado ao Ensino Médio em Redes de Computadores — IFCE Campus Boa Viagem.
        </p>
        <p className="mt-6 text-sm text-slate-600">
          Ambiente em construção. Consulte <code>docs/FSD.md</code> para os requisitos e{' '}
          <code>docs/IDENTIDADE_VISUAL_UX.md</code> para as diretrizes de interface.
        </p>
      </main>
    </>
  );
}
