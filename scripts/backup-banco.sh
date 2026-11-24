#!/usr/bin/env bash
# =============================================================================
# SGC-Redes — backup do PostgreSQL da stack Docker Compose (pg_dump, formato custom)
#
# Uso:
#   ./scripts/backup-banco.sh                 # grava em ./backups (ou em $BACKUP_DIR)
#   BACKUP_DIR=/srv/backups/sgc RETENCAO_DIAS=30 ./scripts/backup-banco.sh
#   ./scripts/backup-banco.sh --restaurar arquivo.dump   # restaura (pede confirmação)
#
# Variáveis:
#   BACKUP_DIR      destino dos arquivos (padrão: ./backups na raiz do projeto)
#   RETENCAO_DIAS   apaga backups mais antigos que isso (padrão: 30)
#   CONTAINER_DB    nome do contêiner do banco (padrão: sgc_redes_db)
#
# Agende com cron ou com o timer do systemd (veja docs/IMPLANTACAO.md). O arquivo contém dados
# pessoais (LGPD): o diretório é criado só com acesso do dono e deve ir para um disco com acesso restrito.
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$RAIZ/backups}"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"
CONTAINER_DB="${CONTAINER_DB:-sgc_redes_db}"

erro() { printf '✘ %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || erro "Docker não encontrado."
[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_DB" 2>/dev/null)" == "true" ]] || erro "Contêiner $CONTAINER_DB não está rodando."
[[ "$RETENCAO_DIAS" =~ ^[0-9]+$ && "$RETENCAO_DIAS" -ge 1 ]] || erro "RETENCAO_DIAS deve ser um número inteiro >= 1."

# Usuário e banco vêm do próprio contêiner (as variáveis do docker-compose).
PG_USER="$(docker exec "$CONTAINER_DB" printenv POSTGRES_USER)"
PG_DB="$(docker exec "$CONTAINER_DB" printenv POSTGRES_DB)"

if [[ "${1:-}" == "--restaurar" ]]; then
  ARQUIVO="${2:-}"
  [[ -f "$ARQUIVO" ]] || erro "Informe o arquivo: --restaurar caminho/do/arquivo.dump"
  printf 'Isto SUBSTITUI os dados do banco "%s" pelo conteúdo de %s.\n' "$PG_DB" "$ARQUIVO"
  read -r -p "Pare o app antes (docker compose stop app). Continuar? [s/N] " resposta
  [[ "$resposta" =~ ^[sS]$ ]] || exit 1
  docker exec -i "$CONTAINER_DB" pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists --no-owner < "$ARQUIVO"
  printf '✔ Restaurado. Suba o app: docker compose start app\n'
  exit 0
fi

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
ARQUIVO="$BACKUP_DIR/sgc-$(date +%Y-%m-%d_%H%M%S).dump"
PARCIAL="$ARQUIVO.parcial"

# Grava num arquivo temporário e só renomeia se o pg_dump terminar bem (nada de backup pela metade).
trap 'rm -f "$PARCIAL"' EXIT
docker exec "$CONTAINER_DB" pg_dump -U "$PG_USER" -d "$PG_DB" --format=custom --compress=6 > "$PARCIAL"
# Confere que o arquivo é um dump legível antes de aceitá-lo.
docker exec -i "$CONTAINER_DB" pg_restore --list < "$PARCIAL" > /dev/null || erro "O dump gerado não é legível."
mv "$PARCIAL" "$ARQUIVO"
trap - EXIT

find "$BACKUP_DIR" -maxdepth 1 -name 'sgc-*.dump' -type f -mtime +"$RETENCAO_DIAS" -delete
printf '✔ Backup: %s (%s). Mantidos: %s arquivo(s), retenção de %s dias.\n' \
  "$ARQUIVO" "$(du -h "$ARQUIVO" | cut -f1)" "$(find "$BACKUP_DIR" -maxdepth 1 -name 'sgc-*.dump' | wc -l)" "$RETENCAO_DIAS"
