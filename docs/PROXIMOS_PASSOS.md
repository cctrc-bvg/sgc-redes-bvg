# Próximos Passos — Retomada do Desenvolvimento

> Atualizado em **23/11/2026** (2ª sessão). Leia este arquivo inteiro antes de continuar. Ele resume o estado do projeto, o que está
> bloqueado, o que fazer em seguida e as armadilhas já encontradas (para não redescobri-las).

---

## 1. Retomada rápida (5 minutos)

```bash
cd ~/projetos/sgc-redes-bvg
git status && git log --oneline -9          # branch minha-contribuicao, em dia com origin
./scripts/dev.sh testar                      # esperado: typecheck ok + 168 testes passando
ls .handoff/                                 # rascunhos de issue/PR e roteiros E2E (local, fora do git)
```

Depois, confira a seção 3 (o que depende do usuário) antes de escolher a próxima tarefa na seção 4.

---

## 2. Estado atual

**Repositórios:** `origin` = fork `isaacmiranda/sgc-redes-bvg` (permissão de admin); `upstream` = `cctrc-bvg/sgc-redes-bvg`
(somente leitura; contém **apenas o commit inicial com a licença**). O FSD, o README e o código inicial existem só no fork.

**Branch `minha-contribuicao`** — enviada ao fork, **sem PR aberto**. 17 commits à frente do upstream (4 do código inicial + 13 novos):

| Commit | Conteúdo |
| :--- | :--- |
| `8ebdce6` | Projeto executável: Next 16, React 19, Prisma 6, Tailwind 4, Vitest 5; Dockerfile multi-stage; migração inicial |
| `63a28c9` | `docs/IDENTIDADE_VISUAL_UX.md` (Marca IF, contraste, Nielsen, WCAG/eMAG) + tokens de cor e Open Sans |
| `1217372` | Correção: progresso da PPI mostrava 100% com 39,9h |
| `1be36a8` | Testes das regras de alimentação/SLA/PEI/PPI; tabela PPI movida para `src/lib/ppi-regras-2022.ts` |
| `605ec1c` | `scripts/dev.sh` (setup, testar, banco nativo/docker, dev, studio, docker, tudo) |
| `fd88bb4` | Login, sessões no banco, RBAC do FSD, troca obrigatória de senha, auditoria; seed sem senha fixa |
| `b62b737` | Cadastro/gestão de usuários pela Coordenação (`/usuarios`) |
| `d3cb489` | Correção: motor de alimentação valida a data (formato e calendário) |
| `126dc21` | Catálogo de Disciplinas (`/disciplinas`), permissão `disciplinas:gerenciar`, campo `Disciplina.ativa` |
| `9dc1367` | Consulta ao catálogo (Professor, CTP, Direção); matriz do PPC e blocos de horário (G01) no seed |
| `5afbbb0` | Núcleo, ano e semestre da disciplina (técnicas semestrais, 50% prática); G01 resolvida (sábados por data) |
| `888653b` | Matriz do 3º ano corrigida: siglas SEGR, EB, PRD, RSF; Projeto de Redes 80h |
| *(último)* | Ofertas: distribuição de disciplinas por turma e ano letivo (`/ofertas`) |

**`AGENTS.md`** (raiz): gerado pelo `next dev` com orientações para assistentes de código sobre o Next 16; versionado
para não reaparecer como alteração pendente. Pode ser editado fora do bloco `nextjs-agent-rules`.

**Telas existentes:** `/login`, `/painel` (cards dos módulos do perfil, todos "Em desenvolvimento"), `/conta/senha`,
`/usuarios`, `/usuarios/novo`, `/usuarios/[id]`, `/usuarios/[id]/senha`, `/disciplinas`, `/disciplinas/nova`, `/disciplinas/[id]`,
`/ofertas`, `/ofertas/[turmaId]?ano=AAAA`.

**Verificado:** 168 testes unitários, typecheck, `next build`, fluxos E2E contra PostgreSQL real (login, usuários e
disciplinas: 33; ofertas: 35 verificações). **Nunca verificado:** `docker compose up --build` (Docker não instalado na máquina de desenvolvimento).

---

## 3. Pendências que dependem do usuário (bloqueios)

- [ ] **Instalar um PostgreSQL** e testar no navegador: `sudo apt install -y postgresql` → `./scripts/dev.sh banco nativo`
      → `./scripts/dev.sh dev`. (Alternativa Docker: `sudo apt install -y docker.io docker-compose-v2`,
      `sudo usermod -aG docker $USER`, sair/entrar, `./scripts/dev.sh banco docker`.)
- [ ] **Testar a stack Docker completa:** `./scripts/dev.sh docker` (senha inicial em `docker compose logs migrate`).
      Pontos de risco: Prisma no Alpine (openssl/musl) e o motor do Prisma no `standalone`.
- [ ] **Decidir a publicação no `cctrc-bvg`:** abrir issue + PR com os 11 commits, ou primeiro um PR dentro do próprio fork.
      Textos prontos em `.handoff/github/` (o PR tem um item "Docker" a marcar após o teste e um `#<número>` da issue).
