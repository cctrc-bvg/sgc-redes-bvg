# Identidade Visual, Usabilidade e Acessibilidade
## SGC-Redes — IFCE Campus Boa Viagem

Este documento define as diretrizes de interface do SGC-Redes. Ele deriva a identidade visual do
**Manual de Aplicação da Marca Instituto Federal (3ª edição, 2015 — Portaria Setec/MEC nº 31/2015)**
e orienta o desenho das telas pelas **10 heurísticas de usabilidade de Nielsen**, pela **WCAG 2.2
(nível AA)** e pelo **eMAG 3.1** (Modelo de Acessibilidade em Governo Eletrônico), de adoção
obrigatória em sítios e sistemas de órgãos do Governo Federal.

---

## 1. Uso da Marca IF (o que o manual exige)

| Regra do manual | Aplicação no SGC-Redes |
| :--- | :--- |
| Não criar novas aplicações, não estilizar, não distorcer, não alterar cores ou tipografia (p. 17) | O sistema **não redesenha** o símbolo IF. Usa o arquivo oficial da assinatura *Instituto Federal do Ceará — Campus Boa Viagem*, obtido junto à Comunicação do IFCE, em `public/marca/` (SVG). O nome "SGC-Redes" é exibido apenas como texto, **separado** da assinatura institucional. |
| Redução máxima: símbolo nunca menor que **1 cm / 30 px** (p. 13) | No cabeçalho, a assinatura horizontal é exibida com o símbolo de pelo menos 30 px de altura. Em telas estreitas, usa-se a versão vertical ou só o nome "SGC-Redes" — nunca a marca miniaturizada. |
| Reserva de integridade de **1 módulo x** ao redor (p. 12) | Área livre mínima (padding) em volta da assinatura; nenhum botão, badge ou borda invade essa área. |
| Em fundos coloridos, aplicar sobre **base branca**; em fundos escuros, tipografia branca (p. 19) | O cabeçalho é branco. Um eventual tema escuro usa a versão monocromática negativa (p. 15). |
| Arquivo da marca em uso | `public/marca/ifce-vertical.png`: assinatura vertical oficial *Instituto Federal — Ceará*, enviada pelo usuário em 25/11/2026 (margens aparadas). Usada só no PEI impresso, a 1,9 cm de altura, como no modelo do campus (`docs/referencias/modelo-pei-campus-boa-viagem.pdf`). Se a Comunicação do IFCE fornecer o SVG, trocar por ele. |
| Não aplicar como marca d'água (p. 17) | A marca não aparece como fundo de telas, relatórios ou PDFs gerados (ficha PPI, PEI). |
| Assinatura cooperada: distância mínima de **3x** de outras marcas; MEC/Governo Federal seguem a SECOM (p. 18) | Rodapés e documentos exportados que combinem IF + MEC seguem esse espaçamento. |

## 2. Paleta Derivada (tokens)

As cores oficiais (p. 14) são a base. Como o sistema é uma interface de trabalho com muito texto,
foram derivados tons para cumprir o contraste mínimo da WCAG 2.2 AA (4,5:1 para texto normal e
3:1 para texto grande e componentes).

| Token | Hex | Origem | Contraste sobre branco | Uso permitido |
| :--- | :--- | :--- | :---: | :--- |
| `if-verde` | `#2f9e41` | Oficial (Pantone 362 C) | 3,45:1 | Elementos decorativos, ícones grandes, bordas de destaque, texto **≥ 24 px** (ou ≥ 18,66 px em negrito). **Não usar em texto comum.** |
| `if-verde-700` | `#237a32` | Derivado | 5,38:1 | Cor primária de ação: botões (texto branco), links e foco. |
| `if-verde-800` | `#1b5e27` | Derivado | 7,84:1 | Hover/ativo de botões e títulos de seção. |
| `if-verde-50` | `#e8f5ea` | Derivado | — | Fundos suaves (verde-700 sobre ele: 4,79:1). |
| `if-vermelho` | `#cd191e` | Oficial (Pantone 187 C) | 5,59:1 | **Reservado a erro, perigo e emergência.** |
| `if-vermelho-700` | `#a3141a` | Derivado | 7,86:1 | Texto de erro sobre fundo `if-vermelho-50`. |
| `if-vermelho-50` | `#fdecec` | Derivado | — | Fundo de alertas de erro/emergência (vermelho-700 sobre ele: 6,88:1). |
| `if-preto` | `#000000` | Oficial | 21:1 | Assinatura monocromática; o texto corrido usa cinza-escuro (`slate-900`). |

> **Atenção — o RGB e o HEX do manual não batem exatamente.** O verde aparece como `R50 G160 B65`
> (`#32a041`) e como `#2f9e41`; o vermelho, como `R200 G25 B30` (`#c8191e`) e como `#cd191e`. Adotamos
> o **HEX** publicado. A diferença é imperceptível e não altera as conclusões de contraste.

### 2.1 Conflito marca × semáforo (decisão de projeto)

O FSD usa um semáforo verde/amarelo/vermelho para o prazo de aviso à Assistência Estudantil (RF04)
e para os diários (RF08), enquanto verde e vermelho são as cores da marca. Para que a cor nunca
seja ambígua (e para cumprir o critério WCAG 1.4.1 — *não usar cor como único meio de informação*):

