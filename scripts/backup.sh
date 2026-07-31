#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# CEIL — sauvegarde PostgreSQL automatisée avec rétention
#
# Usage :
#   ./scripts/backup.sh                        # sauvegarde standard
#   ./scripts/backup.sh --retention 30         # garde 30 jours (défaut : 14)
#   ./scripts/backup.sh --dir /srv/ceil/backups # répertoire personnalisé
#
# La rétention supprime les dumps plus anciens que N jours.
# Un backup échoué ne supprime rien.
# ---------------------------------------------------------------------------

set -euo pipefail

RETENTION_DAYS=14
BACKUP_DIR=""

usage() {
  sed -n '2,/^$/{ s/^# \?//; p }' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --retention)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    --dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Option inconnue : $1"
      usage
      ;;
  esac
done

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="ceil-${TIMESTAMP}.dump"
DEST="${BACKUP_DIR}/${FILENAME}"

echo "[backup] $(date -Iseconds) — début de la sauvegarde"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERREUR : DATABASE_URL n'est pas définie." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Dump personnalisé : format custom (pg_restore), compression gzip
# ---------------------------------------------------------------------------
pg_dump \
  --format=custom \
  --compress=gzip \
  --no-owner \
  --no-privileges \
  --file="$DEST" \
  "$DATABASE_URL"

SIZE=$(du -h "$DEST" | cut -f1)
echo "[backup] Sauvegarde terminée : ${FILENAME} (${SIZE})"

# ---------------------------------------------------------------------------
# Rétention — supprimer les dumps plus anciens que RETENTION_DAYS
# ---------------------------------------------------------------------------
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name 'ceil-*.dump' -type f -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  echo "[backup] ${DELETED} sauvegarde(s) de plus de ${RETENTION_DAYS} jour(s) supprimée(s)."
fi

echo "[backup] $(date -Iseconds) — fin"
