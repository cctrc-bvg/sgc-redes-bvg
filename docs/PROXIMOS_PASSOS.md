# Próximos Passos — Retomada do Desenvolvimento

> Atualizado em **24/11/2026** (Fase 1 e 2 completas; comunicação por e-mail institucional sem depender do WhatsApp). Leia este arquivo inteiro antes de continuar. Ele resume o estado do projeto, o que
> depende do usuário, o que fazer em seguida e as armadilhas já encontradas (para não redescobri-las).

---

## 1. Retomada rápida (5 minutos)

```bash
cd ~/projetos/sgc-redes-bvg
git status && git log --oneline -20         # branch minha-contribuicao; enviada ao fork em 24/11/2026 (pergunte antes de novos push)
./scripts/dev.sh testar                      # esperado: typecheck ok + 316 testes passando
ls .handoff/github .handoff/e2e              # rascunhos de issue/PR e roteiros E2E (local, fora do git)
```

Depois, confira a seção 3 (o que depende do usuário) antes de escolher a próxima tarefa na seção 4.

---

## 2. Estado atual

**Repositórios:** `origin` = fork `isaacmiranda/sgc-redes-bvg` (admin); `upstream` = `cctrc-bvg/sgc-redes-bvg`
(somente leitura; contém só o commit inicial com a licença). FSD, README e código existem só no fork.

**Branch `minha-contribuicao`** — **sem PR aberto**. Enviada ao fork em 24/11/2026 com autorização do usuário; CI verde
no GitHub. Novos `git push` continuam pedindo confirmação:

| Commit | Conteúdo |
| :--- | :--- |
| `8ebdce6` | Projeto executável: Next 16, React 19, Prisma 6, Tailwind 4, Vitest; Dockerfile multi-stage; migração inicial |
| `63a28c9` | `docs/IDENTIDADE_VISUAL_UX.md` (Marca IF, contraste, Nielsen, WCAG/eMAG) + tokens de cor e Open Sans |
| `1217372` | Correção: progresso da PPI mostrava 100% com 39,9h |
| `1be36a8` | Testes das regras de alimentação/SLA/PEI/PPI; tabela PPI em `src/lib/ppi-regras-2022.ts` |
| `605ec1c` | `scripts/dev.sh` (setup, testar, banco nativo/docker, dev, studio, docker, tudo) |
| `fd88bb4` | Login, sessões no banco, RBAC do FSD, troca obrigatória de senha, auditoria; seed sem senha fixa |
| `b62b737` | Cadastro/gestão de usuários pela Coordenação (`/usuarios`) |
| `2389278`, `a8d3a5f` | Este roteiro; `AGENTS.md` versionado |
| `d3cb489` | Correção: motor de alimentação valida a data (formato e calendário) |
| `126dc21` | Catálogo de Disciplinas (`/disciplinas`), `disciplinas:gerenciar`, `Disciplina.ativa` |
| `9dc1367` | Consulta ao catálogo (Professor, CTP, Direção: `disciplinas:ver`); matriz do PPC e blocos (G01) no seed |
| `5afbbb0` | Núcleo, ano e semestre da disciplina (técnicas semestrais, 50% prática) |
| `888653b` | Matriz do 3º ano corrigida: siglas SEGR, EB, PRD, RSF; Projeto de Redes 80h |
| `ae6face` | Ofertas: distribuição de disciplinas por turma e ano letivo (`/ofertas`, `ofertas:gerenciar`) |
| `e01c1e1` | Grade horária (RF01): turma, minha grade, edição com trava de choque, janelas, sábados letivos (G14) |
| `060369d` | Importação em lote (.xlsx/.csv) de disciplinas e usuários, com modelos pré-preenchidos |
| `91723c9` | Este roteiro atualizado para a retomada |
| `0368890` | Cadastro de turmas (`/turmas`, `turmas:gerenciar`): ativos, médias de refeição, ano do curso, ativar/excluir |
| `239604c` | Decisões G02–G13 registradas (padrões do FSD aceitos pelo usuário) |
| `4ad4be3` | Sessões vencidas apagadas a cada login |
| `0f79565` | **Fase 1:** ausências e coberturas (RF02), avisos de refeição e painel da AE (RF03/RF04, G02–G06, G13), comunicação semiautomática (RF05, G07/G08) |
| `8805b79` | Tela de auditoria (`/auditoria`) |
| `3ac54fe` | Kanban de processos SEI (RF09, `/processos`) com sigilo só para a Coordenação |
| `48320ba` | Semáforo de diários (RF08, `/diarios`) + calendário do semestre (`PeriodoLetivo`) |
| `e89d496` | PPI 40h (RF07, `/ppi`): tetos acumulados por categoria, certificado único, ficha para assinatura |
| `79b0026` | PPE/PEI (RF06, `/ppe`): Art. 115, travas dos Arts. 117/121, cronograma, cópia de cronograma (G09) |
| `6dc096e` | Relatórios consolidados (`/relatorios`), sem dados pessoais |
| `de5ec21` | Importação em lote de ofertas e sábados letivos |
| `d6bfb6a` | Este roteiro atualizado (madrugada) |
| `525ef78` | CI no GitHub Actions: typecheck, testes e build (`.github/workflows/ci.yml`) |
| `8b2562c` | PEI para impressão (`/ppe/[id]/imprimir`) |
| `2f022d2` | Convite de substituição: Coordenação convida, docente aceita/recusa em "Minha grade" |
| `f4b53a4` | Cabeçalho da Coordenação com menus "Operação" e "Cadastros" (`<details>`, sem JS) |
| `124b677`, `a1c5672` | Pendências nos cards do painel; este roteiro |
| *(último)* | **Comunicação sem depender do WhatsApp:** mensagens prontas com e-mail institucional, campos `{{...}}`, cópia; "Meu contato" |

