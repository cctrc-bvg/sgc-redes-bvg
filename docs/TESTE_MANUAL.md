# Roteiro de teste manual (Docker local)

> Criado em **25/11/2026**, para o teste das novidades do PR #4: diários automáticos, resumo semanal, reposição de aulas
> e períodos especiais. Usa **dados fictícios** (`@exemplo.edu.br`). Nunca use este roteiro nem os dados de demonstração
> em produção.

## 1. Gerar o ambiente

Na pasta do projeto, no `main` atualizado:

```bash
# Derruba a stack antiga e APAGA o banco dela
docker compose down -v

# Sobe a stack de teste (expõe o banco em 127.0.0.1:5433 e o app em todas as interfaces)
docker compose -f docker-compose.yml -f docker-compose.teste.yml up --build -d
```

- O build usa de 2 a 3 GB de memória e leva alguns minutos: feche o resto antes de rodar.
- No `.env`, confira `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `SEED_COORDENADOR_SENHA`. Para testar de outro
  aparelho da rede, acrescente `APP_URL=http://IP-DESTA-MAQUINA:3000`. Use **http**: com https o cookie de sessão só
  funciona pelo endereço https.

Conferir:

```bash
docker compose logs migrate    # aplica as migrações, inclusive as de diários, reposição e períodos especiais
docker compose ps              # db (healthy), migrate (exited 0), app (up)
```

Carregar os dados de demonstração (a partir do host):

```bash
set -a; . ./.env; set +a
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5433/$POSTGRES_DB?schema=public" \
  npm run db:demo -- --confirmo
```

Acesso: `http://localhost:3000`. Senha de todos: `Demonstracao2026`.

| Perfil | E-mail |
| :-- | :-- |
| Coordenação (também leciona) | `coordenacao@exemplo.edu.br` |
| Professor | `ana.lima@exemplo.edu.br` |
| CTP, Direção, CAE | `ctp@`, `direcao@`, `cae@exemplo.edu.br` |

## 2. Roteiro (cerca de 45 minutos)

### A. Diários automáticos (Coordenação), em `/diarios`
1. As linhas mostram a etiqueta "automático" e o número de aulas já dadas.
2. Abra uma disciplina e mude o valor: ela vira "manual". Clique em "Voltar ao automático".
3. Abra "Conferir com o sistema acadêmico", digite um valor diferente do presumido e confira: ele vira manual.
4. Observe: o presumido faz sentido para a grade e para os feriados do calendário? A tela inicial mostra "Carga projetada
   abaixo da prevista"?

### B. Resumo semanal, em `/comunicacao/periodicas`
1. Leia o texto de dois ou três docentes: aulas, mudanças e prazos.
2. Escolha "Enviado por", clique em "Já enviei: registrar" e confirme que a mensagem de confirmação aparece.
3. Recarregue: o docente fica com "✔ Envio registrado". Navegue entre as semanas.

### C. Reposição de aulas
1. Como Coordenação, registre uma ausência da `ana.lima` numa data recente e passada. Em "Decidir a cobertura", dispense
   a turma. Em `/diarios`, o docente perde aulas no presumido.
2. Entre como `ana.lima`: a tela inicial mostra "Reposições de aulas para informar". Abra `/reposicoes`.
3. Informe a data, com e sem anexo. Teste um PDF, um JPG e um PNG pequenos.
4. Anexos que devem ser recusados: um `.txt` renomeado para `.pdf` e um arquivo maior que 5 MB.
5. Como Coordenação: a tela inicial mostra "Reposições informadas para dar ciência". Baixe o anexo e clique em "Dar ciência".
6. Teste "Desfazer registro". O diário recupera as aulas quando a reposição está registrada?
7. A orientação do formulário e o e-mail da Coordenação (`cctrc.boaviagem@ifce.edu.br`) estão corretos?

### D. Períodos especiais, em Calendário › Períodos especiais
1. Crie um "Jogos internos" na próxima semana. Edite o nome e o tipo (por exemplo, "Universo IFCE").
2. Em REDES-1, copie a grade normal e troque disciplinas de lugar. Coloque um professor em duas turmas no mesmo horário:
   o sistema deve avisar.
3. Em "Estudantes no campus", informe 12 de 30 em alguns dias. Tente 999: deve ser recusado.
4. Confira o resumo de refeições: só manhã gera lanche da manhã, só tarde gera lanche da tarde, integral gera os três.
5. Em Comunicação, cadastre o e-mail da Assistência Estudantil (sem ele o sistema avisa que o contato não está ativo).
   Copie a mensagem e registre o envio.
6. Registre uma ausência num dia do período: as aulas do dia devem vir da grade especial da turma.
7. O resumo semanal da semana do período também usa a grade especial.

### E. Perfis
- Professor: vê só os seus diários e as suas reposições.
- CAE: vê as refeições.
- Direção e CTP: nenhum menu sem sentido.
- Repita as telas novas no celular.

## 3. Como registrar o resultado

Por item, anote o que ficou **confuso**, **errado**, **lento** (com o nome da tela) e o que **faltou**. Uma lista solta, com
o nome da tela, basta.

**Limites conhecidos (não precisa reportar):**
- Nos dias de um período especial, Minha grade, a agenda da tela inicial e as aulas presumidas dos diários ainda usam a
  grade normal.
- Um período tem no máximo 15 dias.
- A aula de hoje só conta como dada a partir de amanhã.

## 4. Logs e limpeza

```bash
docker compose logs -f app                      # erros do sistema
docker compose logs db | grep duration          # consultas lentas (> 500 ms)
docker compose down -v                          # apaga tudo quando terminar
```
