// src/utils/phone-normalizer.js

/**
 * Normalise un numéro de téléphone au format international E.164
 * Format: +{COUNTRY_CODE}{NUMBER} (sans espaces, sans tirets, sans + en trop)
 * 
 * Supporte tous les pays:
 * - Cameroun: +237XXXXXXXXX
 * - Sénégal: +221XXXXXXXXX
 * - Côte d'Ivoire: +225XXXXXXXXX
 * - Nigéria: +234XXXXXXXXX
 * - Ghana: +233XXXXXXXXX
 * - Kenya: +254XXXXXXXXX
 * - Afrique du Sud: +27XXXXXXXXX
 * - France: +33XXXXXXXXX
 * - Et tous les autres...
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Convertir en string et tout nettoyer
  let cleaned = phone.toString().trim();
  
  // Enlever tous les séparateurs courants
  cleaned = cleaned.replace(/[\s\-\(\)\.]/g, '');
  
  // Gérer les doubles plus
  if (cleaned.startsWith('++')) {
    cleaned = cleaned.substring(1);
  }
  
  // Extraire uniquement les chiffres et le + en début
  const hasPlus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');
  
  // Si le numéro commence déjà par + et a un format valide, le retourner tel quel
  if (hasPlus && digits.length >= 8 && digits.length <= 15) {
    // Vérifier qu'il n'y a pas de caractères supplémentaires
    if (cleaned === `+${digits}`) {
      return cleaned;
    }
    // Reconstruire proprement
    return `+${digits}`;
  }
  
  // Détection automatique du code pays basée sur la longueur
  // Longueurs typiques des numéros par pays (sans code pays)
  const countryLengths = {
    // Afrique
    237: 9, // Cameroun
    221: 9, // Sénégal
    225: 8, // Côte d'Ivoire (8-9 chiffres)
    234: 10, // Nigéria
    233: 9, // Ghana
    254: 9, // Kenya
    256: 9, // Ouganda
    250: 9, // Rwanda
    251: 9, // Éthiopie
    255: 9, // Tanzanie
    258: 9, // Mozambique
    260: 9, // Zambie
    263: 9, // Zimbabwe
    265: 8, // Malawi
    266: 8, // Lesotho
    267: 7, // Botswana
    268: 8, // Eswatini
    269: 7, // Comores
    27: 9, // Afrique du Sud
    211: 9, // Soudan du Sud
    212: 9, // Maroc
    213: 9, // Algérie
    216: 8, // Tunisie
    218: 9, // Libye
    222: 8, // Mauritanie
    223: 8, // Mali
    224: 8, // Guinée
    226: 8, // Burkina Faso
    227: 8, // Niger
    228: 8, // Togo
    229: 8, // Bénin
    230: 7, // Maurice
    231: 7, // Liberia
    232: 8, // Sierra Leone
    235: 8, // Tchad
    236: 8, // Centrafrique
    238: 7, // Cap-Vert
    239: 7, // Sao Tomé
    240: 9, // Guinée Équatoriale
    241: 7, // Gabon
    242: 9, // Congo
    243: 9, // RDC
    244: 9, // Angola
    245: 7, // Guinée-Bissau
    248: 7, // Seychelles
    249: 9, // Soudan
    252: 7, // Somalie
    253: 7, // Djibouti
    257: 7, // Burundi
    261: 9, // Madagascar
    262: 9, // Mayotte/Réunion
    264: 9, // Namibie
    266: 8, // Lesotho
    290: 5, // Sainte-Hélène
    291: 6, // Érythrée
    298: 6, // Îles Féroé
    299: 6, // Groenland
    350: 8, // Gibraltar
    351: 9, // Portugal
    352: 9, // Luxembourg
    353: 9, // Irlande
    354: 7, // Islande
    355: 8, // Albanie
    356: 8, // Malte
    357: 8, // Chypre
    358: 8, // Finlande
    359: 8, // Bulgarie
    36: 8, // Hongrie
    370: 8, // Lituanie
    371: 8, // Lettonie
    372: 7, // Estonie
    373: 8, // Moldavie
    374: 8, // Arménie
    375: 9, // Biélorussie
    376: 6, // Andorre
    377: 8, // Monaco
    378: 10, // Saint-Marin
    379: 9, // Vatican
    380: 9, // Ukraine
    381: 8, // Serbie
    382: 8, // Monténégro
    383: 8, // Kosovo
    385: 8, // Croatie
    386: 8, // Slovénie
    387: 8, // Bosnie
    389: 8, // Macédoine
    39: 9, // Italie
    40: 9, // Roumanie
    41: 9, // Suisse
    420: 9, // République tchèque
    421: 9, // Slovaquie
    423: 7, // Liechtenstein
    43: 9, // Autriche
    44: 10, // Royaume-Uni
    45: 8, // Danemark
    46: 9, // Suède
    47: 8, // Norvège
    48: 9, // Pologne
    49: 10, // Allemagne
    500: 5, // Malouines
    501: 7, // Belize
    502: 8, // Guatemala
    503: 8, // Salvador
    504: 8, // Honduras
    505: 8, // Nicaragua
    506: 8, // Costa Rica
    507: 8, // Panama
    508: 6, // Saint-Pierre
    509: 8, // Haïti
    51: 9, // Pérou
    52: 10, // Mexique
    53: 8, // Cuba
    54: 10, // Argentine
    55: 11, // Brésil
    56: 9, // Chili
    57: 10, // Colombie
    58: 10, // Vénézuéla
    591: 8, // Bolivie
    592: 7, // Guyana
    593: 9, // Équateur
    594: 9, // Guyane
    595: 9, // Paraguay
    596: 9, // Martinique
    597: 7, // Suriname
    598: 8, // Uruguay
    599: 7, // Antilles néerl.
    60: 9, // Malaisie
    61: 9, // Australie
    62: 9, // Indonésie
    63: 10, // Philippines
    64: 9, // Nouvelle-Zélande
    65: 8, // Singapour
    66: 9, // Thaïlande
    670: 7, // Timor
    672: 6, // Territoires austr.
    673: 7, // Brunei
    674: 7, // Nauru
    675: 7, // Papouasie
    676: 5, // Tonga
    677: 5, // Îles Salomon
    678: 5, // Vanuatu
    679: 7, // Fidji
    680: 7, // Palaos
    681: 6, // Wallis
    682: 5, // Cook
    683: 5, // Niue
    685: 6, // Samoa
    686: 5, // Kiribati
    687: 6, // Nouvelle-Calédonie
    688: 6, // Tuvalu
    689: 7, // Polynésie
    690: 4, // Tokelau
    691: 7, // Micronésie
    692: 7, // Marshall
    7: 10, // Russie
    81: 10, // Japon
    82: 10, // Corée
    84: 9, // Vietnam
    86: 11, // Chine
    90: 10, // Turquie
    91: 10, // Inde
    92: 10, // Pakistan
    93: 9, // Afghanistan
    94: 9, // Sri Lanka
    95: 9, // Birmanie
    98: 10, // Iran
    212: 9, // Maroc
    213: 9, // Algérie
    216: 8, // Tunisie
    218: 9, // Libye
    220: 7, // Gambie
    221: 9, // Sénégal
    222: 8, // Mauritanie
    223: 8, // Mali
    224: 8, // Guinée
    225: 8, // Côte d'Ivoire
    226: 8, // Burkina Faso
    227: 8, // Niger
    228: 8, // Togo
    229: 8, // Bénin
    230: 7, // Maurice
    231: 7, // Liberia
    232: 8, // Sierra Leone
    233: 9, // Ghana
    234: 10, // Nigéria
    235: 8, // Tchad
    236: 8, // Centrafrique
    237: 9, // Cameroun
    238: 7, // Cap-Vert
    239: 7, // Sao Tomé
    240: 9, // Guinée Équatoriale
    241: 7, // Gabon
    242: 9, // Congo
    243: 9, // RDC
    244: 9, // Angola
    245: 7, // Guinée-Bissau
    248: 7, // Seychelles
    249: 9, // Soudan
    250: 9, // Rwanda
    251: 9, // Éthiopie
    252: 7, // Somalie
    253: 7, // Djibouti
    254: 9, // Kenya
    255: 9, // Tanzanie
    256: 9, // Ouganda
    257: 7, // Burundi
    258: 9, // Mozambique
    260: 9, // Zambie
    261: 9, // Madagascar
    262: 9, // Réunion
    263: 9, // Zimbabwe
    264: 9, // Namibie
    265: 8, // Malawi
    266: 8, // Lesotho
    267: 7, // Botswana
    268: 8, // Eswatini
    269: 7, // Comores
    27: 9, // Afrique du Sud
    290: 5, // Sainte-Hélène
    291: 6, // Érythrée
    298: 6, // Féroé
  };
  
  // Fonction pour trouver le code pays par correspondance
  function findCountryCode(numberDigits) {
    // Tester les codes pays de 1 à 4 chiffres (du plus long au plus court)
    for (let len = 4; len >= 1; len--) {
      const possibleCode = parseInt(numberDigits.substring(0, len));
      if (countryLengths[possibleCode]) {
        const expectedLength = countryLengths[possibleCode];
        const nationalNumber = numberDigits.substring(len);
        if (nationalNumber.length === expectedLength) {
          return {
            code: possibleCode,
            nationalNumber: nationalNumber
          };
        }
      }
    }
    return null;
  }
  
  // Essayer de détecter le code pays
  const countryMatch = findCountryCode(digits);
  
  if (countryMatch) {
    // Reconstruire au format E.164
    return `+${countryMatch.code}${countryMatch.nationalNumber}`;
  }
  
  // Fallback: si le numéro a entre 8 et 15 chiffres, ajouter + automatiquement
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  
  // Si tout échoue, retourner le numéro avec + existant ou le plus simple
  if (!cleaned.startsWith('+') && !hasPlus) {
    return `+${digits}`;
  }
  
  return cleaned;
}

/**
 * Compare deux numéros de téléphone après normalisation
 */
function areSamePhoneNumber(phone1, phone2) {
  if (!phone1 || !phone2) return false;
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  return normalized1 === normalized2;
}

/**
 * Valide si un numéro est au format E.164 valide
 */
function isValidE164(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;
  // Format E.164: + suivi de 8 à 15 chiffres
  return /^\+\d{8,15}$/.test(normalized);
}

/**
 * Extrait le code pays d'un numéro normalisé
 */
function getCountryCode(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;
  const match = normalized.match(/^\+(\d{1,4})/);
  return match ? parseInt(match[1]) : null;
}

module.exports = {
  normalizePhoneNumber,
  areSamePhoneNumber,
  isValidE164,
  getCountryCode
};
