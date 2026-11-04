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

DB_PATH=${DB_PATH:-}
UPLOADS_DIR=${UPLOADS_DIR:-}
BACKUP_DIR=${BACKUP_DIR:-}
KEEP=${KEEP:-14}

[ -n "$DB_PATH" ] || fail "DB_PATH is required"
[ -n "$UPLOADS_DIR" ] || fail "UPLOADS_DIR is required"
[ -n "$BACKUP_DIR" ] || fail "BACKUP_DIR is required"
require_absolute DB_PATH "$DB_PATH"
require_absolute UPLOADS_DIR "$UPLOADS_DIR"
require_absolute BACKUP_DIR "$BACKUP_DIR"
case "$KEEP" in
  ''|*[!0-9]*) fail "KEEP must be a positive integer" ;;
esac
[ "$KEEP" -gt 0 ] || fail "KEEP must be a positive integer"
[ -f "$DB_PATH" ] || fail "database file does not exist"
[ -d "$UPLOADS_DIR" ] || fail "uploads directory does not exist"

mkdir -p "$BACKUP_DIR" || fail "cannot create backup directory"
chmod 700 "$BACKUP_DIR" || fail "cannot secure backup directory"
LOCK_DIR=$BACKUP_DIR/.backup.lock
TEMP_DIR=

cleanup() {
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
  if [ -d "$LOCK_DIR" ]; then
    owner=$(cat "$LOCK_DIR/owner" 2>/dev/null || true)
    if [ "$owner" = "$$" ]; then
      rm -f "$LOCK_DIR/owner"
      rmdir "$LOCK_DIR" 2>/dev/null || true
    fi
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

if ! mkdir -m 700 "$LOCK_DIR" 2>/dev/null; then
  owner=$(cat "$LOCK_DIR/owner" 2>/dev/null || true)
  case "$owner" in
    ''|*[!0-9]*)
      log "Removing stale backup lock"
      stale_lock=$BACKUP_DIR/.backup-stale-$$
      mv "$LOCK_DIR" "$stale_lock" 2>/dev/null || fail "backup lock is being initialized by another process"
      rm -rf "$stale_lock"
      ;;
    *)
      if kill -0 "$owner" 2>/dev/null; then
        log "Backup skipped: another backup is running"
        exit 1
      fi
      log "Removing stale backup lock"
      stale_lock=$BACKUP_DIR/.backup-stale-$$
      mv "$LOCK_DIR" "$stale_lock" 2>/dev/null || fail "backup lock is being updated by another process"
      rm -rf "$stale_lock"
      ;;
  esac
  mkdir -m 700 "$LOCK_DIR" 2>/dev/null || fail "another backup acquired the lock"
fi
printf '%s\n' "$$" > "$LOCK_DIR/owner"
chmod 600 "$LOCK_DIR/owner"

command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 CLI is required"
if command -v shasum >/dev/null 2>&1; then
  checksum() { shasum -a 256 "$1" | awk '{print $1}'; }
elif command -v sha256sum >/dev/null 2>&1; then
  checksum() { sha256sum "$1" | awk '{print $1}'; }
else
  fail "shasum or sha256sum is required"
fi

TEMP_DIR=$BACKUP_DIR/.backup-tmp-$$
mkdir -m 700 "$TEMP_DIR" || fail "cannot create temporary backup directory"

database_path=$TEMP_DIR/db
sqlite_path=$(printf '%s' "$database_path" | sed "s/'/''/g")
sqlite3 "$DB_PATH" ".backup '$sqlite_path'" || fail "SQLite backup failed"
integrity=$(sqlite3 "$database_path" "PRAGMA integrity_check;" 2>/dev/null) ||
  fail "SQLite integrity check failed"
[ "$integrity" = "ok" ] || fail "SQLite integrity check did not return ok"

# Uploads are archived after the database snapshot: new files are written before their metadata is committed.
# Upload files may also be removed by application cleanup flows, so concurrent deletion can still create an orphaned reference.
tar -czf "$TEMP_DIR/uploads.tar.gz" -C "$UPLOADS_DIR" . ||
  fail "uploads archive failed"

timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
backup_name=backup-$timestamp
suffix=1
while [ -e "$BACKUP_DIR/$backup_name" ]; do
  backup_name=backup-$timestamp-$suffix
  suffix=$((suffix + 1))
done

database_size=$(wc -c < "$TEMP_DIR/db" | tr -d ' ')
uploads_size=$(wc -c < "$TEMP_DIR/uploads.tar.gz" | tr -d ' ')
database_checksum=$(checksum "$TEMP_DIR/db") || fail "database checksum failed"
uploads_checksum=$(checksum "$TEMP_DIR/uploads.tar.gz") || fail "uploads checksum failed"
{
  printf 'database_size_bytes=%s\n' "$database_size"
  printf 'database_sha256=%s\n' "$database_checksum"
  printf 'uploads_archive_size_bytes=%s\n' "$uploads_size"
  printf 'uploads_archive_sha256=%s\n' "$uploads_checksum"
} > "$TEMP_DIR/MANIFEST"
chmod 600 "$TEMP_DIR/db" "$TEMP_DIR/uploads.tar.gz" "$TEMP_DIR/MANIFEST"

mv "$TEMP_DIR" "$BACKUP_DIR/$backup_name" ||
  fail "cannot finalize backup directory"
TEMP_DIR=

list_file=$BACKUP_DIR/.backup-list-$$
ls -1d "$BACKUP_DIR"/backup-* 2>/dev/null | sort -r > "$list_file" || true
chmod 600 "$list_file"
index=0
while IFS= read -r backup_path; do
  [ -n "$backup_path" ] || continue
  index=$((index + 1))
  if [ "$index" -gt "$KEEP" ] && [ "$backup_path" != "$BACKUP_DIR/$backup_name" ]; then
    rm -rf "$backup_path" || fail "cannot rotate an old backup"
  fi
done < "$list_file"
rm -f "$list_file"

log "Backup completed: $backup_name"
