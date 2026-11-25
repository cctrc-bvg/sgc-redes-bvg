# Próximos Passos — Retomada do Desenvolvimento

> Atualizado em **24/11/2026**, depois da fusão do **PR #1** e com o branch `e2e-playwright` (PR #2) em preparação. Leia este arquivo inteiro
> antes de continuar: estado do projeto, o que depende do usuário, o backlog e as armadilhas já encontradas.

---

## 1. Retomada rápida (5 minutos)

```bash
cd ~/projetos/sgc-redes-bvg
git status && git log --oneline -8          # branch e2e-playwright (a partir de upstream/main)
gh pr list -R cctrc-bvg/sgc-redes-bvg       # PRs abertos no original
./scripts/dev.sh testar                     # esperado: typecheck ok + 392 testes passando
```

Para ver o sistema com dados: `./scripts/dev.sh dev` num banco de desenvolvimento com
`npm run db:demo -- --confirmo` (usuários `@exemplo.edu.br`, senha `Demonstracao2026`). Regras e arquitetura:
[CONTRIBUTING.md](../CONTRIBUTING.md) e [Guia do contribuidor](desenvolvimento/GUIA_DO_CONTRIBUIDOR.md).

---

## 2. Estado atual

**Repositórios:**
- `origin` = fork `isaacmiranda/sgc-redes-bvg` (público, admin). `upstream` = `cctrc-bvg/sgc-redes-bvg` (original, só leitura).
- **PR #1** (`minha-contribuicao` → `main`, versão inicial completa) foi **mesclado em 24/11/2026**, sem comentários.
  `minha-contribuicao` está encerrado: trabalho novo sai de `upstream/main` num branch novo.
- **PR #2** (`e2e-playwright` → `main`, aberto em 24/11/2026): E2E com Playwright no CI, `prisma.config.ts`, mensagens
  prontas de PPI/PPE, guia de implantação, backup e saudações padrão. CI verde (`verificar` + `e2e` 18/18 no
  `ubuntu-24.04`); aguarda revisão. Texto em `.handoff/github/pr-e2e-playwright.md`.
- **Peça confirmação antes de cada push** (commits novos num branch com PR aberto entram no PR).

**Pronto (Fases 1 e 2 do FSD + extras):**
- Base: login/sessões, RBAC (5 perfis), auditoria, painel com pendências, Meu contato.
- Cadastros: usuários, turmas, disciplinas (matriz do PPC), ofertas.
- Operação:
  - calendário acadêmico;
  - grade (RF01) e sábados letivos;
  - ausências e convites (RF02);
  - alimentação (RF03/04);
  - comunicação semiautomática por e-mail ou WhatsApp (RF05): textos-padrão, mensagem avulsa, grupos de docentes,
    nutricionista, comunicar alterações da alimentação e do calendário.
- Gestão: PPE/PEI (RF06), PPI (RF07), diários (RF08), processos SEI (RF09), relatórios.
- Planilhas e PDF:
  - importação com prévia: usuários, disciplinas, ofertas, grade, calendário, sábados;
  - exportação .xlsx/.csv de todas as listagens;
  - PDF do calendário, das grades, dos relatórios, do PEI e da ficha de PPI.
- Documentação:
  - Ajuda no sistema (`/ajuda`, 14 tópicos com capturas);
  - `docs/MANUAL_DO_USUARIO.md` (gerado);
  - CONTRIBUTING, guia do contribuidor, modelos de issue/PR;
  - dados de demonstração (`prisma/demo.ts`).

**Branch `e2e-playwright` (24/11/2026):**
- **E2E com Playwright** em `e2e/` (`npm run e2e`), job `e2e` no CI com PostgreSQL de serviço + `db:demo`: login/sessão,
  menus, acesso por perfil, mensagem avulsa e caixa de mensagem, importação com prévia, páginas por perfil, PPI/PPE.
- **`prisma.config.ts`** no lugar de `package.json#prisma` (pronto para o Prisma 7); carrega o `.env` com
  `process.loadEnvFile` sem sobrescrever o ambiente. Dockerfile copia o arquivo; `.dockerignore` exclui `.handoff`.
- **Mensagens prontas de PPI e PPE:** `/ppi/[id]/comunicar` (deferida/indeferida → estudante e CTP; a decisão redireciona
  para lá) e `/ppe/[id]/comunicar` (momento calculado: pedir modalidade ao docente; modalidade definida, PEI pronto com
  cronograma e resultado → estudante e CTP). Textos puros em `src/lib/ppi/mensagens.ts` e `src/lib/ppe/mensagens.ts`.

