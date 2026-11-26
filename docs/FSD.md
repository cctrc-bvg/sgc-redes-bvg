# FSD — Functional Specification Document (Especificação Funcional)
## SGC-Redes — IFCE Campus Boa Viagem

- **Versão:** 0.2 (Consolidada pré-fechamento de `/grill-me`)
- **Unidade:** IFCE — Campus Boa Viagem
- **Curso:** Técnico Integrado ao Ensino Médio em Redes de Computadores (3 turmas)
- **Repositório:** `github.com/cctrc-bvg`

---

## 1. Visão Geral e Objetivos
O **SGC-Redes** atua como um painel operacional complementar aos sistemas institucionais oficiais (Q-Acadêmico/SUAP, SEI e SisAE). Seu objetivo é centralizar fluxos ágeis do dia a dia da Coordenadoria de Curso que hoje dependem de planilhas isoladas, e-mails e mensagens manuais no WhatsApp.

### 1.1 Mapeamento de Atribuições (Regimento — Art. 21 e Art. 22)
| Atribuição Regimental (Art. 22) | Módulo no SGC-Redes | Fase |
| :--- | :--- | :---: |
| I, II, XXIV — Reuniões com DE/DG, avaliação e distribuição de disciplinas | Grade Semestral & Hub Gestão | 1 e 2 |
| III, IX — Estrutura curricular, programas e ementas | Catálogo de Disciplinas | 2 |
| IV, VIII — Orientação discente e mediação de conflitos prof./aluno | Kanban (Ocorrências Sigilosas) | 2 |
| V, XXIII — Aproveitamento de disciplinas e seleção de graduados/transferidos | Kanban de Processos SEI | 2 |
| VI, VII — Cobrança de carga horária e preenchimento de diários | Semáforo de Diários | 2 |
| XIII, XV — Acompanhamento de atividades científicas/culturais e optativas | Módulo PPI (40h) | 2 |
| XIX — Encaminhamento e orientação em estágios | Kanban / PPI Grupo III | 2 |
| X, XI, XVI, XVII, XVIII, XX, XXII — Bibliografia, equipamentos, estoque e labs | Módulo Infraestrutura & DAP | 3 (Futura) |
| XII, XIV, XXI — Projetos de pesquisa, encontros do curso e colação | Calendário & Atas | 3 (Futura) |

---

## 2. Perfis de Acesso (RBAC)

| Perfil | Permissões Principais | Restrições (LGPD / Minimização) |
| :--- | :--- | :--- |
| **`COORDENADOR`** | Acesso total aos módulos das Fases 1 e 2, configurações, logs de auditoria e registros sigilosos. | — |
| **`PROFESSOR`** | Visualiza grade horária, responde convites de substituição, define PPE (`PEI`/`Dependência`), preenche planos de PEI e acompanha seus diários. | Não visualiza ocorrências sigilosas nem dados de outros processos administrativos alheios. |
| **`CTP`** | Visualiza módulos de PPE/PEI (Art. 127 ROD), processos no Kanban e relatórios consolidados de ausências. | Sem acesso a anotações privadas marcadas como `sigiloso = true`. |
| **`DIRECAO`** | Visualiza relatórios executivos (faltas, substituições, PPE, PPI) e pautas de gestão. | Sem acesso a anotações privadas sigilosas. |
| **`ASSISTENCIA_ESTUDANTIL`** | Visualiza **exclusivamente** o painel de previsão e alteração de refeições por turma/horário e dá ciência nos alertas. | **Bloqueado** para notas, PPI, PPE, processos SEI e motivos pessoais/médicos. |

**Docência acumulada (decisão de 25/11/2026):** qualquer cargo pode também lecionar (`User.leciona`, "Também leciona" em
Usuários; liga sozinho quando a pessoa recebe disciplina pela planilha de ofertas). As permissões de `PROFESSOR` se
somam às do cargo, e as telas mostram o recorte "meu" (Minha grade, Meus diários, Minhas PPE) à parte, em azul. O
Professor sempre leciona.

---

