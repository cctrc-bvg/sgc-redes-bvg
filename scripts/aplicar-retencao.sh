#!/usr/bin/env bash
# =============================================================================
# SGC-Redes — aplica os prazos de retenção de dados (LGPD) no PostgreSQL da stack Docker Compose.
#
# Uso:
#   ./scripts/aplicar-retencao.sh              # SIMULA: mostra as quantidades e desfaz (nada muda)
#   ./scripts/aplicar-retencao.sh --confirmo   # aplica de verdade
#
# Prazos (scripts/retencao.sql): anexos de reposição 1 ano após o fim do semestre; IP da auditoria 2 anos;
# usuários desativados anonimizados após 2 anos. Os backups antigos mantêm os dados até saírem da rotação
# (RETENCAO_DIAS do backup-banco.sh, 30 dias). Agende uma vez por mês (docs/IMPLANTACAO.md).
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_DB="${CONTAINER_DB:-sgc_redes_db}"
erro() { printf '✘ %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || erro "Docker não encontrado."
[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_DB" 2>/dev/null)" == "true" ]] || erro "Contêiner $CONTAINER_DB não está rodando."
PG_USER="$(docker exec "$CONTAINER_DB" printenv POSTGRES_USER)"
PG_DB="$(docker exec "$CONTAINER_DB" printenv POSTGRES_DB)"

FIM="ROLLBACK;"
MODO="SIMULAÇÃO (nada foi alterado)"
if [[ "${1:-}" == "--confirmo" ]]; then FIM="COMMIT;"; MODO="APLICADO"; fi

printf 'Retenção de dados: %s\n' "$MODO"
{ echo "BEGIN;"; cat "$RAIZ/scripts/retencao.sql"; echo "$FIM"; } \
  | docker exec -i "$CONTAINER_DB" psql -q -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" -At