**Verificado em 24/11/2026 (PR #1):**
- 380 testes unitários, typecheck e build;
- roteiros E2E sem JS (16 roteiros em `.handoff/e2e`, local);
- `docker compose up --build` com migração incremental sobre banco existente;
- teste manual no navegador com JS, feito pelo usuário;
- histórico do git sem dados reais: o branch foi reescrito em 24/11 para remover um telefone real dos testes.

---

## 3. Pendências que dependem do usuário

- [ ] **Acompanhar a revisão do PR #2** (o commit das saudações ainda precisa de push, com confirmação).
- [ ] **Cadastrar em Comunicação** o e-mail institucional de cada grupo/setor, incluindo a nutricionista. Saudações
      padrão (seed, só bancos novos): "prezados(as) …" no plural e "prezado(a) …" no singular.
- [ ] **Configurar `APP_URL`** (https) no servidor de produção — ainda sem endereço definido (decisão de 24/11: fica para depois).
- [ ] **VM de produção no Proxmox** (Docker Compose), com backups do PostgreSQL e HTTPS (proxy reverso).
- [ ] Testar as planilhas de exemplo com dados reais (`.handoff/planilhas-exemplo/`, fora do git).

---

## 4. Backlog priorizado

### P1 — próximos passos (em ordem)

1. **PR #2 (`e2e-playwright`):** CI verde; acompanhar a revisão e corrigir em commits novos (push com confirmação).
2. **Implantação em produção** (falta só o endereço): seguir `docs/IMPLANTACAO.md` — VM no Proxmox, Docker Compose,
   proxy reverso com HTTPS, `APP_URL`, backup diário (`scripts/backup-banco.sh`) e teste de restauração.
3. **Ampliar o E2E aos poucos** (branch `e2e-ampliado`, 24/11: +16 testes — exportação, turma, Meu contato,
   calendário, ausência com convite, alimentação, diários; depois, cabeçalhos de segurança (CSP) e acessibilidade com
   axe-core — e correção dos `<select>` que perdiam o valor após erro de validação). Os roteiros Python de `.handoff/e2e/` (sem JS, fora do git) cobrem mais regras que os
   de fumaça; levar ao Playwright só o que depende do navegador. Nesta máquina (Ubuntu 26.04):
   `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` e `TMPDIR=~/.cache/sgc-tmp`.
4. **Prisma 7/8** (em 24/11/2026 o `latest` do npm já é o 8.0.0-rc; o 7 estável é o 7.10.1 — esperar o 8 estável, que
   exige adaptador de driver e o gerador novo): o `prisma.config.ts` já existe; falta trocar `url = env(...)` do schema pela
   configuração do datasource e testar com `./scripts/dev.sh docker`.
5. ~~**Mensagens prontas de PPI/PPE:** validar os textos~~ — **validados em 25/11/2026** pelo usuário: mantidos assinatura,
   ficha da PPI assinada na Coordenação, motivo do indeferimento ao estudante, nome + matrícula para a CTP, pedido ao
   docente sem o nome do estudante, artigos do ROD também para o estudante, "aprovado(a)/não aprovado(a)/concluída" e
   e-mail do estudante **não** guardado. Acrescentado o aviso de **prazo prorrogado** (estudante e CTP).
6. **Conferir o PEI impresso** com o modelo em papel do campus.

### P2 — depois

- Integração com o SUAP (decidido: depois).
- Envio automático pela Evolution API: o código existe, desligado (decidido: semiautomático).
- **Fase 3 (FSD) — congelada (decisão de 25/11/2026):** laboratórios, estoque/DAP, atas e eventos ficam para
  implementação posterior; não iniciar sem nova decisão.
- Menus `<details>` do cabeçalho: já fecham com JS (`FecharMenus`); sem JS continuam abertos ao navegar.

### Concluídos em 24/11/2026

Calendário acadêmico e importação por planilha; grade por planilha; relatórios em PDF e planilha; exportação de todas
as listagens (.xlsx e .csv, com botões); textos-padrão editáveis; mensagem avulsa com vários destinatários e grupos de
docentes; nutricionista; comunicar alterações da alimentação e do calendário; Ajuda, manual e guia do contribuidor;
dados de demonstração; impressão do PEI; convites de substituição; CI. Depois do PR #1: E2E com Playwright no CI,
`prisma.config.ts`, mensagens prontas de PPI/PPE, guia de implantação e script de backup.

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

**Documentação (24/11/2026):** módulo **Ajuda** no sistema (`/ajuda`, tópicos por perfil com capacidades, fluxograma,
passo a passo, capturas e dúvidas; manual para PDF em `/ajuda/manual`), fonte única em `src/lib/ajuda/topicos.ts`,
`docs/MANUAL_DO_USUARIO.md` gerado por `npm run manual`, capturas por `npm run capturas` (Playwright) sobre dados
fictícios de `npm run db:demo -- --confirmo`. Para contribuidores: `CONTRIBUTING.md`,
`docs/desenvolvimento/GUIA_DO_CONTRIBUIDOR.md` e modelos de issue/PR em `.github/`. O teste da Ajuda falha se um módulo
do painel ficar sem tópico, se faltar imagem ou se o manual estiver desatualizado.

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
- **Mensagem avulsa:** vários destinatários (grupos/setores, grupos de docentes `docentes:todos|turma:X|ano:N` montados pelas
  ofertas do ano, pessoas); uma caixa por destinatário. Escolher um texto-padrão marca os destinatários sugeridos dele
  (`ModeloMensagem.destinos`). Campos `{{...}}` viram controles: turma e disciplina com lista dos cadastrados (`datalist`),
  `{{data...}}` com seletor de data (sai dd/mm/aaaa e preenche `{{dia}}`), `{{horário...}}` com seletor de hora,
  `{{horarios}}` com os blocos cadastrados. `{{nome}}`/`{{destinatarios}}` são preenchidos por destinatário.
- **Alimentação → comunicar:** dar ciência, ajustar quantidade ou acrescentar refeição leva quem tem `comunicacao:enviar`
  a `/alimentacao/comunicar?data=…&motivo=…`, com mensagens do dia para CAE, nutricionista, Gestão e turmas (turmas sem
  quantidade nem urgência). Registrar o envio à CAE marca os avisos do dia como enviados.
- **Calendário acadêmico** (`/calendario`, `src/lib/calendario/`): eventos (`EventoCalendario`, tipos fixos: férias docentes,
  matrícula, encontro pedagógico, avaliações finais/entrega de diários, feriado, ponto facultativo, acolhida, PITs/RITs,
  reunião, suspensão por força maior com motivo de lista fechada, outro), etapas `EtapaLetiva` N1–N4 e semestres
  (`PeriodoLetivo`, o mesmo dos diários). Sábados letivos continuam em `SabadoLetivo` (com o dia da grade). Dia letivo =
  seg–sex ou sábado letivo, dentro das etapas (ou semestres), fora de evento com `suspendeAulas`. Meta 200/ano, 50/etapa.
  `imprevisto` marca dias "a repor". Evento que suspende aulas zera a grade do dia em `carregarDia` (ausências e refeições).
  Professor, CTP, Direção e AE veem; só a Coordenação edita.
- **Impressão/PDF:** páginas `/calendario/imprimir` e `/grade/imprimir` (todas as turmas ou `?turma=`), PDF pelo "Salvar
  como PDF" do navegador (sem biblioteca); o cabeçalho do sistema some na impressão (`print:hidden`).
- **Exportação:** `/exportar/<listagem>?formato=xlsx|csv` (usuários, turmas, disciplinas, ofertas, grade, calendário,
  ausências), com a permissão de cada listagem; as que têm dados pessoais registram `EXPORTOU_LISTAGEM` na auditoria.
- **Nutricionista:** canal `NUTRICIONISTA`, recebe as mesmas alterações de refeição que a CAE (ausência e Alimentação).
- **Textos-padrão** (conjunto inicial em `src/lib/comunicacao/modelos.ts`): modelos por tipo de interação (convite, substituição,
  adiantamento, turma, CAE, CTP, Gestão, docente ausente, diário, reunião, comunicado, PPI, PPE, processo SEI), com variáveis
  `{{turma}}`, `{{data}}`, `{{horarios}}`, `{{nome}}` etc. Cada mensagem gerada traz `tipo` e `variaveis`; o select
  "Texto-padrão" da caixa troca assunto e texto, e o que o sistema não sabe vira campo a preencher. Na mensagem avulsa
  o select lista todos os modelos (sem JS, o servidor aplica o modelo quando o texto vem vazio). Editar modelos pela
  tela ficou para depois (backlog).
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

Movidas para o **[Guia do contribuidor](desenvolvimento/GUIA_DO_CONTRIBUIDOR.md)** (seções 4 a 10): acesso e auditoria,
campos ocultos em vez de `acao.bind`, formulários, lote/importação, migrações, testes e a receita de módulo novo. Regras
de contribuição em [CONTRIBUTING.md](../CONTRIBUTING.md). Funcionalidade nova exige tópico na Ajuda
(`src/lib/ajuda/topicos.ts` + `npm run manual`).

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