## 3. Requisitos Funcionais — Fase 1 (Operação, Alimentação e Comunicação)

### RF01 — Gestão da Grade Horária e Janelas Livres
- O sistema gerencia as **3 turmas** do Técnico Integrado em Redes (`REDES-1`, `REDES-2`, `REDES-3`).
- Para cada dia da semana, cada turma possui blocos nos turnos **Manhã** e/ou **Tarde**, alternando entre:
  1. **Somente Manhã**
  2. **Somente Tarde**
  3. **Regime Integral (Manhã + Tarde)**
- Blocos vagos dentro da grade são **Janelas Livres**: calculadas como o bloco vago num turno em que a turma tem aula naquele dia, para viabilizar remanejamentos.
- Professores consultam a grade de todas as turmas e a própria grade individual; somente a Coordenação edita.

### RF02 — Registro de Ausência Docente e Sugestão de Remanejamento
- Ao registrar a ausência de um docente (data, turma e blocos afetados), o sistema busca automaticamente:
  1. Professores da mesma turma com horário livre naquele turno ou com aula no outro turno passível de **adiantamento** para a janela livre/horário vago.
  2. Possibilidade de cobertura sem dispensa da turma.
- O campo `motivoOperacional` deve aceitar apenas descrições operacionais não sensíveis (ex: *"Ausência justificada"*, *"Participação em evento"*), sem expor dados médicos no sistema/WhatsApp.
- **Licença de vários dias:** o registro aceita um período de até 15 dias corridos ("Até"). Cada dia segue a grade vigente e o calendário acadêmico (feriados, sábados letivos), e gera uma ausência por turma, disciplina e dia. *(Implementado em 25/11/2026.)*
- **Comunicação com o docente ausente (decisão de 25/11/2026):**
  - Ao dar ciência da ausência, e de novo ao informar a cobertura, a mensagem da Coordenação ao docente orienta:
    - procurar a **Coordenadoria de Gestão de Pessoas (CGP)** do campus, pelo e-mail `cgp.boaviagem@ifce.edu.br`, informando o motivo;
    - entregar a ela o comprovante, quando houver (ex.: atestado médico).
  - Esse contato e a entrega de documentos acontecem **fora do SGC-Redes**, direto entre o docente e a Gestão de
    Pessoas. O sistema e a Coordenação do curso não recebem nem guardam motivo pessoal ou documento (LGPD).
  - O texto fica em `ORIENTACAO_GESTAO_PESSOAS` (`src/lib/ausencias/mensagens.ts`) e na variável
    `{{gestao de pessoas}}` dos textos-padrão. *(Implementado em 25/11/2026.)*
- **Prazo de reposição (ROD, Art. 37, § 2º; implementado em 25/11/2026):** as aulas dispensadas devem ser repostas em até 15 dias letivos ou até o fim da etapa, o que ocorrer primeiro (`prazoDeReposicao`, `src/lib/calendario/regras.ts`). O prazo aparece no detalhe da ausência; a tela inicial da Coordenação avisa as reposições sem data agendada com prazo vencido (urgente) ou a vencer em 5 dias. A data deve ser combinada com pelo menos 75% da turma, com registro assinado (Art. 37, § 3º).
- **RF02-A — Docente informa a própria ausência** *(decisão G15, implementado em 25/11/2026)*:
  - **Docente → Coordenação:** o docente informa a data (ou o período) e as aulas, escolhendo um motivo operacional
    da lista, nunca o motivo pessoal.
  - O registro entra como "Aguardando decisão", marcado como "informada pelo docente", e aparece na tela inicial da
    Coordenação.
  - **Coordenação → docente:** a Coordenação dá ciência e decide a cobertura (RF02). A mensagem ao docente leva a
    orientação da Gestão de Pessoas acima.
  - O docente pode cancelar enquanto a Coordenação não decidir.
  - Telas: Minha grade › "Informar ausência" (`/ausencias/informar`) e "Minhas ausências". A Coordenação vê o selo
    "Informada pelo docente" na lista e no detalhe, e a contagem na tela inicial.
  - Para uma ausência no mesmo dia, a tela pede que o docente também ligue para a Coordenação.

