# Arquitetura Técnica, Segurança e Conformidade LGPD
## SGC-Redes — IFCE Campus Boa Viagem

## 1. Diretrizes de Adoção Institucional
- **Software Livre:** Código aberto sob licença MIT, sem custos recorrentes de licença ou dependência de fornecedores comerciais (*vendor lock-in*).
- **Manutenibilidade:** Monolito modular em TypeScript (Next.js App Router + Prisma ORM + PostgreSQL), permitindo evolução contínua pela equipe de TI do campus ou por estudantes em Projetos Integradores / Extensão / TCC do curso de Redes.
- **Portabilidade:** Empacotado em **Docker + Docker Compose**, executável em qualquer VM Debian/Ubuntu do campus.

## 2. Topologia de Containers
- `sgc_redes_app`: Aplicação web Next.js (interface responsiva + APIs REST/Server Actions).
- `sgc_redes_db`: PostgreSQL 16 em rede Docker interna isolada (`sgc_internal`), sem exposição direta de porta para a internet.
- *(Opcional futuro)* `evolution_api`: Conector WhatsApp auto-hospedado na mesma rede interna.

## 3. Proteção de Dados e LGPD (Foco em Menores de Idade)
Por atender um curso **Técnico Integrado ao Ensino Médio** (estudantes majoritariamente menores de 18 anos), o sistema adota os seguintes controles desde o projeto inicial:

1. **Soberania de Dados:** Toda a base de dados e eventuais documentos permanecem exclusivamente em infraestrutura sob controle do IFCE.
2. **Minimização de Dados (Art. 6º, III da LGPD):**
   - O perfil `ASSISTENCIA_ESTUDANTIL` acessa apenas nome da turma, turno, data e contagem numérica de refeições.
   - Mensagens enviadas ao WhatsApp **não** contêm CPF, nomes de menores em situações sensíveis ou informações médicas de servidores.
3. **Sigilo de Mediações (Art. 22, VIII do Regimento):** Processos de orientação/conflito marcados como `sigiloso = true` são filtrados na camada de API para exibição exclusiva ao `COORDENADOR`.
4. **Rastreabilidade (`AuditLog`):** Alterações de grade/refeição (sobretudo em emergências `< 24h`), aprovações de PPI e edições de PEI registram identificador do usuário, ação executada, timestamp e contexto.
5. **Autenticação e Transporte:**
   - Senhas armazenadas com hash `bcrypt` (custo >= 12) e sessões via cookies `HttpOnly` + `SameSite`.
   - Em produção no campus, publicação obrigatória atrás de proxy reverso (Nginx/Traefik) com **HTTPS (TLS)**.
   - Arquitetura preparada para adoção futura de **SSO via SUAP (OAuth2/OIDC)**.
6. **Backup:** Rotina recomendada de `pg_dump` diário criptografado em volume externo à VM da aplicação.
