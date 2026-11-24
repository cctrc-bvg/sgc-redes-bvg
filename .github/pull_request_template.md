## O que muda

<!-- Resumo em 1–3 frases. Ligue a issue: "Resolve #123". -->

## Por quê

<!-- Problema ou necessidade da Coordenação/usuários; artigo do regimento/ROD, se houver. -->

## Como testar

<!-- Passos com os dados de demonstração (npm run db:demo -- --confirmo) e o perfil usado. -->
1.
2.

## Telas

<!-- Capturas antes/depois, SÓ com dados fictícios. -->

## Checklist

- [ ] `./scripts/dev.sh testar` (typecheck + testes) e `npm run build` passam
- [ ] Páginas/actions novas começam com `exigirUsuario()`/`exigirPermissao()`
- [ ] Funciona sem JavaScript (ids em campos ocultos, nada de `acao.bind`)
- [ ] Gravações têm auditoria, sem nomes, e-mails ou senhas nos detalhes
- [ ] Regras de negócio novas têm teste
- [ ] Ajuda atualizada (`src/lib/ajuda/topicos.ts` + `npm run manual`; `npm run capturas` se a tela mudou)
- [ ] Migração revisada (se mexeu no schema) e `prisma/demo.ts` atualizado
- [ ] Nenhum dado real (nomes, matrículas, e-mails, telefones, planilhas do campus)