### RF03 — Motor de Impacto Alimentar (Regra Integral)
- Horários oficiais das refeições no campus (fuso `America/Fortaleza` / `UTC-03:00`):
  - **Lanche da Manhã:** `09:30`
  - **Almoço:** `12:00`
  - **Lanche da Tarde:** `15:00`
- **Regra de Elegibilidade (RN01):**
  - `Somente Manhã` $\rightarrow$ prevê **Lanche da Manhã (`09:30`)**.
  - `Somente Tarde` $\rightarrow$ prevê **Lanche da Tarde (`15:00`)**.
  - `Regime Integral (Manhã + Tarde)` $\rightarrow$ prevê **Lanche da Manhã (`09:30`) + Almoço (`12:00`) + Lanche da Tarde (`15:00`)**.
  - *Regra crítica:* Os estudantes **só almoçam no campus** nos dias em que permanecem nos dois turnos (Manhã e Tarde).
- Ao confirmar alteração na presença da turma, o sistema compara o estado **Antes** vs. **Depois** e calcula individualmente para cada refeição afetada se houve `CANCELAR_REFEICAO` ou `ADICIONAR_REFEICAO`.

### RF04 — SLA Flexível de Comunicação à Assistência Estudantil (Meta 24h vs. Imprevistos)
- O prazo ideal para replanejamento alimentar é de **24 horas de antecedência**. Como imprevistos ocorrem a qualquer momento, o sistema calcula a antecedência por refeição afetada sem bloquear o registro:
  - 🟢 **Verde (`>= 24h`):** Fluxo planejado normal.
  - 🟡 **Amarelo (`4h a 23h59`):** *Imprevisto Moderado* — alerta o coordenador para tentar cobertura interna primeiro; se inevitável, envia tag `[IMPREVISTO]` à Assistência Estudantil.
  - 🔴 **Vermelho (`< 4h`):** *Emergência de Última Hora* — instrui priorizar retenção da turma no campus ou, em caso de dispensa inevitável, registrar justificativa e recomendar contato direto imediato.

### RF05 — Hub de Comunicação WhatsApp
- Canais pré-configurados:
  1. `GRUPO_PROFESSORES`: chamados de substituição/adiantamento, lembretes de diários e reuniões.
  2. `GRUPO_GESTAO_DIR_COORD`: outros coordenadores, Direção de Ensino e Direção Geral.
  3. `ASSISTENCIA_ESTUDANTIL`: notificações de alteração alimentar com data/hora e quantitativo.
  4. `CTP`: alinhamentos pedagógicos e PPE.
  5. `LIDERES_TURMA`: repasse rápido de mudança de horário aos estudantes.
- Suporte a modo **Semiautomático** (texto gerado com 1 clique para WhatsApp Web + log) e **Automático** (via Webhook/Evolution API em container institucional).

---

## 4. Requisitos Funcionais — Fase 2 (PPE, PPI, Diários e Kanban)

### RF06 — Gestão de PPE (Progressão Parcial de Estudos — ROD Arts. 115–128)
- **Importação/Cadastro Semestral:** Registro dos discentes e componentes pendentes no semestre.
- **Validação Art. 115:** Alerta automático de retenção caso o aluno possua **3 ou mais** componentes reprovados (limite da PPE é de até 2 componentes).
- **Definição pelo Docente (Art. 117 e 118):** Escolha por componente/aluno entre:
  - `PEI` (Plano de Estudo Individual — até 30% da CH da disciplina)
  - `DEPENDENCIA` (100% da CH, presencial ou EaD se previsto no PPC — Art. 120)
