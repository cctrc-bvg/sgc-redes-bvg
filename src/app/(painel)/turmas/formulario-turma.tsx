'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alerta, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { ALUNOS_MAXIMO, CAMPOS_REFEICAO, NOME_REFEICAO } from '@/lib/turmas/regras';
import { atualizarTurma, criarTurma, type EstadoTurma } from './actions';

const OPCOES_ANO = [{ valor: '', rotulo: 'Selecione…' }, ...[1, 2, 3].map((a) => ({ valor: String(a), rotulo: `${a}º ano` }))];

export type ValoresTurma = {
  codigo: string;
  nome: string;
  anoCurso: string;
  qtdAlunosAtivos: string;
  qtdMediaLancheManha: string;
  qtdMediaAlmoco: string;
  qtdMediaLancheTarde: string;
  ativa: boolean;
};

type Props =
  | { modo: 'criar'; turmaId?: undefined; iniciais?: undefined; temOfertas?: undefined }
  | { modo: 'editar'; turmaId: string; iniciais: ValoresTurma; temOfertas: boolean };

const classeLinkPrimario =
  'inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800';
const classeLinkSecundario =
  'inline-flex min-h-11 items-center rounded-md border border-slate-400 px-4 font-semibold text-slate-800 hover:bg-slate-100';

export function FormularioTurma({ modo, turmaId, iniciais, temOfertas }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoTurma | undefined, FormData>(
    modo === 'criar' ? criarTurma : atualizarTurma,
    undefined,
  );

  if (modo === 'criar' && estado?.sucesso) {
    return (
      <div className="space-y-5">
        <Alerta tipo="sucesso">
          Turma <strong>{estado.valores?.nome}</strong> cadastrada. Para lançar as disciplinas dela, use Ofertas.
        </Alerta>
        <div className="flex flex-wrap gap-3">
          <Link href="/turmas" className={classeLinkPrimario}>
            Voltar às turmas
          </Link>
          <Link href="/ofertas" className={classeLinkSecundario}>
            Ir para Ofertas
          </Link>
        </div>
      </div>
    );
  }

  // Após erro, mantém o que foi digitado; senão, usa os valores iniciais.
  const v = estado?.valores;
  const texto = (campo: Exclude<keyof ValoresTurma, 'ativa'>) => v?.[campo] ?? iniciais?.[campo] ?? '';
  const ativa = v ? v.ativa === 'on' : (iniciais?.ativa ?? true);

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      {turmaId && <input type="hidden" name="turmaId" value={turmaId} />}

      <Campo id="nome" rotulo="Nome da turma" autoComplete="off" required defaultValue={texto('nome')} erros={estado?.erros?.nome} dica="Ex.: Redes 1º Ano (Integrado)." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          id="codigo"
          rotulo="Código"
          autoComplete="off"
          required
          maxLength={20}
          defaultValue={texto('codigo')}
          erros={estado?.erros?.codigo}
          dica="Curto, usado nos avisos à Assistência Estudantil (ex.: REDES-1)."
        />
        <Selecao
          id="anoCurso"
          rotulo="Ano do curso"
          opcoes={OPCOES_ANO}
          defaultValue={texto('anoCurso')}
          erros={estado?.erros?.anoCurso}
          dica={temOfertas ? 'A turma já tem ofertas: o ano só muda depois de removê-las.' : 'Define as disciplinas da matriz oferecidas à turma.'}
        />
      </div>

      <fieldset className="space-y-4">
        <legend className="font-semibold text-slate-900">Estudantes e refeições</legend>
        <p className="text-sm text-slate-600">
          Quantidades usadas nos avisos à Assistência Estudantil quando a turma é liberada mais cedo ou sai em atividade.
          Até {ALUNOS_MAXIMO} estudantes; a média de cada refeição não passa do número de ativos.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            id="qtdAlunosAtivos"
            rotulo="Estudantes ativos"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={2}
            defaultValue={texto('qtdAlunosAtivos')}
            erros={estado?.erros?.qtdAlunosAtivos}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {CAMPOS_REFEICAO.map((campo) => (
            <Campo
              key={campo}
              id={campo}
              rotulo={`${NOME_REFEICAO[campo]} (média)`}
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={2}
              defaultValue={texto(campo)}
              erros={estado?.erros?.[campo]}
            />
          ))}
        </div>
      </fieldset>

      {modo === 'editar' && (
        <div className="flex items-start gap-3">
          <input id="ativa" name="ativa" type="checkbox" defaultChecked={ativa} aria-describedby="ativa-dica" className="mt-1 size-5 accent-if-verde-700" />
          <div>
            <label htmlFor="ativa" className="font-semibold text-slate-800">
              Turma ativa
            </label>
            <p id="ativa-dica" className="text-sm text-slate-600">
              Desmarque quando a turma deixar de existir. Ela some de Ofertas e da Grade, mas o histórico é mantido.
            </p>
          </div>
        </div>
      )}

      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>
          {enviando ? 'Salvando…' : modo === 'criar' ? 'Cadastrar turma' : 'Salvar alterações'}
        </BotaoPrimario>
      </div>
    </form>
  );
}
