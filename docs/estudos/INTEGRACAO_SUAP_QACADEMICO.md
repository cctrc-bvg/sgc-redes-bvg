# Estudo: integração do SGC-Redes com o Q-Acadêmico e o SUAP Edu

Data: 26/11/2026. Estado: **estudo**, sem decisão. Nada aqui entra no piloto de 2027.1 (congelamento em 04/01/2027).

## 1. Resumo

- **É viável**, mas em etapas e sem depender de uma API que ainda não conhecemos. O caminho de menor risco é
  **leitura**: o SGC-Redes consome dados do sistema acadêmico e **nunca escreve** nele.
- O ganho real para o docente é **parar de informar aulas dadas**: ele já registra a aula no sistema oficial (é o diário
  legal). O SGC lê esse registro e troca a estimativa pela contagem real. Hoje o SGC estima pela grade (RF08-A).
- O segundo ganho é o **login pelo SUAP** (uma senha a menos), que só precisa de cadastro do aplicativo pela TI.
- O Q-Acadêmico **não tem API pública conhecida**; o SUAP tem. O Boa Viagem, pelo que a página institucional mostra,
  **ainda está no Q-Acadêmico** e não há data de migração divulgada. Por isso a integração precisa de uma camada que
  funcione hoje por planilha e amanhã por API, sem refazer o resto.
- O que **não consegui verificar** (ver seção 8): os endpoints reais do SUAP do IFCE (a documentação exige login) e a
  documentação da DGTI (a página estava fora do ar). As conclusões sobre API abaixo são **hipóteses a confirmar**.

## 2. O que se sabe (e de onde)

