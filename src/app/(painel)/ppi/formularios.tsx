'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, BotaoSecundario, Campo, Selecao } from '@/components/campo';
import {
  adicionarAtividade,
  alterarAtividade,
  criarSolicitacao,
  decidirSolicitacao,
  type EstadoAtividade,
  type EstadoSimples,
  type EstadoSolicitacao,
} from './actions';

type Opcao = { valor: string; rotulo: string };

export function FormularioSolicitacao({ turmas }: { turmas: Opcao[] }) {
  const [estado, acao, enviando] = useActionState<EstadoSolicitacao | undefined, FormData>(criarSolicitacao, undefined);
  const v = estado?.valores;
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <Campo id="nomeEstudante" rotulo="Nome do estudante" autoComplete="off" defaultValue={v?.nomeEstudante ?? ''} erros={estado?.erros?.nomeEstudante} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="matricula" rotulo="Matrícula" inputMode="numeric" autoComplete="off" defaultValue={v?.matricula ?? ''} erros={estado?.erros?.matricula} />
        <Selecao id="turmaAtual" rotulo="Turma" opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...turmas]} defaultValue={v?.turmaAtual ?? ''} erros={estado?.erros?.turmaAtual} />
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Criando…' : 'Criar solicitação'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioAtividade({ solicitacaoId, categorias, docentes }: { solicitacaoId: string; categorias: Opcao[]; docentes: Opcao[] }) {
  const [estado, acao, enviando] = useActionState<EstadoAtividade | undefined, FormData>(adicionarAtividade, undefined);
  // Depois de lançar com sucesso, o formulário volta vazio para a próxima atividade.
  const v = estado?.sucesso ? undefined : estado?.valores;
  const e = (c: string) => estado?.erros?.[c];
  return (
    <form action={acao} className="space-y-5" noValidate key={estado?.sucesso ? estado.mensagem : 'form'}>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="solicitacaoId" value={solicitacaoId} />
      <Selecao id="regraId" rotulo="Categoria do Manual 2022" opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...categorias]} defaultValue={v?.regraId ?? ''} erros={e('regraId')} />
      <Campo id="descricaoComprovante" rotulo="Comprovante" autoComplete="off" defaultValue={v?.descricaoComprovante ?? ''} erros={e('descricaoComprovante')} dica="Ex.: Certificado da visita técnica à operadora X." />
      <div className="grid gap-5 sm:grid-cols-3">
        <Campo id="codigoCertificado" rotulo="Código do certificado" autoComplete="off" defaultValue={v?.codigoCertificado ?? ''} erros={e('codigoCertificado')} />
        <Campo id="dataRealizacao" rotulo="Data" type="date" defaultValue={v?.dataRealizacao ?? ''} erros={e('dataRealizacao')} />
        <Campo id="quantidadeInformada" rotulo="Quantidade" inputMode="decimal" defaultValue={v?.quantidadeInformada ?? '1'} erros={e('quantidadeInformada')} dica="Na unidade da categoria." />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Selecao id="orientadorId" rotulo="Orientador do IFCE (se houver)" opcoes={[{ valor: '', rotulo: 'Nenhum' }, ...docentes]} defaultValue={v?.orientadorId ?? ''} erros={e('orientadorId')} />
        <Campo id="orientadorExterno" rotulo="Ou outro servidor (nome)" autoComplete="off" defaultValue={v?.orientadorExterno ?? ''} erros={e('orientadorExterno')} />
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Lançando…' : 'Lançar atividade'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function BotaoAtividade({ atividadeId, operacao, rotulo, rotuloAcessivel }: { atividadeId: string; operacao: 'remover' | 'aprovar' | 'glosar'; rotulo: string; rotuloAcessivel: string }) {
  const [estado, acao, enviando] = useActionState<EstadoSimples | undefined, FormData>(alterarAtividade, undefined);
  return (
    <form action={acao}>
      <input type="hidden" name="atividadeId" value={atividadeId} />
      <input type="hidden" name="operacao" value={operacao} />
      <button
        type="submit"
        disabled={enviando}
        aria-label={rotuloAcessivel}
        className={`inline-flex min-h-11 items-center rounded-md border bg-white px-3 text-sm font-semibold disabled:opacity-70 ${
          operacao === 'remover' ? 'border-if-vermelho-700 text-if-vermelho-700 hover:bg-if-vermelho-50' : 'border-slate-400 text-slate-800 hover:bg-slate-100'
        }`}
      >
        {rotulo}
      </button>
      {estado?.mensagem && !estado.sucesso && <span className="block text-sm text-if-vermelho-700">{estado.mensagem}</span>}
    </form>
  );
}

export function FormularioDecisaoPpi({ solicitacaoId, status, observacoes }: { solicitacaoId: string; status: string; observacoes: string }) {
  const [estado, acao, enviando] = useActionState<EstadoSimples | undefined, FormData>(decidirSolicitacao, undefined);
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="solicitacaoId" value={solicitacaoId} />
      <Selecao
        id="status"
        rotulo="Situação"
        className="sm:max-w-xs"
        opcoes={[
          { valor: 'EM_ANALISE', rotulo: 'Em análise' },
          { valor: 'DEFERIDA', rotulo: 'Deferida (meta atingida)' },
          { valor: 'INDEFERIDA', rotulo: 'Indeferida' },
        ]}
        defaultValue={status}
      />
      <AreaTexto id="observacoes" rotulo="Observações" rows={3} maxLength={1000} defaultValue={observacoes} dica="Obrigatória para indeferir." />
      <BotaoSecundario type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar situação'}
      </BotaoSecundario>
    </form>
  );
}