**Telas** (todas funcionam sem JavaScript):
- Acesso: `/login`, `/painel` (cards por perfil; **todos os módulos já abrem**), `/conta/senha`, `/conta/contato`
  (cada pessoa decide se o WhatsApp dela é usado; desligado = só e-mail).
- Coordenação: `/usuarios` (+`/novo`, `/[id]`, `/[id]/senha`, `/importar`), `/disciplinas/nova`, `/disciplinas/importar`,
  `/turmas` (+`/nova`, `/[id]`), `/ofertas` (+`/importar`), `/ofertas/[turmaId]?ano=AAAA`, `/grade/turma/[id]/editar`,
  cadastro em `/grade/sabados` (+`/importar`), `/ausencias` (+`/nova`, `/[id]`), `/comunicacao`, `/auditoria`,
  `/processos` (+`/novo`, `/[id]`), `/diarios` (+`/[ofertaId]`), `/ppi` (+`/nova`, `/[id]`, `/[id]/ficha`), `/ppe/nova`.
- Assistência Estudantil: só `/alimentacao` (previsão por turma, avisos, ciência). Coordenação também lança acréscimos
  (`/alimentacao/adicionar`, G05) e ajusta quantidades (G04).
- Professor: `/grade/minha` mostra substituições/adiantamentos dos próximos 14 dias; `/diarios` (só os próprios);
  `/ppe` e `/ppe/[id]` das disciplinas que leciona no ano (define modalidade, preenche o PEI, encerra).
- CTP: `/ppe` (leitura, Art. 127), `/processos` (leitura, sem sigilosos), `/relatorios`. Direção: `/relatorios`.
- Consulta (Professor, CTP, Direção conforme permissão): `/disciplinas`, `/disciplinas/[id]`, `/grade`, `/grade/minha`,
  `/grade/turma/[id]`, `/grade/sabados`. Período da grade por `?ano=AAAA&sem=1|2`.
- Modelos de planilha (`?formato=xlsx|csv`): `/disciplinas/importar/modelo`, `/usuarios/importar/modelo`,
  `/ofertas/importar/modelo` (`&ano=AAAA`), `/grade/sabados/importar/modelo`.

