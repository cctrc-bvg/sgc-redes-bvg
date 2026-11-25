# Roadmap até o semestre 2027.1

> Auditoria de **25/11/2026** (quarta-feira). Meta: **testar em produção no semestre 2027.1, que começa na segunda semana de
> janeiro (segunda-feira, 11/01/2027)**. Faltam cerca de **6 semanas e meia**, com recesso de fim de ano no meio.
> Prazos abaixo são **propostas para discussão**, não compromissos. Detalhes técnicos: `PROXIMOS_PASSOS.md`.

## 1. Auditoria

### 1.1 Desenvolvido (pronto e testado em máquina de desenvolvimento)

| Área | Situação |
| :-- | :-- |
| Base | Login e sessões, 5 perfis + docência acumulada, auditoria, tela inicial com prioridades por perfil |
| Cadastros | Usuários, turmas, disciplinas (matriz do PPC), ofertas, importação e exportação por planilha |
| Operação | Calendário acadêmico (dias letivos, sábados letivos, avaliações finais), grade e janelas livres, ausências (inclusive informadas pelo docente), convites e substituição, alimentação com SLA |
| Comunicação | Semiautomática por e-mail/WhatsApp, textos-padrão, histórico, **resumo semanal dos docentes** (novo) |
| Períodos especiais e reposição | **Grade temporária e resumo de refeições** para jogos internos e encontros (G30, novo); **reposição de aulas confirmada** pelo docente, com formulário opcional (G29, novo) |
| Gestão | PPE/PEI, PPI, **diários automáticos com conferência** (novo), processos SEI, relatórios, PDFs |
| Prazos do ROD | Reposição (Art. 37), frequência do substituto (Art. 43), avaliação final sem dia letivo (Art. 32) |
| Produção | `/api/saude`, backup, `atualizar.sh` com ensaio de migração e volta automática, política de migrações no CI, guia `IMPLANTACAO.md` |
| Qualidade | 454 testes unitários, typecheck, E2E com cerca de 40 testes, acessibilidade, CI no GitHub, Ajuda no sistema (14 tópicos), manual e `FLUXOS.md` |
| Tamanho | Cerca de 24 mil linhas de código (sem testes), 18 migrações |

### 1.2 Em desenvolvimento

| Item | Estado |
| :-- | :-- |
| PR #4 (`rod-prazos`) | Aberto, com prazos do ROD, diários automáticos e resumo semanal (últimos commits enviados em 25/11). CI a conferir |
| E2E das telas novas | Escrito (`diarios`, `periodicas`, listas de páginas e acessibilidade), **ainda não executado** |
| Avisos de fim de etapa e de fechamento do período | Só o prazo da etapa entra no resumo semanal; faltam mensagens próprias |
| Capturas de tela do manual | Faltam as das telas novas |

### 1.3 Por fazer

| Item | Depende de | Prioridade para 2027.1 |
| :-- | :-- | :-- |
| VM, endereço https, certificado | TI | **Crítica** |
| Primeiro uso real de `atualizar.sh` e `ensaiar-migracao.sh` (nunca rodaram com Docker) | VM pronta | **Crítica** |
| Teste de restauração do backup; cron de 3 backups ao dia; destino do backup fora da VM | VM e TI | **Crítica** |
| Monitoramento de `/api/saude` | TI | Alta |
| Carga dos dados reais de 2027.1 (usuários, turmas, matriz, ofertas, grade, calendário) | Coordenação e Direção | **Crítica** |
| Cadastros de Comunicação (e-mails de setores e da CGP) e "Também leciona" | Coordenação | Alta |
| Teste das planilhas de exemplo com dados reais | Coordenação | Alta |
| Treinamento da Coordenação e roteiro de uso | Coordenação | Alta |
| Revisão de segurança e de LGPD antes de abrir a usuários reais | Desenvolvimento | Alta |
| Medir o desempenho da tela inicial com dados reais (ver riscos) | Desenvolvimento | Média |
| Redefinição de senha por e-mail | SMTP institucional | Baixa (a Coordenação gera senha provisória) |
| Login Google (G20–G22) | Decisão e TI | Baixa para o piloto; depois |
| Importar diários do acadêmico por planilha | Arquivo de exemplo | Baixa (a progressão automática reduziu a necessidade) |
| Conferência do Art. 105 (avaliação final) | Registro das médias | Baixa |
| Integração com o SUAP; envio automático pela Evolution API | Decisão | Fora do piloto |
| Fase 3 do FSD (laboratórios, estoque/DAP, atas, eventos) | Nova decisão | Congelada |

## 2. Riscos