- **Formulário Digital do PEI (Modelo Oficial Campus Boa Viagem):**
  - Campos obrigatórios: Semestre, Estudante, Matrícula, Docente, Componente Curricular, CH do PEI, Horas presenciais, Objetivos de aprendizagem, Conteúdos a recuperar e Cronograma de encontros (`Data`, `Conteúdo`, `Metodologia/Avaliação`).
  - **Trava Art. 117 §1º:** Impede salvar PEI com carga horária superior a **30%** da carga horária total da disciplina.
  - **Trava Art. 121:** Se a disciplina exigir conteúdo prático (`exigePratica = true`), exige preenchimento de carga horária prática $> 0$.
  - Suporte a registro de **Prorrogação** dentro do período vigente (Art. 124), **Conclusão Antecipada** mediante desempenho satisfatório (Art. 123 §único) e marcação de **Lançado no Sistema Acadêmico** (Art. 125).
  - **Acompanhamento do PEI** *(implementado em 25/11/2026)*:
    - O docente marca os encontros realizados.
    - A tela inicial do docente avisa os encontros já passados sem registro e o momento de lançar o resultado (fim
      do cronograma ou do prazo prorrogado).
    - A tela inicial da Coordenação avisa as PPE com resultado à espera do lançamento no acadêmico.
- Visibilidade compartilhada com **CTP** e **Conselho de Classe** (Art. 127).

### RF07 — Calculadora e Auditoria de PPI (40 Horas — Manual 2022)
- **Meta de Integralização:** **40 horas** totais obtidas durante o período de integralização do curso.
- **Motor dos 6 Grupos (32 Categorias):**
  - Grupo I (Ensino - 5 categorias), Grupo II (Pesquisa, Inovação e Extensão - 10), Grupo III (Experiência Profissional e Estágio - 5), Grupo IV (Cursos e Eventos - 5), Grupo V (Cunho Técnico - 6), Grupo VI (Múltiplas Linguagens - 1).
- **Regras de Cálculo e Auditoria:**
  - Aplicação automática do teto por atividade: `min(min(qtdInformada, qtdMaxima) * horasPorUnidade, pontuacaoMaxima)`.
  - **Regra de Certificado Único:** Cada comprovante/certificado recebe um identificador único por solicitação, impedindo sua contagem em duas categorias simultâneas.
  - Indicação obrigatória de servidor orientador (docente ou técnico do IFCE) nas atividades que o manual exigir.
- **Exportação:** Geração da ficha **"SOLICITAÇÃO DE PRÁTICA PROFISSIONAL INTEGRADA (PPI)"** totalizada para assinatura (Aluno, Coordenação e Direção de Ensino).

### RF08 — Semáforo de Diários e Carga Horária (Art. 22, VI e VII)
- Painel por semestre listando ofertas (`Turma × Disciplina × Professor`), comparando aulas previstas vs. ministradas e status do diário, com disparo rápido de lembrete ao docente via WhatsApp.

### RF08-A — Progressão automática dos diários *(requisito de 25/11/2026; diários implementados em 25/11/2026; mensagens periódicas pendentes)*
- **Premissa:** pode haver pouca adesão dos docentes ao sistema. O acompanhamento dos diários não pode depender de cada
  docente lançar aulas: **com o passar dos dias, presume-se que as aulas estão sendo ministradas**, e só as exceções
  (ausências, trocas, dispensas) são registradas.
- **Aulas ministradas presumidas** por oferta: aulas da grade que já ocorreram em dias letivos, desde o início do período
  até hoje (grade × calendário: feriados, suspensões, sábados letivos e avaliações finais ficam de fora), menos as aulas
  perdidas sem cobertura e sem reposição. Substituição e adiantamento contam como aula dada.
- **Valor efetivo** = valor lançado pela Coordenação, se houver (correção ou conferência no sistema acadêmico); senão, o
  presumido. O diário é presumido "em dia"; "atrasado" só quando a Coordenação marca depois de conferir.
- **Semáforo:** com o modo automático, "atenção" passa a significar problema estrutural, por exemplo a grade não
  comporta as aulas previstas até o fim do período; a Coordenação vê isso cedo, sem depender do docente.
