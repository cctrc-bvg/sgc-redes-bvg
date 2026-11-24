# Próximos Passos — Retomada do Desenvolvimento

> Atualizado em **24/11/2026**. Leia este arquivo inteiro antes de continuar. Ele resume o estado do projeto, o que
> depende do usuário, o que fazer em seguida e as armadilhas já encontradas (para não redescobri-las).

---

## 1. Retomada rápida (5 minutos)

```bash
cd ~/projetos/sgc-redes-bvg
git status && git log --oneline -12         # branch minha-contribuicao, em dia com origin
./scripts/dev.sh testar                      # esperado: typecheck ok + 220 testes passando
ls .handoff/github .handoff/e2e              # rascunhos de issue/PR e roteiros E2E (local, fora do git)
```

Depois, confira a seção 3 (o que depende do usuário) antes de escolher a próxima tarefa na seção 4.

---

## 2. Estado atual

**Repositórios:** `origin` = fork `isaacmiranda/sgc-redes-bvg` (admin); `upstream` = `cctrc-bvg/sgc-redes-bvg`
(somente leitura; contém só o commit inicial com a licença). FSD, README e código existem só no fork.

**Branch `minha-contribuicao`** — enviada ao fork, **sem PR aberto**, 21 commits à frente do upstream:

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
| *(último)* | Este roteiro atualizado para a retomada |

**Telas** (todas funcionam sem JavaScript):
- Acesso: `/login`, `/painel` (cards por perfil; só "Grade" já abre), `/conta/senha`.
- Coordenação: `/usuarios` (+`/novo`, `/[id]`, `/[id]/senha`, `/importar`), `/disciplinas/nova`, `/disciplinas/importar`,
  `/ofertas`, `/ofertas/[turmaId]?ano=AAAA`, `/grade/turma/[id]/editar`, cadastro em `/grade/sabados`.
- Consulta (Professor, CTP, Direção conforme permissão): `/disciplinas`, `/disciplinas/[id]`, `/grade`, `/grade/minha`,
  `/grade/turma/[id]`, `/grade/sabados`. Período da grade por `?ano=AAAA&sem=1|2`.
- Modelos de planilha: `/disciplinas/importar/modelo?formato=xlsx|csv`, `/usuarios/importar/modelo?formato=xlsx|csv`.

**Dados no seed** (idempotente; nunca sobrescreve edições): coordenador inicial, turmas `REDES-1..3` (com `anoCurso`),
canais WhatsApp, regras PPI, 8 blocos de horário (A–D manhã/tarde, 60 min) e as **47 disciplinas da matriz**.

**Verificado:** 220 testes unitários, typecheck, `next build` e 6 roteiros E2E sem JavaScript contra PostgreSQL real
(login, usuários, disciplinas 33, ofertas 35, grade 44, importação 42 verificações), todos verdes em 24/11/2026.
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
- [ ] **Decidir a publicação no `cctrc-bvg`:** issue + PR, ou primeiro um PR dentro do fork. Textos prontos e
      atualizados em `.handoff/github/` (o PR tem o item "Docker" a marcar após o teste e um `#<número>` da issue).
      **Confirmar com o usuário antes de criar issue/PR** no repositório da organização.
- [ ] **Responder G02–G13** (`.handoff/github/issue-decisoes-g01-g13.md`; também no FSD, seção 5) ou autorizar os padrões
      sugeridos no FSD. G01 e G14 já resolvidas.
- [ ] (Não bloqueia) A grade 2026 diverge da matriz em aulas/semana de algumas anuais (ex.: Geografia II 2 aulas vs.
      40h): confirmar se há PPC mais novo. A tela da grade já aponta "⚠ difere" nesses casos.

---

## 4. Backlog priorizado

### P1 — não depende de decisões pendentes

1. **Turmas** (tela) — hoje só via seed. Editar nome, `anoCurso`, `qtdAlunosAtivos` e médias de refeição (`qtdMedia*`,
   usadas nos avisos à Assistência Estudantil); ativar/desativar.