| Fato | Fonte | Confiança |
|---|---|---|
| Todos os campi do IFCE usam o Acadêmico, exceto Maranguape, que migrou todos os estudantes ao SUAP Edu. Treze campi (Acopiara, Baturité, Camocim, Canindé, Guaramiranga, Horizonte, Jaguaribe, Jaguaruana, Morada Nova, Mombaça, Pecém, Ubajara, Umirim) usam o SUAP Edu só para calouros. | [Portal IFCE, 19/08/2026](https://portal.ifce.edu.br/noticias/conheca-os-principais-sistemas-uteis-aos-estudantes/) | Alta, mas pode ter mudado |
| Boa Viagem não aparece na lista; logo segue no Acadêmico. Não há cronograma do IFCE. | mesma página (inferência) | Média |
| Outro IF (IFF) migra gradualmente até 2027, por campus e nível; o SUAP Edu cobre matrícula, frequência, avaliações e documentos. | [Portal IFF, 20/07/2026](https://portal1.iff.edu.br/nossos-campi/reitoria/noticias/suap-edu-iff-inicia-transicao-para-novo-modulo-de-gestao-academica-que-substituira-o-q-academico/) | Alta (referência, não é o IFCE) |
| O SUAP tem uma API REST com token e documentação Swagger em `/api/docs`. No IFCE a página exige login. Clientes de terceiros (IFRN) mostram endpoints de **dados do próprio usuário** (meus dados, diários, turmas virtuais) e avisam que os caminhos variam entre instituições. | [API do SUAP (IFRN)](https://ifrn.github.io/suapi/), [Suapy](https://github.com/kellyson71/suapy) | Média |
| O IFCE tem página de documentação da DGTI sobre importação de alunos no SUAP Edu. | [DGTI](https://docs-dgti.ifce.edu.br/doku.php?id=sistemas%3Asuap%3Aedu%3Aimportaralunos) | Não consegui abrir (503) |

## 3. O que o SGC-Redes precisa do sistema acadêmico (e o que não precisa)

| Dado | Fonte da verdade | Papel do SGC | Ganho |
|---|---|---|---|
| Identidade do servidor (nome, e-mail, SIAPE) | Acadêmico/SUAP | Ler no login (SSO) | Sem senha própria; vínculo por SIAPE |
| Aulas **dadas** por diário | Acadêmico/SUAP (o docente já lança) | **Ler** | Fim da estimativa e do ajuste manual no diário |
| Quem leciona o quê (turma, disciplina, professor) | Acadêmico (diário) e SGC (ofertas) | Conferir com o SGC | Detecta divergência entre distribuição e diário |
| Quantidade de estudantes ativos por turma | Acadêmico/SUAP | Ler **só a contagem** | Refeições e lista de turmas sem digitar |
| Etapas, calendário e dias letivos | SGC (Coordenação define) | Nada (ou conferir) | Já resolvido por importação |
| Grade de horários | SGC | Nada | O sistema oficial não é a fonte |
| Ausência, dispensa, substituição, reposição | SGC | Nada; só lembrar o docente de lançar a frequência lá (ROD, Art. 43) | Escrever no oficial seria arriscado e sem ganho claro |
| PPI, PEI, mediações | SGC | Nada | Dados sensíveis ficam fora |

**Regra de ouro:** cada dado tem **um** lugar onde é digitado. O que o docente já faz no sistema oficial o SGC lê; o que é
da coordenação e só existe no SGC fica nele. Nenhum dado é digitado duas vezes.

**Fora do escopo, de propósito:** nomes, CPF, notas e frequência individual de estudantes (menores de idade). O SGC só
precisa de **contagens** (já é o desenho atual da alimentação e do PPI para a CCA).

## 4. Opções de integração

| # | Opção | Depende de | Viabilidade | Esforço* | Observação |
|---|---|---|---|---|---|
| 0 | **Planilha** exportada do Acadêmico/SUAP e importada no SGC (já existe a importação com prévia) | Só de um arquivo de exemplo real | Alta, **funciona já** | 2 dias, depois do exemplo | Um passo manual por etapa ou semana, feito pela Coordenação, não pelo docente |
| 1 | **Login pelo SUAP** (OAuth2) | TI cadastrar o aplicativo no SUAP | Alta se o SUAP do IFCE oferecer o cadastro | 2–3 dias | Só identidade; ver `SSO_GOOGLE.md` (mesma estrutura) |
| 2 | **API de leitura com conta de serviço** (SGC lê diários/turmas de todos) | DGTI liberar credencial e escopo | **Incerta**: não sei se existe endpoint institucional | 1–2 semanas após ler a documentação | Menor atrito para o usuário; maior risco de segurança |
| 3 | **Token do próprio docente** (cada um autoriza o SGC a ler os diários dele) | SUAP permitir o fluxo | Incerta | 1–2 semanas | Menor privilégio; exige um clique de consentimento por docente |
| 4 | **Arquivo agendado**: a TI exporta CSV periodicamente e o SGC importa | TI agendar | Média | 2 dias + agendamento da TI | Serve também ao Acadêmico; sem API |

\* Esforço de desenvolvimento, sem contar a espera pela TI.

**Q-Acadêmico:** não conheço API pública. Para ele só valem as opções 0 e 4. Como a migração do campus não tem data, é
provável que o Acadêmico continue em uso durante todo 2027.

## 5. Recomendação

1. **Piloto 2027.1: não integrar.** Já está decidido e o congelamento é em 04/01. Manter a estimativa automática do
   diário e o ajuste manual.
2. **Preparar já (barato):** pedir à TI/Registro Acadêmico **uma exportação real** de diário (aulas dadas por
   disciplina e turma) do Acadêmico e outra do SUAP Edu, com dados anonimizados. É o que destrava a opção 0.
3. **Fase 1 (1º semestre de 2027):** opção 0 para as aulas dadas (importação por planilha, na conferência dos diários) e
   opção 1 (login pelo SUAP), em paralelo ao Google, se a TI cadastrar o aplicativo.
4. **Fase 2 (depois):** opção 3 ou 2, só se a documentação confirmar o endpoint e a DGTI autorizar. Do contrário, opção 4.
5. **Desenho que evita refazer:** criar uma interface única `FonteAcademica` (aulas dadas por oferta, contagem de
   estudantes por turma, identidade) com implementações trocáveis: planilha do Acadêmico, planilha do SUAP, API do SUAP.
   Quando o campus migrar, troca-se a implementação; telas e regras não mudam. Cada `DisciplinaOferta` ganha um
   identificador externo (código do diário) para o casamento, preenchido na primeira importação.

## 6. Como o fluxo fica integrado sem trabalho extra

- **Docente:** continua lançando a aula no sistema oficial (obrigação que já tem). No SGC só informa ausência e
  reposição. O diário do SGC passa a mostrar o valor lido; a estimativa fica como reserva quando não há dado.
- **Coordenação:** um passo por etapa (importar a exportação) ou, na fase 2, nenhum. A tela de conferência mostra
  divergências (diário sem aula lançada, aula lançada além da grade) em vez de números a digitar.
- **Casamento sem digitação:** por código do diário; na falta dele, por turma + disciplina + SIAPE do professor, com
  prévia para a Coordenação aprovar o que for ambíguo (como já faz a importação de ofertas).
- **Falha segura:** se o sistema acadêmico cair ou o arquivo não vier, o SGC segue com a estimativa. Nenhuma tela depende
  da integração para funcionar.
- **Sem escrita no oficial.** A frequência de aula substituída e a reposição continuam sendo lançadas pelo docente lá;
  o SGC só lembra e confere depois, quando a leitura estiver disponível.

## 7. Segurança e LGPD

| Risco | Controle |
|---|---|
| Guardar senha de servidor do SUAP | **Nunca.** OAuth2 com PKCE para login; sem "senha do SUAP" no SGC |
| Segredos de integração vazarem | Variáveis de ambiente/segredos do Docker, fora do repositório; rotação combinada com a TI; permissões mínimas |
| Conta de serviço com acesso amplo (opção 2) | Escopo só de leitura dos diários; lista de IPs permitidos; credencial própria, revogável; registrar cada sincronização |
| Tomada de conta no login (vincular por e-mail) | Vincular por **SIAPE verificado** vindo do SUAP, não por e-mail digitado; `state` e URI de retorno fixos; manter a senha local de emergência para a Coordenação |
| Permissões herdadas do SUAP | **Não** derivar perfil do grupo do SUAP; o perfil continua no SGC (RBAC atual) |
| Excesso de dados (menores de idade) | Importar só contagens e aulas dadas; **sem** nome, CPF, nota ou frequência individual; descartar colunas não mapeadas já na leitura |
| Servidor desligado no SUAP continuar com acesso | Sincronizar situação (ativo/inativo) e desativar o usuário no SGC; revisão periódica |
| Mudança de formato sem aviso (endpoints não documentados) | Validar o esquema na leitura; falhar com mensagem clara; manter a planilha como alternativa; testes com arquivos de exemplo |
| Base legal e responsabilidade | Execução de política pública (LGPD, art. 7º, III); IFCE é o controlador; atualizar o inventário de dados/RIPD; ciência e termo da DGTI antes de qualquer credencial |
| Rastreabilidade | `AuditLog` de cada importação/sincronização: quem, quando, quantos registros, o que mudou |
| Transporte | TLS em todas as chamadas; tempo limite e repetição com limite; sem seguir redirecionamentos para outros domínios |

Observação: a opção 3 (token do docente) é a mais fácil de defender na LGPD, pois cada um autoriza o que o sistema lê
sobre si. O custo é o consentimento individual e a guarda de tokens (criptografados em repouso).

## 8. Limites deste estudo e o que fazer para fechar

Não consegui ler a documentação da API do SUAP do IFCE (exige login) nem a página da DGTI (erro 503). Faltam:

1. Entrar em `suap.ifce.edu.br/api/docs` com a conta institucional e conferir: há endpoints de diário/aulas? São só do
   próprio usuário ou há credencial institucional? Como funciona o login por OAuth e o cadastro de aplicativo?
2. No SUAP Edu e no Acadêmico, ver que **relatórios exportáveis** o docente e o Registro Acadêmico têm (diário,
   aulas, frequência por turma) e em que formato.
3. Confirmar com a Proen ou o Registro Acadêmico do campus **se e quando** o Boa Viagem migra.

## 9. Perguntas para a TI/DGTI e o Registro Acadêmico (para o pedido de 2027)

1. O Boa Viagem migra para o SUAP Edu? Quando e para quais cursos/turmas?
2. O SUAP do IFCE permite cadastrar um aplicativo OAuth2 (login)? Quem autoriza e qual o prazo?
3. Existe API de leitura de diários, aulas ministradas e turmas? Com token do usuário ou institucional? Há limite de uso?
4. É permitida uma conta de serviço somente leitura, com lista de IPs? Qual o procedimento e o termo?
5. Há exportação agendada (CSV) de diários e matrículas que a TI possa publicar?
6. O Acadêmico tem alguma exportação ou serviço que não seja a tela? Pode enviar um arquivo de exemplo anonimizado?
7. Qual setor responde pela LGPD dessa troca de dados e que documento (termo, RIPD) a DGTI exige?

## 10. Decisões que dependem de você

1. Concorda com a diretriz **somente leitura** e **sem dados individuais de estudantes**?
2. Prefere priorizar a Fase 1 pelo **login** (menos senhas) ou pelas **aulas dadas** (menos digitação)? Sugiro as aulas
   dadas, porque é onde o docente hoje tem trabalho duplo.
3. Autoriza incluir as perguntas da seção 9 no pedido à TI de 2027?
