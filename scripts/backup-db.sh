#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${DB_PATH:-$ROOT/data/bot.db}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "Database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/bot-$STAMP.db"

cd "$ROOT"
node --input-type=module -e "
import Database from 'better-sqlite3';
const db = new Database(process.argv[1], { readonly: true });
await db.backup(process.argv[2]);
db.close();
" "$DB_PATH" "$TARGET"

echo "Backup created: $TARGET"

find "$BACKUP_DIR" -name 'bot-*.db' -type f -mtime +"$KEEP_DAYS" -delete
echo "Old backups older than ${KEEP_DAYS} days removed"
