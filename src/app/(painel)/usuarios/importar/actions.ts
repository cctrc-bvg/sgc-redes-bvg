'use server';

import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import type { EstadoImportacao } from '@/lib/importacao/estado';
import { avisoColunasDesconhecidas, lerEntrada, serializarDados } from '@/lib/importacao/servidor';
import { gerarCsv } from '@/lib/importacao/tabela';
import { COLUNAS_USUARIO, planejarImportacaoUsuarios } from '@/lib/importacao/usuarios';
import { gerarSenhaProvisoria } from '@/lib/usuarios/regras';

const CUSTO_BCRYPT = 12;

export async function importarUsuarios(_estado: EstadoImportacao | undefined, formData: FormData): Promise<EstadoImportacao> {
  const { usuario: editor } = await exigirPermissao('usuarios:gerenciar');
  const entrada = await lerEntrada(formData, COLUNAS_USUARIO);
  if ('erro' in entrada) return { mensagem: entrada.erro };

  const existentes = await prisma.user.findMany({ select: { email: true, siape: true } });
  const plano = planejarImportacaoUsuarios({
    registros: entrada.registros,
    emailsExistentes: new Set(existentes.map((u) => u.email)),
    siapesExistentes: new Set(existentes.flatMap((u) => (u.siape ? [u.siape] : []))),
  });
  const avisos = avisoColunasDesconhecidas(entrada.desconhecidas);

  if (!entrada.confirmar || plano.temErros) {
    if (plano.temErros) {
      return {
        linhas: plano.linhas,
        avisos,
        mensagem: entrada.confirmar
          ? 'Os cadastros mudaram desde a prévia e agora há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.'
          : 'Há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.',
      };
    }
    return {
      linhas: plano.linhas,
      avisos,
      dados: plano.criar.length ? serializarDados(entrada) : undefined,
      mensagem: plano.criar.length
        ? `Prévia pronta: ${plano.criar.length} usuário(s) novo(s). Confira e confirme abaixo.`
        : 'Todos os e-mails da planilha já estão cadastrados: não há ninguém novo para importar.',
    };
  }
  if (plano.criar.length === 0) return { concluido: true, sucesso: true, mensagem: 'Nada para gravar: todos já estavam cadastrados.' };

  // Senhas provisórias geradas e "hasheadas" antes da transação (bcrypt é lento de propósito).
  const novos: { dados: (typeof plano.criar)[number]; senha: string; hash: string }[] = [];
  for (const d of plano.criar) {
    const senha = gerarSenhaProvisoria();
    novos.push({ dados: d, senha, hash: await bcrypt.hash(senha, CUSTO_BCRYPT) });
  }
  let criados: { id: string }[];
  try {
    criados = await prisma.$transaction(
      novos.map(({ dados, hash }) =>
        prisma.user.create({
          data: { ...dados, siape: dados.siape ?? null, whatsapp: dados.whatsapp ?? null, passwordHash: hash, deveTrocarSenha: true },
          select: { id: true },
        }),
      ),
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { mensagem: 'Alguém cadastrou um destes e-mails ou SIAPEs durante a importação. Nada foi gravado: envie a planilha de novo.' };
    }
    throw e;
  }
  await registrarAuditoria({
    userId: editor.id,
    acao: 'IMPORTOU_USUARIOS',
    entidade: 'User',
    entidadeId: 'importacao',
    // Só ids e perfis: nada de nomes, e-mails ou senhas na auditoria.
    detalhes: { criados: criados.map((c, i) => ({ id: c.id, perfil: novos[i].dados.role })) },
  });
  revalidatePath('/usuarios');

  const credenciais = novos.map((n) => ({ nome: n.dados.nome, email: n.dados.email, senha: n.senha }));
  return {
    concluido: true,
    sucesso: true,
    mensagem: `Importação concluída: ${criados.length} usuário(s) cadastrado(s).`,
    credenciais,
    credenciaisCsv: gerarCsv(['Nome', 'E-mail', 'Senha provisória'], credenciais.map((c) => [c.nome, c.email, c.senha])),
  };
}
