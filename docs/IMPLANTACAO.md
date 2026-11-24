# Implantação em produção

Roteiro para colocar o SGC-Redes no ar numa VM do campus (Proxmox), com Docker Compose, HTTPS e backup diário do
banco. O sistema não depende de serviços externos: o WhatsApp é semiautomático e o e-mail sai do cliente de cada
pessoa (`mailto:`).

> **Pendente:** o endereço definitivo (domínio ou nome na rede do campus). Ele define o `APP_URL` e o certificado.
> Os passos 1 a 4 e 6 podem ser feitos antes; o passo 5 depende do endereço.

---

## 1. VM no Proxmox

| Recurso | Mínimo | Recomendado |
| :--- | :--- | :--- |
| vCPU | 2 | 2 |
| RAM | 2 GB | 4 GB (o build da imagem é o pico de memória) |
| Disco | 20 GB | 40 GB (imagens Docker, banco e backups locais) |
| Sistema | Debian 12 ou Ubuntu Server 24.04 LTS | |

- Rede: IP fixo (ou reserva no DHCP) e acesso pela porta 443 a partir da rede do campus. A porta 3000 do app **não**
  deve ficar exposta: só o proxy reverso fala com ela.
- Atualizações automáticas de segurança (`unattended-upgrades`) e fuso `America/Fortaleza`
  (`timedatectl set-timezone America/Fortaleza`).
- No Proxmox, inclua a VM no backup agendado (vzdump). Ele complementa o backup do banco do passo 6, mas não o
  substitui: com o `pg_dump` dá para restaurar só o banco, em qualquer máquina.

## 2. Docker e código

```bash
# Docker Engine + plugin compose (repositório oficial): https://docs.docker.com/engine/install/
sudo apt install -y git
sudo git clone https://github.com/cctrc-bvg/sgc-redes-bvg.git /opt/sgc-redes
sudo chown -R "$USER" /opt/sgc-redes
cd /opt/sgc-redes
```

## 3. Configuração (`.env`)

```bash
cp .env.example .env
chmod 600 .env
```

Preencha:

| Variável | Valor |
| :--- | :--- |
| `POSTGRES_USER`, `POSTGRES_DB` | nomes à escolha (ex.: `sgc_redes`, `sgc_redes_ifce`) |
| `POSTGRES_PASSWORD` | senha longa e aleatória: `openssl rand -base64 32` |
| `APP_URL` | endereço **https** definitivo (ex.: `https://sgc-redes.exemplo.ifce.edu.br`) — sem barra no final |
| `SEED_COORDENADOR_EMAIL` | e-mail institucional da Coordenação |
| `SEED_COORDENADOR_SENHA` | deixe **vazio**: o seed gera uma senha e mostra uma única vez no log do `migrate` |
| `WHATSAPP_WEBHOOK_*` | vazio (envio automático desligado, decisão de 24/11/2026) |

Com `APP_URL` em `https://`, o cookie de sessão sai marcado como `Secure`: **o login só funciona pelo endereço https**.
`DATABASE_URL` do `.env` não é usada pelo Compose (ele monta a URL a partir das variáveis do banco).

**Nunca** rode `npm run db:demo` em produção: ele cria usuários com senha conhecida (o script se recusa com
`NODE_ENV=production`, mas não conte com isso).

## 4. Subir a stack

```bash
docker compose up --build -d
docker compose logs migrate       # migrações + seed; anote a senha provisória da Coordenação, se gerada
docker compose ps                 # db (healthy), migrate (exited 0), app (up)
```

A cada atualização do código:

```bash
./scripts/backup-banco.sh         # backup antes de migrar
git pull
docker compose up --build -d      # o serviço migrate aplica só as migrações novas
docker image prune -f             # limpa imagens antigas
```

## 5. HTTPS com proxy reverso

O app escuta em `localhost:3000` (mapeado pelo Compose). Restrinja a porta ao próprio host trocando, no
`docker-compose.yml` da VM, `"3000:3000"` por `"127.0.0.1:3000:3000"`.

**Opção A — Caddy (mais simples).** Obtém e renova o certificado sozinho quando o nome é público (Let's Encrypt). Para
um nome só da rede interna, use o certificado emitido pela TI (`tls /caminho/cert.pem /caminho/chave.pem`).

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
sgc-redes.exemplo.ifce.edu.br {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}
}
```

```bash
sudo systemctl reload caddy
```

**Opção B — Nginx** com o certificado da TI (ou `certbot --nginx`): `proxy_pass http://127.0.0.1:3000;` com
`proxy_set_header Host $host;`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` e
`proxy_set_header X-Forwarded-Proto https;`, e `client_max_body_size 2m;` (importação de planilhas, até 1 MB).

Depois do proxy: confira que `APP_URL` no `.env` é exatamente o endereço https e rode `docker compose up -d app` para
o app ler o valor novo. Os links das mensagens prontas ("Minha grade", ausências) usam esse endereço.

## 6. Backup diário do banco

`scripts/backup-banco.sh` roda `pg_dump` dentro do contêiner, confere que o arquivo é legível, grava em
`BACKUP_DIR` (padrão `./backups`, só o dono acessa) e apaga os mais antigos que `RETENCAO_DIAS` (padrão 30).

```bash
sudo mkdir -p /srv/backups/sgc && sudo chown "$USER" /srv/backups/sgc
BACKUP_DIR=/srv/backups/sgc ./scripts/backup-banco.sh       # teste manual
```

Agendamento com cron (todo dia às 02:30), em `crontab -e` do usuário que roda o Docker:

```
30 2 * * * BACKUP_DIR=/srv/backups/sgc RETENCAO_DIAS=30 /opt/sgc-redes/scripts/backup-banco.sh >> /srv/backups/sgc/backup.log 2>&1
```

**Cópia fora da VM:** o backup local não protege contra a perda da VM. Copie `/srv/backups/sgc` para outro servidor ou
storage do campus (ex.: `rsync` agendado, ou um compartilhamento montado como `BACKUP_DIR`). Os arquivos têm dados
pessoais (LGPD): destino com acesso restrito à Coordenação e à TI.

**Teste de restauração** (faça uma vez na implantação e depois a cada semestre), numa VM de teste ou com o app parado:

```bash
docker compose stop app
./scripts/backup-banco.sh --restaurar /srv/backups/sgc/sgc-AAAA-MM-DD_HHMMSS.dump
docker compose start app
```

## 7. Depois de subir

- [ ] Entrar com o e-mail da Coordenação, trocar a senha provisória.
- [ ] **Comunicação → Grupos e setores:** e-mail institucional e saudação de cada grupo (CAE, nutricionista, CTP,
      Gestão, líderes de turma).
- [ ] Cadastrar (ou importar por planilha) usuários, turmas, disciplinas, ofertas, grade e calendário do ano.
- [ ] Conferir um backup gerado pelo cron no dia seguinte e a cópia fora da VM.
- [ ] Registrar o endereço, a localização dos backups e quem tem acesso no documento da TI.

## Problemas comuns

| Sintoma | Causa provável |
| :--- | :--- |
| Login volta para a tela de login sem erro | Acesso por `http://` ou por outro endereço com `APP_URL` em https (cookie `Secure`). |
| `migrate` termina com erro | Veja `docker compose logs migrate`; banco sem espaço ou senha do `.env` diferente da do volume já criado. |
| Importação de planilha falha no proxy | Limite de upload do proxy abaixo de 2 MB (`client_max_body_size`). |
| Horários um dia antes/depois | Fuso da VM; o app usa `America/Fortaleza` nas regras, mas os logs e o cron usam o fuso da VM. |
