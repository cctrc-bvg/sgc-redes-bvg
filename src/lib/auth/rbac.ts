import type { Role } from '@prisma/client';

/**
 * Controle de acesso por perfil (RBAC) — FSD, seção 2.
 *
 * Toda verificação de acesso deve passar por `temPermissao`, tanto nas telas (o que exibir)
 * quanto nas Server Actions e consultas (o que permitir). Esconder um menu não basta.
 */
export const PERMISSOES = [
  'grade:ver',
  'grade:editar',
  'ausencias:registrar',
  'ausencias:informar', // RF02-A: o docente informa a própria ausência
  'substituicao:responder',
  'alimentacao:ver',
  'alimentacao:confirmar', // Assistência Estudantil dá ciência do aviso
  'alimentacao:gerenciar',
  'comunicacao:enviar',
  'ppe:ver',
  'ppe:definir', // docente define PEI ou Dependência (Arts. 117–118)
  'ppe:gerenciar',
  'ppi:ver',
  'ppi:gerenciar',
  'diarios:ver-proprios',
  'diarios:ver-todos',
  'kanban:ver',
  'kanban:gerenciar',
  'kanban:ver-sigiloso', // Art. 22, VIII — exclusivo da Coordenação
  'relatorios:ver',
  'usuarios:gerenciar',
  'disciplinas:ver', // consulta ao catálogo (carga horária, prática, programa)
  'disciplinas:gerenciar', // Art. 22, III e IX — estrutura curricular, programas e ementas
  'ofertas:gerenciar', // Art. 22, XXIV — distribuição de disciplinas aos docentes
  'turmas:gerenciar', // cadastro das turmas, estudantes ativos e médias de refeição
  'auditoria:ver',
  'calendario:ver', // calendário acadêmico: dias letivos, etapas e eventos
  'calendario:gerenciar',
] as const;

export type Permissao = (typeof PERMISSOES)[number];

/** Permissões da docência: do Professor e de quem, em outro cargo, também leciona. */
export const PERMISSOES_DOCENCIA: readonly Permissao[] = ['grade:ver', 'substituicao:responder', 'ausencias:informar', 'ppe:ver', 'ppe:definir', 'diarios:ver-proprios', 'disciplinas:ver', 'calendario:ver'];

const PERMISSOES_POR_PERFIL: Record<Role, readonly Permissao[]> = {
  COORDENADOR: PERMISSOES,
  PROFESSOR: PERMISSOES_DOCENCIA,
  CTP: ['ppe:ver', 'kanban:ver', 'relatorios:ver', 'disciplinas:ver', 'calendario:ver'],
  DIRECAO: ['relatorios:ver', 'disciplinas:ver', 'calendario:ver'],
  // Minimização de dados (LGPD): apenas refeições, sem notas, PPI, PPE, processos ou motivos.
  ASSISTENCIA_ESTUDANTIL: ['alimentacao:ver', 'alimentacao:confirmar', 'calendario:ver'],
};

/**
 * Quem tem as permissões: só o perfil (cargo) ou a conta, que pode somar a docência ao cargo (`leciona`).
 * Passe a conta sempre que a tiver; só o perfil vale como "não leciona" (exceto PROFESSOR).
 */
export type Titular = Role | { role: Role; leciona?: boolean | null };

const comoConta = (t: Titular) => (typeof t === 'string' ? { role: t, leciona: false } : t);

/** Leciona: Professor ou outro cargo com a docência acumulada. */
export function ehDocente(t: Titular): boolean {
  const c = comoConta(t);
  return c.role === 'PROFESSOR' || Boolean(c.leciona);
}

/** Acumula dois papéis (cargo + docência): a tela distingue as ações de cada um. */
export function acumulaDocencia(t: Titular): boolean {
  return ehDocente(t) && comoConta(t).role !== 'PROFESSOR';
}