1. **Verde da marca = identidade e ação primária.** Vermelho da marca = apenas erro, perigo e emergência.
2. Todo status de semáforo traz **ícone + rótulo em texto** (ex.: "🔴 Emergência (< 4h)", como já
   faz `classificarSla`). Ninguém precisa distinguir cores para entender o status.
3. Os badges de status usam fundo suave (`-50`) + texto escuro (`-700/800`), visualmente distintos
   dos botões primários (fundo sólido).

## 3. Tipografia

- **Open Sans** (p. 16), família livre, carregada via `next/font` e **auto-hospedada** no build
  (a página não faz requisição a servidores externos em tempo de execução, o que está alinhado à
  soberania de dados da `ARQUITETURA_LGPD.md`).
- Pesos: Regular (400) para texto, Semibold (600) para rótulos e cabeçalhos de tabela, Bold (700)
  para títulos.
- Corpo de texto de no mínimo **16 px**, altura de linha ≥ 1,5 e texto redimensionável até 200%
  sem perda de conteúdo (WCAG 1.4.4).

## 4. Heurísticas de Nielsen aplicadas ao SGC-Redes

| # | Heurística | Como se materializa no sistema |
| :-: | :--- | :--- |
| 1 | **Visibilidade do status do sistema** | Badge de SLA calculado *enquanto* se registra a ausência; estado de cada aviso (rascunho → enviado → ciente da AE); indicadores de carregamento e confirmação após salvar. |
| 2 | **Correspondência com o mundo real** | Vocabulário institucional (PEI, PPE, diário, processo SEI, ROD art. X); datas `dd/mm/aaaa`, hora no formato 24h, fuso `America/Fortaleza`; grade exibida como o quadro de horários usado na escola. |
| 3 | **Controle e liberdade do usuário** | Prévia editável da mensagem antes de enviar ao WhatsApp; "Desfazer" em remanejamentos ainda não comunicados; formulários longos (PEI) salvos como rascunho. |
| 4 | **Consistência e padrões** | Mesmos verbos em todo o sistema ("Registrar", "Enviar aviso", "Concluir"); posição fixa da ação primária; um mesmo componente de semáforo para SLA e diários; padrões de formulário do Design System gov.br como referência. |
| 5 | **Prevenção de erros** | Travas do ROD (Art. 117 §1º: teto de 30% exibido ao lado do campo; Art. 121: carga prática) validadas em tempo real; `motivoOperacional` escolhido de uma lista pré-definida (evita digitar dados médicos — LGPD); confirmação explícita para dispensar turma com menos de 4h de antecedência; certificado de PPI duplicado bloqueado. |
| 6 | **Reconhecer em vez de lembrar** | Janelas livres destacadas na grade; lista de professores sugeridos para substituição já filtrada; autocompletar de matrícula e disciplina; categorias de PPI exibidas com teto e horas por unidade. |
| 7 | **Flexibilidade e eficiência de uso** | Ações de um clique ("Gerar aviso para a AE"); "Clonar cronograma" entre PEIs (G09); atalhos de teclado para usuários frequentes (coordenação), sem prejudicar quem não os conhece. |
| 8 | **Estética e design minimalista** | Cada perfil vê apenas o que precisa (o perfil `ASSISTENCIA_ESTUDANTIL` vê só refeições), o que também cumpre a minimização de dados da LGPD; sem elementos decorativos competindo com dados. |
| 9 | **Ajudar a reconhecer, diagnosticar e recuperar erros** | Mensagens em linguagem simples, junto ao campo, dizendo a regra e a correção (ex.: "Art. 117 §1º ROD: a carga do PEI (20h) excede 30% da disciplina (máximo 18h)"). Nunca exibir apenas códigos ou "Erro 500". |
| 10 | **Ajuda e documentação** | Dica contextual (ícone "?") com o artigo do ROD ou item do Manual de PPI 2022 correspondente; página de ajuda curta por perfil. |

## 5. Checklist de Acessibilidade (WCAG 2.2 AA / eMAG)

- [ ] Contraste mínimo de 4,5:1 em texto e de 3:1 em componentes e ícones informativos (usar os tokens da seção 2).
- [ ] Toda a navegação funciona só com teclado; foco sempre visível (anel `if-verde-700` de 2 px com afastamento).
- [ ] Link "Ir para o conteúdo" no topo; atalhos de teclado do eMAG (Alt+1 conteúdo, Alt+2 menu, Alt+3 busca).
- [ ] `lang="pt-BR"` no documento; títulos (`h1`–`h3`) em ordem hierárquica; uma `<main>` por página.
- [ ] Todo campo com `<label>` visível; erros associados por `aria-describedby` e anunciados (`aria-live`).
- [ ] Tabelas de grade e de diários com `<th scope>` e legenda (`<caption>`).
- [ ] Status nunca transmitido só por cor (seção 2.1).
- [ ] Alvos de toque de pelo menos 24×24 px (WCAG 2.5.8); recomenda-se 44×44 px no celular.
- [ ] Layout responsivo sem rolagem horizontal até 320 px de largura (o celular é o uso principal dos professores).
- [ ] Respeitar `prefers-reduced-motion`; nenhuma animação essencial.
- [ ] Validar cada tela com leitor de tela (NVDA ou Orca) e com uma ferramenta automática (axe, Lighthouse) antes do merge.
