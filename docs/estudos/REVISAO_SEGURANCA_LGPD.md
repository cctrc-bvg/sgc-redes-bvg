# Revisão de segurança e LGPD — 27/11/2026

Escopo: autorização das ações e rotas, autenticação e sessão, cabeçalhos, uploads, exportações, dependências, trilha de
auditoria e retenção de dados. Método: leitura do código e `npm audit --omit=dev`. Não foi um teste de invasão.

## O que está bem
- **Autorização:** todas as Server Actions e rotas (`route.ts`) conferem permissão ou propriedade do registro
  (`exigirPermissao`, `exigirUsuario` + acesso por registro em PPE e reposições). O download do anexo de reposição só
  libera para a Coordenação e o docente da ausência, sempre como download, com `nosniff` e `no-store`.
- **Login e sessão:** bcrypt, resposta de mesmo tempo para e-mail inexistente, limite por e-mail (5 em 15 min) e por IP
  (20), token de 256 bits guardado só como hash no banco, cookie `HttpOnly` + `SameSite=Lax` + `Secure` em https,
  sessões apagadas ao desativar o usuário ou trocar a senha, redirecionamento pós-login validado (`destinoSeguro`).
- **Cabeçalhos:** CSP restritiva (sem terceiros, `frame-ancestors 'none'`, `object-src 'none'`), `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`; o HSTS fica no proxy.
- **Upload:** tipo conferido pelos primeiros bytes (PDF, JPG, PNG), limite de 5 MB e de 3 anexos por ausência.
- **Planilhas:** células gravadas como texto (o Excel não executa como fórmula); importação limitada a 1 MB.
- **Auditoria:** sem senhas nem dados sensíveis nos detalhes; o sistema guarda só quantidades de estudantes.

## Achados e o que foi feito
1. **IP de origem falsificável (corrigido neste PR).** O app usava o *primeiro* valor de `X-Forwarded-For`. Com o Nginx
   configurado como na documentação (`$proxy_add_x_forwarded_for`), o cliente escreve o começo da lista: burlava o
   limite por IP do login e gravava IP falso na auditoria. Agora vale o último valor (o que o proxy acrescentou),
   ajustável por `PROXY_SALTOS` (padrão 1); `docs/IMPLANTACAO.md` passou a recomendar `$remote_addr`. Teste em `src/lib/ip.test.ts`.
2. **Dependências com aviso (aceito, sem ação):** `effect` e `deepmerge-ts` (via Prisma CLI, usados só na
   configuração em tempo de build, sem entrada de usuário) e `uuid` (via `exceljs`, que usa v4; a falha é em v3/v5/v6
   com buffer). Reavaliar quando o Prisma e o `exceljs` publicarem versões novas.
3. **Retenção de dados (decisão pendente, abaixo).** Nada é apagado hoje, exceto sessões vencidas.
4. **CSP com `'unsafe-inline'` em scripts:** exigência dos scripts do Next sem nonce. Melhoria possível: nonce por
   requisição (as páginas já são dinâmicas). Prioridade baixa (sem terceiros e sem HTML vindo de usuário).
5. **Limite de login em memória:** vale para uma instância (a implantação prevista). Quem digita o e-mail de outra
   pessoa 5 vezes bloqueia essa conta por 15 min (aceitável; a Coordenação redefine a senha se preciso).

## Decisão pendente: retenção (LGPD, art. 6º, III e art. 15–16)
Proposta para validar com a Direção e o encarregado de dados do campus:

| Dado | Proposta | Observação |
|---|---|---|
| Anexos de reposição (podem ter assinaturas de estudantes) | apagar 1 ano após o fim do semestre | maior risco: são os únicos arquivos com dado de menores |
| `AuditLog` com IP | manter 2 anos; depois anonimizar o IP (manter a ação) | IP é dado pessoal |
| Ausências, reposições, diários | manter durante o curso + prazo de guarda acadêmica do IFCE | seguir a tabela de temporalidade do IFCE |
| Usuários desativados | anonimizar nome e e-mail 2 anos após a saída | manter vínculos para histórico |
| Revisões do calendário | manter | sem dado pessoal além do autor |

Implementar depois da decisão: um comando agendado (`scripts/`) que aplica os prazos e registra o que apagou.

## Itens para o pedido à TI
- Proxy: Caddy ou Nginx **sobrescrevendo** `X-Forwarded-For`, HTTPS e `client_max_body_size 7m`.
- Backup criptografado fora da VM e teste de restauração; senha do banco trocada no `.env`.