| # | Risco | Impacto | Resposta |
| :-- | :-- | :-- | :-- |
| R1 | **A TI demora a entregar VM, endereço e certificado** (recesso, fila de chamados) | Sem produção em janeiro | Abrir o pedido **nesta semana**; plano B: subir numa VM de teste da própria TI ou em servidor do campus sem HA, só com backup |
| R2 | **Scripts de produção nunca rodaram com Docker** | Falha na primeira implantação ou atualização | Ensaiar na VM assim que existir, com a TI ao lado; ter o passo a passo manual de `IMPLANTACAO.md` como alternativa |
| R3 | **Dados de 2027.1 chegam tarde** (grade e calendário costumam fechar em dezembro) | Sistema vazio na primeira semana | Pedir já o calendário 2027 e a distribuição de disciplinas; começar com calendário e ofertas, e completar a grade durante a primeira semana |
| R4 | **Nunca testado com dados reais** (só demonstração) | Surpresas em planilhas, nomes e regras | Fazer o ensaio com a Coordenação em dezembro, em banco separado, e corrigir antes do congelamento |
| R5 | **Desempenho da tela inicial da Coordenação:** o aviso "carga projetada" chama `situacoesAutomaticas` e `carregarAno` a cada abertura | Pode passar de 1 s (meta RNF01) | Medir com dados reais; se passar, guardar o resultado por 1 minuto (já previsto no backlog) |
| R6 | Um único desenvolvedor, em máquina de 4 GB (E2E completo leva 15 a 20 min) | Ritmo lento de verificação | Rodar E2E só no CI para o que não for crítico; congelar funcionalidades em 04/01 |
| R7 | Pouca adesão dos docentes | Dados defasados | Já tratado pelo RF08-A e RNF06: a Coordenação opera, o docente recebe mensagens |
| R8 | LGPD: nomes, e-mails e telefones de docentes e estudantes em produção | Exposição indevida | Revisão de `ARQUITETURA_LGPD.md`, acesso restrito ao backup, nenhum dado real fora da VM |
| R9 | Merge do PR #4 e revisão pelo repositório original atrasam | Código de produção diferente do desejado | Pedir a revisão agora; produzir a primeira implantação a partir de uma tag |

## 3. Marcos e prazos propostos

Hoje é 25/11 (semana 0). Datas são de segunda a sexta de cada semana.

| Marco | Janela | O que entrega | Critério de pronto |
| :-- | :-- | :-- | :-- |
| **M0. Fechar o PR #4** | 25/11 a 04/12 | CI verde nos dois jobs; E2E das telas novas executado; correções; merge | `verificar` e `e2e` verdes; PR mesclado |
| **M1. Pedidos à TI enviados** | **até 27/11** | VM (4 vCPU, 8 GB, 80 GB SSD), endereço https e certificado, destino do backup, monitoramento, e-mail do remetente | Chamado aberto com prazo de resposta combinado |
| **M2. Dados reais de 2027.1 solicitados** | até 04/12 | Calendário acadêmico 2027, matriz do PPC, distribuição de disciplinas, lista de docentes, horários | Arquivos recebidos (nomes fora do git) |
| **M3. Primeira implantação acompanhada** | 07/12 a 18/12 | Stack no ar na VM; `atualizar.sh` e `ensaiar-migracao.sh` rodados; backup e **restauração testados**; cron de backups; monitoramento ligado | `/api/saude` monitorado; restauração medida (RTO ≤ 1 h) |
| **M4. Ensaio com dados reais** | 14/12 a 22/12 | Carga por planilha, calendário e ofertas; Coordenação usa por um dia; lista de ajustes | Ensaio concluído, lista de problemas priorizada |
| **M5. Congelamento e correções** | 04/01 | Só correção de erros, sem funcionalidade nova; revisão de segurança e LGPD concluída; tag de versão | Tag criada; produção atualizada a partir dela |
| **M6. Treinamento e roteiro** | 04/01 a 08/01 | Sessão com a Coordenação (e Direção, CTP, CAE se possível); roteiro da primeira semana; contatos de suporte | Coordenação opera o roteiro sem ajuda |
| **M7. Início do piloto (2027.1)** | **11/01** | Uso real: calendário, grade, ausências, alimentação, comunicação, diários automáticos, PPE/PPI | Primeira semana de aulas operada pelo sistema |
| **M8. Estabilização** | 11/01 a 12/02 | Correções, medição de desempenho, primeiro resumo semanal em produção (sexta 15/01), ajuste dos prazos | Sem incidente grave por 2 semanas |
| **M9. Primeira etapa (N1)** | fim de março (conforme calendário) | Avisos de fim de etapa e de fechamento; conferência por amostra dos diários | Entrega da N1 acompanhada pelo sistema |

### Linha do tempo resumida

```
Nov  25 ── M0 PR#4 ── M1 pedidos à TI (27/11) ── M2 dados reais pedidos (04/12)
Dez  07 ─────── M3 implantação acompanhada ─────── 18/12
     14 ───────────── M4 ensaio com dados reais ───── 22/12
     22 ─────────────────── recesso (buffer) ────────────────
Jan  04 ── M5 congelamento ── M6 treinamento ── 08/01
     11 ── M7 INÍCIO DO PILOTO 2027.1 ── M8 estabilização até 12/02
Mar  ── M9 fim da N1
```

### Caminho crítico

`M1 (TI)` → `M3 (VM, backup, restauração)` → `M4 (dados reais)` → `M7 (piloto)`.
Se a VM chegar depois de **18/12**, o ensaio com dados reais (M4) e a restauração (M3) ficam espremidos antes do recesso: acione o plano B de R1.

## 4. O que entra e o que não entra no piloto

**Entra:** tudo da seção 1.1. É suficiente para a Coordenação operar o semestre.

**Fica fora, sem prejuízo ao piloto:** login Google, redefinição de senha por e-mail, importação de diários, integração com SUAP, envio automático pelo WhatsApp, Fase 3.

**Não começar antes do piloto:** funcionalidade nova que não corrija erro. O melhor uso das semanas de dezembro é implantar, carregar dados e treinar.

## 5. Decisões e providências que dependem de você (para esta semana)

1. **Abrir o chamado à TI** (M1). Posso redigir o texto do pedido com tudo o que `IMPLANTACAO.md` especifica.
2. **Pedir à Direção/Coordenação os dados de 2027.1** (M2), com a lista exata do que enviar e em que formato (planilhas de exemplo em `.handoff/`).
3. **Escolher a data do ensaio com dados reais** (M4) e quem da Coordenação participa.
4. **Confirmar o plano B de hospedagem** (R1) caso a TI não entregue até 18/12.
5. **Aprovar o congelamento em 04/01** (M5).
