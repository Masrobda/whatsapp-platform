#!/bin/bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

OUTPUT_DIR="/var/socadel/db_mysql"
CSV_FILE="$OUTPUT_DIR/db_facture.csv"
LOG_FILE="/var/www/numericexport/api/logs/export_socadel_mysql.log"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

echo "$(date) - Début de l'export de mysql_invoices_all vers PostgreSQL..." >> "$LOG_FILE"

# Export direct avec \copy (le fichier écrase l'ancien grâce au nom fixe)
psql -U nextltd_user -d nextltd_db -c "\copy (SELECT * FROM mysql_invoices_all) TO '$CSV_FILE' WITH (FORMAT csv, HEADER true);" >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "$(date) - Succès : Fichier exporté vers $CSV_FILE" >> "$LOG_FILE"
else
    echo "$(date) - ERREUR lors de l'export psql." >> "$LOG_FILE"
    exit 1
fi