2. **Importação em lote de ofertas e sábados letivos** — mesmo padrão de `src/lib/importacao/` (o usuário pediu lote
   "seja de disciplinas, de usuários"; ofertas e calendário são os próximos candidatos naturais).
3. **Tela de auditoria** (`auditoria:ver`, só Coordenação) — filtrar `AuditLog` por ação, usuário e data.
4. **Limpeza de sessões expiradas** — apagar `Sessao` vencidas no login (barato) ou por rotina periódica.
5. **Semáforo de diários (RF08)** — não depende de decisões: ofertas já têm `aulasPrevistas`/`aulasMinistradas`.
   Incluir aqui a visão do professor das **próprias ofertas**.
6. **Kanban SEI (RF09)** — não depende de decisões.
7. **Testes E2E versionados** — migrar `.handoff/e2e/` (Python, sem JS) para Playwright no projeto, + um com JS.
8. **`prisma.config.ts`** — o Prisma avisa que `package.json#prisma` (seed) será removido no Prisma 7.
9. **CI (GitHub Actions)** — typecheck + testes + build em PRs.

### P2 — depende das decisões

| Módulo (FSD) | Requisito | Decisões |
| :--- | :--- | :--- |
| Ausências e substituição | RF02 | G03 (G01/G14 ok; usar `diaDaGradeNaData()`) |
| Painel de alimentação (AE) | RF03, RF04 | G02, G04, G05, G06, G13 |
| Hub de comunicação WhatsApp | RF05 | G07, G08 |
| PPE / PEI | RF06 | G09, G10 |
| PPI (40h) | RF07 | G11 |
| Relatórios | — | depende dos módulos acima |

Ordem sugerida: Ausências → Alimentação → Comunicação (núcleo da Fase 1).

### Feito nesta fase (referência)

Catálogo + matriz, consulta ao catálogo, ofertas, grade (RF01) com sábados letivos, importação em lote. Detalhes nos
commits da seção 2 e nas decisões da seção 5.

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
- **Importação em lote** por .xlsx ou .csv com modelo pré-preenchido para baixar, editar e enviar; prévia antes de gravar.

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
  ~1–2 min; a bateria completa de E2E (6 roteiros, cada um com banco recriado) passa de 10 min — rode em segundo plano.
- **npm 9.2 do Ubuntu** falha com `reading 'edgesOut'`: use `npx -y npm@10 install` (o `dev.sh` faz isso).
- **Postgres de teste sem Docker:** `npx prisma dev -n sgc-teste -d`. Exige `&connection_limit=1&pgbouncer=true` na
  `DATABASE_URL`, senão `42P05 prepared statement already exists`.
- **`prisma migrate reset` é bloqueado** para assistentes de IA: recrie a instância (`npx prisma dev stop|rm sgc-teste`).
- **Servidor standalone de teste:** copie `.next/static` para `.next/standalone/.next/static`; localize o processo pela
  porta (`ss -ltnp | grep :3123`). Evite `pkill -f <texto>` (pode matar o próprio shell).
- **Processo a 100% de CPU:** `kill -USR1 <pid>` e `node .handoff/e2e/inspecionar-cpu.mjs` mostram a pilha.
- **Roteiros E2E (Python, sem JS):**
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
for s in e2e_login e2e_usuarios e2e_disciplinas e2e_ofertas e2e_grade e2e_importacao; do
  bash .handoff/e2e/e2e_ambiente.sh >/dev/null 2>&1          # recria banco, migra, seed, sobe servidor na 3123
  echo "$s: $(python3 -I .handoff/e2e/$s.py 2>&1 | grep -E 'FALHA|TUDO CERTO' | tr '\n' ' ')"
done
```

Depois do E2E, desligue o servidor e o banco:
`ss -ltnp | grep :3123` (matar o pid) e `npx prisma dev stop sgc-teste && npx prisma dev rm sgc-teste`.