- [x] ~~Transcrição da matriz~~ — conferida: siglas SEGR, EB, PRD, RSF; Projeto de Redes 80h; o total de 960h do
      3º ano no PPC tem erro de soma (correto: 1.080h).
- [ ] A grade 2026 diverge da matriz em aulas/semana de algumas anuais (ex.: Geografia II 2 aulas vs. 40h;
      Servidores no 3º ano): confirmar se há PPC mais novo. Não bloqueia.
- [ ] **G14 (nova):** num sábado letivo, qual grade vale? (horário de um dia da semana, ou atividade específica?)
- [ ] **Responder G01–G13** (tabela em `.handoff/github/issue-decisoes-g01-g13.md`; G01–G12 também no FSD, seção 5).
      G01 resolvida: blocos A–D de 60 min; sábados letivos existem e variam com o calendário (cadastro por data).
      Alternativa: autorizar o uso dos padrões sugeridos no FSD.

---

## 4. Backlog priorizado

### P1 — não depende de G01–G13 (pode começar já)

1. ~~Validar a data no motor de alimentação~~ — feito (`d3cb489`).
2. ~~Catálogo de Disciplinas~~ — feito. Desativar em vez de excluir quando já há ofertas/PPEs; exclusão só para
   cadastro por engano. Falta: **importar a matriz do curso** (lista real de disciplinas e CH — pedir ao usuário
   ou ao PPC) e decidir se Professor/CTP devem **consultar** o catálogo (hoje só a Coordenação vê).
   → Ambos feitos: matriz importada pelo seed (47 disciplinas) e consulta liberada a Professor, CTP e Direção.
3. ~~Ofertas~~ — feito. `DisciplinaOferta` agora tem `anoLetivo` + `semestreLetivo` (null = anual; técnica de
   semestre ímpar do curso → .1, par → .2), única por ano/turma/disciplina; `aulasPrevistas` = carga horária (blocos
   de 60 min). Tela por turma com um select de professor por disciplina; oferta já usada na grade não pode ficar sem
   professor. Falta: **ofertar disciplina de outro ano** (ex.: dependência/reoferta, "Artes II" no 3º ano da grade
   2026) e permitir ao professor **ver as próprias ofertas** (virá com o semáforo de diários).
4. **Turmas** — `anoCurso` (1–3) adicionado e preenchido pelo seed; hoje só via seed (`REDES-1..3`); tela para editar `qtdAlunosAtivos` e médias de refeição
   (`qtdMedia*`), usadas nos avisos à Assistência Estudantil.
5. **Tela de auditoria** (`auditoria:ver`, só Coordenação) — filtrar `AuditLog` por ação, usuário e data.
6. **Limpeza de sessões expiradas** — linhas de `Sessao` vencidas só são apagadas quando o cookie é reapresentado.
   Apagar vencidas no login (barato) ou por rotina periódica.
7. **Testes E2E versionados** — migrar os roteiros de `.handoff/e2e/` (Python, sem JS) para Playwright no projeto,
   incluindo um teste com JavaScript habilitado.
8. **`prisma.config.ts`** — o Prisma avisa que `package.json#prisma` (seed) será removido no Prisma 7.
9. **CI (GitHub Actions)** — typecheck + testes + build em PRs.

### P2 — depende das decisões

| Módulo (FSD) | Requisito | Decisões |
| :--- | :--- | :--- |
| Grade e janelas livres | RF01 | G14 (G01 resolvida) |
| Ausências e substituição | RF02 | G01, G03 |
| Painel de alimentação (AE) | RF03, RF04 | G02, G04, G05, G06, G13 |
| Hub de comunicação WhatsApp | RF05 | G07, G08 |
| PPE / PEI | RF06 | G09, G10 |
| PPI (40h) | RF07 | G11 |
| Semáforo de diários | RF08 | — (depende das ofertas, P1-3) |
| Kanban SEI | RF09 | — (pode ir para P1 se houver pressa) |
| Relatórios | — | depende dos módulos acima |

Ordem sugerida após as decisões: Grade → Ausências → Alimentação → Comunicação (núcleo da Fase 1).

---

## 5. Decisões já tomadas (não rediscutir sem motivo novo)

- **Disciplinas:** técnicas são **semestrais** (CH da coluna "Semestre" do PPC) e têm **metade da carga prática**
  (`exigePratica` verdadeiro); propedêuticas e diversificadas são **anuais**. Validado no formulário
  (`DisciplinaSchema`). Ofertas devem respeitar isso: anual = ano letivo inteiro; técnica = um semestre.
- **Sábados letivos** existem mas dependem do calendário civil: cadastrar por data, nunca como dia fixo da semana.
- **Prisma 6.x**, não 7: o schema usa `url = env(...)` no datasource.
- **Sessões próprias no banco**, não NextAuth (v5 ainda beta para Next 16). `NEXTAUTH_URL` → `APP_URL`;
  `AUTH_SECRET` removido. Caminho futuro: SSO SUAP via OIDC.
