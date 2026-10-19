#!/bin/bash
exec /var/www/numericexport/api/venv/bin/python3 /var/www/numericexport/api/src/scripts/generate_campaign_report.py "$@"
