#!/usr/bin/env bash
# Backup dinh ky: pg_dump toan bo + tar thu muc storage.
# Cron mau: 17 1 * * * /opt/vieschool/scripts/backup.sh >> /var/log/vieschool-backup.log 2>&1
set -euo pipefail
DEST="${BACKUP_DIR:-/opt/vieschool/backups}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
docker exec vn-db pg_dump -U postgres -d postgres -Fc -f "/tmp/vieschool-${TS}.dump"
docker cp "vn-db:/tmp/vieschool-${TS}.dump" "$DEST/vieschool-${TS}.dump"
docker exec vn-db rm "/tmp/vieschool-${TS}.dump"
tar -czf "$DEST/storage-${TS}.tar.gz" -C "$(docker volume inspect -f '{{.Mountpoint}}' vieschool-db-vn_storage-data)" .
find "$DEST" -mtime +30 -delete
echo "BACKUP_OK $TS"
