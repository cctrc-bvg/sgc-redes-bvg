#!/usr/bin/env bash
# =============================================================================
# SGC-Redes — ensaio das migrações sobre uma CÓPIA do banco de produção, sem tocar no banco real.
#
# Restaura um backup (pg_dump) num PostgreSQL temporário, isolado, e aplica as migrações da imagem
# sgc-redes-migrate:atual (a versão nova, já construída). Se falhar aqui, falharia em produção.
#
# Uso:
#   ./scripts/ensaiar-migracao.sh                      # usa o backup mais recente de $BACKUP_DIR
#   ./scripts/ensaiar-migracao.sh caminho/arquivo.dump
#
# Chamado pelo scripts/atualizar.sh antes de qualquer mudança. Veja docs/IMPLANTACAO.md, seção 8.
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$RAIZ/backups}"
IMAGEM_MIGRATE="${IMAGEM_MIGRATE:-sgc-redes-migrate:atual}"
NOME="sgc_ensaio_$$"

erro() { printf '✘ %s\n' "$*" >&2; exit 1; }

ARQUIVO="${1:-$(ls -1t "$BACKUP_DIR"/sgc-*.dump 2>/dev/null | head -n 1 || true)}"
[[ -n "$ARQUIVO" && -f "$ARQUIVO" ]] || erro "Nenhum backup encontrado. Rode ./scripts/backup-banco.sh antes."
docker image inspect "$IMAGEM_MIGRATE" >/dev/null 2>&1 || erro "Imagem $IMAGEM_MIGRATE não encontrada: rode 'docker compose build migrate' antes."

limpar() { docker rm -f "$NOME" >/dev/null 2>&1 || true; docker network rm "$NOME" >/dev/null 2>&1 || true; }
trap limpar EXIT

printf '• Ensaio sobre %s\n' "$ARQUIVO"
# Rede própria, sem acesso à rede do banco real; a senha é descartável e o contêiner é apagado ao final.
docker network create --internal "$NOME" >/dev/null
docker run -d --name "$NOME" --network "$NOME" -e POSTGRES_USER=ensaio -e POSTGRES_PASSWORD=ensaio -e POSTGRES_DB=ensaio postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NOME" pg_isready -U ensaio -d ensaio >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$NOME" pg_isready -U ensaio -d ensaio >/dev/null 2>&1 || erro "O PostgreSQL temporário não subiu."

docker exec -i "$NOME" pg_restore -U ensaio -d ensaio --no-owner --no-privileges < "$ARQUIVO" || erro "Não foi possível restaurar o backup no ensaio."
printf '• Backup restaurado na cópia. Aplicando as migrações da versão nova…\n'

if docker run --rm --network "$NOME" -e DATABASE_URL="postgresql://ensaio:ensaio@$NOME:5432/ensaio?schema=public" "$IMAGEM_MIGRATE" npx prisma migrate deploy; then
  printf '✔ Ensaio aprovado: as migrações aplicam sobre uma cópia dos dados reais.\n'
else
  erro "Ensaio REPROVADO: as migrações falharam na cópia. Nada foi alterado no banco real."
fi