export function permissoesDoPerfil(t: Titular): readonly Permissao[] {
  const { role } = comoConta(t);
  if (!acumulaDocencia(t)) return PERMISSOES_POR_PERFIL[role];
  return PERMISSOES.filter((p) => PERMISSOES_POR_PERFIL[role].includes(p) || PERMISSOES_DOCENCIA.includes(p));
}

export function temPermissao(t: Titular, permissao: Permissao): boolean {
  return PERMISSOES_POR_PERFIL[comoConta(t).role].includes(permissao) || (ehDocente(t) && PERMISSOES_DOCENCIA.includes(permissao));
}

/** Permissão que vem do cargo (sem contar a docência): ex.: a CTP vê todas as PPEs mesmo se também lecionar. */
export function temPermissaoDoCargo(t: Titular, permissao: Permissao): boolean {
  const { role } = comoConta(t);
  return role !== 'PROFESSOR' && PERMISSOES_POR_PERFIL[role].includes(permissao);
}

/** Perfis na ordem de exibição. */
export const PERFIS: readonly Role[] = ['COORDENADOR', 'PROFESSOR', 'CTP', 'DIRECAO', 'ASSISTENCIA_ESTUDANTIL'];

export const NOME_PERFIL: Record<Role, string> = {
  COORDENADOR: 'Coordenação',
  PROFESSOR: 'Professor(a)',
  CTP: 'CTP',
  DIRECAO: 'Direção',
  ASSISTENCIA_ESTUDANTIL: 'Assistência Estudantil',
};

export interface Modulo {
  id: string;
  titulo: string;
  descricao: string;
  fase: 1 | 2;
  /** O módulo aparece para quem tiver qualquer uma destas permissões. */
  requer: readonly Permissao[];
  /** Endereço do módulo, quando já disponível. */
  href?: string;
}

/** Módulos das Fases 1 e 2 (FSD, seções 3 e 4), na ordem de exibição. */
export const MODULOS: readonly Modulo[] = [
  { id: 'calendario', titulo: 'Calendário acadêmico', descricao: 'Dias letivos, etapas N1–N4, sábados letivos, feriados e eventos.', fase: 1, requer: ['calendario:ver'], href: '/calendario' },
  { id: 'grade', titulo: 'Grade e substituições', descricao: 'Horários das turmas, janelas livres e remanejamentos.', fase: 1, requer: ['grade:ver'], href: '/grade' },
  { id: 'alimentacao', titulo: 'Alimentação', descricao: 'Previsão e alterações de refeições por turma.', fase: 1, requer: ['alimentacao:ver'], href: '/alimentacao' },
  { id: 'comunicacao', titulo: 'Comunicação', descricao: 'Mensagens prontas por e-mail ou WhatsApp, textos-padrão e histórico.', fase: 1, requer: ['comunicacao:enviar'], href: '/comunicacao' },
  { id: 'ppe', titulo: 'PPE / PEI', descricao: 'Progressão Parcial de Estudos e Planos de Estudo Individual.', fase: 2, requer: ['ppe:ver'], href: '/ppe' },
  { id: 'ppi', titulo: 'PPI (40h)', descricao: 'Cálculo e auditoria da Prática Profissional Integrada.', fase: 2, requer: ['ppi:ver'], href: '/ppi' },
  { id: 'diarios', titulo: 'Diários', descricao: 'Semáforo de carga horária e preenchimento de diários.', fase: 2, requer: ['diarios:ver-proprios', 'diarios:ver-todos'], href: '/diarios' },
  { id: 'processos', titulo: 'Processos SEI', descricao: 'Kanban de processos e atendimentos.', fase: 2, requer: ['kanban:ver'], href: '/processos' },
  { id: 'relatorios', titulo: 'Relatórios', descricao: 'Faltas, substituições, PPE e PPI consolidados.', fase: 2, requer: ['relatorios:ver'], href: '/relatorios' },
];

export function modulosDoPerfil(perfil: Role): Modulo[] {
  return MODULOS.filter((m) => m.requer.some((p) => temPermissao(perfil, p)));
}