**Dados no seed** (idempotente; nunca sobrescreve edições): coordenador inicial, turmas `REDES-1..3` (com `anoCurso`;
editáveis em `/turmas`),
grupos e setores de comunicação (saudação padrão só para professores e líderes), regras PPI, 8 blocos de horário (A–D manhã/tarde, 60 min) e as **47 disciplinas da matriz**.

**Verificado:** 316 testes unitários, typecheck, `next build` e 14 roteiros E2E sem JavaScript contra PostgreSQL
real, todos verdes em 24/11/2026: login, usuários, disciplinas, ofertas, grade, importação, turmas, ausências (inclui comunicação, auditoria e relatórios), alimentação, processos, diários, PPI, PPE e importação de ofertas/sábados.
As migrações que convertem dados (ofertas e grade) foram testadas com linhas no formato antigo.

**Nunca verificado:** `docker compose up --build` (stack completa em contêiner).

---

## 3. Pendências que dependem do usuário

- [ ] **Atualizar o banco Docker de desenvolvimento** (`sgc_dev_db`, já rodando): `./scripts/dev.sh banco docker` aplica
      as migrações novas e o seed; depois `./scripts/dev.sh dev` e testar no navegador. Se esse banco recebeu a matriz
      numa versão anterior, Projeto de Redes pode estar com 40h (o seed não sobrescreve CH): corrigir pela tela.
      Obs.: o usuário já está no grupo `docker`; uma sessão de terminal antiga precisa de `sg docker -c "..."`.
- [ ] **Testar a stack Docker completa:** `./scripts/dev.sh docker` (senha inicial em `docker compose logs migrate`).
      Riscos: Prisma no Alpine (openssl/musl), motor do Prisma e **ExcelJS** no `standalone`. É pesado para 4 GB de RAM.
- [x] ~~Enviar os commits da madrugada ao fork~~ — enviados em 24/11/2026; primeira execução do CI no GitHub passou.
- [ ] **Testar no navegador com JavaScript** os módulos novos (os E2E são sem JS). Em especial a página da ausência
      (caixas de mensagem: copiar, colar, substituir campos, abrir no e-mail) e a Alimentação vista pela AE.
- [ ] **Cadastrar em `/comunicacao`** o e-mail institucional e a saudação de cada grupo/setor (CAE, CTP, Gestão,
      professores, turmas). Sem isso as mensagens saem com "Para" vazio e um campo `{{...}}` na saudação.
- [ ] **Configurar `APP_URL`** no servidor de produção: as mensagens aos docentes trazem o link de "Minha grade".
- [x] ~~Envio automático (Evolution API)~~ — **decidido em 24/11/2026: continuar semiautomático** (e-mail ou WhatsApp Web
      com o texto pronto). O código da Evolution fica, desligado, para o futuro.
- [ ] **Publicação no `cctrc-bvg`** — **decidido: depois do teste no navegador, issue + PR a partir do fork.** Textos em
      `.handoff/github/` (o PR tem o item "Docker" a marcar após o teste e um `#<número>` da issue).
      **Confirmar com o usuário antes de criar issue/PR** no repositório da organização.
- [x] ~~Responder G02–G13~~ — **padrões do FSD aceitos em 24/11/2026** (FSD, seção 5). Todas as decisões G01–G14 fechadas.
- [x] ~~Grade 2026 × matriz~~ — o usuário confirmou (24/11/2026) que a turma de 2026 tem as aulas normais e que Geografia
      é anual: a grade 2026 vale como está; a marca "⚠ difere" é só informativa.

---

## 4. Backlog priorizado

### P1 — próximos passos

1. **Testes E2E versionados** — migrar `.handoff/e2e/` (Python, sem JS) para Playwright no projeto, + roteiros com JS.
2. ~~CI~~ feito e verde no GitHub (actions na v5, sem o aviso de Node 20).
3. **`prisma.config.ts`** — o Prisma avisa que `package.json#prisma` (seed) será removido no Prisma 7. **Cuidado:** com o
   arquivo de configuração o Prisma 6 deixa de carregar o `.env` sozinho (precisa de `import 'dotenv/config'`), o que afeta
   `scripts/dev.sh` e o Dockerfile (`npx prisma db seed`). Fazer junto com o teste da stack Docker.