- **Senha provisória** gerada pelo sistema, exibida uma vez, troca obrigatória no 1º acesso.
- **Cookie de sessão** sem `Expires` (fecha com o navegador; computadores compartilhados); 8h de inatividade no banco.
- **Verde oficial `#2f9e41` não é usado em texto** (3,45:1). Ações/links: `if-verde-700`. Vermelho só para erro/emergência.
  Status sempre com ícone + texto.
- **Formulários funcionam sem JavaScript** (Server Actions + `useActionState`) — é um requisito de acessibilidade.
- Interface, mensagens, commits e documentação **em português**.

---

- **Grade de exemplo (PDF aSc 2026)** traz professores por disciplina/turma: útil para testar as Ofertas (P1-3), mas os
  **nomes de professores não vão para o repositório** (dados pessoais em repositório público). Cadastrar pela tela.

## 6. Convenções do código

- **Acesso:** toda página e Server Action protegida começa com `exigirUsuario()` ou `exigirPermissao('...')`
  (`src/lib/auth/dal.ts`). O `src/proxy.ts` só faz checagem otimista do cookie. Novas permissões vão em
  `src/lib/auth/rbac.ts` (com teste em `auth.test.ts`).
- **Nunca** use `acao.bind(null, id)` com `useActionState`: no envio sem JS o React re-renderiza sem fim e prende o
  servidor a 100% de CPU. Passe o id por `<input type="hidden">` e leia do `FormData`.
- **Formulários:** componentes `Campo`, `Selecao`, `BotaoPrimario`, `BotaoSecundario`, `Alerta` (`src/components/campo.tsx`);
  validação com zod no servidor (`z.flattenError(...).fieldErrors`); `noValidate` no `<form>`; devolver os valores
  digitados no estado para não perder o que foi preenchido.
- **Código só de servidor** importa `'server-only'`. Componentes cliente não podem importar módulos com `node:crypto`
  (ex.: `PERFIS` fica em `rbac.ts`, não em `usuarios/regras.ts`).
- **Regras de negócio puras** em `src/lib/**` com testes `*.test.ts` ao lado; o alias `@/` funciona também no Vitest.
- **Auditoria:** `registrarAuditoria()` registra ação e campos alterados, **nunca** valores pessoais ou senhas.
- **Alterar o schema:** edite só as linhas necessárias (não rode `prisma format`, ele realinha o arquivo inteiro).
  Gere a migração sem banco:
  ```bash
  git show HEAD:prisma/schema.prisma > /tmp/schema_antigo.prisma
  mkdir -p prisma/migrations/AAAAMMDDHHMMSS_nome
  DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma migrate diff \
    --from-schema-datamodel /tmp/schema_antigo.prisma --to-schema-datamodel prisma/schema.prisma \
    --script > prisma/migrations/AAAAMMDDHHMMSS_nome/migration.sql
  npx prisma generate
  ```
- **Commits** pequenos e temáticos, mensagem em português; correções de bugs em commit separado.

---

## 7. Ambiente local e armadilhas conhecidas

- Máquina com **4 GB de RAM e HDD**: rode tudo com `nice -n 15 ionice -c 2 -n 7`, um processo pesado por vez.
  O `scripts/dev.sh` já faz isso.
- **npm 9.2 do Ubuntu** falha com `reading 'edgesOut'`: use `npx -y npm@10 install` (o `dev.sh` faz automaticamente).
- **Sem Postgres/Docker na máquina de desenvolvimento?** Use `npx prisma dev -n sgc-teste -d` (Postgres embutido).
  Exige `&connection_limit=1&pgbouncer=true` na `DATABASE_URL`, senão dá `42P05 prepared statement already exists`.
- **`prisma migrate reset` é bloqueado** quando executado por um assistente de IA; para recomeçar o banco de teste,
  remova e recrie a instância (`npx prisma dev stop|rm sgc-teste`). O `.handoff/e2e/e2e_ambiente.sh` faz isso.
- **Servidor standalone de teste:** copie `.next/static` para `.next/standalone/.next/static`; inicie com `exec` e
  localize o processo pela porta (`ss -ltnp | grep :3123`), não pelo PID do shell. Evite `pkill -f <texto>`:
  ele pode encerrar o próprio shell que contém o texto.
- **Processo preso em 100% de CPU:** `kill -USR1 <pid>` ativa o inspetor; `node .handoff/e2e/inspecionar-cpu.mjs`
  pausa e mostra a pilha com trechos do código (foi assim que se achou o problema do `.bind`).

---

## 8. Verificação antes de cada commit

```bash
./scripts/dev.sh testar                                   # typecheck + testes unitários
NEXT_TELEMETRY_DISABLED=1 nice -n 15 npx next build       # build de produção
# Se mexeu em telas/ações: E2E sem JavaScript contra Postgres temporário
.handoff/e2e/e2e_ambiente.sh                              # recria banco, migra, seed, sobe servidor na 3123
python3 -I .handoff/e2e/e2e_usuarios.py && python3 -I .handoff/e2e/e2e_disciplinas.py
# e2e_login.py troca a senha da coordenação para outra: rode-o num banco recriado
```

Após o E2E, desligue o servidor (porta 3123) e o banco (`npx prisma dev stop sgc-teste && npx prisma dev rm sgc-teste`).
