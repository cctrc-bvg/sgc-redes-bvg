'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { CARGA_HORARIA_MAXIMA, NOME_NUCLEO, NUCLEOS } from '@/lib/disciplinas/regras';
import { atualizarDisciplina, criarDisciplina, type EstadoDisciplina } from './actions';

const OPCOES_NUCLEO = [
  { valor: '', rotulo: 'Selecione…' },
  ...NUCLEOS.map((n) => ({ valor: n, rotulo: `${NOME_NUCLEO[n]}${n === 'TECNICO' ? ' (semestral)' : ' (anual)'}` })),
];
const OPCOES_ANO = [{ valor: '', rotulo: 'Selecione…' }, ...[1, 2, 3].map((a) => ({ valor: String(a), rotulo: `${a}º ano` }))];
const OPCOES_SEMESTRE = [
  { valor: '', rotulo: 'Anual' },
  ...[1, 2, 3, 4, 5, 6].map((s) => ({ valor: String(s), rotulo: `${s}º semestre (${Math.ceil(s / 2)}º ano)` })),
];

export type ValoresDisciplina = {
  codigo: string;
  nome: string;
  cargaHoraria: string;
  exigePratica: boolean;
  ementaUrl: string;
  programaTexto: string;
  nucleo: string;
  anoCurso: string;
  semestreCurso: string;
  ativa: boolean;
};

type Props =
  | { modo: 'criar'; disciplinaId?: undefined; iniciais?: undefined }
  | { modo: 'editar'; disciplinaId: string; iniciais: ValoresDisciplina };

const classeLinkPrimario =
  'inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800';
const classeLinkSecundario =
  'inline-flex min-h-11 items-center rounded-md border border-slate-400 px-4 font-semibold text-slate-800 hover:bg-slate-100';

function CaixaMarcacao({ id, rotulo, dica, marcada }: { id: string; rotulo: string; dica: string; marcada: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        defaultChecked={marcada}
        aria-describedby={`${id}-dica`}
        className="mt-1 size-5 accent-if-verde-700"
      />
      <div>
        <label htmlFor={id} className="font-semibold text-slate-800">
          {rotulo}
        </label>
        <p id={`${id}-dica`} className="text-sm text-slate-600">
          {dica}
        </p>
      </div>
    </div>
  );
}

export function FormularioDisciplina({ modo, disciplinaId, iniciais }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoDisciplina | undefined, FormData>(
    modo === 'criar' ? criarDisciplina : atualizarDisciplina,
    undefined,
  );

  if (modo === 'criar' && estado?.sucesso) {
    return (
      <div className="space-y-5">
        <Alerta tipo="sucesso">
          Disciplina <strong>{estado.valores?.nome}</strong> cadastrada.
        </Alerta>
        <div className="flex flex-wrap gap-3">
          <Link href="/disciplinas" className={classeLinkPrimario}>
            Voltar ao catálogo
          </Link>
          <a href="/disciplinas/nova" className={classeLinkSecundario}>
            Cadastrar outra
          </a>
        </div>
      </div>
    );
  }

  // Após erro, mantém o que foi digitado; senão, usa os valores iniciais.
  const v = estado?.valores;
  const texto = (campo: Exclude<keyof ValoresDisciplina, 'exigePratica' | 'ativa'>) => v?.[campo] ?? iniciais?.[campo] ?? '';
  const marcado = (campo: 'exigePratica' | 'ativa', padrao: boolean) => (v ? v[campo] === 'on' : (iniciais?.[campo] ?? padrao));

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      {disciplinaId && <input type="hidden" name="disciplinaId" value={disciplinaId} />}

      <Campo id="nome" rotulo="Nome da disciplina" autoComplete="off" required defaultValue={texto('nome')} erros={estado?.erros?.nome} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          id="codigo"
          rotulo="Código (opcional)"
          autoComplete="off"
          maxLength={20}
          defaultValue={texto('codigo')}
          erros={estado?.erros?.codigo}
          dica="Como aparece no SUAP ou na matriz curricular."
        />
        <Campo
          id="cargaHoraria"
          rotulo="Carga horária total (horas)"
          inputMode="numeric"
          autoComplete="off"
          required
          maxLength={3}
          defaultValue={texto('cargaHoraria')}
          erros={estado?.erros?.cargaHoraria}
          dica={`Base do teto do PEI: 30% (Art. 117 §1º). Até ${CARGA_HORARIA_MAXIMA}h.`}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Selecao id="nucleo" rotulo="Núcleo" opcoes={OPCOES_NUCLEO} defaultValue={texto('nucleo')} erros={estado?.erros?.nucleo} />
        <Selecao id="anoCurso" rotulo="Ano do curso" opcoes={OPCOES_ANO} defaultValue={texto('anoCurso')} erros={estado?.erros?.anoCurso} />
        <Selecao
          id="semestreCurso"
          rotulo="Período"
          opcoes={OPCOES_SEMESTRE}
          defaultValue={texto('semestreCurso')}
          erros={estado?.erros?.semestreCurso}
        />
      </div>
      <p className="-mt-3 text-sm text-slate-600">Técnicas são semestrais; propedêuticas e diversificadas são anuais.</p>
      <CaixaMarcacao
        id="exigePratica"
        rotulo="Exige conteúdo prático"
        dica="Obriga o PEI a reservar horas para aulas práticas (Art. 121 do ROD). Técnicas: metade da carga é prática."
        marcada={marcado('exigePratica', false)}
      />
      <Campo
        id="ementaUrl"
        rotulo="Endereço da ementa ou do PPC (opcional)"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://"
        defaultValue={texto('ementaUrl')}
        erros={estado?.erros?.ementaUrl}
      />
      <AreaTexto
        id="programaTexto"
        rotulo="Programa / ementa (opcional)"
        rows={6}
        maxLength={10_000}
        defaultValue={texto('programaTexto')}
        erros={estado?.erros?.programaTexto}
        dica="Conteúdo programático usado como referência nos PEIs e reposições (Art. 22, IX)."
      />
      {modo === 'editar' && (
        <CaixaMarcacao
          id="ativa"
          rotulo="Disciplina ativa"
          dica="Desmarque se saiu da matriz vigente. Ela some das listas de novas ofertas, mas o histórico é mantido."
          marcada={marcado('ativa', true)}
        />
      )}

      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>
          {enviando ? 'Salvando…' : modo === 'criar' ? 'Cadastrar disciplina' : 'Salvar alterações'}
        </BotaoPrimario>
      </div>
    </form>
  );
}