4. ~~Impressão do PEI~~ feito (`/ppe/[id]/imprimir`); conferir com o modelo em papel do campus.
5. ~~G05 integrado ao PEI~~ — decidido manter manual (ver decisões abaixo).
6. ~~Convite de substituição~~ feito, com mensagem pronta ao convidado (e-mail ou WhatsApp).
7. ~~Cabeçalho agrupado~~ feito. Os menus `<details>` ficam abertos ao navegar no cliente; fechar com JS se incomodar.
8. **Mensagens prontas em outros módulos:** acréscimo de refeição (`/alimentacao/adicionar`) e decisões de PPI/PPE ainda
   não geram caixa de mensagem; usar a mensagem avulsa de `/comunicacao` enquanto isso.

### Decisões de 24/11/2026 (sugestões aceitas pelo usuário)

- **Publicação:** testar no navegador, depois issue + PR do fork para o `cctrc-bvg` (com confirmação antes).
- **Escolhas da madrugada** (seção 5, "Implementação da Fase 1 e 2"): aceitas; levar à Coordenação para validar.
- **WhatsApp:** semiautomático; o sistema funciona **inteiro sem integração**. Toda comunicação também por **e-mail institucional**.
- **G05 no PEI:** continua manual (`/alimentacao/adicionar`) para não guardar a turma do estudante com PEI.
- **Playwright:** poucos roteiros de fumaça com JS, rodando no CI do GitHub (não na máquina de 4 GB).
- **`prisma.config.ts` / Prisma 7:** junto com o teste do Docker, sem pressa.
- **Aviso ao convidado:** já sai na caixa de mensagens da ausência (e-mail ou WhatsApp, com link de "Minha grade").
- **Login pelo SUAP:** segunda fase, depois do sistema em uso (pedir cadastro do app à TI).

### Feito (referência)

Catálogo + matriz, consulta ao catálogo, ofertas, grade (RF01) com sábados letivos, importação em lote (disciplinas,
usuários, ofertas, sábados), turmas, ausências (RF02), alimentação (RF03/RF04), comunicação (RF05), PPE/PEI (RF06),
PPI (RF07), diários (RF08), Kanban SEI (RF09), relatórios, auditoria, limpeza de sessões. Detalhes nos commits da seção 2
e nas decisões da seção 5.

---

## 5. Decisões já tomadas (não rediscutir sem motivo novo)

**Curso e calendário (confirmadas pela Coordenação):**
- **Disciplinas técnicas são semestrais** (CH da coluna "Semestre" do PPC) e têm **metade da carga prática**
  (`exigePratica` = sim); **propedêuticas e diversificadas são anuais**. Validado em `DisciplinaSchema`.
- **Matriz:** códigos repetidos entre anos recebem sufixo do ano (BIO.1, BIO.2…); técnicas do 3º ano: SEGR, EB, PRD, RSF;
  o total de 960h do 3º ano impresso no PPC tem erro de soma (correto: 1.080h). Dados em `src/lib/disciplinas/matriz-curricular.ts`.
- **G01:** 4 blocos de 60 min por turno — manhã 07:30–11:45 (intervalo 09:30–09:45), tarde 13:00–17:20 (intervalo
  15:00–15:20). Coincidem com os horários de refeição do motor (09:30, 12:00, 15:00).
- **G14:** há **sábados letivos**, variáveis com o calendário civil; cada um segue a grade de um dia da semana
  (`SabadoLetivo`). Use `diaDaGradeNaData()` para saber qual grade vale numa data.
- **Ofertas:** uma por ano letivo × turma × disciplina; anual → `semestreLetivo` null; técnica de semestre ímpar do curso
  → .1, par → .2; `aulasPrevistas` = CH. Ofertar disciplina de outro ano **não é necessário** (Artes no 3º ano foi caso único).
- **Grade:** por ano + semestre letivo; anuais nos dois semestres, técnicas só no seu. Janelas livres são **calculadas**
  (vago em turno com aula), não gravadas. Choque de professor entre turmas é recusado no servidor.
