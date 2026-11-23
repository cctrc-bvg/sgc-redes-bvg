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

Requisitos: Node.js 20.9+ (recomendado 22) e um PostgreSQL 16 acessível.

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

## Mantenedores

- Coordenação do Curso Técnico Integrado em Redes de Computadores — IFCE Campus Boa Viagem (`cctrc-bvg`).
