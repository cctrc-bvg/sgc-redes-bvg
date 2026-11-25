# Pedido à TI — infraestrutura do SGC-Redes para o semestre 2027.1

> Rascunho de **25/11/2026** para a Coordenação revisar, preencher os campos entre colchetes `[...]` e enviar por
> e-mail ou chamado institucional. **Prazo desejado para o envio: 27/11/2026.**

**Assunto:** Solicitação de VM e serviços de rede para o SGC-Redes (Curso Técnico em Redes de Computadores) — piloto em 2027.1

Prezados(as) da Coordenação de TI,

A Coordenação do Curso Técnico em Redes de Computadores do campus Boa Viagem desenvolveu o **SGC-Redes**, sistema web
para apoiar a rotina da Coordenação: calendário acadêmico, grade horária, ausências e substituições de docentes,
alimentação escolar, comunicação por e-mail, diários, PPE/PEI, PPI e processos SEI. Pretendemos **iniciar o uso em
produção no semestre 2027.1, cujas aulas começam em 11/01/2027**. Para isso precisamos dos itens abaixo, preferencialmente
**até 18/12/2026**, para ter tempo de instalar, ensaiar o backup e carregar os dados antes do início das aulas.

## 1. Máquina virtual (Proxmox)

| Recurso | Solicitado |
| :-- | :-- |
| Sistema | Debian 12 ou Ubuntu Server 24.04 LTS |
| vCPU | 4 (tipo de CPU `host`) |
| Memória | 8 GB (balão mínimo de 4 GB) |
| Disco | 80 GB em SSD |
| Rede | IP fixo (ou reserva no DHCP), acesso pela porta 443 a partir da rede do campus; a porta 3000 do app não fica exposta |
| Acesso | Usuário administrador com `sudo` para [nome do responsável] e acesso SSH pela rede interna |
| Fuso | `America/Fortaleza` |
| Docker | Docker Engine e plugin Compose instalados (ou autorização para instalarmos) |

O dimensionamento foi medido (`docs/IMPLANTACAO.md`, seção 1.1): o uso esperado, de até 100 docentes, consome cerca de 0,1
núcleo no pior minuto. A folga existe para a atualização do sistema na própria VM e para o crescimento.

## 2. Endereço e certificado

- **Nome no domínio institucional**, por exemplo `sgc-redes.boaviagem.ifce.edu.br` (ou o padrão que a TI preferir).
- **Certificado TLS** válido para esse nome (ou autorização para emitir pelo Let's Encrypt, se a rede permitir).
- Proxy reverso com HTTPS. Se for o proxy da TI: repassar `Host`, `X-Forwarded-For` e `X-Forwarded-Proto: https`, e
  permitir **corpo de requisição de até 7 MB** (`client_max_body_size 7m`), usado no envio de planilhas e de formulários de
  reposição em PDF ou imagem.

## 3. Backup

- Backup da VM no agendamento do Proxmox (vzdump).
- **Destino fora da VM** para as cópias do banco: um diretório ou storage de rede, com **acesso restrito à Coordenação e
  à TI**, pois os arquivos contêm dados pessoais (LGPD). Volume pequeno: o banco é de poucas dezenas de MB.
- Se houver armazenamento compartilhado no cluster, avaliar o **HA do Proxmox** para a VM.

## 4. Monitoramento

- Incluir o endereço `https://[endereço]/api/saude` no monitoramento da TI (Zabbix, Uptime Kuma ou equivalente), com
  alerta por e-mail à Coordenação e à TI. A resposta é `200` quando o sistema e o banco estão saudáveis.

## 5. E-mail (opcional neste primeiro momento)

- O sistema **não envia e-mail**: a Coordenação envia as mensagens pelo e-mail institucional dela, a partir de textos
  prontos. Assim, **não é preciso SMTP** para o piloto.
- Para a fase seguinte (redefinição de senha por e-mail), consultar se há um servidor SMTP institucional para sistemas.
- Também para a fase seguinte: **login com a conta Google institucional** (OpenID Connect), que exigiria um projeto OAuth
  e a autorização do domínio. Decisão adiada; não faz parte deste pedido.

## 6. Segurança e dados pessoais

- O sistema guarda nomes, e-mails e telefones de docentes e dados de refeição por turma. Não guarda motivo de ausência
  nem dados de saúde. A documentação está em `docs/ARQUITETURA_LGPD.md`.
- Pedimos que o acesso à VM e aos backups seja restrito à TI responsável e à Coordenação.

## 7. Cronograma proposto

| Data | Etapa |
| :-- | :-- |
| 27/11/2026 | Envio deste pedido |
| Até 18/12/2026 | VM, endereço e certificado disponíveis; instalação acompanhada pela TI |
| Até 22/12/2026 | Teste de restauração do backup e monitoramento ativos |
| 04/01/2027 | Congelamento de funcionalidades; treinamento da Coordenação |
| 11/01/2027 | Início do piloto, na primeira semana de aulas |

Podemos fazer a instalação em reunião com a TI (cerca de 2 horas) e deixamos o passo a passo documentado em
`docs/IMPLANTACAO.md`. Se a entrega da VM não for possível até 18/12, pedimos que nos informem o quanto antes para
combinarmos uma alternativa temporária.

Agradecemos o apoio.

Atenciosamente,
[Nome], Coordenação do Curso Técnico em Redes de Computadores — IFCE campus Boa Viagem
