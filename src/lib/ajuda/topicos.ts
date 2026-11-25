/**
 * Conteúdo do módulo Ajuda (manual do usuário). Fonte única para:
 * - as páginas /ajuda e /ajuda/[topico] (filtradas pelo perfil de quem lê);
 * - o manual em Markdown (docs/MANUAL_DO_USUARIO.md, gerado por `npm run manual`);
 * - as capturas de tela (`npm run capturas`, que visita `imagens[].captura`).
 *
 * Ao mudar uma tela, atualize o texto aqui e gere de novo as capturas do tópico.
 */
import type { Permissao } from '@/lib/auth/rbac';

export type PerfilCaptura = 'coordenacao' | 'professor' | 'ctp' | 'direcao' | 'cae';

export interface ImagemAjuda {
  /** Arquivo em public/manual/ (servido em /manual/). */
  arquivo: string;
  /** Texto alternativo: o que a imagem mostra (leitores de tela). */
  alt: string;
  legenda: string;
  /** Como gerar a captura com os dados de demonstração. */
  captura: {
    rota: string;
    perfil: PerfilCaptura;
    /** Seletor de um link a clicar depois de abrir a rota (ex.: o primeiro item de uma lista). */
    clicar?: string;
    /** Seletor de um elemento para centralizar na captura. */
    focar?: string;
    /** Captura a página inteira (rolagem). */
    paginaInteira?: boolean;
  };
}

export interface EtapaFluxo {
  rotulo: string;
  /** Quem faz a etapa (perfil ou "Sistema"). */
  ator: string;
  detalhe?: string;
  /** Onde a etapa acontece: a tela (como aparece no menu) e, se houver, o endereço para abrir direto. */
  onde?: { tela: string; rota?: string };
}

export interface FluxoAjuda {
  titulo: string;
  /** Quem executa, em texto livre (ex.: "Coordenação"). */
  quem: string;
  passos: string[];
}

export interface TopicoAjuda {
  id: string;
  titulo: string;
  resumo: string;
  /** Permissão que dá acesso ao tópico; null = todos os usuários. */
  permissao: Permissao | null;
  /** Endereço da funcionalidade no sistema. */
  rota?: string;
  capacidades: string[];
  /** Fluxo principal, desenhado como fluxograma. */
  diagrama?: { titulo: string; etapas: EtapaFluxo[] };
  fluxos: FluxoAjuda[];
  imagens: ImagemAjuda[];
  duvidas: { pergunta: string; resposta: string }[];
  relacionados: string[];
}


