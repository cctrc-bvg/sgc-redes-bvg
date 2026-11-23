import type { InputHTMLAttributes } from 'react';

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  rotulo: string;
  dica?: string;
  erros?: string[];
};

/**
 * Campo de formulário acessível: rótulo visível, dica e erros ligados ao input por
 * aria-describedby, e aria-invalid quando há erro (IDENTIDADE_VISUAL_UX.md, seção 5).
 */
export function Campo({ id, rotulo, dica, erros, className, ...props }: CampoProps) {
  const temErro = Boolean(erros?.length);
  const descritores = [dica && `${id}-dica`, temErro && `${id}-erro`].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {rotulo}
      </label>
      {dica && (
        <p id={`${id}-dica`} className="mt-0.5 text-sm text-slate-600">
          {dica}
        </p>
      )}
      <input
        id={id}
        name={id}
        aria-invalid={temErro || undefined}
        aria-describedby={descritores}
        className={`mt-1 block w-full rounded-md border bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-if-verde-700 focus:outline-none focus:ring-2 focus:ring-if-verde-700 ${
          temErro ? 'border-if-vermelho-700' : 'border-slate-400'
        }`}
        {...props}
      />
      {temErro && (
        <ul id={`${id}-erro`} className="mt-1 space-y-0.5 text-sm text-if-vermelho-700">
          {erros!.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BotaoPrimario({ children, carregando, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean }) {
  return (
    <button
      type="submit"
      aria-disabled={carregando || undefined}
      disabled={carregando}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-if-verde-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-if-verde-800 disabled:cursor-wait disabled:opacity-70"
      {...props}
    >
      {children}
    </button>
  );
}

export function Alerta({ tipo, children }: { tipo: 'erro' | 'sucesso' | 'info'; children: React.ReactNode }) {
  const estilos = {
    erro: 'border-if-vermelho-700 bg-if-vermelho-50 text-if-vermelho-700',
    sucesso: 'border-if-verde-700 bg-if-verde-50 text-if-verde-800',
    info: 'border-slate-400 bg-slate-50 text-slate-800',
  }[tipo];
  const icone = { erro: '⚠', sucesso: '✔', info: 'ℹ' }[tipo];
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`flex gap-2 rounded-md border-l-4 px-3 py-2 text-sm ${estilos}`}>
      <span aria-hidden="true">{icone}</span>
      <div>{children}</div>
    </div>
  );
}

type SelecaoProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  rotulo: string;
  opcoes: readonly { valor: string; rotulo: string }[];
  dica?: string;
  erros?: string[];
};

/** Lista de seleção com o mesmo padrão acessível do Campo. */
export function Selecao({ id, rotulo, opcoes, dica, erros, className, ...props }: SelecaoProps) {
  const temErro = Boolean(erros?.length);
  const descritores = [dica && `${id}-dica`, temErro && `${id}-erro`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {rotulo}
      </label>
      {dica && (
        <p id={`${id}-dica`} className="mt-0.5 text-sm text-slate-600">
          {dica}
        </p>
      )}
      <select
        id={id}
        name={id}
        aria-invalid={temErro || undefined}
        aria-describedby={descritores}
        className={`mt-1 block min-h-11 w-full rounded-md border bg-white px-3 py-2 text-base text-slate-900 focus:border-if-verde-700 focus:outline-none focus:ring-2 focus:ring-if-verde-700 ${
          temErro ? 'border-if-vermelho-700' : 'border-slate-400'
        }`}
        {...props}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {temErro && (
        <ul id={`${id}-erro`} className="mt-1 space-y-0.5 text-sm text-if-vermelho-700">
          {erros!.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BotaoSecundario({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-400 bg-white px-4 py-2 text-base font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
      {...props}
    >
      {children}
    </button>
  );
}
