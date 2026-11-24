#!/usr/bin/env bash
# =============================================================================
# SGC-Redes — script de desenvolvimento local
#
# Uso: ./scripts/dev.sh <comando> [opções]
#
#   setup              Verifica o Node, instala dependências e cria o .env
#   testar             Typecheck + testes unitários (não precisa de banco)
#   banco [nativo|docker]
#                      Prepara um PostgreSQL local, aplica migrações e seed
#   dev [--rede]       Sobe o servidor de desenvolvimento (porta 3000)
#   studio             Abre o Prisma Studio para ver os dados (porta 5555)
#   docker             Sobe a stack completa (db + migrate + app) via Docker Compose
#   tudo [nativo|docker]
#                      setup + testar + banco
#   ajuda              Mostra esta ajuda
#
# Comandos pesados rodam com baixa prioridade de CPU e disco (nice/ionice),
# pensando em máquinas com pouca RAM e HDD.
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

CONTAINER_DB_DEV="sgc_dev_db"
VOLUME_DB_DEV="sgc_dev_pgdata"
NODE_MINIMO="20.9.0"

# ---------- utilidades ----------
if [[ -t 1 ]]; then
  C_OK=$'\e[32m'; C_AVISO=$'\e[33m'; C_ERRO=$'\e[31m'; C_PASSO=$'\e[1;34m'; C_FIM=$'\e[0m'
else
  C_OK=''; C_AVISO=''; C_ERRO=''; C_PASSO=''; C_FIM=''
fi
passo() { printf '\n%s==> %s%s\n' "$C_PASSO" "$*" "$C_FIM"; }
ok()    { printf '%s✔ %s%s\n' "$C_OK" "$*" "$C_FIM"; }
aviso() { printf '%s! %s%s\n' "$C_AVISO" "$*" "$C_FIM" >&2; }
erro()  { printf '%s✘ %s%s\n' "$C_ERRO" "$*" "$C_FIM" >&2; exit 1; }
tem()   { command -v "$1" >/dev/null 2>&1; }

confirmar() {
  local resposta
  read -r -p "$1 [s/N] " resposta
  [[ "$resposta" =~ ^[sS]$ ]]
}

# Executa com baixa prioridade de CPU (nice) e de disco (ionice), quando disponíveis.
leve() {
  local prefixo=(nice -n 15)
  tem ionice && prefixo+=(ionice -c 2 -n 7)
  "${prefixo[@]}" "$@"
}

# O npm 9.2 empacotado no Debian falha neste projeto ("reading 'edgesOut'");
# usa o npm 10 via npx quando o do sistema for mais antigo.
npm_cmd() {
  local maior
  maior="$(npm -v | cut -d. -f1)"
  if (( maior < 10 )); then
    leve npx -y npm@10 "$@"
  else
    leve npm "$@"
  fi
}