export const TOPICOS: readonly TopicoAjuda[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros passos',
    resumo: 'Acesso, troca de senha, tela inicial, menus e preferências de contato.',
    permissao: null,
    rota: '/painel',
    capacidades: [
      'Entrar com o e-mail institucional e a senha recebida da Coordenação.',
      'Trocar a senha provisória no primeiro acesso (obrigatório).',
      'Na tela inicial, ver primeiro o que precisa da sua atenção agora (do mais urgente ao menos), com um botão para resolver cada item.',
      'Abrir "Todas as funções" com um clique: cada função tem um ícone, o mesmo do menu do cabeçalho. Sem pendências, o menu já vem aberto.',
      'Acompanhar a agenda: o professor vê a própria semana (aulas, feriados, substituições); a Assistência Estudantil, as refeições previstas para hoje e amanhã; os demais perfis, o mês do calendário acadêmico e os próximos eventos (a Coordenação, também as ausências de hoje).',
      'Se você tem um cargo (Coordenação, Direção, CTP) e também leciona, ver tudo junto: o que é do cargo em verde e o que é da docência em azul, sempre com o nome "Docência" escrito.',
      'Voltar à tela inicial de qualquer página pelo botão "Início" do cabeçalho.',
      'Informar seu WhatsApp e dizer se aceita recebê-lo pelo sistema (Meu contato).',
      'Sair do sistema em qualquer página (botão Sair). A sessão expira após 8 horas sem uso.',
    ],
    diagrama: {
      titulo: 'Primeiro acesso',
      etapas: [
        { rotulo: 'Cadastro', ator: 'Coordenação', detalhe: 'cria o usuário e entrega a senha provisória em mensagem privada', onde: { tela: 'Cadastros › Usuários', rota: '/usuarios' } },
        { rotulo: 'Login', ator: 'Você', detalhe: 'e-mail institucional + senha provisória', onde: { tela: 'Entrada', rota: '/login' } },
        { rotulo: 'Nova senha', ator: 'Você', detalhe: '10+ caracteres, com letras e números', onde: { tela: 'Alterar senha', rota: '/conta/senha' } },
        { rotulo: 'Tela inicial', ator: 'Sistema', detalhe: 'o que pede atenção, as funções do seu perfil e a agenda', onde: { tela: 'Início', rota: '/painel' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Entrar pela primeira vez',
        quem: 'Todos',
        passos: [
          'Abra o endereço do sistema e informe seu e-mail institucional e a senha provisória.',
          'O sistema pede uma nova senha: use pelo menos 10 caracteres, com letras e números, diferente da provisória.',
          'Pronto: a tela inicial mostra o que precisa da sua atenção, as funções do seu perfil e a sua agenda.',
        ],
      },
      {
        titulo: 'Ajustar preferências de contato',
        quem: 'Todos',
        passos: [
          'No cabeçalho, clique no seu nome e escolha "Meu contato".',
          'Informe o WhatsApp (a máscara preenche o formato) e marque se aceita que o sistema use esse número.',
          'Sem WhatsApp, todas as mensagens continuam disponíveis para envio pelo e-mail institucional.',
        ],
      },
      {
        titulo: 'Tenho um cargo e também dou aula',
        quem: 'Coordenação, Direção, CTP ou AE que lecionam',
        passos: [
          'Peça à Coordenação para marcar "Também leciona" no seu cadastro (em Usuários). Ao receber uma disciplina pela planilha de ofertas, a marca liga sozinha.',
          'Na tela inicial, os cartões trazem o selo do papel: "Docência" (azul) para convites de substituição, PPE e diários seus; o nome do cargo (verde) para o resto.',
          'No cabeçalho, o menu "Docência" reúne Minha grade, Meus diários e Minhas PPE / PEI.',
          'Em PPE e Diários, alterne entre "Todas" (o que o cargo acompanha) e "Minhas" (as suas disciplinas).',
          'Na agenda, "Minha semana" mostra as suas aulas; o calendário do mês fica recolhido logo abaixo.',
        ],
      },
      {
        titulo: 'Esqueci a senha',
        quem: 'Todos',
        passos: [
          'Peça à Coordenação: em Usuários, ela gera uma nova senha provisória para você.',
          'No próximo acesso, o sistema pede a troca da senha.',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'primeiros-passos-login.jpg',
        alt: 'Tela de login com os campos e-mail e senha e o botão Entrar.',
        legenda: 'Tela de entrada: e-mail institucional e senha.',
        captura: { rota: '/login', perfil: 'coordenacao' },
      },
      {
        arquivo: 'primeiros-passos-painel.jpg',
        alt: 'Tela inicial da Coordenação: cartões "Precisa da sua atenção" com quantidade e botão para resolver, o menu "Todas as funções" fechado e, o selo "Docência" em azul nas ações das disciplinas que a coordenadora leciona; ao lado, as ausências de hoje, a semana de aulas dela e o calendário do mês recolhido.',
        legenda: 'Tela inicial da Coordenação que também leciona: o cargo em verde, a docência em azul.',
        captura: { rota: '/painel', perfil: 'coordenacao' },
      },
      {
        arquivo: 'primeiros-passos-painel-professor.jpg',
        alt: 'Tela inicial de um professor, com a agenda "Minha semana": aulas de cada dia, feriados e substituições.',
        legenda: 'O professor vê a própria semana; cada perfil vê só as suas funções.',
        captura: { rota: '/painel', perfil: 'professor' },
      },
    ],
    duvidas: [
      { pergunta: 'Errei a senha várias vezes e fui bloqueado. E agora?', resposta: 'Depois de 5 tentativas erradas, o login daquele e-mail fica bloqueado por 15 minutos. Espere ou peça uma nova senha à Coordenação.' },
      { pergunta: 'Um menu que eu esperava não aparece.', resposta: 'Os menus dependem do perfil (veja "Quem vê o quê" no início da Ajuda). Se precisar de outro acesso, fale com a Coordenação.' },
      { pergunta: 'Por que algumas ações aparecem em azul?', resposta: 'Para quem tem um cargo e também leciona, azul (com o selo "Docência") marca o que é da sua docência; verde, o que é do cargo. Quem tem um papel só não vê essa distinção.' },
      { pergunta: 'Onde ficaram as outras funções na tela inicial?', resposta: 'Em "Todas as funções", logo abaixo das pendências: clique para abrir. Elas também estão nos menus do cabeçalho.' },
      { pergunta: 'Preciso usar meu WhatsApp pessoal?', resposta: 'Não. Todas as comunicações funcionam pelo e-mail institucional; o WhatsApp é opcional.' },
    ],
    relacionados: ['comunicacao', 'privacidade'],
  },
  {
    id: 'calendario',
    titulo: 'Calendário acadêmico',
    resumo: 'Dias letivos, etapas N1–N4, sábados letivos, feriados, eventos e alterações imprevistas.',
    permissao: 'calendario:ver',
    rota: '/calendario',
    capacidades: [
      'Cadastrar as datas das etapas N1 a N4 e dos semestres de cada ano letivo.',
      'Cadastrar eventos: férias docentes, matrícula, encontro pedagógico, acolhida, feriados, pontos facultativos, PITs/RITs, reuniões, avaliações finais e outros.',
      'Registrar suspensões não previstas (falta de energia, de água, de transporte, luto oficial, ponto facultativo municipal…) como dias a repor.',
      'Cadastrar sábados letivos, cada um seguindo a grade de um dia da semana.',
      'Contar os dias letivos por mês, etapa, semestre e ano, comparando com a meta (50 por etapa, 200 no ano).',
      'Avaliações finais nunca contam como dias letivos (ROD, Art. 32): ficam fora da contagem e da grade, inclusive aos sábados. Acontecem só no fim do ano, depois da última semana letiva, também para as disciplinas semestrais; o sistema avisa se o período for cadastrado antes disso.',
      'Ver o ano inteiro ou um mês, imprimir/salvar em PDF e exportar/importar em planilha.',
      'Ao registrar uma alteração imprevista, abrir as mensagens prontas para avisar docentes, CAE, nutricionista, Gestão, CTP e turmas.',
    ],
    diagrama: {
      titulo: 'Montar o calendário do ano',
      etapas: [
        { rotulo: 'Etapas e semestres', ator: 'Coordenação', detalhe: 'datas de início e fim de N1–N4 e dos dois semestres', onde: { tela: 'Calendário › Etapas', rota: '/calendario/etapas' } },
        { rotulo: 'Eventos', ator: 'Coordenação', detalhe: 'feriados, recesso, reuniões, avaliações', onde: { tela: 'Calendário › Novo evento', rota: '/calendario/eventos/novo' } },
        { rotulo: 'Sábados letivos', ator: 'Coordenação', detalhe: 'data + dia cuja grade vale', onde: { tela: 'Grade › Sábados letivos', rota: '/grade/sabados' } },
        { rotulo: 'Contagem', ator: 'Sistema', detalhe: 'dias letivos por mês, etapa e ano; saldo da meta', onde: { tela: 'Calendário', rota: '/calendario' } },
        { rotulo: 'Consulta e PDF', ator: 'Todos', detalhe: 'visão anual, mensal e impressão', onde: { tela: 'Calendário › Imprimir', rota: '/calendario/imprimir' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Cadastrar as etapas do ano',
        quem: 'Coordenação',
        passos: [
          'Abra Calendário e escolha o ano (setas ← →).',
          'Clique em "Etapas e semestres" e informe início e término de N1 a N4 (e dos dois semestres, usados pelos diários).',
          'Salve. O resumo passa a mostrar os dias letivos de cada etapa e o saldo em relação à meta.',
        ],
      },
      {
        titulo: 'Cadastrar um feriado ou evento',
        quem: 'Coordenação',
        passos: [
          'Clique em "Novo evento" (ou no número do dia, na visão do mês).',
          'Escolha o tipo, as datas (término vazio = um dia) e a descrição.',
          'Marque "Sem aula" se o dia sai da contagem de dias letivos (já vem marcado para feriado, férias etc.).',
          'Salve: o evento aparece colorido no calendário e entra na contagem.',
        ],
      },
      {
        titulo: 'Registrar uma suspensão não prevista (força maior)',
        quem: 'Coordenação',
        passos: [
          'Em "Novo evento", escolha "Suspensão de aulas (força maior)" e o motivo (falta de energia, de água, de transporte, luto…).',
          'Marque "Imprevisto": o dia entra como dia letivo perdido, a repor.',
          'Ao salvar, o sistema abre as mensagens prontas para CAE, nutricionista, todos os docentes, Gestão, CTP e líderes de turma. Envie e registre cada uma.',
          'Cadastre o sábado letivo de reposição em Grade › Sábados letivos.',
        ],
      },
      {
        titulo: 'Copiar o calendário para o ano seguinte',
        quem: 'Coordenação',
        passos: [
          'No calendário do ano atual, clique em "Exportar planilha (.xlsx)".',
          'No Excel ou LibreOffice, troque as datas para o novo ano.',
          'Em "Importar planilha", escolha o novo ano, envie o arquivo, confira a prévia e confirme.',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'calendario-ano.jpg',
        alt: 'Calendário anual com o resumo de dias letivos por etapa e os doze meses coloridos por tipo de evento.',
        legenda: 'Visão anual: resumo da contagem e os 12 meses, com cores por tipo de evento.',
        captura: { rota: '/calendario', perfil: 'coordenacao', paginaInteira: true },
      },
      {
        arquivo: 'calendario-mes.jpg',
        alt: 'Visão de um mês com cada dia marcado como letivo ou sem aula e os eventos escritos no dia.',
        legenda: 'Visão do mês: clique no dia para cadastrar um evento ou no evento para editá-lo.',
        captura: { rota: '/calendario?mes=11', perfil: 'coordenacao', focar: 'table' },
      },
      {
        arquivo: 'calendario-evento.jpg',
        alt: 'Formulário de novo evento com tipo, datas, descrição, motivo e as opções Sem aula e Imprevisto.',
        legenda: 'Cadastro de evento: tipo, datas, "Sem aula" e "Imprevisto".',
        captura: { rota: '/calendario/eventos/novo', perfil: 'coordenacao' },
      },
    ],
    duvidas: [
      { pergunta: 'Por que o total do ano não bate com a soma dos meses de julho?', resposta: 'Dias fora das etapas (recesso entre N2 e N3, por exemplo) não contam como letivos, mesmo sendo dias úteis.' },
      { pergunta: 'Um feriado caiu num sábado letivo. O que acontece?', resposta: 'Evento com "Sem aula" vale também para o sábado letivo: o dia sai da contagem.' },
      { pergunta: 'A suspensão afeta outras telas?', resposta: 'Sim. Em dia sem aula pelo calendário, Ausências e Alimentação não mostram aulas nem refeições daquele dia.' },
    ],
    relacionados: ['grade', 'comunicacao', 'planilhas'],
  },
  {
    id: 'grade',
    titulo: 'Grade horária',
    resumo: 'Horários das turmas, grade individual do professor, janelas livres, sábados letivos e importação.',
    permissao: 'grade:ver',
    rota: '/grade',
    capacidades: [
      'Consultar a grade de cada turma por ano e semestre, com disciplina e professor em cada horário.',
      'Ver a sua grade individual (Minha grade) e responder convites de substituição.',
      'Informar a sua ausência à Coordenação (um dia ou um período de até 15 dias) e acompanhar a situação em "Minhas ausências" (docentes).',
      'Identificar janelas livres: horários vagos num turno em que a turma tem aula.',
      'Conferir se as aulas na grade batem com a carga horária da matriz.',
      'Editar a grade com verificação de choque de horário do professor entre turmas (Coordenação).',
      'Copiar as disciplinas anuais do 1º para o 2º semestre.',
      'Importar e exportar a grade em planilha; imprimir/salvar em PDF a grade de uma turma ou de todas.',
    ],
    diagrama: {
      titulo: 'Montar a grade do semestre',
      etapas: [
        { rotulo: 'Ofertas', ator: 'Coordenação', detalhe: 'professor de cada disciplina na turma', onde: { tela: 'Cadastros › Ofertas', rota: '/ofertas' } },
        { rotulo: 'Grade', ator: 'Coordenação', detalhe: 'pela tela ou por planilha', onde: { tela: 'Operação › Grade', rota: '/grade' } },
        { rotulo: 'Conferência', ator: 'Sistema', detalhe: 'choques de horário e aulas × matriz; a tela inicial avisa turma sem grade', onde: { tela: 'Grade › Turma' } },
        { rotulo: 'Consulta', ator: 'Professores', detalhe: 'grade da turma e Minha grade', onde: { tela: 'Minha grade', rota: '/grade/minha' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Montar a grade pela tela',
        quem: 'Coordenação',
        passos: [
          'Em Grade, escolha ano e semestre e clique em "Ver grade" da turma; depois em "Editar grade".',
          'Em cada horário, escolha a disciplina (aparecem as anuais e as técnicas do semestre).',
          'Salve. Se o professor já tiver aula em outra turma naquele horário, o sistema recusa e marca a célula.',
        ],
      },
      {
        titulo: 'Montar a grade por planilha',
        quem: 'Coordenação',
        passos: [
          'Em Grade, clique em "Importar planilha" e baixe o modelo: ele traz a grade atual ou, para turma sem grade, uma linha por aula semanal prevista de cada disciplina.',
          'Preencha Dia e Início (ou Turno e Bloco A–D) de cada aula.',
          'Escolha o modo: "Completar" muda só as linhas enviadas; "Substituir" deixa as turmas da planilha exatamente como nela.',
          'Envie, confira a prévia (erros por linha) e confirme.',
        ],
      },
      {
        titulo: 'Consultar a minha grade e responder convites',
        quem: 'Professor',
        passos: [
          'Em Grade, clique em "Ver minha grade": aparecem suas aulas em todas as turmas e os sábados letivos.',
          'Se houver convite de substituição, ele aparece no topo: aceite ou recuse.',
        ],
      },
      {
        titulo: 'Informar minha ausência',
        quem: 'Professor',
        passos: [
          'Em Minha grade, clique em "Informar ausência" (ou use o menu).',
          'Escolha a data; para vários dias, preencha também "Até" (até 15 dias). Aparecem as suas aulas pela grade.',
          'Marque as aulas e escolha um motivo operacional da lista. Nunca escreva o motivo pessoal ou médico.',
          'Envie: a Coordenação recebe o aviso na tela inicial, dá ciência e organiza a cobertura. Se a ausência for hoje, ligue também para a Coordenação.',
          'Acompanhe em "Minhas ausências"; enquanto a Coordenação não decidir, você pode cancelar.',
          'O motivo e o comprovante (ex.: atestado médico) vão direto à Coordenadoria de Gestão de Pessoas (CGP), pelo e-mail cgp.boaviagem@ifce.edu.br, fora do sistema.',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'grade-turma.jpg',
        alt: 'Quadro da grade de uma turma, com dias nas colunas e horários nas linhas, cada célula com disciplina e professor.',
        legenda: 'Grade da turma, com janelas livres destacadas e a conferência com a matriz.',
        captura: { rota: '/grade', perfil: 'coordenacao', clicar: 'a[href^="/grade/turma/"]', paginaInteira: true },
      },
      {
        arquivo: 'grade-minha.jpg',
        alt: 'Grade individual de um professor com as aulas em várias turmas e um convite de substituição.',
        legenda: 'Minha grade (professor): aulas em todas as turmas e convites de substituição.',
        captura: { rota: '/grade/minha', perfil: 'professor' },
      },
      {
        arquivo: 'grade-importar.jpg',
        alt: 'Página de importação da grade com escolha do semestre, modo completar ou substituir e os passos para baixar o modelo e enviar o arquivo.',
        legenda: 'Importação da grade por planilha.',
        captura: { rota: '/grade/importar', perfil: 'coordenacao' },
      },
    ],
    duvidas: [
      { pergunta: 'Uma disciplina não aparece para escolher na grade.', resposta: 'Ela precisa estar distribuída em Ofertas para a turma e o ano, e valer no semestre (técnicas são de um semestre só).' },
      { pergunta: 'Como funciona o sábado letivo na grade?', resposta: 'Cada sábado letivo segue a grade de um dia da semana (ex.: "grade de quarta"), cadastrado em Grade › Sábados letivos.' },
    ],
    relacionados: ['cadastros', 'ausencias', 'calendario', 'planilhas'],
  },
  {
    id: 'ausencias',
    titulo: 'Ausências e substituições',
    resumo: 'Registro de falta docente, decisão de cobertura de cada horário, convites, refeições e mensagens.',
    permissao: 'ausencias:registrar',
    rota: '/ausencias',
    capacidades: [
      'Registrar a ausência de um docente numa data: o sistema mostra as aulas dele pela grade vigente.',
      'Licença de vários dias: informe também "Até" (até 15 dias) e registre todas as aulas do período de uma vez; feriados e sábados letivos já entram na conta.',
      'Receber as ausências que os próprios docentes informam (selo "Informada pelo docente" e contagem na tela inicial) e dar ciência a eles.',
      'Para cada horário perdido: substituição por outro docente, adiantamento de uma aula posterior da turma, dispensa da turma ou decidir depois.',
      'Sugestões de cobertura priorizando professores da mesma turma e livres no horário.',
      'Convidar docentes para substituir; eles aceitam ou recusam em Minha grade.',
      'Calcular o impacto nas refeições da turma (lanches e almoço) e avisar a Assistência Estudantil com a urgência (24h, imprevisto, emergência).',
      'Gerar as mensagens prontas para docentes, CTP, Gestão, CAE, nutricionista e líderes de turma.',
    ],
    diagrama: {
      titulo: 'Da ausência à comunicação',
      etapas: [
        { rotulo: 'Registro', ator: 'Coordenação', detalhe: 'docente, data (ou período de até 15 dias) e aulas afetadas', onde: { tela: 'Ausências › Registrar', rota: '/ausencias/nova' } },
        { rotulo: 'Cobertura', ator: 'Coordenação', detalhe: 'substituir, adiantar, dispensar ou decidir depois', onde: { tela: 'Ausências › detalhe', rota: '/ausencias' } },
        { rotulo: 'Convites', ator: 'Professores', detalhe: 'aceitam ou recusam em Minha grade (ou pela tela inicial)', onde: { tela: 'Minha grade', rota: '/grade/minha' } },
        { rotulo: 'Refeições', ator: 'Sistema', detalhe: 'calcula o impacto e avisa a CAE', onde: { tela: 'Alimentação', rota: '/alimentacao' } },
        { rotulo: 'Mensagens', ator: 'Coordenação', detalhe: 'envia por e-mail ou WhatsApp e registra', onde: { tela: 'Ausências › detalhe › Comunicar' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Registrar uma ausência',
        quem: 'Coordenação',
        passos: [
          'Em Ausências, clique em "Registrar ausência".',
          'Escolha o docente e a data: aparecem as aulas dele naquele dia. Para vários dias, preencha também "Até": as aulas aparecem separadas por dia.',
          'Marque as aulas afetadas e informe um motivo operacional, sem dados pessoais ou médicos (ex.: "Participação em evento").',
          'Em Comunicar, envie ao docente a "Ciência da sua ausência": ela já orienta a procurar a Gestão de Pessoas com o motivo e o comprovante, fora do sistema.',
          'Salve: a página da ausência abre com a situação de cada horário.',
        ],
      },
      {
        titulo: 'Decidir a cobertura',
        quem: 'Coordenação',
        passos: [
          'Em "Decidir a cobertura", escolha para cada horário: substituto sugerido, adiantamento de aula, dispensa ou decidir depois.',
          'Opcional: em "Convites de substituição", convide um ou mais docentes; quem aceitar primeiro assume o horário.',
          'Confira "Refeições da turma neste dia": dispensas podem cancelar lanche ou almoço, com aviso à CAE.',
          'Em "Mensagens prontas", copie cada texto para o e-mail ou WhatsApp e clique em "Já enviei: registrar".',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'ausencias-lista.jpg',
        alt: 'Lista de ausências com data, turma, disciplina, docente e situação.',
        legenda: 'Lista de ausências e a situação de cada uma.',
        captura: { rota: '/ausencias', perfil: 'coordenacao' },
      },
      {
        arquivo: 'ausencias-detalhe.jpg',
        alt: 'Página de uma ausência com a situação por horário, o formulário de cobertura, convites, refeições e mensagens prontas.',
        legenda: 'Página da ausência: cobertura, convites, refeições e mensagens prontas.',
        captura: { rota: '/ausencias', perfil: 'coordenacao', clicar: 'a[href^="/ausencias/c"]', paginaInteira: true },
      },
    ],
    duvidas: [
      { pergunta: 'Posso registrar uma ausência que já aconteceu?', resposta: 'Sim, até 30 dias para trás, e ausências planejadas até um ano à frente.' },
      { pergunta: 'O docente avisou que não vai mais faltar.', resposta: 'Na página da ausência, use "Cancelar registro". Os avisos de refeição são desfeitos e a CAE vê que tudo volta ao normal.' },
      { pergunta: 'Por que não posso escrever o motivo real da falta?', resposta: 'Por privacidade (LGPD): o sistema e as mensagens trazem só um motivo operacional. Atestados e motivos pessoais ficam nos sistemas oficiais.' },
      { pergunta: 'E o atestado ou o motivo da ausência do docente?', resposta: 'O docente trata direto com a Coordenadoria de Gestão de Pessoas (CGP, cgp.boaviagem@ifce.edu.br): informa o motivo e entrega o comprovante (por exemplo, atestado médico). Isso não passa pelo SGC-Redes nem pela Coordenação do curso; a mensagem de ciência da ausência traz essa orientação.' },
      { pergunta: 'O que é o selo "Informada pelo docente"?', resposta: 'O próprio docente informou a ausência em Minha grade. Dê ciência a ele pela mensagem pronta e decida a cobertura, como num registro feito pela Coordenação.' },
    ],
    relacionados: ['grade', 'alimentacao', 'comunicacao'],
  },
  {
    id: 'alimentacao',
    titulo: 'Alimentação',
    resumo: 'Avisos de refeição por turma (lanches e almoço), urgência, ciência da CAE e comunicação.',
    permissao: 'alimentacao:ver',
    rota: '/alimentacao',
    capacidades: [
      'Ver, por data, os avisos de cancelamento ou acréscimo de lanche da manhã (09:30), almoço (12:00) e lanche da tarde (15:00).',
      'Classificar a urgência pela antecedência: 🟢 24h ou mais, 🟡 imprevisto (4h a 24h), 🔴 emergência (menos de 4h).',
      'Lançar acréscimos (ex.: encontro de PEI no contraturno) e ajustar quantidades (Coordenação).',
      'Dar ciência dos avisos (Assistência Estudantil).',
      'Depois de ciência, ajuste ou acréscimo, abrir as mensagens prontas para CAE, nutricionista, Gestão e líderes de turma.',
      'Respeitar o calendário: em dia sem aula, não há refeições previstas.',
    ],
    diagrama: {
      titulo: 'Aviso de refeição',
      etapas: [
        { rotulo: 'Origem', ator: 'Sistema/Coordenação', detalhe: 'dispensa de turma ou acréscimo manual', onde: { tela: 'Ausências ou Alimentação › Acrescentar', rota: '/alimentacao/adicionar' } },
        { rotulo: 'Urgência', ator: 'Sistema', detalhe: 'verde, amarelo ou vermelho pela antecedência', onde: { tela: 'Alimentação', rota: '/alimentacao' } },
        { rotulo: 'Ciência', ator: 'Assistência Estudantil', detalhe: 'confirma no painel (a tela inicial mostra os pendentes)', onde: { tela: 'Alimentação', rota: '/alimentacao' } },
        { rotulo: 'Comunicar', ator: 'Coordenação', detalhe: 'CAE, nutricionista, Gestão, turmas', onde: { tela: 'Alimentação › Comunicar', rota: '/alimentacao/comunicar' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Acrescentar uma refeição',
        quem: 'Coordenação',
        passos: [
          'Em Alimentação, clique em "Acrescentar refeição".',
          'Escolha turma, data, refeição, quantidade e o motivo (sem dados de estudantes).',
          'Salve: o aviso vai para o painel da Assistência Estudantil e o sistema abre as mensagens prontas.',
        ],
      },
      {
        titulo: 'Dar ciência',
        quem: 'Assistência Estudantil',
        passos: ['Em Alimentação, confira os avisos pendentes do dia.', 'Clique em "Dar ciência" em cada aviso. A Coordenação vê a confirmação.'],
      },
    ],
    imagens: [
      {
        arquivo: 'alimentacao-painel.jpg',
        alt: 'Painel de alimentação com avisos por turma, refeição, quantidade e etiqueta de urgência.',
        legenda: 'Avisos de refeição do dia, com urgência e ciência da CAE.',
        captura: { rota: '/alimentacao', perfil: 'coordenacao', paginaInteira: true },
      },
      {
        arquivo: 'alimentacao-cae.jpg',
        alt: 'Painel visto pela Assistência Estudantil, com os avisos e o botão Dar ciência.',
        legenda: 'Visão da Assistência Estudantil: só refeições, sem dados pessoais.',
        captura: { rota: '/alimentacao', perfil: 'cae' },
      },
    ],
    duvidas: [
      { pergunta: 'A turma foi dispensada depois do almoço já servido.', resposta: 'Refeições cujo horário já passou não geram aviso; só as futuras afetadas.' },
      { pergunta: 'O almoço é sempre previsto?', resposta: 'Não. Os estudantes só almoçam no campus nos dias em que têm aula nos dois turnos (regime integral).' },
    ],
    relacionados: ['ausencias', 'comunicacao', 'calendario'],
  },
  {
    id: 'comunicacao',
    titulo: 'Comunicação',
    resumo: 'Mensagens prontas por e-mail ou WhatsApp, mensagem avulsa, textos-padrão, grupos e histórico.',
    permissao: 'comunicacao:enviar',
    rota: '/comunicacao',
    capacidades: [
      'Modo semiautomático: o sistema escreve a mensagem e você envia pelo e-mail institucional ou pelo WhatsApp, e registra o envio.',
      'Caixa de mensagem com Para, Assunto e Texto editáveis, botões de copiar, abrir no e-mail ou no WhatsApp e campos a preencher.',
      'Mensagem avulsa para vários destinatários: grupos e setores, grupos de docentes (todos, por turma, por ano) e pessoas.',
      'Textos-padrão por tipo de interação, com campos de substituição como {{data}} e {{codigo da turma}} — criar, editar e remover.',
      'Cadastro do e-mail e da saudação de cada grupo ou setor (CAE, CTP, Gestão, nutricionista, professores, líderes).',
      'Histórico dos envios registrados, exportável em planilha.',
    ],
    diagrama: {
      titulo: 'Envio semiautomático',
      etapas: [
        { rotulo: 'Mensagem pronta', ator: 'Sistema', detalhe: 'texto, assunto e destinatário', onde: { tela: 'Comunicar (em cada módulo)' } },
        { rotulo: 'Revisar', ator: 'Você', detalhe: 'editar, preencher campos, escolher texto-padrão', onde: { tela: 'Comunicação › Textos-padrão', rota: '/comunicacao/modelos' } },
        { rotulo: 'Enviar', ator: 'Você', detalhe: 'e-mail institucional ou WhatsApp', onde: { tela: 'botões Abrir e-mail / WhatsApp' } },
        { rotulo: 'Registrar', ator: 'Você', detalhe: '"Já enviei: registrar" guarda no histórico', onde: { tela: 'Comunicação › Histórico', rota: '/comunicacao' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Enviar uma mensagem avulsa',
        quem: 'Coordenação',
        passos: [
          'Em Comunicação, escolha um texto-padrão: os destinatários sugeridos já vêm marcados (você pode mudar).',
          'Marque os destinatários: grupos e setores, grupos de docentes ou pessoas.',
          'Preencha os campos do texto (turma, disciplina, data e hora têm listas e seletores).',
          'Clique em "Gerar mensagens": sai uma caixa por destinatário. Copie ou abra no e-mail/WhatsApp, envie e registre.',
        ],
      },
      {
        titulo: 'Criar ou editar um texto-padrão',
        quem: 'Coordenação',
        passos: [
          'Em Comunicação › Textos-padrão, clique em "Novo texto-padrão" ou edite um existente.',
          'Escolha o tipo de interação, os destinatários sugeridos, o assunto e o texto.',
          'Use os botões de variáveis para inserir campos como {{data}}; a página explica como cada campo é preenchido.',
        ],
      },
      {
        titulo: 'Cadastrar o e-mail de um setor',
        quem: 'Coordenação',
        passos: ['Em Comunicação, na seção de grupos e setores, informe o e-mail institucional e a saudação ("prezados(as) colegas da Assistência Estudantil").', 'As próximas mensagens já saem com o destinatário e a saudação.'],
      },
    ],
    imagens: [
      {
        arquivo: 'comunicacao-avulsa.jpg',
        alt: 'Formulário de mensagem avulsa com texto-padrão, destinatários, campos do texto e o botão Gerar mensagens.',
        legenda: 'Mensagem avulsa: texto-padrão, vários destinatários e campos com listas e datas.',
        captura: { rota: '/comunicacao', perfil: 'coordenacao', paginaInteira: true },
      },
      {
        arquivo: 'comunicacao-modelos.jpg',
        alt: 'Lista de textos-padrão agrupados por tipo de interação, com botões para criar e editar.',
        legenda: 'Textos-padrão editáveis, por tipo de interação.',
        captura: { rota: '/comunicacao/modelos', perfil: 'coordenacao' },
      },
    ],
    duvidas: [
      { pergunta: 'O sistema envia as mensagens sozinho?', resposta: 'Não, por padrão. Ele prepara e você envia: assim nada sai sem revisão. O envio automático pelo WhatsApp depende de configuração da TI.' },
      { pergunta: 'O que significa um campo entre chaves, como {{nome}}?', resposta: 'É um campo a preencher. Use "Substituir no texto" na caixa da mensagem ou edite à mão antes de enviar.' },
    ],
    relacionados: ['ausencias', 'alimentacao', 'calendario', 'diarios'],
  },
  {
    id: 'ppe',
    titulo: 'PPE / PEI',
    resumo: 'Progressão Parcial de Estudos: registro, modalidade, Plano de Estudo Individual e impressão.',
    permissao: 'ppe:ver',
    rota: '/ppe',
    capacidades: [
      'Registrar, por semestre, os estudantes e os componentes em PPE (Coordenação).',
      'Alertar retenção quando o estudante tem 3 ou mais componentes pendentes (Art. 115).',
      'O docente da disciplina define a modalidade: PEI ou Dependência (Arts. 117–118).',
      'Preencher o PEI no modelo do campus, com trava de 30% da carga horária (Art. 117 §1º) e prática obrigatória quando a disciplina exige (Art. 121).',
      'Cronograma de encontros, com cópia de outro PEI da mesma disciplina (G09).',
      'Marcar os encontros realizados: a tela inicial do docente lembra os que já passaram e avisa quando é hora de lançar o resultado (fim do cronograma ou do prazo prorrogado).',
      'A Coordenação vê na tela inicial as PPE com resultado à espera do lançamento no sistema acadêmico (Art. 125) e as que aguardam o docente.',
      'Acompanhar a situação: em andamento, prorrogado, aprovado, reprovado, lançado no acadêmico. Imprimir o PEI.',
      'Visível também à CTP e ao Conselho de Classe (Art. 127).',
      'Mensagens prontas de cada momento (Coordenação): pedir ao docente a definição da modalidade; avisar estudante e CTP da modalidade, do PEI pronto (com o cronograma de encontros), da prorrogação do prazo (Art. 124) e do resultado. Ao prorrogar, a Coordenação vai direto às mensagens.',
    ],
    diagrama: {
      titulo: 'Ciclo da PPE',
      etapas: [
        { rotulo: 'Registro', ator: 'Coordenação', detalhe: 'estudante e componente pendente', onde: { tela: 'PPE / PEI › Registrar', rota: '/ppe/nova' } },
        { rotulo: 'Modalidade', ator: 'Professor', detalhe: 'PEI ou Dependência (aparece na tela inicial do docente)', onde: { tela: 'Minhas PPE / PEI', rota: '/ppe?escopo=minhas' } },
        { rotulo: 'PEI', ator: 'Professor', detalhe: 'objetivos, conteúdos, carga e encontros', onde: { tela: 'PPE › detalhe' } },
        { rotulo: 'Encontros', ator: 'Professor', detalhe: 'marca os realizados; a tela inicial lembra os que já passaram', onde: { tela: 'PPE › Encontros realizados' } },
        { rotulo: 'Resultado', ator: 'Professor', detalhe: 'aprovado ou reprovado ao fim do cronograma (ou prorrogação, Art. 124)', onde: { tela: 'PPE › Situação' } },
        { rotulo: 'Comunicar', ator: 'Coordenação', detalhe: 'estudante e CTP recebem o resultado', onde: { tela: 'PPE › Comunicar' } },
        { rotulo: 'Lançamento', ator: 'Coordenação', detalhe: 'lança no acadêmico e marca aqui (Art. 125)', onde: { tela: 'PPE / PEI', rota: '/ppe' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Registrar uma PPE',
        quem: 'Coordenação',
        passos: ['Em PPE / PEI, clique em "Registrar PPE".', 'Informe semestre, estudante, matrícula e componente.', 'Com 3 ou mais componentes no semestre, o sistema mostra o alerta de retenção.'],
      },
      {
        titulo: 'Definir a modalidade e preencher o PEI',
        quem: 'Professor',
        passos: [
          'Em PPE / PEI aparecem as PPEs das disciplinas que você leciona.',
          'Abra o registro e escolha PEI ou Dependência.',
          'No PEI, preencha carga horária (até 30% da disciplina), horas presenciais e práticas, objetivos, conteúdos, critérios e o cronograma.',
          'Salve e use "Imprimir" para gerar o documento para assinatura.',
        ],
      },
      {
        titulo: 'Acompanhar e encerrar o PEI',
        quem: 'Professor',
        passos: [
          'Depois de cada encontro, abra a PPE e marque-o em "Encontros realizados". A tela inicial lembra os encontros que já passaram sem marca.',
          'Ao fim do cronograma (ou do prazo prorrogado, Art. 124), a tela inicial mostra "PEI prontos para lançar o resultado".',
          'Em "Situação", escolha Aprovado ou Reprovado e informe a nota, se houver.',
          'A Coordenação avisa o estudante e a CTP e, depois de lançar no sistema acadêmico, marca "Lançado no acadêmico" (Art. 125).',
        ],
      },
      {
        titulo: 'Comunicar a PPE',
        quem: 'Coordenação',
        passos: [
          'Abra a PPE e clique em "Ver mensagens prontas": o sistema escolhe o texto do momento (definir modalidade, modalidade definida, PEI pronto ou resultado).',
          'Aguardando o docente: a mensagem vai para quem leciona a disciplina no ano, sem o nome do estudante.',
          'Depois: uma mensagem para o estudante (digite o e-mail dele ou escolha o contato no WhatsApp) e outra para a CTP.',
          'Registre cada envio. Quando a PPE muda de momento, as mensagens mudam e podem ser enviadas de novo.',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'ppe-lista.jpg',
        alt: 'Lista de PPEs do semestre com estudante, componente, modalidade, situação e alerta de retenção.',
        legenda: 'PPEs do semestre e alertas de retenção.',
        captura: { rota: '/ppe', perfil: 'coordenacao' },
      },
      {
        arquivo: 'ppe-pei.jpg',
        alt: 'Formulário do Plano de Estudo Individual com carga horária, objetivos, conteúdos e cronograma de encontros.',
        legenda: 'Plano de Estudo Individual no modelo do campus.',
        captura: { rota: '/ppe', perfil: 'coordenacao', clicar: 'a[href^="/ppe/c"]', paginaInteira: true },
      },
    ],
    duvidas: [
      { pergunta: 'O sistema não deixa salvar o PEI.', resposta: 'Confira a carga horária: o PEI não pode passar de 30% da carga da disciplina, e disciplinas com prática exigem horas práticas.' },
      { pergunta: 'Vários estudantes na mesma disciplina precisam de PEI.', resposta: 'É um PEI por estudante. Preencha o primeiro e copie o cronograma para os demais.' },
    ],
    relacionados: ['alimentacao', 'privacidade'],
  },
  {
    id: 'ppi',
    titulo: 'PPI (40 horas)',
    resumo: 'Lançamento e auditoria das atividades da Prática Profissional Integrada, com os tetos do Manual 2022.',
    permissao: 'ppi:ver',
    rota: '/ppi',
    capacidades: [
      'Abrir a solicitação de PPI de um estudante e lançar as atividades com comprovante (só a Coordenação, G11).',
      'Aplicar automaticamente os tetos de quantidade e de horas de cada uma das 32 categorias dos 6 grupos.',
      'Impedir que o mesmo certificado conte duas vezes na solicitação.',
      'Mostrar o progresso até as 40 horas e marcar a solicitação como em análise, deferida ou indeferida.',
      'Gerar a ficha "Solicitação de Prática Profissional Integrada" para assinatura.',
      'Ao deferir ou indeferir, abrir as mensagens prontas para o estudante e a CTP (e-mail ou WhatsApp), com as horas e o motivo.',
    ],
    diagrama: {
      titulo: 'Auditoria de PPI',
      etapas: [
        { rotulo: 'Solicitação', ator: 'Coordenação', detalhe: 'estudante, matrícula e turma', onde: { tela: 'PPI › Nova', rota: '/ppi/nova' } },
        { rotulo: 'Atividades', ator: 'Coordenação', detalhe: 'categoria, comprovante, quantidade', onde: { tela: 'PPI › detalhe' } },
        { rotulo: 'Tetos', ator: 'Sistema', detalhe: 'horas validadas pelo Manual 2022', onde: { tela: 'PPI › detalhe' } },
        { rotulo: 'Decisão e ficha', ator: 'Coordenação', detalhe: 'deferir, avisar e imprimir', onde: { tela: 'PPI › Comunicar / Ficha' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Auditar uma solicitação',
        quem: 'Coordenação',
        passos: [
          'Em PPI, clique em "Nova solicitação" ou busque o estudante por nome ou matrícula.',
          'Em "Lançar atividade", escolha a categoria, informe o comprovante, o código do certificado, a data e a quantidade.',
          'O sistema calcula as horas validadas respeitando os tetos; acompanhe o total até 40h.',
          'Atualize a situação e gere a ficha para assinatura.',
        ],
      },
      {
        titulo: 'Avisar o estudante e a CTP da decisão',
        quem: 'Coordenação',
        passos: [
          'Ao deferir ou indeferir, o sistema abre "Comunicar a decisão da PPI" (o link também fica no topo da solicitação).',
          'Na caixa do estudante, digite o e-mail dele (estudantes não têm cadastro) ou abra no WhatsApp e escolha o contato.',
          'A mensagem da CTP já vem com o e-mail do grupo cadastrado em Comunicação.',
          'Depois de enviar, clique em "Já enviei: registrar" para guardar no histórico.',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'ppi-solicitacao.jpg',
        alt: 'Solicitação de PPI com o total de horas validadas, a lista de atividades e o formulário de lançamento.',
        legenda: 'Solicitação de PPI: atividades, horas validadas e progresso até 40h.',
        captura: { rota: '/ppi', perfil: 'coordenacao', clicar: 'a[href^="/ppi/c"]', paginaInteira: true },
      },
    ],
    duvidas: [{ pergunta: 'Lancei 10 horas e o sistema validou menos.', resposta: 'Cada categoria tem teto de quantidade e de horas (Manual 2022); o excedente não conta.' }],
    relacionados: ['relatorios'],
  },
  {
    id: 'diarios',
    titulo: 'Diários',
    resumo: 'Semáforo de carga horária e preenchimento dos diários, com lembrete ao docente.',
    permissao: 'diarios:ver-proprios',
    rota: '/diarios',
    capacidades: [
      'Ver, por oferta (turma × disciplina × professor), as aulas previstas e ministradas e a situação do diário.',
      'Ordenar do que precisa de atenção ao que está em dia (semáforo).',
      'Registrar a situação do diário e enviar lembrete ao docente por e-mail ou WhatsApp (Coordenação).',
      'O professor vê os próprios diários.',
    ],
    diagrama: {
      titulo: 'Acompanhar os diários',
      etapas: [
        { rotulo: 'Datas do semestre', ator: 'Coordenação', detalhe: 'base para as aulas esperadas (a tela inicial avisa se faltar)', onde: { tela: 'Calendário › Etapas', rota: '/calendario/etapas' } },
        { rotulo: 'Aulas ministradas', ator: 'Coordenação', detalhe: 'conforme o diário no sistema acadêmico', onde: { tela: 'Diários', rota: '/diarios' } },
        { rotulo: 'Semáforo', ator: 'Sistema', detalhe: 'em dia, atenção ou atrasado pelo esperado até hoje', onde: { tela: 'Diários', rota: '/diarios' } },
        { rotulo: 'Lembrete', ator: 'Coordenação', detalhe: 'mensagem pronta ao docente, registrada', onde: { tela: 'Diários › disciplina' } },
        { rotulo: 'Lançamento', ator: 'Professor', detalhe: 'atualiza o diário no acadêmico; vê os seus em Meus diários', onde: { tela: 'Meus diários', rota: '/diarios?escopo=meus' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Cobrar um diário atrasado',
        quem: 'Coordenação',
        passos: ['Em Diários, abra a oferta em atenção.', 'Atualize a situação, se for o caso.', 'Em "Lembrete ao docente", copie a mensagem pronta, envie e registre.'],
      },
    ],
    imagens: [
      {
        arquivo: 'diarios-lista.jpg',
        alt: 'Lista de diários com turma, disciplina, professor, aulas previstas e ministradas e a cor do semáforo.',
        legenda: 'Semáforo de diários.',
        captura: { rota: '/diarios', perfil: 'coordenacao' },
      },
    ],
    duvidas: [{ pergunta: 'De onde vêm as aulas previstas?', resposta: 'Da grade e das datas dos semestres cadastradas no calendário.' }],
    relacionados: ['comunicacao', 'calendario'],
  },
  {
    id: 'processos',
    titulo: 'Processos SEI',
    resumo: 'Quadro (kanban) de processos e atendimentos: aproveitamentos, transferências, estágios e mediações.',
    permissao: 'kanban:ver',
    rota: '/processos',
    capacidades: [
      'Acompanhar processos em 4 colunas: Novo, Com professor, Aguardando retorno, Concluído.',
      'Registrar número SEI, prazo, tipo (etiqueta) e descrição.',
      'Filtrar por etiqueta e mover os cartões entre colunas.',
      'Marcar itens sigilosos (orientação e mediação), visíveis só à Coordenação.',
    ],
    diagrama: {
      titulo: 'Colunas do quadro',
      etapas: [
        { rotulo: 'Novo', ator: 'Coordenação', onde: { tela: 'Processos › Novo', rota: '/processos/novo' } },
        { rotulo: 'Com professor', ator: 'Docente', onde: { tela: 'Processos', rota: '/processos' } },
        { rotulo: 'Aguardando retorno', ator: 'Interessado/setor', detalhe: 'a tela inicial avisa prazos em 3 dias e vencidos', onde: { tela: 'Processos', rota: '/processos' } },
        { rotulo: 'Concluído', ator: 'Coordenação', onde: { tela: 'Processos', rota: '/processos' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Cadastrar e acompanhar um processo',
        quem: 'Coordenação',
        passos: ['Em Processos SEI, clique em "Novo item".', 'Informe título, tipo, número SEI, prazo e, se preciso, marque "sigiloso".', 'Mova o cartão de coluna conforme o andamento.'],
      },
    ],
    imagens: [
      {
        arquivo: 'processos-quadro.jpg',
        alt: 'Quadro de processos com quatro colunas e cartões com título, tipo, número SEI e prazo.',
        legenda: 'Quadro de processos SEI.',
        captura: { rota: '/processos', perfil: 'coordenacao', paginaInteira: true },
      },
    ],
    duvidas: [{ pergunta: 'A CTP vê os itens sigilosos?', resposta: 'Não. Itens sigilosos aparecem só para a Coordenação (Art. 22, VIII).' }],
    relacionados: ['privacidade'],
  },
  {
    id: 'relatorios',
    titulo: 'Relatórios',
    resumo: 'Números consolidados de ausências, cobertura, alimentação, PPE e PPI, em tela, PDF e planilha.',
    permissao: 'relatorios:ver',
    rota: '/relatorios',
    capacidades: [
      'Ausências por mês: aulas perdidas, substituídas, adiantadas, dispensadas, sem decisão e taxa de cobertura.',
      'Avisos de refeição por urgência; PPE por situação e alertas de retenção; PPI por situação e metas atingidas.',
      'Só números agregados, sem nomes de estudantes nem motivos (LGPD).',
      'Imprimir/salvar em PDF e exportar em planilha.',
    ],
    diagrama: {
      titulo: 'Gerar um relatório',
      etapas: [
        { rotulo: 'Ano letivo', ator: 'Coordenação/CTP/Direção', detalhe: 'escolhe o ano', onde: { tela: 'Relatórios', rota: '/relatorios' } },
        { rotulo: 'Consolidação', ator: 'Sistema', detalhe: 'faltas, substituições, PPE e PPI, sem dados sensíveis', onde: { tela: 'Relatórios', rota: '/relatorios' } },
        { rotulo: 'Saída', ator: 'Você', detalhe: 'PDF para impressão ou planilha (.xlsx/.csv)', onde: { tela: 'Relatórios › Imprimir', rota: '/relatorios/imprimir' } },
      ],
    },
    fluxos: [{ titulo: 'Gerar o relatório do ano', quem: 'Coordenação, CTP e Direção', passos: ['Em Relatórios, escolha o ano e clique em "Ver".', 'Use "Imprimir / PDF" ou "Exportar planilha".'] }],
    imagens: [
      {
        arquivo: 'relatorios.jpg',
        alt: 'Relatório consolidado com a tabela mensal de ausências e cobertura e os quadros de alimentação, PPE e PPI.',
        legenda: 'Relatório consolidado do ano.',
        captura: { rota: '/relatorios', perfil: 'direcao', paginaInteira: true },
      },
    ],
    duvidas: [],
    relacionados: ['planilhas'],
  },
  {
    id: 'cadastros',
    titulo: 'Cadastros: usuários, turmas, disciplinas e ofertas',
    resumo: 'Base do sistema: pessoas, turmas, matriz curricular e distribuição das disciplinas aos professores.',
    permissao: 'usuarios:gerenciar',
    rota: '/usuarios',
    capacidades: [
      'Usuários: cadastrar um a um (com máscara de telefone) ou em lote por planilha; gerar senha provisória; desativar (encerra as sessões na hora).',
      'Turmas: código, ano do curso, estudantes ativos e médias de refeição.',
      'Disciplinas: matriz curricular com núcleo, ano, semestre, carga horária, exigência de prática e programa; importação por planilha.',
      'Ofertas: distribuir as disciplinas de cada turma aos professores por ano letivo, pela tela ou por planilha (o modelo já traz a matriz).',
    ],
    diagrama: {
      titulo: 'Ordem dos cadastros no início do ano',
      etapas: [
        { rotulo: 'Usuários', ator: 'Coordenação', detalhe: 'professores, setores e quem também leciona', onde: { tela: 'Cadastros › Usuários', rota: '/usuarios' } },
        { rotulo: 'Turmas', ator: 'Coordenação', detalhe: 'confere estudantes e médias', onde: { tela: 'Cadastros › Turmas', rota: '/turmas' } },
        { rotulo: 'Disciplinas', ator: 'Coordenação', detalhe: 'matriz já vem cadastrada', onde: { tela: 'Cadastros › Disciplinas', rota: '/disciplinas' } },
        { rotulo: 'Ofertas', ator: 'Coordenação', detalhe: 'professor de cada disciplina (a tela inicial conta as que faltam)', onde: { tela: 'Cadastros › Ofertas', rota: '/ofertas' } },
        { rotulo: 'Grade', ator: 'Coordenação', detalhe: 'horários do semestre', onde: { tela: 'Operação › Grade', rota: '/grade' } },
        { rotulo: 'Calendário', ator: 'Coordenação', detalhe: 'etapas, semestres, eventos e sábados', onde: { tela: 'Calendário › Etapas', rota: '/calendario/etapas' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Cadastrar professores em lote',
        quem: 'Coordenação',
        passos: [
          'Em Usuários, clique em "Importar planilha" e baixe o modelo.',
          'Preencha nome, e-mail institucional, perfil, SIAPE e WhatsApp (opcionais). O sistema aceita .xlsx e .csv (separado por ponto e vírgula, vírgula ou tabulação).',
          'Envie, confira a prévia e confirme. As senhas provisórias aparecem uma única vez, com opção de baixar.',
        ],
      },
      {
        titulo: 'Distribuir as disciplinas do ano',
        quem: 'Coordenação',
        passos: [
          'Em Ofertas, escolha o ano e clique em "Distribuir disciplinas" da turma.',
          'Escolha o professor de cada disciplina e salve. Ou use "Importar planilha": o modelo já traz as disciplinas da matriz de cada turma.',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'cadastros-usuarios.jpg',
        alt: 'Lista de usuários com nome, e-mail, perfil, situação e último acesso, e botões para cadastrar, importar e exportar.',
        legenda: 'Usuários do sistema.',
        captura: { rota: '/usuarios', perfil: 'coordenacao' },
      },
      {
        arquivo: 'cadastros-ofertas.jpg',
        alt: 'Distribuição de disciplinas de uma turma com uma lista de professores para cada disciplina.',
        legenda: 'Distribuição das disciplinas aos professores.',
        captura: { rota: '/ofertas', perfil: 'coordenacao', clicar: 'a[href^="/ofertas/c"]', paginaInteira: true },
      },
    ],
    duvidas: [{ pergunta: 'Como desligo o acesso de quem saiu do campus?', resposta: 'Em Usuários, abra a pessoa e desative. O histórico continua, mas o acesso é encerrado na hora.' }],
    relacionados: ['grade', 'planilhas'],
  },
  {
    id: 'planilhas',
    titulo: 'Planilhas, impressão e PDF',
    resumo: 'Importar e exportar dados em planilha e gerar PDF do calendário, das grades e dos relatórios.',
    permissao: null,
    capacidades: [
      'Exportar em .xlsx ou .csv: usuários, turmas, disciplinas, ofertas, grade, calendário, ausências, relatórios e histórico de comunicação (conforme o perfil).',
      'Importar por planilha, sempre com prévia antes de gravar: usuários, disciplinas, ofertas, grade, calendário e sábados letivos.',
      'O formato de exportação é o mesmo da importação: baixe, edite e envie de volta.',
      'Imprimir ou salvar em PDF: calendário do ano, grades (uma turma ou todas), relatórios, PEI e ficha de PPI.',
      'Exportações com dados pessoais ficam registradas na auditoria.',
    ],
    diagrama: {
      titulo: 'Importação com prévia',
      etapas: [
        { rotulo: 'Modelo', ator: 'Você', detalhe: 'baixe o .xlsx ou .csv', onde: { tela: 'Importar planilha (em cada cadastro)' } },
        { rotulo: 'Preencher', ator: 'Você', detalhe: 'Excel ou LibreOffice' },
        { rotulo: 'Prévia', ator: 'Sistema', detalhe: 'criar, alterar, igual ou erro por linha', onde: { tela: 'Importar planilha' } },
        { rotulo: 'Confirmar', ator: 'Você', detalhe: 'grava tudo ou nada', onde: { tela: 'Importar planilha' } },
      ],
    },
    fluxos: [
      {
        titulo: 'Salvar em PDF',
        quem: 'Todos',
        passos: ['Clique em "Imprimir / PDF" na página desejada.', 'No navegador, use Ctrl+P e escolha "Salvar como PDF". A orientação (retrato/paisagem) já vem ajustada.'],
      },
      {
        titulo: 'Importar uma planilha',
        quem: 'Coordenação',
        passos: [
          'Abra "Importar planilha" no módulo e baixe o modelo (ele já vem pré-preenchido quando possível).',
          'Preencha e envie o arquivo (até 1 MB e 500 linhas).',
          'Confira a prévia: linhas com erro explicam o que corrigir; nada é gravado enquanto houver erro.',
          'Clique em "Confirmar importação".',
        ],
      },
    ],
    imagens: [
      {
        arquivo: 'planilhas-importacao.jpg',
        alt: 'Página de importação do calendário com os passos: baixar o modelo, enviar a planilha e conferir a prévia.',
        legenda: 'Importação com prévia (exemplo: calendário).',
        captura: { rota: '/calendario/importar', perfil: 'coordenacao' },
      },
      {
        arquivo: 'planilhas-impressao.jpg',
        alt: 'Versão para impressão do calendário acadêmico, com cabeçalho do IFCE e os meses do ano.',
        legenda: 'Versão para impressão/PDF do calendário.',
        captura: { rota: '/calendario/imprimir', perfil: 'coordenacao' },
      },
    ],
    duvidas: [
      { pergunta: 'Meu CSV dá "Faltam colunas obrigatórias".', resposta: 'Use os títulos de coluna do modelo. O sistema aceita CSV separado por ponto e vírgula, vírgula ou tabulação, e arquivos do Excel em português.' },
      { pergunta: 'A importação apaga o que não está na planilha?', resposta: 'Não, exceto na grade com o modo "Substituir", que vale só para as turmas presentes na planilha.' },
    ],
    relacionados: ['cadastros', 'calendario', 'grade', 'relatorios'],
  },
  {
    id: 'privacidade',
    titulo: 'Privacidade, segurança e auditoria',
    resumo: 'Como o sistema protege os dados (LGPD) e o que fica registrado na auditoria.',
    permissao: null,
    capacidades: [
      'Cada perfil vê só o necessário (minimização de dados): a Assistência Estudantil, por exemplo, vê apenas refeições.',
      'Mensagens e registros usam motivos operacionais, sem dados médicos ou pessoais.',
      'Senhas guardadas com criptografia forte; sessões expiram após 8 horas sem uso.',
      'Auditoria (Coordenação): quem fez o quê e quando — logins, cadastros, alterações, envios e exportações —, sem guardar nomes ou senhas no registro.',
    ],
    diagrama: {
      titulo: 'Proteção dos dados em cada ação',
      etapas: [
        { rotulo: 'Acesso', ator: 'Sistema', detalhe: 'cada tela e ação confere o perfil (e a docência) da conta' },
        { rotulo: 'Ação', ator: 'Você', detalhe: 'registra, decide ou envia' },
        { rotulo: 'Auditoria', ator: 'Sistema', detalhe: 'guarda quem fez o quê e quando, sem copiar dados pessoais', onde: { tela: 'Cadastros › Auditoria', rota: '/auditoria' } },
        { rotulo: 'Mensagens', ator: 'Sistema', detalhe: 'textos sem nome de estudante quando não precisam dele' },
      ],
    },
    fluxos: [
      {
        titulo: 'Consultar a auditoria',
        quem: 'Coordenação',
        passos: ['Em Cadastros › Auditoria, filtre por ação, usuário e período.', 'Cada linha mostra data, usuário, ação e os campos alterados.'],
      },
    ],
    imagens: [
      {
        arquivo: 'privacidade-auditoria.jpg',
        alt: 'Tela de auditoria com filtros de ação, usuário e período e a lista de registros.',
        legenda: 'Registros de auditoria.',
        captura: { rota: '/auditoria', perfil: 'coordenacao' },
      },
    ],
    duvidas: [{ pergunta: 'Posso compartilhar uma planilha exportada?', resposta: 'Planilhas com dados pessoais devem ficar só com quem precisa delas para o trabalho e ser apagadas quando não forem mais necessárias.' }],
    relacionados: ['primeiros-passos'],
  },
];

export const topicoPorId = (id: string) => TOPICOS.find((t) => t.id === id) ?? null;