- **Acesso:** professores veem a grade de todas as turmas e a própria grade; Professor, CTP e Direção consultam o
  catálogo; só a Coordenação edita catálogo, ofertas, grade e sábados. Coordenação também leciona (recebe ofertas).
- **Turmas** valem para todos os anos letivos (as disciplinas de cada ano ficam nas ofertas). `Turma.anoLetivo` é legado:
  recebe o ano da criação e não aparece na tela. Médias de refeição ≤ estudantes ativos (≤ 80). Com ofertas lançadas, o
  ano do curso fica travado; turma usada (ofertas, grade, ausências, avisos) só é desativada, nunca excluída.
- **Importação em lote** por .xlsx ou .csv com modelo pré-preenchido para baixar, editar e enviar; prévia antes de gravar.
  Ofertas: chave ano + turma + disciplina, só cria ou troca professor (nunca remove). Sábados: dia da grade por extenso
  (números recusados: "2" seria 2ª-feira ou terça?).

**Implementação da Fase 1 e 2 (madrugada de 24/11/2026; revisar com a Coordenação se algo não bater com a prática):**
- **Ausência:** uma por oferta e dia (`@@unique([dataAula, ofertaId])`); decisão **por horário** em `CoberturaBloco`
  (substituição, adiantamento ou dispensa). Professor com aulas em 2 turmas no dia gera 2 registros.
- **Adiantamento:** traz uma aula **posterior** da mesma turma, no mesmo dia (inclusive do outro turno), de professor livre
  no horário vago; a origem fica vaga. Sugestões e validação consideram as coberturas das outras ausências do dia.
- **Motivo operacional** só de lista fechada (`MOTIVOS_OPERACIONAIS`); nada de texto livre (LGPD).
- **Refeições:** presença por turno = há pelo menos uma aula no turno (RN01; isso já atende G02). Avisos são
  recalculados por turma e dia a cada decisão (`recalcularAlertasDaTurma`): cria os que faltam, cancela (`canceladoEm`)
  os que deixaram de valer; refeição já servida não gera aviso (G13). Quantidade = média da turma; editável (G04), e
  mudar a quantidade pede nova ciência da AE. Acréscimos manuais (`manual = true`, G05) ficam fora do recálculo.
- **Emergência (< 4h):** exige justificativa na decisão e mostra "ligue para a AE" (G06).
- **Comunicação semiautomática por e-mail ou WhatsApp:** o sistema funciona sem integração com o WhatsApp. Cada mensagem
  (`MensagemPronta`, `src/lib/comunicacao/mensagem.ts`) tem Para (e-mail institucional do usuário ou do grupo/setor),
  assunto, texto editável e campos `{{...}}` para destinatários sem cadastro; a caixa (`src/components/caixa-mensagem.tsx`)
  copia texto/assunto, cola, substitui campos e abre no e-mail (`mailto:` sem a formatação `*negrito*`) ou no WhatsApp.
  O registro do envio pede o meio (E-mail, WhatsApp, Outro) e guarda o **texto gerado** (edições na caixa não vão ao banco).
  Mensagens individuais: convidado, substituto, docente da aula adiantada e docente ausente; CTP recebe aviso de dispensa.
  Canal **inativo** não gera mensagem. `User.usaWhatsapp = false` (em "Meu contato"): ninguém recebe link para o número
  da pessoa, e ela própria não vê botões nem a opção WhatsApp.
- **Mensagens:** sempre regeneradas no servidor; Gestão só recebe dispensa, impacto alimentar ou aula sem cobertura (G08);
  líderes de turma sem nome de docente; AE sem docente nem disciplina.
- **Diários:** espelho do sistema acadêmico (a Coordenação atualiza); amarelo quando ministradas < esperadas − 10%
  (mín. 2), com esperadas proporcionais ao tempo decorrido do semestre (`PeriodoLetivo`; anuais usam os dois semestres).
- **PPI:** tetos de quantidade e de horas **acumulados por categoria** (as atividades mais antigas consomem primeiro);
  deferir exige 40h; indeferir exige motivo; deferida trava lançamentos.
