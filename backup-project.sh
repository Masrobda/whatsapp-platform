#!/bin/bash

DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$HOME/numericexport-full-backup-$DATE.tar.gz"

echo "=== Création de la sauvegarde du code ==="
tar -czf "$BACKUP_FILE" \
  --exclude='*/node_modules' \
  --exclude='*/.next' \
  --exclude='*/.git' \
  --exclude='*/logs' \
  --exclude='*/.env*' \
  --exclude='*/.DS_Store' \
  api dashboard vitrine ecosystem.config.js

echo "=== Sauvegarde terminée ==="
ls -lh "$BACKUP_FILE"

# Optionnel : copie sur un autre endroit (exemple : Google Drive monté ou SCP)
# scp "$BACKUP_FILE" user@autre-serveur:/backups/