- **Comunicação como principal interface com o docente:** em vez de exigir acesso, o sistema prepara mensagens para a
  Coordenação enviar (e-mail ou WhatsApp): resumo da semana, mudanças, prazos do ROD calculados pelo calendário
  (reposição, Art. 37; frequência em 7 dias letivos, Art. 43; entrega da etapa em 5 dias letivos, Art. 171, XIX) e
  lembrete de fechamento do período. O docente só entra no sistema para informar ausência, tratar de atestado
  (com a CGP, fora do sistema) ou responder algo específico.
- **Sistema funciona sem adesão:** tudo que o docente pode fazer no sistema (informar ausência, responder convite,
  definir modalidade e preencher o PEI, marcar encontros) a Coordenação também pode fazer por ele, depois de combinar
  por telefone ou mensagem. Isso já vale hoje; o desenho novo evita criar função que só o docente consiga executar.

### RF09 — Kanban de Processos SEI e Atendimentos
- Fluxo em 4 colunas (`NOVO` $\rightarrow$ `COM_PROFESSOR` $\rightarrow$ `AGUARDANDO_RETORNO` $\rightarrow$ `CONCLUIDO`) com número SEI, prazo e etiquetas (`Aproveitamento de Disciplina`, `Graduado/Transferido`, `Estágio`, `Orientação/Mediação`, `Outro SEI`).
- Itens marcados como `sigiloso = true` são visíveis exclusivamente ao perfil `COORDENADOR`.

---

## 4A. Requisitos Não Funcionais

### RNF01 — Capacidade no pico de fim de semestre
- Atender até **100 docentes** no mesmo período, com picos de 30 acessos no mesmo minuto (por exemplo, logo após um aviso no grupo), sem degradação perceptível: meta de **p95 abaixo de 1 s** por página.
- Dimensionamento e medição em `docs/IMPLANTACAO.md`, seção 1.1: **4 vCPU, 8 GB de RAM e 80 GB em SSD**, com PostgreSQL ajustado. A carga medida fica em cerca de 0,1 núcleo no pior minuto; a folga cobre o build das atualizações e o crescimento.
- Consultas acima de 500 ms ficam registradas no log do banco, para encontrar gargalos.

### RNF02 — Disponibilidade
- Meta de **99,5% no horário letivo**.
- **Mecanismos:**
  - reinício automático dos contêineres;
  - verificação de saúde (`/api/saude`) a cada 30 s;
  - limite de memória do app;
  - HA do Proxmox, se houver armazenamento compartilhado;
  - monitoramento externo pela TI.
- **Atualizações** fora do horário letivo, com aviso prévio. A indisponibilidade em cada troca é de segundos.

### RNF03 — Segurança dos dados e recuperação
- **Backup:** diário do banco (`pg_dump` verificado), com 30 dias de retenção e cópia fora da VM, além do backup da VM (vzdump).
- **No fim de semestre:** backups também ao longo do dia, com **RPO de até 6 h** (perda máxima de dados se a VM se perder).
- **RTO de até 1 h** (tempo para voltar ao ar), com ensaio de restauração a cada semestre.

### RNF04 — Atualização sem perda de dados
- Toda atualização segue `scripts/atualizar.sh`:
  1. backup;
  2. build com o app no ar;
  3. **ensaio das migrações numa cópia do banco**;
  4. troca;
  5. verificação de saúde;
  6. **volta automática** se o app novo não ficar saudável.
- Mudanças de esquema seguem **expandir → migrar dados → contrair**, em versões separadas.
- Migração destrutiva (apagar, renomear, mudar tipo, tornar obrigatória) só com aprovação explícita no arquivo. Um teste no CI barra as demais (`docs/IMPLANTACAO.md`, seção 8).

### RNF05 — Autenticação institucional (estudo)
- Login com a conta Google institucional (OpenID Connect, domínio `ifce.edu.br`), mantendo o perfil e a docência no SGC-Redes e a senha local da Coordenação como contingência.
- Viável, mas depende da TI. Estudo em `docs/estudos/SSO_GOOGLE.md`; decisões G20–G22, adiadas pelo usuário em 25/11/2026.