- **PPE:** o docente que define é quem tem oferta da disciplina no ano do semestre; CTP só lê; lançamento no sistema
  acadêmico (Art. 125) só pela Coordenação; prorrogação só para PEI preenchido.
- **Kanban:** item sigiloso não existe para quem não tem `kanban:ver-sigiloso` (404, nem aparece no payload).

**Técnicas:**
- **Prisma 6.x**, não 7 (schema usa `url = env(...)`).
- **Sessões próprias no banco**, não NextAuth. `APP_URL` no lugar de `NEXTAUTH_URL`. Futuro: SSO SUAP via OIDC.
- **Senha provisória** gerada pelo sistema, exibida uma vez, troca obrigatória no 1º acesso.
- **Cookie de sessão** sem `Expires`; 8h de inatividade no banco.
- **Verde oficial `#2f9e41` não é usado em texto** (3,45:1). Ações/links: `if-verde-700`. Status sempre com ícone + texto.
- **Formulários funcionam sem JavaScript** (Server Actions + `useActionState`) — requisito de acessibilidade.
- **ExcelJS** (não o pacote `xlsx` do npm, abandonado e vulnerável) para planilhas; fora do bundle (`serverExternalPackages`).
- **Dados pessoais fora do repositório:** a grade de exemplo (PDF aSc 2026) tem nomes de professores — não versionar;
  cadastrar pela tela ou por importação.
- Interface, mensagens, commits e documentação **em português**.

---

## 6. Convenções do código

- **Acesso:** toda página, Server Action e Route Handler protegido começa com `exigirUsuario()` ou
  `exigirPermissao('...')` (`src/lib/auth/dal.ts`). O `src/proxy.ts` só faz checagem otimista. Novas permissões em
  `src/lib/auth/rbac.ts` (com teste em `auth.test.ts`). Módulo pronto no painel: preencha `href` em `MODULOS`.
- **Nunca** use `acao.bind(null, id)` com `useActionState`: sem JS o React re-renderiza sem fim (CPU 100%). Passe ids
  por `<input type="hidden">`. Arquivo `'use server'` só exporta funções assíncronas (constantes vão para `src/lib`).
- **Formulários:** `Campo`, `Selecao`, `AreaTexto`, `BotaoPrimario`, `BotaoSecundario`, `Alerta` (`src/components/campo.tsx`);
  zod no servidor (`z.flattenError(...).fieldErrors`); `noValidate`; devolver os valores digitados no estado.
- **Formulários de lote** (distribuição, grade): o servidor monta a lista de itens a partir do banco e lê só esses
  campos do `FormData`; campo ausente = "não mexer"; planejamento puro (`planejar*`) + gravação em transação, tudo ou nada.
- **Código só de servidor** importa `'server-only'`. Componentes cliente não importam módulos com `node:crypto`, Prisma
  ou ExcelJS — recebem dados prontos por props (ex.: nomes de campo da grade).
- **Regras de negócio puras** em `src/lib/**` com `*.test.ts` ao lado; o alias `@/` funciona no Vitest.
- **Auditoria:** `registrarAuditoria()` com ação, ids e campos alterados; **nunca** nomes, e-mails ou senhas.
- **Importação em lote:** colunas/regras em `src/lib/importacao/<entidade>.ts` (puro, reaproveita o zod do formulário);
  planilhas em `planilha.ts`; entrada/confirmação em `servidor.ts`; tela em `src/components/importador-planilha.tsx`.
- **Alterar o schema:** edite só as linhas necessárias (não rode `prisma format`). Gere a migração sem banco:
  ```bash
  git show HEAD:prisma/schema.prisma > /tmp/schema_antigo.prisma
  mkdir -p prisma/migrations/AAAAMMDDHHMMSS_nome
  DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma migrate diff \
    --from-schema-datamodel /tmp/schema_antigo.prisma --to-schema-datamodel prisma/schema.prisma \
    --script > prisma/migrations/AAAAMMDDHHMMSS_nome/migration.sql
  npx prisma generate
  ```
  **Revise o SQL:** troca de coluna gera `DROP` + `ADD ... NOT NULL`, que perde dados ou falha com linhas existentes.
  Reescreva convertendo (veja `20261124150000_ofertas_ano_letivo`) e teste com linhas no formato antigo.
