# clean_csv.py
import html
import csv
import re

input_file = '/tmp/contct_utf8.csv'
output_file = '/tmp/contct_clean.csv'

def normalize_phone(phone):
    if not phone:
        return ''
    # Enlever espaces, tirets, points
    phone = re.sub(r'[\s\-\.\(\)]', '', phone)
    # Enlever tout sauf chiffres et +
    phone = re.sub(r'[^0-9+]', '', phone)
    if phone and not phone.startswith('+'):
        phone = '+' + phone
    # Si le numéro est +237 suivi de 8 chiffres (sans 6) → ajouter 6 après +237
    if phone.startswith('+237') and len(phone) == 12:  # +237 + 8 chiffres
        phone = '+2376' + phone[4:]
    return phone

with open(input_file, 'r', encoding='utf-8') as infile, \
     open(output_file, 'w', encoding='utf-8', newline='') as outfile:

    reader = csv.reader(infile, delimiter=';')
    writer = csv.writer(outfile, delimiter='|')

    # Lire les en-têtes si présents (on les saute)
    header = next(reader, None)
    if header and header[0].strip().lower() == 'contract_number':
        pass  # on saute l'en-tête
    else:
        # Si pas d'en-tête, on rembobine
        infile.seek(0)
        reader = csv.reader(infile, delimiter=';')

    for row in reader:
        if len(row) < 3:
            continue  # ignorer les lignes incomplètes
        contract_number = row[0].strip()
        client_name = html.unescape(row[1].strip())
        client_phone = html.unescape(row[2].strip())

        # Ignorer les lignes sans nom
        if not client_name:
            continue

        # Normaliser le téléphone
        client_phone = normalize_phone(client_phone)

        writer.writerow([contract_number, client_name, client_phone])
