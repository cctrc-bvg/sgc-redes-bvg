'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, BotaoSecundario, Campo, Selecao } from '@/components/campo';
import {
  clonarCronograma,
  definirModalidade,
  excluirPpe,
  mudarSituacao,
  registrarPpe,
  salvarPei,
  type EstadoPpe,
  type EstadoRegistroPpe,
} from './actions';

type Opcao = { valor: string; rotulo: string };
const umErro = (m?: string) => (m ? [m] : undefined);

export function FormularioRegistroPpe({ disciplinas, semestre }: { disciplinas: Opcao[]; semestre: string }) {
  const [estado, acao, enviando] = useActionState<EstadoRegistroPpe | undefined, FormData>(registrarPpe, undefined);
  const v = estado?.valores;
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <Campo id="nomeEstudante" rotulo="Nome do estudante" autoComplete="off" defaultValue={v?.nomeEstudante ?? ''} erros={estado?.erros?.nomeEstudante} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="matricula" rotulo="Matrícula" inputMode="numeric" autoComplete="off" defaultValue={v?.matricula ?? ''} erros={estado?.erros?.matricula} />
        <Campo id="semestre" rotulo="Semestre" defaultValue={v?.semestre ?? semestre} erros={estado?.erros?.semestre} dica="Formato 2026.1 ou 2026.2." />
      </div>
      <Selecao
        id="disciplinaId"
        rotulo="Componente curricular pendente"
        opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...disciplinas]}
        defaultValue={v?.disciplinaId ?? ''}
        erros={estado?.erros?.disciplinaId}
      />
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Registrando…' : 'Registrar PPE'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioModalidade({ ppeId, atual, opcoes }: { ppeId: string; atual: string; opcoes: Opcao[] }) {
  const [estado, acao, enviando] = useActionState<EstadoPpe | undefined, FormData>(definirModalidade, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="ppeId" value={ppeId} />
      <Selecao id="modalidade" rotulo="Modalidade (Arts. 117 e 118)" opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...opcoes]} defaultValue={atual === 'A_DEFINIR' ? '' : atual} />
      <BotaoSecundario type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Definir'}
      </BotaoSecundario>
      {estado?.mensagem && (
        <div className="w-full">
          <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>
        </div>
      )}
    </form>
  );
}

export interface ValoresPei {
  cargaHorariaPei: string;
  horasPresenciais: string;
  horasPraticas: string;
  objetivos: string;
  conteudos: string;
  criteriosAval: string;
  encontros: { data: string; conteudo: string; metodologia: string }[];
}