### RNF06 — Funcionar com pouca adesão dos docentes
- O sistema é operado pela Coordenação; o docente é, antes de tudo, **destinatário de comunicações**. Nenhuma rotina da Coordenação pode depender de o docente abrir o sistema.
- Toda ação do docente tem equivalente na Coordenação, e a comunicação (e-mail institucional ou WhatsApp) cobre o que o docente precisa saber.
- Requisito de projeto para os próximos módulos: ver RF08-A.

---

## 5. Checklist de Fechamento — Sessão `/grill-me` (Decisões Pendentes)

> *Preencher e aprovar antes de iniciar o desenvolvimento das telas de interface:*

| ID | Questão de Borda / Regra Operacional | Opção Padrão Sugerida | Decisão Final |
| :-: | :--- | :--- | :--- |
| **G01** | Horários exatos dos blocos de aula (Manhã/Tarde) e existência de sábados letivos | 5 blocos Manhã + 5 blocos Tarde (50 min) | **Parcial:** 4 blocos de 60 min por turno (A–D), seg–sex, conforme grade 2026 (aSc). Manhã 07:30–11:45, intervalo 09:30–09:45; tarde 13:00–17:20, intervalo 15:00–15:20. **Há sábados letivos**, definidos pelo calendário acadêmico conforme o calendário civil (não são fixos): o sistema deve cadastrá-los por data, e cada um segue a grade de um dia da semana (G14). |
| **G02** | Falta apenas na última aula antes do intervalo/saída: mantém lanche das 09:30 / 15:00? | Sim, se houver aula no turno antes do lanche | **Aceito o padrão (24/11/2026):** mantém o lanche se houver aula no turno antes do horário do lanche. |
| **G03** | Substituição: apenas professores da mesma turma ou qualquer docente de Redes disponível? | Priorizar mesma turma; listar demais como opção | **Aceito o padrão (24/11/2026):** prioriza professores da mesma turma; os demais docentes aparecem como opção. |
| **G04** | Queda do turno da tarde e transporte escolar: cancelamento total do almoço (12:00) ou permite ajuste parcial de alunos que ficam esperando ônibus? | Cancelamento total por padrão, com campo editável de quantidade | **Aceito o padrão (24/11/2026):** cancelamento total do almoço, com quantidade editável. |
| **G05** | Encontros de contraturno (PEI/Lab) para grupos pequenos devem gerar alerta de adição de refeição? | Sim, opcional via checkbox ao agendar encontro | **Aceito o padrão (24/11/2026):** opcional, por caixa de marcação ao agendar o encontro. |
| **G06** | Emergência (< 4h): envia alerta vermelho no painel da Assistência ou exige apenas ligação? | Envia alerta vermelho no painel + instrução de ligação | **Aceito o padrão (24/11/2026):** alerta vermelho no painel da AE + instrução de ligação. |
| **G07** | WhatsApp no Dia 1: Semiautomático (WhatsApp Web) ou Automático (Evolution API)? | Semiautomático no Dia 1; Webhook pronto para API | **Aceito o padrão (24/11/2026):** semiautomático (WhatsApp Web + registro); webhook preparado para a API. |
| **G08** | Grupo Gestão (DE/DG): notificar toda falta ou apenas dispensas de turma/impacto alimentar? | Apenas dispensas, impacto alimentar ou faltas sem cobertura | **Aceito o padrão (24/11/2026):** só dispensas, impacto alimentar ou faltas sem cobertura. |
| **G09** | PPE com vários alunos na mesma disciplina: 1 PEI coletivo ou 1 PEI por aluno? | PEI individual por aluno (com função de "clonar cronograma") | **Aceito o padrão (24/11/2026):** PEI individual por estudante, com "clonar cronograma". |
| **G10** | Base da CH de 30% do PEI: hora-aula (50 min) ou hora-relógio (60 min)? | Conforme cadastro da matriz no PPC | **Aceito o padrão (24/11/2026):** conforme a carga horária cadastrada na matriz do PPC. |
| **G11** | PPI (40h): apenas Coordenação lança certificados ou haverá upload pelo aluno? | Apenas Coordenação lança/audita nas Fases 1 e 2 (menor risco LGPD) | **Aceito o padrão (24/11/2026):** só a Coordenação lança e audita. |
| **G12** | Acesso de estudantes nas Fases 1 e 2: apenas servidores (alunos via Líderes) ou login discente? | Apenas servidores nas Fases 1 e 2 | **Aceito o padrão (24/11/2026):** apenas servidores. |
| **G13** | Cancelar refeição cujo horário **já passou** (ex.: queda da tarde registrada às 13h, depois do almoço das 12h): avisar a AE? | Não gerar aviso para refeição já servida; mostrar só as refeições futuras afetadas | **Aceito o padrão (24/11/2026).** |
| **G14** | Sábados letivos seguem a grade de qual dia? | Indicado no calendário acadêmico | **Decidido:** cada sábado letivo segue a grade de um dia da semana, cadastrado por data. |
| **G15** | O docente pode informar a própria ausência no sistema (RF02-A)? | Sim: o registro entra como "Aguardando decisão", com motivo operacional da lista; a Coordenação dá ciência e decide a cobertura | **Aceito (25/11/2026)** e implementado. |
| **G16** | Nome e contato da Gestão de Pessoas na orientação ao docente ausente | Nome oficial e e-mail do setor na mensagem | **Decidido (25/11/2026):** Coordenadoria de Gestão de Pessoas (CGP), `cgp.boaviagem@ifce.edu.br` (`GESTAO_PESSOAS` em `src/lib/ausencias/mensagens.ts`). |
| **G17** | Recursos da VM de produção | 4 vCPU, 8 GB de RAM (balão mínimo de 4 GB), 80 GB em SSD; PostgreSQL ajustado no `.env` | **Aceito (25/11/2026):** o que for solicitado será concedido. |
| **G18** | Janela de atualização | Fora do horário letivo (depois das 22h ou em sábado sem aula), com aviso no grupo de professores um dia antes; sem atualização na última semana do semestre, salvo correção urgente | **Aceito (25/11/2026).** |
| **G19** | Backups no fim de semestre e destino da cópia fora da VM | Três backups por dia (02:30, 12:30 e 18:30) o ano todo; cópia diária para um storage da TI com acesso restrito | **Aceito (25/11/2026):** o caminho do storage será informado pela TI na implantação. |
| **G20** | Adotar o login Google institucional (SSO)? | Sim, quando a TI entregar o projeto e as credenciais OAuth e o domínio público (`docs/estudos/SSO_GOOGLE.md`) | *Pendente* |
| **G21** | Senha local depois do SSO | Só para a Coordenação, como contingência | *Pendente* |
| **G22** | Cadastro automático de quem entra pelo Google | Não: só quem a Coordenação cadastrou | *Pendente* |
| **G23** | Avaliações finais contam como dias letivos? Quando acontecem? | Não contam (ROD, Art. 32: "excetuando-se o período destinado aos exames finais"); sem aula regular pela grade | **Decidido (25/11/2026):** não contam como letivos; só no fim do ano, depois da última semana letiva, inclusive para as disciplinas semestrais; podem cair em sábado. Sempre "sem aula" no calendário (`SEMPRE_NAO_LETIVO`), com aviso se cadastradas antes do último dia letivo. A AF é aplicada no mínimo 3 dias letivos após o registro da média parcial (Art. 105, § 1º). |
| **G24** | Refeições nos dias de avaliação final | Sem previsão pela grade; a Coordenação lança acréscimos por dia quando houver estudantes no campus para as avaliações (Alimentação › Acrescentar refeição) | **Aceito (25/11/2026).** Já funciona com o acréscimo existente, em qualquer data; a agenda da AE na tela inicial mostra os acréscimos mesmo em dia sem aula. |
| **G25** | Adotar a progressão automática dos diários (RF08-A) como padrão? | Sim: aulas presumidas pela grade e pelo calendário; a Coordenação só corrige exceções | **Aceito (25/11/2026).** Implementado: aulas presumidas pela grade e pelo calendário (`src/lib/diarios/automatico.ts`); a Coordenação corrige (vira manual) ou volta ao automático. |
| **G26** | Como tratar o "diário em dia" sem o docente lançar? | Presumido em dia; "atrasado" só quando a Coordenação conferir no acadêmico e marcar (conferência por amostra no fim de cada etapa) | **Aceito (25/11/2026).** Implementado: o diário é presumido em dia; "atrasado" só por marcação manual. Tela de conferência por amostra em `/diarios/conferencia`. |
| **G27** | Quais mensagens periódicas o sistema prepara aos docentes? | Resumo semanal (aulas, mudanças, prazos) na sexta-feira; aviso de fim de etapa com o prazo de entrega (5 dias letivos); aviso de fechamento do período. A Coordenação revisa e envia | **Aceito (25/11/2026).** Implementado: resumo semanal na sexta; aviso de fim de etapa (de 7 dias antes até a entrega) e aviso de fechamento do semestre (14 dias antes); a Coordenação revisa e envia. |
| **G28** | Qual grade vale para contar as aulas já dadas? | A grade vigente do semestre aplicada desde o início do período; a Coordenação corrige o valor se a grade mudou no meio. Alternativa: guardar uma cópia da grade a cada mudança (mais exata, mais trabalho) | **Aceito (25/11/2026).** Implementado: grade vigente do semestre desde o início do período (anuais: a grade de cada semestre); a Coordenação corrige se a grade mudou no meio. |
| **G29** | Como confirmar a reposição de aulas (ROD, Art. 37)? | O docente informa a data e, se quiser, anexa o formulário (PDF, JPG ou PNG, até 5 MB, guardado no banco); a Coordenação dá ciência. A Coordenação também pode registrar direto. O anexo não é obrigatório: o formulário também pode ir pelo e-mail institucional (cctrc.boaviagem@ifce.edu.br) | **Decidido (25/11/2026), implementado:** `/reposicoes`; reposição informada deixa de ser pendência e conta como aula dada no diário. |
| **G30** | Como tratar semanas de jogos internos, encontro dos servidores, Universo IFCE, semana do curso e de outros cursos, encontros de extensão e de pesquisa e eventos externos (grade temporária e alimentação)? | **Período especial** com datas (até 15 dias), **grade especial por turma** (copiada da normal e editada) que vale no lugar da normal nos dias do período, **estudantes presentes por turma e dia** (só a quantidade) e **resumo de refeições** (regra do campus × presentes) para a AE e a nutricionista | **Decidido (25/11/2026), implementado antes do congelamento de 04/01/2027:** `/periodos`. A grade especial vale em ausências e refeições (`aplicarGradeEspecial`) e no resumo semanal; Minha grade, agenda da tela inicial e aulas presumidas dos diários ainda usam a grade normal. |
| **G31** | Como a CCA (Coordenação de Controle Acadêmico, a secretaria escolar do curso) participa? | Perfil **CCA**: acompanha todos os diários, só em leitura (sem corrigir, conferir nem enviar lembretes), e consulta calendário e catálogo. Das PPI recebe só o **apanhado geral por turma** (deferidas, indeferidas, em análise), por mensagem pronta da Coordenação, sem nomes nem matrículas | **Aceito (26/11/2026), a partir do teste de 25/11.** Novo perfil `CCA`, canal `CCA` em Comunicação e página "Resumo para a CCA" na PPI. Ela não vê PPI individual, PPE, processos nem ausências. |
| **G32** | Quando outro docente ocupa o horário de quem faltou, a aula conta para quem? | A aula **não** conta na disciplina de quem faltou: ele ainda deve repô-la para completar a carga horária. O docente que ocupou o horário **pode** contá-lo na disciplina dele | **Aceito (26/11/2026), a partir do teste de 25/11.** A ausência coberta por substituição entra em Reposição de aulas (mesmo prazo do Art. 37) e sai do presumido do faltante. Ao decidir a substituição, a Coordenação escolhe a **disciplina que o substituto ministra no horário** e a aula conta no diário dela (sozinha, se ele só tem uma na turma). Prazo de reposição: o mesmo do Art. 37. Adiantamento continua contando como aula dada. |
