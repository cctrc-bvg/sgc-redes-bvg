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
  'auditoria:ver',
] as const;

export type Permissao = (typeof PERMISSOES)[number];

const PERMISSOES_POR_PERFIL: Record<Role, readonly Permissao[]> = {
  COORDENADOR: PERMISSOES,
  PROFESSOR: ['grade:ver', 'substituicao:responder', 'ppe:ver', 'ppe:definir', 'diarios:ver-proprios', 'disciplinas:ver'],
  CTP: ['ppe:ver', 'kanban:ver', 'relatorios:ver', 'disciplinas:ver'],
  DIRECAO: ['relatorios:ver', 'disciplinas:ver'],
  // Minimização de dados (LGPD): apenas refeições, sem notas, PPI, PPE, processos ou motivos.
  ASSISTENCIA_ESTUDANTIL: ['alimentacao:ver', 'alimentacao:confirmar'],
};

export function permissoesDoPerfil(perfil: Role): readonly Permissao[] {
  return PERMISSOES_POR_PERFIL[perfil];
}

export function temPermissao(perfil: Role, permissao: Permissao): boolean {
  return PERMISSOES_POR_PERFIL[perfil].includes(permissao);
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
  { id: 'grade', titulo: 'Grade e substituições', descricao: 'Horários das turmas, janelas livres e remanejamentos.', fase: 1, requer: ['grade:ver'], href: '/grade' },
  { id: 'alimentacao', titulo: 'Alimentação', descricao: 'Previsão e alterações de refeições por turma.', fase: 1, requer: ['alimentacao:ver'] },
  { id: 'comunicacao', titulo: 'Comunicação', descricao: 'Mensagens padronizadas para os grupos de WhatsApp.', fase: 1, requer: ['comunicacao:enviar'] },
  { id: 'ppe', titulo: 'PPE / PEI', descricao: 'Progressão Parcial de Estudos e Planos de Estudo Individual.', fase: 2, requer: ['ppe:ver'] },
  { id: 'ppi', titulo: 'PPI (40h)', descricao: 'Cálculo e auditoria da Prática Profissional Integrada.', fase: 2, requer: ['ppi:ver'] },
  { id: 'diarios', titulo: 'Diários', descricao: 'Semáforo de carga horária e preenchimento de diários.', fase: 2, requer: ['diarios:ver-proprios', 'diarios:ver-todos'] },
  { id: 'processos', titulo: 'Processos SEI', descricao: 'Kanban de processos e atendimentos.', fase: 2, requer: ['kanban:ver'] },
  { id: 'relatorios', titulo: 'Relatórios', descricao: 'Faltas, substituições, PPE e PPI consolidados.', fase: 2, requer: ['relatorios:ver'] },
];

export function modulosDoPerfil(perfil: Role): Modulo[] {
  return MODULOS.filter((m) => m.requer.some((p) => temPermissao(perfil, p)));
}
