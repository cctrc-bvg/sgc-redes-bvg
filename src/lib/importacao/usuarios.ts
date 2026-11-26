import type { Role } from '@prisma/client';
import * as z from 'zod';
import { NOME_PERFIL, PERFIS } from '@/lib/auth/rbac';
import { UsuarioSchema } from '@/lib/usuarios/regras';
import { normalizarCabecalho } from './tabela';
import type { LinhaAnalisada } from './disciplinas';

export const COLUNAS_USUARIO = [
  { campo: 'nome', titulo: 'Nome completo', apelidos: ['nome'], obrigatoria: true, largura: 36 },
  { campo: 'email', titulo: 'E-mail', apelidos: ['email', 'e_mail_institucional'], obrigatoria: true, largura: 34 },
  { campo: 'role', titulo: 'Perfil', apelidos: ['perfil_de_acesso', 'role'], obrigatoria: true, largura: 24 },
  { campo: 'siape', titulo: 'SIAPE', apelidos: ['matricula', 'matricula_siape'], largura: 12 },
  { campo: 'whatsapp', titulo: 'WhatsApp', apelidos: ['telefone', 'celular'], largura: 18 },
] as const;

export type CampoUsuario = (typeof COLUNAS_USUARIO)[number]['campo'];
export type RegistroUsuario = Record<CampoUsuario, string>;

export const OPCOES_PERFIL_PLANILHA = PERFIS.map((p) => NOME_PERFIL[p]);

/** Domínio reservado das linhas de exemplo do modelo: nunca é importado por engano. */
export const DOMINIO_EXEMPLO = 'exemplo.com';

/** "Professor(a)", "professor", "PROFESSOR", "Coordenação", "coordenador" → Role. */
export function lerPerfil(valor: string): Role | null {
  const v = normalizarCabecalho(valor);
  for (const p of PERFIS) {
    if (v === normalizarCabecalho(p) || v === normalizarCabecalho(NOME_PERFIL[p])) return p;
  }
  if (v.startsWith('professor') || v === 'docente') return 'PROFESSOR';
  if (v.startsWith('coordena')) return 'COORDENADOR';
  if (v.startsWith('assistencia')) return 'ASSISTENCIA_ESTUDANTIL';
  if (v === 'controle_academico' || v.startsWith('cca')) return 'CCA';
  return null;
}

export type DadosUsuarioNovo = z.infer<typeof UsuarioSchema>;

export interface PlanoImportacaoUsuarios {
  linhas: LinhaAnalisada[];
  criar: DadosUsuarioNovo[];
  temErros: boolean;
}

/**
 * Valida as linhas com as mesmas regras do formulário. A importação só CRIA contas: e-mail já
 * cadastrado é ignorado (para alterar alguém, use a tela do usuário). SIAPE de outra pessoa é erro.
 */
export function planejarImportacaoUsuarios(params: {
  registros: { numero: number; valores: RegistroUsuario }[];
  emailsExistentes: ReadonlySet<string>;
  siapesExistentes: ReadonlySet<string>;
}): PlanoImportacaoUsuarios {
  const plano: PlanoImportacaoUsuarios = { linhas: [], criar: [], temErros: false };
  const emails = new Map<string, number>();
  const siapes = new Map<string, number>();
  const erro = (numero: number, descricao: string, detalhe: string) => {
    plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe });
    plano.temErros = true;
  };

  for (const { numero, valores } of params.registros) {
    const descricao = valores.nome || valores.email || '(sem nome)';
    const perfil = lerPerfil(valores.role);
    const r = UsuarioSchema.safeParse({ ...valores, role: perfil ?? '' });
    if (!r.success) {
      const porCampo = z.flattenError(r.error).fieldErrors as Record<string, string[] | undefined>;
      const rotulos: Record<string, string> = { nome: 'Nome', email: 'E-mail', role: 'Perfil', siape: 'SIAPE', whatsapp: 'WhatsApp' };
      const msgs = Object.entries(porCampo).flatMap(([c, m]) => (m?.length ? [`${rotulos[c] ?? c}: ${m[0]}`] : []));
      if (porCampo.role?.length) msgs.splice(msgs.findIndex((m) => m.startsWith('Perfil')), 1, `Perfil: use ${OPCOES_PERFIL_PLANILHA.join(', ')}.`);
      erro(numero, descricao, msgs.join(' '));
      continue;
    }
    const d = r.data;
    if (d.email.endsWith(`@${DOMINIO_EXEMPLO}`)) {
      erro(numero, descricao, 'Linha de exemplo do modelo: substitua pelos dados reais ou apague a linha.');
      continue;
    }
    const emailRepetido = emails.get(d.email);
    if (emailRepetido) {
      erro(numero, descricao, `E-mail repetido na linha ${emailRepetido} desta planilha.`);
      continue;
    }
    emails.set(d.email, numero);
    if (params.emailsExistentes.has(d.email)) {
      plano.linhas.push({ numero, descricao, situacao: 'ignorar', detalhe: 'Já cadastrado: não será alterado. Para mudar dados ou perfil, use a tela do usuário.' });
      continue;
    }
    if (d.siape) {
      const siapeRepetido = siapes.get(d.siape);
      if (siapeRepetido) {
        erro(numero, descricao, `SIAPE repetido na linha ${siapeRepetido} desta planilha.`);
        continue;
      }
      if (params.siapesExistentes.has(d.siape)) {
        erro(numero, descricao, 'SIAPE já pertence a outro usuário cadastrado.');
        continue;
      }
      siapes.set(d.siape, numero);
    }
    plano.criar.push(d);
    plano.linhas.push({ numero, descricao, situacao: 'criar', detalhe: NOME_PERFIL[d.role] });
  }
  return plano;
}

export const EXEMPLOS_USUARIOS: string[][] = [
  ['Maria Exemplo da Silva', `maria.exemplo@${DOMINIO_EXEMPLO}`, NOME_PERFIL.PROFESSOR, '1234567', '(88) 99999-0001'],
  ['João Exemplo Souza', `joao.exemplo@${DOMINIO_EXEMPLO}`, NOME_PERFIL.PROFESSOR, '', ''],
  ['Ana Exemplo Lima', `ana.exemplo@${DOMINIO_EXEMPLO}`, NOME_PERFIL.CTP, '', ''],
];

export const INSTRUCOES_USUARIOS = [
  'Importação de usuários — SGC-Redes',
  'Preencha a aba "Dados", uma pessoa por linha, e envie o arquivo em Usuários › Importar planilha. Antes de gravar, o sistema mostra quem será cadastrado.',
  `As linhas de exemplo (e-mails @${DOMINIO_EXEMPLO}) são recusadas: substitua-as pelos dados reais ou apague-as.`,
  'A planilha só cadastra pessoas novas. E-mails já cadastrados são ignorados; para alterar alguém, use a tela do usuário.',
  'Nome completo e E-mail institucional: obrigatórios. O e-mail é o login.',
  `Perfil: ${OPCOES_PERFIL_PLANILHA.join(', ')}.`,
  'SIAPE (opcional): 7 dígitos. WhatsApp (opcional): DDD + número, ex.: (88) 99999-8888.',
  'Cada pessoa recebe uma senha provisória, exibida uma única vez ao final da importação (com opção de baixar a lista) e trocada no primeiro acesso.',
  'Pode salvar como .xlsx ou .csv. Máximo de 500 linhas por envio.',
];