versao_maior_igual() { # $1 >= $2 ?
  [[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" == "$2" ]]
}

segredo() { node -e "console.log(require('crypto').randomBytes(${1:-16}).toString('hex'))"; }

carregar_env() {
  [[ -f .env ]] || erro "Arquivo .env não encontrado. Rode primeiro: ./scripts/dev.sh setup"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  : "${POSTGRES_USER:?POSTGRES_USER ausente no .env}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD ausente no .env}"
  : "${POSTGRES_DB:?POSTGRES_DB ausente no .env}"
}

porta_ocupada() { tem ss && ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"; }

# ---------- setup ----------
cmd_setup() {
  passo "Verificando Node.js"
  tem node || erro "Node.js não encontrado. Instale o Node 22 LTS (ex.: https://github.com/nvm-sh/nvm)."
  local v; v="$(node -v | sed 's/^v//')"
  versao_maior_igual "$v" "$NODE_MINIMO" || erro "Node $v é antigo; é preciso >= $NODE_MINIMO."
  ok "Node $v"

  passo "Instalando dependências"
  if [[ -d node_modules && node_modules/.package-lock.json -nt package-lock.json ]]; then
    ok "node_modules já está atualizado (pulando instalação)"
  else
    npm_cmd install --no-audit --no-fund
    ok "Dependências instaladas e Prisma Client gerado"
  fi

  passo "Configurando .env"
  if [[ -f .env ]]; then
    ok ".env já existe (mantido como está)"
  else
    local senha
    senha="$(segredo 16)"
    sed -e "s/trocar_esta_senha_em_producao/${senha}/g" .env.example > .env
    chmod 600 .env
    ok ".env criado com senha do banco aleatória"
  fi
}

# ---------- testes ----------
cmd_testar() {
  [[ -d node_modules ]] || erro "Dependências ausentes. Rode primeiro: ./scripts/dev.sh setup"
  passo "Verificação de tipos (TypeScript)"
  leve npx tsc --noEmit
  ok "Typecheck sem erros"

  passo "Testes unitários (Vitest, 1 worker)"
  leve npx vitest run
  ok "Testes concluídos"
}

# ---------- banco ----------
banco_nativo() {
  passo "PostgreSQL nativo (apt)"
  if ! tem psql; then
    aviso "PostgreSQL não está instalado."
    confirmar "Instalar agora com 'sudo apt install -y postgresql'?" || erro "Instalação cancelada."
    sudo apt-get update
    sudo apt-get install -y postgresql
  fi
  sudo systemctl enable --now postgresql >/dev/null 2>&1 || sudo service postgresql start || true

  local psql_pg=(sudo -u postgres psql -v ON_ERROR_STOP=1 -qtAX)
  if [[ "$("${psql_pg[@]}" -c "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'")" == "1" ]]; then
    # Mantém a senha do papel sincronizada com o .env.
    "${psql_pg[@]}" -c "ALTER ROLE \"${POSTGRES_USER}\" WITH LOGIN CREATEDB PASSWORD '${POSTGRES_PASSWORD}'"
    ok "Usuário ${POSTGRES_USER} já existia (senha sincronizada com o .env)"
  else
    "${psql_pg[@]}" -c "CREATE ROLE \"${POSTGRES_USER}\" WITH LOGIN CREATEDB PASSWORD '${POSTGRES_PASSWORD}'"
    ok "Usuário ${POSTGRES_USER} criado"
  fi
  if [[ "$("${psql_pg[@]}" -c "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'")" == "1" ]]; then
    ok "Banco ${POSTGRES_DB} já existia"
  else
    "${psql_pg[@]}" -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\""
    ok "Banco ${POSTGRES_DB} criado"
  fi
}

exigir_docker() {
  tem docker || erro "Docker não encontrado. Instale com: sudo apt install -y docker.io docker-compose-v2"
  docker info >/dev/null 2>&1 || erro "Sem permissão no Docker. Rode 'sudo usermod -aG docker \$USER', saia e entre de novo na sessão."
}

banco_docker() {
  passo "PostgreSQL 16 em container Docker"
  exigir_docker
  if docker container inspect "$CONTAINER_DB_DEV" >/dev/null 2>&1; then
    docker start "$CONTAINER_DB_DEV" >/dev/null
    ok "Container ${CONTAINER_DB_DEV} iniciado (já existia)"
    aviso "Se você mudou a senha no .env depois de criar o container, remova-o: docker rm -f ${CONTAINER_DB_DEV} && docker volume rm ${VOLUME_DB_DEV}"
  else
    porta_ocupada 5432 && erro "A porta 5432 já está em uso (talvez um PostgreSQL nativo). Use: ./scripts/dev.sh banco nativo"
    docker run -d --name "$CONTAINER_DB_DEV" \
      -p 127.0.0.1:5432:5432 \
      -e POSTGRES_USER="$POSTGRES_USER" \
      -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
      -e POSTGRES_DB="$POSTGRES_DB" \
      -v "$VOLUME_DB_DEV":/var/lib/postgresql/data \
      postgres:16-alpine >/dev/null
    ok "Container ${CONTAINER_DB_DEV} criado"
  fi

  printf 'Aguardando o PostgreSQL ficar pronto'
  for _ in $(seq 1 30); do
    if docker exec "$CONTAINER_DB_DEV" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      printf '\n'; ok "PostgreSQL pronto"; return
    fi
    printf '.'; sleep 2
  done
  printf '\n'; erro "O PostgreSQL não respondeu. Veja: docker logs ${CONTAINER_DB_DEV}"
}

cmd_banco() {
  carregar_env
  local modo="${1:-}"
  if [[ -z "$modo" ]]; then
    printf 'Como deseja rodar o PostgreSQL?\n  1) nativo (apt) — mais leve\n  2) docker — igual à produção\n'
    local escolha; read -r -p "Escolha [1/2]: " escolha
    case "$escolha" in 1) modo=nativo ;; 2) modo=docker ;; *) erro "Opção inválida." ;; esac
  fi
  case "$modo" in
    nativo) banco_nativo ;;
    docker) banco_docker ;;
    *) erro "Modo desconhecido: $modo (use 'nativo' ou 'docker')" ;;
  esac

  # Garante que o DATABASE_URL do .env aponta para este banco.
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?schema=public"

  passo "Aplicando migrações"
  leve npx prisma migrate deploy
  passo "Populando dados iniciais (seed)"
  leve npx prisma db seed
  ok "Banco pronto. Veja os dados com: ./scripts/dev.sh studio"
}

# ---------- servidores ----------
cmd_dev() {
  [[ -f .env ]] || erro "Rode primeiro: ./scripts/dev.sh setup"
  local args=()
  if [[ "${1:-}" == "--rede" ]]; then
    args=(-H 0.0.0.0)
    aviso "Servidor acessível na rede local: http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000"
    aviso "Use apenas em rede confiável; o modo dev não é seguro para exposição pública."
  fi
  passo "Servidor de desenvolvimento em http://localhost:3000 (Ctrl+C para sair)"
  NEXT_TELEMETRY_DISABLED=1 leve npx next dev "${args[@]}"
}

cmd_studio() {
  carregar_env
  passo "Prisma Studio em http://localhost:5555 (Ctrl+C para sair)"
  leve npx prisma studio --browser none
}

cmd_docker() {
  exigir_docker
  [[ -f .env ]] || erro "Rode primeiro: ./scripts/dev.sh setup"
  if docker container inspect "$CONTAINER_DB_DEV" >/dev/null 2>&1 \
     && [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_DB_DEV")" == "true" ]]; then
    aviso "O banco de desenvolvimento (${CONTAINER_DB_DEV}) está rodando; parando para liberar memória."
    docker stop "$CONTAINER_DB_DEV" >/dev/null
  fi
  passo "Construindo e subindo a stack completa (pode levar vários minutos na primeira vez)"
  leve docker compose up --build -d
  passo "Resultado das migrações e do seed"
  docker compose logs migrate | tail -n 20
  ok "Aplicação em http://localhost:3000  —  logs: docker compose logs -f app  —  parar: docker compose down"
}

cmd_tudo() {
  cmd_setup
  cmd_testar
  cmd_banco "${1:-}"
  printf '\n'
  ok "Tudo pronto. Próximo passo: ./scripts/dev.sh dev   (e, em outro terminal, ./scripts/dev.sh studio)"
}

cmd_ajuda() { sed -n '3,19p' "$0" | sed 's/^# \{0,1\}//'; }

# ---------- despacho ----------
comando="${1:-ajuda}"
shift || true
case "$comando" in
  setup)  cmd_setup ;;
  testar) cmd_testar ;;
  banco)  cmd_banco "$@" ;;
  dev)    cmd_dev "$@" ;;
  studio) cmd_studio ;;
  docker) cmd_docker ;;
  tudo)   cmd_tudo "$@" ;;
  ajuda|-h|--help) cmd_ajuda ;;
  *) aviso "Comando desconhecido: $comando"; cmd_ajuda; exit 1 ;;
esac
