/** Exibe a senha provisória UMA vez, com orientação de entrega segura. */
export function SenhaProvisoria({ senha, nome }: { senha: string; nome?: string }) {
  return (
    <div role="status" className="rounded-md border-l-4 border-if-verde-700 bg-if-verde-50 p-4">
      <p className="font-semibold text-if-verde-800">Senha provisória{nome ? ` de ${nome}` : ''}:</p>
      <p className="mt-2">
        <code className="select-all rounded bg-white px-3 py-1.5 font-mono text-xl tracking-wider text-slate-900 ring-1 ring-slate-300">{senha}</code>
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
        <li>
          <strong>Anote agora:</strong> ela não será exibida novamente.
        </li>
        <li>Entregue pessoalmente ou por mensagem privada — nunca em grupo.</li>
        <li>No primeiro acesso, o sistema exigirá que a pessoa crie a própria senha.</li>
      </ul>
    </div>
  );
}
