# Como contribuir com o SGC-Redes

Obrigado pelo interesse! O SGC-Redes é um sistema livre (licença MIT) mantido pela Coordenação do Curso Técnico
Integrado em Redes de Computadores do IFCE Campus Boa Viagem. Estudantes, servidores e qualquer pessoa podem contribuir
com código, testes, documentação, relatos de problemas e sugestões.

Antes de começar, leia o **[Guia do contribuidor](docs/desenvolvimento/GUIA_DO_CONTRIBUIDOR.md)**: arquitetura, convenções
do código, testes e a receita para criar um módulo novo.

## Regras de convivência

- Trate todas as pessoas com respeito e paciência; críticas são ao código, nunca a quem o escreveu.
- Pergunte quando tiver dúvida: abra uma issue com o rótulo **dúvida**.
- Discussões, issues, commits, código e documentação são **em português**.

## Regras de ouro (não negociáveis)

1. **Nenhum dado real no repositório.** Nada de nomes, matrículas, e-mails, telefones, planilhas ou PDFs do campus em
   commits, issues, prints ou testes. Use dados fictícios (`@exemplo.edu.br`, "Estudante Exemplo") — veja
   `prisma/demo.ts`. Arquivos com dados reais ficam fora do git (ex.: `.handoff/`).
2. **LGPD por padrão.** Cada perfil vê só o que precisa (matriz em `src/lib/auth/rbac.ts`). Motivos de ausência são
   operacionais, nunca médicos ou pessoais. A auditoria registra ids e campos alterados, **nunca** nomes, e-mails ou senhas.
3. **Toda página, Server Action e rota protegida começa com `exigirUsuario()` ou `exigirPermissao()`.** Esconder um botão
   não é controle de acesso.
4. **Funciona sem JavaScript.** Formulários são Server Actions com `<form>`; ids vão em `<input type="hidden">`, nunca
   em `acao.bind(...)` (sem JS, o React re-renderiza sem fim).
5. **Regra de negócio tem teste.** Lógica pura em `src/lib/**` com `*.test.ts` ao lado.
6. **Funcionalidade nova tem ajuda.** Atualize `src/lib/ajuda/topicos.ts` (manual do usuário), rode `npm run manual` e,
   se a tela mudou, `npm run capturas`. O teste da Ajuda falha se um módulo do painel ficar sem tópico.
7. **Acessibilidade e identidade visual** conforme [docs/IDENTIDADE_VISUAL_UX.md](docs/IDENTIDADE_VISUAL_UX.md): rótulos
   em todos os campos, contraste, foco visível, tabelas com `<caption>` e `scope`, alvos de toque de 44px.

## Fluxo de trabalho

1. **Combine antes de codar.** Procure uma issue existente ou abra uma (modelos "Problema" ou "Melhoria"). Para mudanças
   grandes, descreva a proposta e espere um retorno da Coordenação.
2. **Faça um fork** e crie um branch a partir de `main` com nome descritivo: `calendario-importacao`, `correcao-login-bloqueio`.
3. **Prepare o ambiente:** `./scripts/dev.sh tudo` e, para ter dados para testar, `npm run db:demo -- --confirmo`.
4. **Commits pequenos e temáticos**, em português, no imperativo: "Corrige contagem de dias letivos no recesso".
   Correção de bug vai em commit separado de funcionalidade.
5. **Antes do pull request**, rode a verificação:
   ```bash
   ./scripts/dev.sh testar                       # typecheck + testes unitários
   NEXT_TELEMETRY_DISABLED=1 npm run build       # build de produção
   npm run manual                                # se mexeu na Ajuda
   ```
   Se mexeu em telas ou ações, teste no navegador **com e sem JavaScript** e descreva o que testou no PR.
6. **Abra o pull request** para `main` preenchendo o modelo: o que muda, por quê, como testar, capturas (com dados
   fictícios) e o checklist. O CI (typecheck, testes e build) precisa passar.
7. **Revisão:** pelo menos uma pessoa mantenedora revisa. Responda aos comentários com novos commits (não reescreva o
   histórico durante a revisão). A fusão é feita pela Coordenação.

## Mudanças no banco de dados

- Edite só o necessário em `prisma/schema.prisma` e gere a migração (passo a passo no guia). **Revise o SQL**: troca de
  tipo ou coluna obrigatória pode apagar dados ou falhar com linhas existentes.
- Nunca edite uma migração já publicada; crie outra.
- Atualize `prisma/seed.ts` e `prisma/demo.ts` se a mudança afetar dados iniciais ou de demonstração.

## Relatar problemas de segurança

**Não abra issue pública** para falhas de segurança ou vazamento de dados. Escreva para o e-mail institucional da
Coordenação do curso, descrevendo o problema e como reproduzi-lo. Responderemos o quanto antes.

## Licença

Ao contribuir, você concorda que sua contribuição seja distribuída sob a [licença MIT](LICENSE) do projeto.
