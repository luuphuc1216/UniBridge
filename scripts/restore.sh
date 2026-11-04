#!/bin/sh
set -eu
umask 077

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

require_absolute() {
  value_name=$1
  value=$2
  case "$value" in
    /*) ;;
    *) fail "$value_name must be an absolute path" ;;
  esac
}

BACKUP_PATH=${1:-}
ACTION=${2:-}
DB_PATH=${DB_PATH:-}
UPLOADS_DIR=${UPLOADS_DIR:-}
RESTORE_STAGING_DIR=${RESTORE_STAGING_DIR:-}
[ -n "$BACKUP_PATH" ] || fail "usage: restore.sh BACKUP_DIR [--apply]"
[ -d "$BACKUP_PATH" ] || fail "backup directory does not exist"
[ -n "$DB_PATH" ] || fail "DB_PATH is required"
[ -n "$UPLOADS_DIR" ] || fail "UPLOADS_DIR is required"
[ -n "$RESTORE_STAGING_DIR" ] || fail "RESTORE_STAGING_DIR is required"
require_absolute DB_PATH "$DB_PATH"
require_absolute UPLOADS_DIR "$UPLOADS_DIR"
require_absolute RESTORE_STAGING_DIR "$RESTORE_STAGING_DIR"
case "$ACTION" in
  ''|--apply) ;;
  *) fail "the only supported option is --apply" ;;
esac

command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 CLI is required"
if command -v shasum >/dev/null 2>&1; then
  checksum() { shasum -a 256 "$1" | awk '{print $1}'; }
elif command -v sha256sum >/dev/null 2>&1; then
  checksum() { sha256sum "$1" | awk '{print $1}'; }
else
  fail "shasum or sha256sum is required"
fi

BACKUP_PATH=$(cd "$BACKUP_PATH" && pwd -P)
backup_name=$(basename "$BACKUP_PATH")
manifest=$BACKUP_PATH/MANIFEST
database_file=$BACKUP_PATH/db
archive_file=$BACKUP_PATH/uploads.tar.gz
[ -f "$manifest" ] && [ -f "$database_file" ] && [ -f "$archive_file" ] ||
  fail "backup is missing required files"

expected_db_checksum=$(sed -n 's/^database_sha256=//p' "$manifest")
expected_uploads_checksum=$(sed -n 's/^uploads_archive_sha256=//p' "$manifest")
expected_db_size=$(sed -n 's/^database_size_bytes=//p' "$manifest")
expected_uploads_size=$(sed -n 's/^uploads_archive_size_bytes=//p' "$manifest")
[ -n "$expected_db_checksum" ] && [ -n "$expected_uploads_checksum" ] ||
  fail "backup manifest is invalid"
[ "$(checksum "$database_file")" = "$expected_db_checksum" ] ||
  fail "database checksum mismatch"
[ "$(checksum "$archive_file")" = "$expected_uploads_checksum" ] ||
  fail "uploads checksum mismatch"
[ "$(wc -c < "$database_file" | tr -d ' ')" = "$expected_db_size" ] ||
  fail "database size mismatch"
[ "$(wc -c < "$archive_file" | tr -d ' ')" = "$expected_uploads_size" ] ||
  fail "uploads archive size mismatch"

mkdir -m 700 "$RESTORE_STAGING_DIR" 2>/dev/null ||
  fail "RESTORE_STAGING_DIR must not already exist"
STAGE_CREATED=1
stage_cleanup() {
  if [ "${STAGE_CREATED:-0}" -eq 1 ]; then
    rm -rf "$RESTORE_STAGING_DIR"
  fi
}
trap stage_cleanup EXIT
trap 'exit 1' HUP INT TERM
chmod 700 "$RESTORE_STAGING_DIR"
mkdir -m 700 "$RESTORE_STAGING_DIR/uploads"
cp "$database_file" "$RESTORE_STAGING_DIR/db"
cp "$archive_file" "$RESTORE_STAGING_DIR/uploads.tar.gz"
chmod 600 "$RESTORE_STAGING_DIR/db" "$RESTORE_STAGING_DIR/uploads.tar.gz"

archive_listing=$RESTORE_STAGING_DIR/.archive-list
tar -tzf "$RESTORE_STAGING_DIR/uploads.tar.gz" > "$archive_listing" ||
  fail "cannot read uploads archive"
awk '
    /^\// { invalid = 1 }
    {
      count = split($0, part, "/")
      for (i = 1; i <= count; i++) if (part[i] == "..") invalid = 1
    }
    END { exit invalid }
  ' "$archive_listing" || fail "uploads archive contains an unsafe path"
rm -f "$archive_listing"
tar -xzf "$RESTORE_STAGING_DIR/uploads.tar.gz" -C "$RESTORE_STAGING_DIR/uploads" ||
  fail "cannot unpack uploads archive"
integrity=$(sqlite3 "$RESTORE_STAGING_DIR/db" "PRAGMA integrity_check;" 2>/dev/null) ||
  fail "restored database integrity check failed"
[ "$integrity" = "ok" ] || fail "restored database integrity check did not return ok"

log "Backup verified and staged at the requested staging directory"
printf 'Manual restore commands (do not run while the app or job is using the database):\n'
printf '  mv "%s" "%s.before-restore-<timestamp>"\n' "$DB_PATH" "$DB_PATH"
printf '  cp "%s/db" "%s"\n' "$RESTORE_STAGING_DIR" "$DB_PATH"
printf '  mv "%s" "%s.before-restore-<timestamp>"\n' "$UPLOADS_DIR" "$UPLOADS_DIR"
printf '  cp -R "%s/uploads/." "%s/"\n' "$RESTORE_STAGING_DIR" "$UPLOADS_DIR"

if [ "$ACTION" != "--apply" ]; then
  STAGE_CREATED=0
  exit 0
fi

[ -t 0 ] || fail "--apply requires an interactive terminal"
printf 'Type %s to apply this restore: ' "$backup_name"
IFS= read -r confirmation || confirmation=
[ "$confirmation" = "$backup_name" ] || fail "confirmation did not match"

if command -v fuser >/dev/null 2>&1; then
  if fuser "$DB_PATH" >/dev/null 2>&1; then
    fail "a process is using the database"
  fi
elif command -v lsof >/dev/null 2>&1; then
  if [ -n "$(lsof -t "$DB_PATH" 2>/dev/null || true)" ]; then
    fail "a process is using the database"
  fi
else
  log "WARNING: cannot check database users (no fuser or lsof)"
  printf 'Type %s again to confirm no process is using the database: ' "$backup_name"
  IFS= read -r second_confirmation || second_confirmation=
  [ "$second_confirmation" = "$backup_name" ] ||
    fail "second confirmation did not match"
fi

db_parent=$(dirname "$DB_PATH")
uploads_parent=$(dirname "$UPLOADS_DIR")
[ -d "$db_parent" ] && [ -d "$uploads_parent" ] ||
  fail "database and uploads parent directories must exist"
timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
old_db=$DB_PATH.before-restore-$timestamp
old_uploads=$UPLOADS_DIR.before-restore-$timestamp
new_db=$DB_PATH.restore-new-$$
new_uploads=$UPLOADS_DIR.restore-new-$$
[ ! -e "$old_db" ] && [ ! -e "$old_uploads" ] &&
  [ ! -e "$new_db" ] && [ ! -e "$new_uploads" ] ||
  fail "restore destination already exists"
cp "$RESTORE_STAGING_DIR/db" "$new_db"
cp -R "$RESTORE_STAGING_DIR/uploads" "$new_uploads"
chmod 600 "$new_db"
chmod 700 "$new_uploads"

db_saved=0
uploads_saved=0
if [ -e "$DB_PATH" ]; then
  mv "$DB_PATH" "$old_db" || fail "cannot preserve the current database"
  db_saved=1
fi
if [ -e "$UPLOADS_DIR" ]; then
  if ! mv "$UPLOADS_DIR" "$old_uploads"; then
    [ "$db_saved" -eq 0 ] || mv "$old_db" "$DB_PATH"
    fail "cannot preserve the current uploads directory"
  fi
  uploads_saved=1
fi
if ! mv "$new_db" "$DB_PATH"; then
  [ "$db_saved" -eq 0 ] || mv "$old_db" "$DB_PATH"
  [ "$uploads_saved" -eq 0 ] || mv "$old_uploads" "$UPLOADS_DIR"
  fail "cannot install the restored database"
fi
if ! mv "$new_uploads" "$UPLOADS_DIR"; then
  rm -f "$DB_PATH"
  [ "$db_saved" -eq 0 ] || mv "$old_db" "$DB_PATH"
  [ "$uploads_saved" -eq 0 ] || mv "$old_uploads" "$UPLOADS_DIR"
  fail "cannot install the restored uploads directory"
fi

STAGE_CREATED=0
log "Restore applied; previous data was preserved with .before-restore-$timestamp suffixes"
