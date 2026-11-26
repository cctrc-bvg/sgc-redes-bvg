import { acumulaDocencia, temPermissao, type Permissao, type Titular } from '@/lib/auth/rbac';

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

export type GrupoFuncao = 'Operação' | 'Acompanhamento' | 'Cadastros' | 'Docência';

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
  /** Não aparece para quem tem esta permissão (ex.: quem registra ausências não precisa "informar"). */
  ocultarCom?: Permissao;
}

/**
 * Funções do sistema, na ordem de exibição: fonte única do menu do cabeçalho e do menu "Todas as funções" do painel.
 * Cada função leva o mesmo ícone nos dois lugares, para o usuário associar o desenho à tarefa.
 */
export const FUNCOES: readonly Funcao[] = [
  { id: 'calendario', href: '/calendario', rotulo: 'Calendário', descricao: 'Dias letivos, feriados, sábados letivos e eventos.', icone: 'calendario', grupo: 'Operação', requer: ['calendario:ver'] },
  { id: 'minha-grade', href: '/grade/minha', rotulo: 'Minha grade', descricao: 'Suas aulas da semana, mudanças e convites de substituição.', icone: 'minha-grade', grupo: 'Operação', requer: ['substituicao:responder'] },
  { id: 'informar-ausencia', href: '/ausencias/informar', rotulo: 'Informar ausência', descricao: 'Avise a Coordenação de uma ausência sua (um dia ou um período).', icone: 'ausencias', grupo: 'Operação', requer: ['ausencias:informar'], ocultarCom: 'ausencias:registrar' },
  { id: 'grade', href: '/grade', rotulo: 'Grade', descricao: 'Horários das turmas, janelas livres e sábados letivos.', icone: 'grade', grupo: 'Operação', requer: ['grade:ver'] },
  { id: 'ausencias', href: '/ausencias', rotulo: 'Ausências', descricao: 'Registrar faltas de docentes e decidir a ocupação dos horários.', icone: 'ausencias', grupo: 'Operação', requer: ['ausencias:registrar'] },
  { id: 'alimentacao', href: '/alimentacao', rotulo: 'Alimentação', descricao: 'Previsão de refeições e avisos à Assistência Estudantil.', icone: 'alimentacao', grupo: 'Operação', requer: ['alimentacao:ver'] },
  { id: 'comunicacao', href: '/comunicacao', rotulo: 'Comunicação', descricao: 'Mensagens prontas por e-mail ou WhatsApp e textos-padrão.', icone: 'comunicacao', grupo: 'Operação', requer: ['comunicacao:enviar'] },
  { id: 'ppe', href: '/ppe', rotulo: 'PPE / PEI', descricao: 'Progressão Parcial de Estudos e Planos de Estudo Individual.', icone: 'ppe', grupo: 'Acompanhamento', requer: ['ppe:ver'] },
  { id: 'ppi', href: '/ppi', rotulo: 'PPI (40h)', descricao: 'Solicitações e auditoria da Prática Profissional Integrada.', icone: 'ppi', grupo: 'Acompanhamento', requer: ['ppi:ver'] },
  { id: 'diarios', href: '/diarios', rotulo: 'Diários', descricao: 'Aulas ministradas e diários em dia, por disciplina.', icone: 'diarios', grupo: 'Acompanhamento', requer: ['diarios:ver-proprios', 'diarios:ver-todos', 'diarios:acompanhar'] },
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

/**
 * Funções da docência para quem a acumula a outro cargo: o recorte "meu" das telas que o cargo vê por inteiro.
 * (Para o Professor, as próprias funções já são esse recorte.)
 */
export const FUNCOES_DOCENCIA: readonly Funcao[] = [
  { id: 'minha-grade', href: '/grade/minha', rotulo: 'Minha grade', descricao: 'Suas aulas da semana, mudanças e convites de substituição.', icone: 'minha-grade', grupo: 'Docência', requer: ['substituicao:responder'] },
  { id: 'informar-ausencia', href: '/ausencias/informar', rotulo: 'Informar ausência', descricao: 'Avise a Coordenação de uma ausência sua (um dia ou um período).', icone: 'ausencias', grupo: 'Docência', requer: ['ausencias:informar'] },
  { id: 'meus-diarios', href: '/diarios?escopo=meus', rotulo: 'Meus diários', descricao: 'Aulas ministradas e diário em dia nas suas disciplinas.', icone: 'diarios', grupo: 'Docência', requer: ['diarios:ver-proprios'] },
  { id: 'minhas-ppe', href: '/ppe?escopo=minhas', rotulo: 'Minhas PPE / PEI', descricao: 'Definir a modalidade e preencher o PEI das suas disciplinas.', icone: 'ppe', grupo: 'Docência', requer: ['ppe:definir'] },
];

/** Funções que a conta pode abrir, na ordem de exibição. */
export function funcoesDoPerfil(conta: Titular): Funcao[] {
  return FUNCOES.filter((f) => f.requer.some((p) => temPermissao(conta, p)) && !(f.ocultarCom && temPermissao(conta, f.ocultarCom)));
}

/**
 * Funções agrupadas, sem grupos vazios. Quem acumula a docência a outro cargo vê os grupos do cargo e, à parte,
 * o grupo "Docência" (com as funções que só a docência libera, como a Grade para a Direção).
 */
export function funcoesPorGrupo(conta: Titular): { grupo: GrupoFuncao; funcoes: Funcao[] }[] {
  const agrupar = (lista: readonly Funcao[]) =>
    GRUPOS.map((grupo) => ({ grupo, funcoes: lista.filter((f) => f.grupo === grupo) })).filter((g) => g.funcoes.length > 0);
  if (typeof conta === 'string' || !acumulaDocencia(conta)) return agrupar(funcoesDoPerfil(conta));
  const doCargo = funcoesDoPerfil(conta.role).filter((f) => f.id !== 'minha-grade');
  const cobertas = new Set(['minha-grade', 'informar-ausencia', 'diarios', 'ppe']);
  const soDaDocencia = funcoesDoPerfil(conta).filter((f) => !doCargo.includes(f) && !cobertas.has(f.id));
  return [...agrupar(doCargo), { grupo: 'Docência', funcoes: [...FUNCOES_DOCENCIA, ...soDaDocencia.map((f) => ({ ...f, grupo: 'Docência' as const }))] }];
}
