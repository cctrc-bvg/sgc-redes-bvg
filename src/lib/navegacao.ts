import type { Role } from '@prisma/client';
import { temPermissao, type Permissao } from '@/lib/auth/rbac';

/** Nome do ícone de cada função (ver src/components/icone.tsx). */
export type NomeIcone =
  | 'inicio'
  | 'calendario'
  | 'grade'
  | 'minha-grade'
  | 'ausencias'
  | 'alimentacao'
  | 'comunicacao'
  | 'ppe'
  | 'ppi'
  | 'diarios'
  | 'processos'
  | 'relatorios'
  | 'usuarios'
  | 'turmas'
  | 'disciplinas'
  | 'ofertas'
  | 'auditoria'
  | 'ajuda'
  | 'contato'
  | 'senha'
  | 'alerta'
  | 'funcoes'
  | 'relogio'
  | 'ok';

export type GrupoFuncao = 'Operação' | 'Acompanhamento' | 'Cadastros';

export interface Funcao {
  id: string;
  href: string;
  rotulo: string;
  /** Uma linha sobre o que se faz ali, na linguagem de quem usa. */
  descricao: string;
  icone: NomeIcone;
  grupo: GrupoFuncao;
  /** A função aparece para quem tiver qualquer uma destas permissões. */
  requer: readonly Permissao[];
}

/**
 * Funções do sistema, na ordem de exibição: fonte única do menu do cabeçalho e do menu "Todas as funções" do painel.
 * Cada função leva o mesmo ícone nos dois lugares, para o usuário associar o desenho à tarefa.
 */
export const FUNCOES: readonly Funcao[] = [
  { id: 'calendario', href: '/calendario', rotulo: 'Calendário', descricao: 'Dias letivos, feriados, sábados letivos e eventos.', icone: 'calendario', grupo: 'Operação', requer: ['calendario:ver'] },
  { id: 'minha-grade', href: '/grade/minha', rotulo: 'Minha grade', descricao: 'Suas aulas da semana, mudanças e convites de substituição.', icone: 'minha-grade', grupo: 'Operação', requer: ['substituicao:responder'] },
  { id: 'grade', href: '/grade', rotulo: 'Grade', descricao: 'Horários das turmas, janelas livres e sábados letivos.', icone: 'grade', grupo: 'Operação', requer: ['grade:ver'] },
  { id: 'ausencias', href: '/ausencias', rotulo: 'Ausências', descricao: 'Registrar faltas de docentes e decidir a cobertura.', icone: 'ausencias', grupo: 'Operação', requer: ['ausencias:registrar'] },
  { id: 'alimentacao', href: '/alimentacao', rotulo: 'Alimentação', descricao: 'Previsão de refeições e avisos à Assistência Estudantil.', icone: 'alimentacao', grupo: 'Operação', requer: ['alimentacao:ver'] },
  { id: 'comunicacao', href: '/comunicacao', rotulo: 'Comunicação', descricao: 'Mensagens prontas por e-mail ou WhatsApp e textos-padrão.', icone: 'comunicacao', grupo: 'Operação', requer: ['comunicacao:enviar'] },
  { id: 'ppe', href: '/ppe', rotulo: 'PPE / PEI', descricao: 'Progressão Parcial de Estudos e Planos de Estudo Individual.', icone: 'ppe', grupo: 'Acompanhamento', requer: ['ppe:ver'] },
  { id: 'ppi', href: '/ppi', rotulo: 'PPI (40h)', descricao: 'Solicitações e auditoria da Prática Profissional Integrada.', icone: 'ppi', grupo: 'Acompanhamento', requer: ['ppi:ver'] },
  { id: 'diarios', href: '/diarios', rotulo: 'Diários', descricao: 'Aulas ministradas e diários em dia, por disciplina.', icone: 'diarios', grupo: 'Acompanhamento', requer: ['diarios:ver-proprios', 'diarios:ver-todos'] },
  { id: 'processos', href: '/processos', rotulo: 'Processos SEI', descricao: 'Quadro de processos e atendimentos com prazos.', icone: 'processos', grupo: 'Acompanhamento', requer: ['kanban:ver'] },
  { id: 'relatorios', href: '/relatorios', rotulo: 'Relatórios', descricao: 'Faltas, substituições, PPE e PPI consolidados.', icone: 'relatorios', grupo: 'Acompanhamento', requer: ['relatorios:ver'] },
  { id: 'usuarios', href: '/usuarios', rotulo: 'Usuários', descricao: 'Contas, perfis e senhas provisórias.', icone: 'usuarios', grupo: 'Cadastros', requer: ['usuarios:gerenciar'] },
  { id: 'turmas', href: '/turmas', rotulo: 'Turmas', descricao: 'Turmas, estudantes ativos e médias de refeição.', icone: 'turmas', grupo: 'Cadastros', requer: ['turmas:gerenciar'] },
  { id: 'disciplinas', href: '/disciplinas', rotulo: 'Disciplinas', descricao: 'Matriz do curso: carga horária, prática e programa.', icone: 'disciplinas', grupo: 'Cadastros', requer: ['disciplinas:ver'] },
  { id: 'ofertas', href: '/ofertas', rotulo: 'Ofertas', descricao: 'Distribuição das disciplinas aos docentes no ano.', icone: 'ofertas', grupo: 'Cadastros', requer: ['ofertas:gerenciar'] },
  { id: 'auditoria', href: '/auditoria', rotulo: 'Auditoria', descricao: 'Quem fez o quê e quando (LGPD).', icone: 'auditoria', grupo: 'Cadastros', requer: ['auditoria:ver'] },
];

/** Atalhos da conta, para todos os perfis. */
export const FUNCOES_DA_CONTA = [
  { id: 'ajuda', href: '/ajuda', rotulo: 'Ajuda', descricao: 'Como usar cada parte do sistema.', icone: 'ajuda' },
  { id: 'contato', href: '/conta/contato', rotulo: 'Meu contato', descricao: 'Seu WhatsApp e como prefere ser avisado.', icone: 'contato' },
  { id: 'senha', href: '/conta/senha', rotulo: 'Alterar senha', descricao: 'Troque a sua senha de acesso.', icone: 'senha' },
] as const satisfies readonly Omit<Funcao, 'grupo' | 'requer'>[];

export const GRUPOS: readonly GrupoFuncao[] = ['Operação', 'Acompanhamento', 'Cadastros'];

/** Funções que o perfil pode abrir, na ordem de exibição. */
export function funcoesDoPerfil(perfil: Role): Funcao[] {
  return FUNCOES.filter((f) => f.requer.some((p) => temPermissao(perfil, p)));
}

/** Funções do perfil agrupadas, sem grupos vazios. */
export function funcoesPorGrupo(perfil: Role): { grupo: GrupoFuncao; funcoes: Funcao[] }[] {
  const minhas = funcoesDoPerfil(perfil);
  return GRUPOS.map((grupo) => ({ grupo, funcoes: minhas.filter((f) => f.grupo === grupo) })).filter((g) => g.funcoes.length > 0);
}
