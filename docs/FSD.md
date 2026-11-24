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

### RF09 — Kanban de Processos SEI e Atendimentos
- Fluxo em 4 colunas (`NOVO` $\rightarrow$ `COM_PROFESSOR` $\rightarrow$ `AGUARDANDO_RETORNO` $\rightarrow$ `CONCLUIDO`) com número SEI, prazo e etiquetas (`Aproveitamento de Disciplina`, `Graduado/Transferido`, `Estágio`, `Orientação/Mediação`, `Outro SEI`).
- Itens marcados como `sigiloso = true` são visíveis exclusivamente ao perfil `COORDENADOR`.

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
