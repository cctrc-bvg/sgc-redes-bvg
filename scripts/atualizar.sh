#!/usr/bin/env bash
# =============================================================================
# SGC-Redes — atualização segura em produção (docs/IMPLANTACAO.md, seção 8)
#
#   1. confere a stack e o repositório      5. sobe a versão nova (migrate + app)
#   2. backup do banco (obrigatório)        6. espera o app ficar saudável (/api/saude)
#   3. constrói a versão nova (app no ar)   7. se não ficar: volta à versão anterior
#   4. ensaia as migrações numa cópia
#
# Uso:
#   ./scripts/atualizar.sh                  # atualiza para origin/main
#   ./scripts/atualizar.sh v1.3.0           # atualiza para uma tag (ou commit)
#   ./scripts/atualizar.sh --voltar         # volta à versão anterior (código e imagens)
#
# O app fica fora do ar só durante a troca de contêiner (segundos). Programe para fora do horário de pico.
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
export BACKUP_DIR="${BACKUP_DIR:-$RAIZ/backups}"
ESPERA_SAUDE="${ESPERA_SAUDE:-180}"
REGISTRO="$RAIZ/.versao-anterior"

erro() { printf '✘ %s\n' "$*" >&2; exit 1; }
passo() { printf '\n▶ %s\n' "$*"; }

saudavel() {
  local estado
  for _ in $(seq 1 "$ESPERA_SAUDE"); do
    estado="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' sgc_redes_app 2>/dev/null || true)"
    [[ "$estado" == "healthy" ]] && return 0
    sleep 1
  done
  return 1
}

guardar_imagens() {
  for img in sgc-redes-app sgc-redes-migrate; do
    docker image inspect "$img:atual" >/dev/null 2>&1 && docker image tag "$img:atual" "$img:anterior"
  done
}

voltar() {
  [[ -f "$REGISTRO" ]] || erro "Não há versão anterior registrada."
  local anterior
  anterior="$(cat "$REGISTRO")"
  passo "Voltando ao código $anterior e às imagens :anterior"
  git checkout --quiet --detach "$anterior"
  for img in sgc-redes-app sgc-redes-migrate; do
    docker image inspect "$img:anterior" >/dev/null 2>&1 && docker image tag "$img:anterior" "$img:atual"
  done
  # Sem migrate: pela política de migrações (só acréscimos), a versão anterior funciona sobre o banco já migrado.
  docker compose up -d --no-build --no-deps app
  if saudavel; then
    printf '✔ Versão anterior no ar.\n'
  else
    printf '✘ A versão anterior também não ficou saudável. Veja "docker compose logs app".\n' >&2
    printf '  Último recurso: restaurar o backup feito antes da atualização (./scripts/backup-banco.sh --restaurar).\n' >&2
    exit 1
  fi
}

[[ "${1:-}" == "--voltar" ]] && { voltar; exit 0; }
ALVO="${1:-origin/main}"

passo "1. Conferências"
command -v docker >/dev/null || erro "Docker não encontrado."
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || erro "Há alterações locais no código. Guarde-as (git stash) ou descarte antes de atualizar."
git fetch --quiet --tags origin
git rev-parse --verify --quiet "$ALVO^{commit}" >/dev/null || erro "Versão '$ALVO' não encontrada."
ATUAL="$(git rev-parse HEAD)"
NOVO="$(git rev-parse "$ALVO^{commit}")"
[[ "$ATUAL" != "$NOVO" ]] || { printf '✔ Já está na versão %s.\n' "$ALVO"; exit 0; }
printf 'De %s para %s (%s):\n' "${ATUAL:0:7}" "${NOVO:0:7}" "$ALVO"
git log --oneline "$ATUAL..$NOVO" | head -n 30
MIGRACOES="$(git diff --name-only "$ATUAL" "$NOVO" -- prisma/migrations | grep -c 'migration.sql' || true)"
printf 'Migrações novas: %s\n' "$MIGRACOES"
if git diff "$ATUAL" "$NOVO" -- prisma/migrations | grep -q -- '-- sgc:destrutiva-aprovada:'; then
  printf '⚠ Esta versão traz migração DESTRUTIVA aprovada. Voltar atrás exigirá restaurar o backup.\n'
  read -r -p "Continuar? [s/N] " resposta
  [[ "$resposta" =~ ^[sS]$ ]] || exit 1
fi

passo "2. Backup do banco"
./scripts/backup-banco.sh

passo "3. Construindo a versão nova (o app atual continua no ar)"
guardar_imagens
printf '%s\n' "$ATUAL" > "$REGISTRO"
git checkout --quiet --detach "$NOVO"
if ! docker compose build migrate app; then
  git checkout --quiet --detach "$ATUAL"
  for img in sgc-redes-app sgc-redes-migrate; do docker image inspect "$img:anterior" >/dev/null 2>&1 && docker image tag "$img:anterior" "$img:atual"; done
  erro "Falha no build. Nada mudou em produção."
fi

passo "4. Ensaio das migrações numa cópia do banco"
if [[ "$MIGRACOES" -gt 0 ]]; then
  if ! ./scripts/ensaiar-migracao.sh; then
    git checkout --quiet --detach "$ATUAL"
    for img in sgc-redes-app sgc-redes-migrate; do docker image inspect "$img:anterior" >/dev/null 2>&1 && docker image tag "$img:anterior" "$img:atual"; done
    erro "Ensaio reprovado. Nada mudou em produção; a versão atual segue no ar."
  fi
else
  printf 'Sem migrações novas: ensaio dispensado.\n'
fi

passo "5. Subindo a versão nova"
if ! docker compose up -d --no-build; then
  printf '\n✘ Falha ao subir a versão nova (veja "docker compose logs migrate"). Voltando à anterior.\n' >&2
  voltar
  exit 1
fi

passo "6. Esperando o app ficar saudável (até ${ESPERA_SAUDE}s)"
# Saudável e já rodando a imagem nova (não o contêiner antigo).
if saudavel && [[ "$(docker inspect -f '{{.Image}}' sgc_redes_app)" == "$(docker image inspect -f '{{.Id}}' sgc-redes-app:atual)" ]]; then
  docker image prune -f >/dev/null
  printf '\n✔ Atualizado para %s. Para voltar: ./scripts/atualizar.sh --voltar\n' "$ALVO"
else
  printf '\n✘ A versão nova não ficou saudável. Voltando à anterior.\n' >&2
  docker compose logs --tail 40 app >&2 || true
  voltar
  exit 1
fi