/** Formulário do PEI no modelo oficial do campus, com cronograma em linhas (funciona sem JavaScript). */
export function FormularioPei({ ppeId, iniciais, teto, exigePratica, linhasExtras }: { ppeId: string; iniciais: ValoresPei; teto: number; exigePratica: boolean; linhasExtras: number }) {
  const [estado, acao, enviando] = useActionState<EstadoPpe | undefined, FormData>(salvarPei, undefined);
  const v = estado?.valores;
  const e = estado?.erros ?? {};
  const linhas = iniciais.encontros.length + linhasExtras;
  const val = (campo: keyof Omit<ValoresPei, 'encontros'>) => v?.[campo] ?? iniciais[campo];
  const enc = (i: number, c: 'data' | 'conteudo' | 'metodologia') => v?.[`encontro:${i}:${c}`] ?? iniciais.encontros[i]?.[c] ?? '';
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="ppeId" value={ppeId} />
      <input type="hidden" name="linhasCronograma" value={linhas} />
      <div className="grid gap-5 sm:grid-cols-3">
        <Campo id="cargaHorariaPei" rotulo="CH do PEI (h)" inputMode="numeric" maxLength={3} defaultValue={val('cargaHorariaPei')} erros={umErro(e.cargaHorariaPei)} dica={`Máximo ${teto}h (30%, Art. 117 §1º).`} />
        <Campo id="horasPresenciais" rotulo="Horas presenciais" inputMode="numeric" maxLength={3} defaultValue={val('horasPresenciais')} erros={umErro(e.horasPresenciais)} />
        <Campo
          id="horasPraticas"
          rotulo="Horas práticas"
          inputMode="numeric"
          maxLength={3}
          defaultValue={val('horasPraticas')}
          erros={umErro(e.horasPraticas)}
          dica={exigePratica ? 'Obrigatório: a disciplina exige prática (Art. 121).' : 'Se houver.'}
        />
      </div>
      <AreaTexto id="objetivos" rotulo="1. Objetivos de aprendizagem" rows={3} maxLength={3000} defaultValue={val('objetivos')} erros={umErro(e.objetivos)} />
      <AreaTexto id="conteudos" rotulo="2. Conteúdos a recuperar" rows={3} maxLength={3000} defaultValue={val('conteudos')} erros={umErro(e.conteudos)} />
      <AreaTexto id="criteriosAval" rotulo="3. Critérios de avaliação (opcional)" rows={2} maxLength={2000} defaultValue={val('criteriosAval')} />
      <fieldset>
        <legend className="font-semibold text-slate-900">4. Cronograma de encontros</legend>
        <p className="text-sm text-slate-600">Linhas em branco são ignoradas. Salve para ganhar mais linhas.</p>
        {e.cronograma && <p className="mt-1 text-sm text-if-vermelho-700">{e.cronograma}</p>}
        <div className="mt-3 space-y-4">
          {Array.from({ length: linhas }, (_, i) => (
            <div key={i} className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[10rem_1fr_1fr]">
              <Campo id={`encontro:${i}:data`} rotulo={`Encontro ${i + 1}: data`} type="date" defaultValue={enc(i, 'data')} />
              <Campo id={`encontro:${i}:conteudo`} rotulo="Conteúdo" maxLength={500} defaultValue={enc(i, 'conteudo')} />
              <Campo id={`encontro:${i}:metodologia`} rotulo="Metodologia/avaliação" maxLength={500} defaultValue={enc(i, 'metodologia')} />
              {e[`encontro:${i}`] && <p className="text-sm text-if-vermelho-700 sm:col-span-3">{e[`encontro:${i}`]}</p>}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar PEI'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioClonar({ ppeId, origens }: { ppeId: string; origens: Opcao[] }) {
  const [estado, acao, enviando] = useActionState<EstadoPpe | undefined, FormData>(clonarCronograma, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="ppeId" value={ppeId} />
      <Selecao id="origemId" rotulo="Copiar cronograma de" opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...origens]} defaultValue="" />
      <BotaoSecundario type="submit" disabled={enviando}>
        {enviando ? 'Copiando…' : 'Copiar'}
      </BotaoSecundario>
      {estado?.mensagem && (
        <div className="w-full">
          <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>
        </div>
      )}
    </form>
  );
}

export function FormularioSituacao({ ppeId, opcoes, permiteProrrogar }: { ppeId: string; opcoes: Opcao[]; permiteProrrogar: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoPpe | undefined, FormData>(mudarSituacao, undefined);
  const e = estado?.erros ?? {};
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="ppeId" value={ppeId} />
      <Selecao id="status" rotulo="Nova situação" className="sm:max-w-sm" opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...opcoes]} defaultValue="" />
      <Campo id="notaFinal" rotulo="Nota final (aprovação/reprovação, opcional)" inputMode="decimal" className="sm:max-w-xs" erros={umErro(e.notaFinal)} />
      {permiteProrrogar && (
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Campo id="prorrogadoAte" rotulo="Prorrogar até (Art. 124)" type="date" erros={umErro(e.prorrogadoAte)} />
          <Campo id="justificativaProrrogacao" rotulo="Justificativa da prorrogação" erros={umErro(e.justificativaProrrogacao)} />
        </div>
      )}
      <BotaoSecundario type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Atualizar situação'}
      </BotaoSecundario>
    </form>
  );
}

export function FormularioExclusaoPpe({ ppeId }: { ppeId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoPpe | undefined, FormData>(excluirPpe, undefined);
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <input type="hidden" name="ppeId" value={ppeId} />
      <div className="flex items-start gap-3">
        <input id="confirmo" name="confirmo" type="checkbox" className="mt-1 size-5 accent-if-vermelho-700" />
        <label htmlFor="confirmo" className="text-slate-800">
          Confirmo que esta PPE foi registrada por engano (o PEI e o cronograma também serão apagados).
        </label>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-4 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:opacity-70"
      >
        {enviando ? 'Excluindo…' : 'Excluir PPE'}
      </button>
    </form>
  );
}