- **Commits** pequenos e temáticos, em português; correções de bugs em commit separado.

---

## 7. Ambiente local e armadilhas conhecidas

- Máquina com **4 GB de RAM e HDD**: tudo com `nice -n 15 ionice -c 2 -n 7`, um processo pesado por vez. O build leva
  ~1–2 min; a bateria completa de E2E (14 roteiros, cada um com banco recriado) leva ~40 min — rode em segundo plano.
- **npm 9.2 do Ubuntu** falha com `reading 'edgesOut'`: use `npx -y npm@10 install` (o `dev.sh` faz isso).
- **Postgres de teste sem Docker:** `npx prisma dev -n sgc-teste -d`. Exige `&connection_limit=1&pgbouncer=true` na
  `DATABASE_URL`, senão `42P05 prepared statement already exists`.
- **`prisma migrate reset` é bloqueado** para assistentes de IA: recrie a instância (`npx prisma dev stop|rm sgc-teste`).
- **Servidor standalone de teste:** copie `.next/static` para `.next/standalone/.next/static`; localize o processo pela
  porta (`ss -ltnp | grep :3123`). Evite `pkill -f <texto>` (pode matar o próprio shell).
- **Processo a 100% de CPU:** `kill -USR1 <pid>` e `node .handoff/e2e/inspecionar-cpu.mjs` mostram a pilha.
- **Roteiros E2E (Python, sem JS):** `e2e_alimentacao.py`, `e2e_processos.py`, `e2e_diarios.py`, `e2e_ppi.py` e `e2e_ppe.py`
  reaproveitam os utilitários de `e2e_ausencias.py` (cortado em `# --- Data alvo`); `e2e_importacao2.py` reaproveita
  `e2e_importacao.py`. O parser de formulários **ignora `<select>`** e só envia campos ocultos: passe selects e
  checkboxes em `valores` (ou `enviar_multi` para campos repetidos). Dados de teste entram por SQL (`sql()`).
  - o 1º formulário com Server Action em toda página logada é o **"Sair"** do cabeçalho — escolha o formulário pelo
    campo (`form_com(pag, "campo")`); na grade do 2º semestre há dois formulários com os mesmos campos ocultos;
  - o React separa textos adjacentes com `<!-- -->` (troque por "" antes de comparar) e o `<strong>` vira espaço;
  - para **contar** ocorrências, remova os blocos `<script>…</script>` (o payload RSC repete os textos);
  - consultas ao banco no roteiro: arquivo `.ts` temporário **dentro do projeto** + `npx tsx` (para achar `@prisma/client`).
- **Auditoria de dependências:** alertas altos vêm do Prisma (`effect`/`deepmerge-ts`, pré-existentes); o `uuid`
  moderado vem do ExcelJS e não se aplica (só v3/v5/v6 com buffer).

---

## 8. Verificação antes de cada commit

```bash
./scripts/dev.sh testar                                         # typecheck + testes unitários
NEXT_TELEMETRY_DISABLED=1 nice -n 15 ionice -c 2 -n 7 npx next build
# Se mexeu em telas/ações: E2E sem JavaScript, CADA roteiro num banco recriado (eles alteram senhas e dados)
for s in e2e_login e2e_usuarios e2e_disciplinas e2e_ofertas e2e_grade e2e_importacao e2e_turmas \
         e2e_ausencias e2e_alimentacao e2e_processos e2e_diarios e2e_ppi e2e_ppe e2e_importacao2; do
  bash .handoff/e2e/e2e_ambiente.sh >/dev/null 2>&1          # recria banco, migra, seed, sobe servidor na 3123
  echo "$s: $(python3 -I .handoff/e2e/$s.py 2>&1 | grep -E 'FALHA|TUDO CERTO' | tr '\n' ' ')"
done
```

Depois do E2E, desligue o servidor e o banco:
`ss -ltnp | grep :3123` (matar o pid) e `npx prisma dev stop sgc-teste && npx prisma dev rm sgc-teste`.
