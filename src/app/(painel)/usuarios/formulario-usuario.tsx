'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { Role } from '@prisma/client';
import { Alerta, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { NOME_PERFIL, PERFIS } from '@/lib/auth/rbac';
import { atualizarUsuario, criarUsuario, type EstadoUsuario } from './actions';
import { SenhaProvisoria } from './senha-provisoria';

const OPCOES_PERFIL = PERFIS.map((p) => ({ valor: p, rotulo: NOME_PERFIL[p] }));

export type ValoresUsuario = {
  nome: string;
  email: string;
  role: Role;
  siape: string;
  whatsapp: string;
  ativo: boolean;
};

type Props =
  | { modo: 'criar'; usuarioId?: undefined; iniciais?: undefined; proprio?: false }
  | { modo: 'editar'; usuarioId: string; iniciais: ValoresUsuario; proprio: boolean };

export function FormularioUsuario({ modo, usuarioId, iniciais, proprio }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoUsuario | undefined, FormData>(
    modo === 'criar' ? criarUsuario : atualizarUsuario,
    undefined,
  );

  if (modo === 'criar' && estado?.sucesso && estado.senhaProvisoria) {
    return (
      <div className="space-y-5">
        <Alerta tipo="sucesso">
          Usuário <strong>{estado.valores?.nome}</strong> ({estado.valores?.email}) cadastrado.
        </Alerta>
        <SenhaProvisoria senha={estado.senhaProvisoria} />
        <div className="flex flex-wrap gap-3">
          <Link href="/usuarios" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Voltar à lista
          </Link>
          <a href="/usuarios/novo" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Cadastrar outro
          </a>
        </div>
      </div>
    );
  }

  // Após erro, mantém o que foi digitado; senão, usa os valores iniciais.
  const v = estado?.valores;
  const valor = (campo: keyof ValoresUsuario) => (v?.[campo] ?? (iniciais ? String(iniciais[campo]) : '')) as string;
  const ativo = v ? v.ativo === 'on' : (iniciais?.ativo ?? true);

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      {usuarioId && <input type="hidden" name="usuarioId" value={usuarioId} />}

      <Campo id="nome" rotulo="Nome completo" autoComplete="off" required defaultValue={valor('nome')} erros={estado?.erros?.nome} />
      <Campo
        id="email"
        rotulo="E-mail institucional"
        type="email"
        inputMode="email"
        autoComplete="off"
        required
        defaultValue={valor('email')}
        erros={estado?.erros?.email}
        dica="É o login da pessoa no sistema."
      />
      <Selecao
        id="role"
        rotulo="Perfil de acesso"
        opcoes={OPCOES_PERFIL}
        defaultValue={valor('role') || 'PROFESSOR'}
        erros={estado?.erros?.role}
        disabled={proprio}
        dica={proprio ? 'Você não pode alterar o seu próprio perfil.' : 'Define o que a pessoa pode ver e fazer (FSD, seção 2).'}
      />
      {proprio && <input type="hidden" name="role" value={iniciais?.role} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          id="siape"
          rotulo="Matrícula SIAPE (opcional)"
          inputMode="numeric"
          autoComplete="off"
          maxLength={7}
          defaultValue={valor('siape')}
          erros={estado?.erros?.siape}
        />
        <Campo
          id="whatsapp"
          rotulo="WhatsApp (opcional)"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(88) 99999-8888"
          defaultValue={valor('whatsapp')}
          erros={estado?.erros?.whatsapp}
          dica="Usado só para lembretes individuais (ex.: diários)."
        />
      </div>

      {modo === 'editar' && (
        <div className="flex items-start gap-3">
          <input
            id="ativo"
            name="ativo"
            type="checkbox"
            defaultChecked={ativo}
            disabled={proprio}
            aria-describedby="ativo-dica"
            className="mt-1 size-5 accent-if-verde-700"
          />
          <div>
            <label htmlFor="ativo" className="font-semibold text-slate-800">
              Acesso ativo
            </label>
            <p id="ativo-dica" className="text-sm text-slate-600">
              {proprio ? 'Você não pode desativar a sua própria conta.' : 'Desmarque para bloquear o acesso. As sessões abertas são encerradas na hora.'}
            </p>
          </div>
          {proprio && <input type="hidden" name="ativo" value="on" />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : modo === 'criar' ? 'Cadastrar usuário' : 'Salvar alterações'}</BotaoPrimario>
      </div>
    </form>
  );
}
