# SGC-Redes — Sistema de Gestão da Coordenação de Curso

**Curso Técnico Integrado ao Ensino Médio em Redes de Computadores**  
**IFCE — Campus Boa Viagem**

Sistema web gratuito, de código aberto e auto-hospedado para apoiar a rotina operacional da Coordenadoria de Curso (Art. 21 e 22 do Regimento Interno), integrando gestão de grade/substituições, planejamento alimentar junto à Assistência Estudantil, comunicação via WhatsApp, controle de PPE/PEI, auditoria de PPI (40h) e acompanhamento de processos.

---

## Escopo Implementado na Especificação (Fases 1 e 2)

- **Fase 1 — Operação Diária, Alimentação e Comunicação:**
  - Gestão das 3 turmas (alternância entre Só Manhã, Só Tarde e Integral, com suporte a janelas livres).
  - Registro de ausências docentes com sugestão de substituição/adiantamento em janelas livres.
  - Motor de impacto alimentar (`09:30`, `12:00`, `15:00`) com regra de **Almoço exclusivo para regime integral** e SLA flexível (**24h ideal** / **Imprevisto** / **Emergência**).
  - Hub de mensagens padronizadas (LGPD-safe) para WhatsApp: Professores, Gestão (Coordenação + Direção de Ensino + Direção Geral), Assistência Estudantil, CTP e Líderes de Turma.
- **Fase 2 — Gestão Acadêmica, PPE/PEI, PPI e Processos:**
  - **PPE (Progressão Parcial de Estudos):** Fluxo completo conforme ROD Arts. 115–128 (limite de 2 componentes, escolha entre PEI $\le 30\%$ ou Dependência, geração do modelo oficial de PEI do Campus Boa Viagem).
  - **PPI (Prática Profissional Integrada):** Calculadora e auditoria das **40 horas** conforme Manual 2022 (6 grupos, 32 categorias, travas de teto e certificado único).
  - **Diários & Kanban:** Semáforo de carga horária/diários e quadro de processos SEI (aproveitamentos, transferidos, estágios e ocorrências sigilosas).
- **Fase 3 (Backlog Futuro):**
  - Inventário físico de laboratórios de Redes, estoque de consumíveis (interface com DAP — Arts. 23–24) e gestão avançada de atas/eventos.

---

## Stack Tecnológica (100% Open Source)

- **Aplicação:** Next.js (TypeScript) + Tailwind CSS
- **ORM e Banco:** Prisma ORM + PostgreSQL 16
- **Infraestrutura:** Docker & Docker Compose (execução local no campus)
- **Licença:** MIT

---

## Documentação

- [Especificação Funcional (FSD) e Checklist `/grill-me`](docs/FSD.md)
- [Arquitetura, Segurança e Conformidade LGPD](docs/ARQUITETURA_LGPD.md)
- [Identidade Visual, Usabilidade (Nielsen) e Acessibilidade (WCAG/eMAG)](docs/IDENTIDADE_VISUAL_UX.md)

---

## Início Rápido (Ambiente Docker)

```bash
cp .env.example .env
# Edite o arquivo .env definindo senhas fortes e AUTH_SECRET
docker compose up -d
```

Na primeira subida, o serviço `migrate` aplica as migrações do Prisma e o seed inicial e depois
encerra; em seguida o `app` sobe em `http://localhost:3000`.

---

## Desenvolvimento Local

O jeito mais rápido é usar o script de apoio, que roda os passos com baixa prioridade de CPU/disco:

```bash
./scripts/dev.sh tudo     # instala, cria .env com senhas aleatórias, testa e prepara o banco
./scripts/dev.sh dev      # http://localhost:3000  (use --rede para acessar de outro computador)
./scripts/dev.sh studio   # http://localhost:5555 — dados do seed (turmas, canais, regras PPI)
./scripts/dev.sh ajuda    # todos os comandos (setup, testar, banco, docker...)
```

Para fazer manualmente — requisitos: Node.js 20.9+ (recomendado 22) e um PostgreSQL 16 acessível.

```bash
cp .env.example .env      # ajuste DATABASE_URL para o seu PostgreSQL
npm install               # também gera o Prisma Client
npm run db:deploy         # aplica as migrações
npm run db:seed           # cria turmas, canais, regras de PPI e o usuário coordenador
npm run dev               # http://localhost:3000
```

| Script | Descrição |
| :--- | :--- |
| `npm run typecheck` | Verificação de tipos (TypeScript) |
| `npm test` | Testes unitários (Vitest) |
| `npm run build` | Build de produção (Next.js standalone) |
| `npm run db:migrate` | Cria uma nova migração após alterar `prisma/schema.prisma` |
| `npm run db:studio` | Interface do Prisma para inspecionar o banco |

---

## Primeiro Acesso e Autenticação

1. O seed cria o usuário da Coordenação (`SEED_COORDENADOR_EMAIL`, padrão `cctrc.boaviagem@ifce.edu.br`).
   A senha vem de `SEED_COORDENADOR_SENHA` ou, se vazia, é **gerada e exibida uma única vez** na saída do
   seed (no Docker: `docker compose logs migrate`).
2. Entre em `/login`; o sistema exige a **troca da senha provisória** antes de liberar o painel.
3. Cada perfil vê apenas os módulos permitidos pela matriz do FSD (seção 2), definida em `src/lib/auth/rbac.ts`.
4. Em **Usuários** (`/usuarios`), a Coordenação cadastra professores, CTP, Direção e Assistência Estudantil.
   O sistema gera uma senha provisória exibida uma única vez, para entrega em mensagem privada; a pessoa
   define a própria senha no primeiro acesso. Desativar um usuário encerra as sessões dele na hora.

Detalhes de segurança: sessões no banco (o cookie `HttpOnly`/`SameSite=Lax` guarda um token aleatório; o
banco guarda só o hash SHA-256), expiração após 8h sem uso, cookie encerrado ao fechar o navegador,
senhas com bcrypt (custo 12), limite de 5 tentativas de login por e-mail a cada 15 min e registro em
`AuditLog` de login, falhas, logout e troca de senha. Em produção, defina `APP_URL` com `https://` para o
cookie ser marcado como `Secure`.

Toda página ou Server Action protegida deve começar com `exigirUsuario()` ou `exigirPermissao(...)`
(`src/lib/auth/dal.ts`); o `src/proxy.ts` faz apenas uma checagem otimista do cookie.

---

## Mantenedores

- Coordenação do Curso Técnico Integrado em Redes de Computadores — IFCE Campus Boa Viagem (`cctrc-bvg`).
