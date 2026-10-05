// dashboard/app/socadel/dashboard/filterOptions.ts

export const REGIONS = [
  'DCUD', 'DCUY', 'DRC', 'DRE', 'DRNEA', 'DRONO', 'DRSANO', 'DRSM', 'DRSOM'
] as const;

export const DIVISIONS = [
  'DLP ADAMAOUA', 'DLP EXTREME-NORD', 'DPC BAFIA', 'DPC BAMENDA', 'DPC BAMENDA EXT',
  'DPC BERTOUA', 'DPC EBOLOWA', 'DPC EDEA', 'DPC ESEKA', 'DPC EST EXT', 'DPC KRIBI',
  'DPC KUMBA', 'DPC MBALMAYO', 'DPC MFOU', 'DPC MOUNGO', 'DPC NORD', 'DPC OBALA',
  'DPC SANGMELIMA', 'DVC DOUALA CENTRE', 'DVC DOUALA EST', 'DVC DOUALA NORD',
  'DVC DOUALA OUEST', 'DVC DOUALA SUD', 'DVC LIMBE', 'DVC OUEST 1 NOUN',
  'DVC OUEST 1-BAF', 'DVC OUEST 2-MEN_BAMB', 'DVC OUEST 2NHT_NKAM',
  'DVC YAOUNDE CENTRE', 'DVC YAOUNDE EST', 'DVC YAOUNDE NORD', 'DVC YAOUNDE OUEST',
  'DVC YAOUNDE SUD'
] as const;

export const MRCS = [
  'MRC_ABONG_MBANG', 'MRC_ADAMAOUA', 'MRC_BAFIA', 'MRC_BAFOUSSAM', 'MRC_BAMBOUTOS',
  'MRC_BAMENDA', 'MRC_BAMENDA_EXTERIEUR', 'MRC_BIYEMASSI', 'MRC_BUEA', 'MRC_DLA_CENTRE',
  'MRC_DLA_EST', 'MRC_DLA_NORD', 'MRC_DLA_OUEST', 'MRC_EBOLOWA', 'MRC_ECLAIRAGE_PUBLIC',
  'MRC_EDEA', 'MRC_ESEKA', 'MRC_EST', 'MRC_ETOUDI', 'MRC_EXTREME_NORD', 'MRC_GROS_BT',
  'MRC_HAUT_NKAM', 'MRC_KOUMASSI', 'MRC_KRIBI', 'MRC_KUMBA', 'MRC_KUMBO', 'MRC_LIMBE',
  'MRC_LOGPOM', 'MRC_LOUM', 'MRC_MAMFE', 'MRC_MAROUA EXTERIEUR', 'MRC_MBALMAYO',
  'MRC_MEIGANGA', 'MRC_MENOUA', 'MRC_MESSASSI', 'MRC_MFOU', 'MRC_MV_READING_CENTER',
  'MRC_NDE', 'MRC_NKOABANG', 'MRC_NKOLBISSON', 'MRC_NKONGSAMBA', 'MRC_NLONGKAK',
  'MRC_NORD', 'MRC_NOUN', 'MRC_NSAM', 'MRC_OBALA', 'MRC_ODZA', 'MRC_PREPAIEMENT',
  'MRC_SANGMELIMA', 'MRC_TIKO', 'MRC_YAOUNDE_CENTRE', 'MRC_YASSA', 'MRC_YDE_EST'
] as const;

export const AGENCES = [
  'CSC_ABONG-BANG', 'CSC_AKOM II', 'CSC_AKONO', 'CSC_AKONOLINGA', 'CSC_AKWA', 'CSC_AMBAM',
  'CSC_AWAE', 'CSC_AYOS', 'CSC_BAFANG', 'CSC_BAFIA', 'CSC_BAFOUSSAM - DJEMOUN',
  'CSC_BAFOUSSAM - NYLON', 'CSC_BAFUT', 'CSC_BALI', 'CSC_BAMBILI', 'CSC_BAMVELE',
  'CSC_BANDJOUN', 'CSC_BANENGO', 'CSC_BANGANGTE-BAZOU', 'CSC_BANGEM', 'CSC_BANYO',
  'CSC_BASSA', 'CSC_BATIBO', 'CSC_BATOURI', 'CSC_BELABO', 'CSC_BENGBIS', 'CSC_BEPANDA',
  'CSC_BETARE OYA', 'CSC_BILLE', 'CSC_BIWONG-BANE', 'CSC_BIYEM-ASSI', 'CSC_BOGO',
  'CSC_BONABERI NORD', 'CSC_BONABERI SUD', 'CSC_BONAMOUSSADI', 'CSC_BOTMAKAK',
  'CSC_BOUMNYEBEL', 'CSC_BOURHA', 'CSC_BUEA', 'CSC_BUREAU DE DANG', 'CSC_BUREAU SOA',
  'CSC_CAMPO', 'CSC_CENTER', 'CSC_DAKAR', 'CSC_DEIDO', 'CSC_DIANG', 'CSC_DIMAKO',
  'CSC_DIZANGUE', 'CSC_DJOUM', 'CSC_DOMBE', 'CSC_DOUME', 'CSC_DSCHANG',
  'CSC_EBOLOWA RURAL', 'CSC_EBOLOWA URBAIN', 'CSC_EDEA', 'CSC_EKONDO-TITI', 'CSC_ELEVEUR',
  'CSC_ELOGBATINDI', 'CSC_ENDOM', 'CSC_ESEKA', 'CSC_ESSOS', 'CSC_ETOUDI', 'CSC_EWANKANG',
  'CSC_FIGUIL', 'CSC_FOUMBAN-KOUTABA', 'CSC_FOUMBOT', 'CSC_FUNDONG', 'CSC_GAROUA BOULAI',
  'CSC_GAROUA_1', 'CSC_GAROUA_2', 'CSC_GUIDER', 'CSC_KAELE', 'CSC_KANO', 'CSC_KEMBONG',
  'CSC_KENA', 'CSC_KODENGUI', 'CSC_KOUMASSI', 'CSC_KOUSSERI', 'CSC_KOUTABA', 'CSC_KRIBI',
  'CSC_KUMBA', 'CSC_KUMBO', 'CSC_KYE-OSSI', 'CSC_LAGDO', 'CSC_LENDI', 'CSC_LIMBE',
  'CSC_LOGPOM', 'CSC_LOLODORF', 'CSC_LOMIE', 'CSC_LOUM', 'CSC_MAAN', 'CSC_MAGA', 'CSC_MAGBA',
  'CSC_MAKAK', 'CSC_MAMFE', 'CSC_MANJO', 'CSC_MANKON', 'CSC_MAROUA_DJARENGOL_PIDDERE',
  'CSC_MAROUA_DOUGOY', 'CSC_MAROUA_RURAL', 'CSC_MAYO-OULO', 'CSC_MBALMAYO', 'CSC_MBANDJOCK',
  'CSC_MBANGA', 'CSC_MBANKOMO', 'CSC_MBENGWI', 'CSC_MBOUDA', 'CSC_MEIGANGA', 'CSC_MELONG',
  'CSC_MENGUEME', 'CSC_MENJI', 'CSC_MERI', 'CSC_MESSASSI', 'CSC_MESSONDO', 'CSC_METET',
  'CSC_MEYOMESSALA', 'CSC_MFOU', 'CSC_MINTA', 'CSC_MOKOLO', 'CSC_MOLOUNDOU', 'CSC_MONATELE',
  'CSC_MORA', 'CSC_MOUANKO', 'CSC_MOULVOUDAYE', 'CSC_MOUTOURWA', 'CSC_MUNDEMBA',
  'CSC_MUTENGUENE', 'CSC_MUYUKA', 'CSC_NANGA-EBOKO', 'CSC_NDIKINIMEKI-TONGA', 'CSC_NDOGPASSI',
  'CSC_NDOM', 'CSC_NDOP', 'CSC_NDU', 'CSC_NEW-BELL', 'CSC_NGAMBE', 'CSC_NGAOUNDAL',
  'CSC_NGAOUNDERE NORD', 'CSC_NGAOUNDERE SUD', 'CSC_NGONG', 'CSC_NGOULEMAKONG', 'CSC_NGOUMOU',
  'CSC_NGUELEMEDOUKA', 'CSC_NKOABANG', 'CSC_NKOLBIKOK', 'CSC_NKOLBISSON', 'CSC_NKONGSAMBA',
  'CSC_NKWEN', 'CSC_NLONGKAK', 'CSC_NSAM', 'CSC_NSIMALEN', 'CSC_NTUI', 'CSC_NYETE',
  'CSC_OBALA', 'CSC_ODZA', 'CSC_OKOLA', 'CSC_PALMIERS', 'CSC_PENJA', 'CSC_PITOA', 'CSC_PK21',
  'CSC_POLI', 'CSC_POUMA', 'CSC_REY BOUBA', 'CSC_SAA', 'CSC_SANGMELIMA', 'CSC_SANGMELIMA RURAL',
  'CSC_SANTA', 'CSC_SANTCHOU', 'CSC_SIMBOCK', 'CSC_SOUZA', 'CSC_TCHOLLIRE', 'CSC_TIBATI',
  'CSC_TIGNERE', 'CSC_TIKO', 'CSC_TOMBEL', 'CSC_TOUBORO', 'CSC_WUM', 'CSC_YABASSI',
  'CSC_YAGOUA', 'CSC_YASSA', 'CSC_YOKADOUMA', 'CSC_YOKO', 'CSC_ZOETELE'
] as const;

// ═══════════════════════════════════════════════════════════
// HIÉRARCHIE  Région > Division > MRC > Agences
// ═══════════════════════════════════════════════════════════
export const HIERARCHY: Record<string, Record<string, Record<string, string[]>>> = {
  DCUD: {
    'DPC MFOU': {
      MRC_MFOU: ['CSC_AKONO'],
    },
    'DVC DOUALA CENTRE': {
      MRC_DLA_CENTRE: ['CSC_BASSA', 'CSC_BEPANDA', 'CSC_DEIDO'],
    },
    'DVC DOUALA EST': {
      MRC_DLA_EST: ['CSC_BILLE', 'CSC_DAKAR'],
      MRC_YASSA: ['CSC_NDOGPASSI', 'CSC_YASSA'],
    },
    'DVC DOUALA NORD': {
      MRC_DLA_NORD: ['CSC_BONAMOUSSADI', 'CSC_PALMIERS'],
      MRC_LOGPOM: ['CSC_LENDI', 'CSC_LOGPOM', 'CSC_PK21'],
    },
    'DVC DOUALA OUEST': {
      MRC_DLA_OUEST: ['CSC_BONABERI NORD', 'CSC_BONABERI SUD', 'CSC_SOUZA'],
    },
    'DVC DOUALA SUD': {
      MRC_KOUMASSI: ['CSC_AKWA', 'CSC_KOUMASSI', 'CSC_NEW-BELL'],
    },
  },
  DCUY: {
    'DVC YAOUNDE CENTRE': {
      MRC_YAOUNDE_CENTRE: ['CSC_CENTER', 'CSC_NKOLBIKOK'],
    },
    'DVC YAOUNDE EST': {
      MRC_NKOABANG: ['CSC_KODENGUI', 'CSC_NKOABANG'],
      MRC_YDE_EST: ['CSC_ELEVEUR', 'CSC_ESSOS'],
    },
    'DVC YAOUNDE NORD': {
      MRC_ETOUDI: ['CSC_BUREAU SOA', 'CSC_ETOUDI'],
      MRC_MESSASSI: ['CSC_MESSASSI'],
      MRC_NLONGKAK: ['CSC_NLONGKAK'],
    },
    'DVC YAOUNDE OUEST': {
      MRC_BIYEMASSI: ['CSC_BIYEM-ASSI', 'CSC_MBANKOMO'],
      MRC_NKOLBISSON: ['CSC_NKOLBISSON', 'CSC_SIMBOCK'],
    },
    'DVC YAOUNDE SUD': {
      MRC_NSAM: ['CSC_MFOU', 'CSC_NSAM', 'CSC_NSIMALEN'],
      MRC_ODZA: ['CSC_EWANKANG', 'CSC_ODZA'],
    },
  },
  DRC: {
    'DPC BAFIA': {
      MRC_BAFIA: ['CSC_BAFIA', 'CSC_MONATELE', 'CSC_NDOM', 'CSC_OKOLA', 'CSC_YOKO'],
    },
    'DPC MFOU': {
      MRC_MFOU: ['CSC_AKONOLINGA', 'CSC_AWAE', 'CSC_AYOS', 'CSC_MAKAK', 'CSC_NGOUMOU'],
    },
    'DPC OBALA': {
      MRC_OBALA: ['CSC_MBANDJOCK', 'CSC_NTUI', 'CSC_OBALA', 'CSC_SAA'],
    },
  },
  DRE: {
    'DPC BERTOUA': {
      MRC_EST: ['CSC_BAMVELE', 'CSC_BERTOUA', 'CSC_KANO'],
    },
    'DPC EST EXT': {
      MRC_ABONG_MBANG: [
        'CSC_ABONG-BANG', 'CSC_BATOURI', 'CSC_BELABO', 'CSC_BETARE OYA',
        'CSC_DIANG', 'CSC_DIMAKO', 'CSC_DOUME', 'CSC_GAROUA BOULAI', 'CSC_LOMIE',
        'CSC_MINTA', 'CSC_MOLOUNDOU', 'CSC_NGUELEMEDOUKA', 'CSC_YOKADOUMA',
      ],
    },
  },
  DRNEA: {
    'DLP ADAMAOUA': {
      MRC_ADAMAOUA: [
        'CSC_BUREAU DE DANG', 'CSC_NGAOUNDERE NORD', 'CSC_NGAOUNDERE SUD',
        'CSC_TIGNERE', 'CSC_TOUBORO',
      ],
      MRC_MEIGANGA: ['CSC_BANYO', 'CSC_MEIGANGA', 'CSC_NGAOUNDAL', 'CSC_TIBATI'],
    },
    'DLP EXTREME-NORD': {
      MRC_ADAMAOUA: ['CSC_AMCHIDE'],
      MRC_EXTREME_NORD: [
        'CSC_BOGO', 'CSC_MAGA', 'CSC_MAROUA_DJARENGOL_PIDDERE', 'CSC_MAROUA_DOUGOY',
        'CSC_MAROUA_RURAL', 'CSC_MERI', 'CSC_MOUTOURWA',
      ],
      'MRC_MAROUA EXTERIEUR': [
        'CSC_KAELE', 'CSC_KOUSSERI', 'CSC_MOKOLO', 'CSC_MORA', 'CSC_MOULVOUDAYE', 'CSC_YAGOUA',
      ],
    },
    'DPC NORD': {
      MRC_NORD: [
        'CSC_BOURHA', 'CSC_FIGUIL', 'CSC_GAROUA_1', 'CSC_GAROUA_2', 'CSC_GUIDER',
        'CSC_LAGDO', 'CSC_MAYO-OULO', 'CSC_NGONG', 'CSC_PITOA', 'CSC_POLI',
        'CSC_REY BOUBA', 'CSC_TCHOLLIRE',
      ],
    },
  },
  DRONO: {
    'DPC BAMENDA': {
      MRC_BAMENDA: ['CSC_MANKON', 'CSC_NKWEN'],
    },
    'DPC BAMENDA EXT': {
      MRC_BAMENDA_EXTERIEUR: [
        'CSC_BAFUT', 'CSC_BALI', 'CSC_BAMBILI', 'CSC_BATIBO', 'CSC_FUNDONG',
        'CSC_MBENGWI', 'CSC_NDOP', 'CSC_SANTA', 'CSC_WUM',
      ],
      MRC_KUMBO: ['CSC_KUMBO', 'CSC_NDU', 'CSC_NKAMBE'],
    },
    'DVC OUEST 1 NOUN': {
      MRC_NOUN: ['CSC_FOUMBAN-KOUTABA', 'CSC_FOUMBOT', 'CSC_KOUTABA', 'CSC_MAGBA'],
    },
    'DVC OUEST 1-BAF': {
      MRC_BAFOUSSAM: [
        'CSC_BAFOUSSAM - DJEMOUN', 'CSC_BAFOUSSAM - NYLON', 'CSC_BANDJOUN',
        'CSC_BANENGO', 'CSC_KENA',
      ],
    },
    'DVC OUEST 2-MEN_BAMB': {
      MRC_BAMBOUTOS: ['CSC_MBOUDA'],
      MRC_MENOUA: ['CSC_DSCHANG', 'CSC_MENJI'],
    },
    'DVC OUEST 2NHT_NKAM': {
      MRC_HAUT_NKAM: ['CSC_BAFANG'],
      MRC_NDE: ['CSC_BANGANGTE-BAZOU', 'CSC_NDIKINIMEKI-TONGA'],
    },
  },
  DRSANO: {
    'DPC EDEA': {
      MRC_EDEA: ['CSC_DIZANGUE', 'CSC_EDEA', 'CSC_MESSONDO', 'CSC_MOUANKO', 'CSC_NGAMBE', 'CSC_POUMA'],
    },
    'DPC ESEKA': {
      MRC_ESEKA: ['CSC_BOTMAKAK', 'CSC_BOUMNYEBEL', 'CSC_ESEKA'],
    },
    'DPC KRIBI': {
      MRC_KRIBI: ['CSC_AKOM II', 'CSC_CAMPO', 'CSC_DOMBE', 'CSC_ELOGBATINDI', 'CSC_KRIBI', 'CSC_NYETE'],
    },
  },
  DRSM: {
    'DPC EBOLOWA': {
      MRC_EBOLOWA: [
        'CSC_AMBAM', 'CSC_BIWONG-BANE', 'CSC_EBOLOWA RURAL', 'CSC_EBOLOWA URBAIN',
        'CSC_KYE-OSSI', 'CSC_LOLODORF', 'CSC_MAAN',
      ],
    },
    'DPC MBALMAYO': {
      MRC_EBOLOWA: ['CSC_NGOULEMAKONG'],
      MRC_MBALMAYO: ['CSC_MBALMAYO', 'CSC_MENGUEME', 'CSC_METET'],
    },
    'DPC OBALA': {
      MRC_OBALA: ['CSC_NANGA-EBOKO'],
    },
    'DPC SANGMELIMA': {
      MRC_MBALMAYO: ['CSC_ENDOM'],
      MRC_SANGMELIMA: [
        'CSC_BENGBIS', 'CSC_DJOUM', 'CSC_MEYOMESSALA', 'CSC_SANGMELIMA',
        'CSC_SANGMELIMA RURAL', 'CSC_ZOETELE',
      ],
    },
  },
  DRSOM: {
    'DPC KUMBA': {
      MRC_KUMBA: ['CSC_EKONDO-TITI', 'CSC_KUMBA', 'CSC_MUYUKA'],
      MRC_MAMFE: ['CSC_KEMBONG', 'CSC_MAMFE', 'CSC_MUNDEMBA', 'CSC_TOMBEL'],
    },
    'DPC MOUNGO': {
      MRC_LOUM: ['CSC_LOUM', 'CSC_MBANGA', 'CSC_PENJA', 'CSC_YABASSI'],
      MRC_NKONGSAMBA: ['CSC_BANGEM', 'CSC_MANJO', 'CSC_MELONG', 'CSC_NKONGSAMBA', 'CSC_SANTCHOU'],
    },
    'DVC LIMBE': {
      MRC_BUEA: ['CSC_BUEA'],
      MRC_LIMBE: ['CSC_LIMBE'],
      MRC_TIKO: ['CSC_MUTENGUENE', 'CSC_TIKO'],
    },
  },
};

// ═══════════════════════════════════════════════════════════
// HELPERS DE CASCADE
// ═══════════════════════════════════════════════════════════

/** Divisions disponibles pour une région (vide = toutes) */
export function getDivisionsForRegion(region: string): string[] {
  if (!region || !HIERARCHY[region]) return [...DIVISIONS];
  return Object.keys(HIERARCHY[region]).sort();
}

/** MRC disponibles selon région + division */
export function getMrcsCascade(region: string, division: string): string[] {
  // Aucun filtre → tout
  if (!region && !division) return [...MRCS];

  const set = new Set<string>();

  // Iterate over matching entries
  const regions = region ? [region] : Object.keys(HIERARCHY);
  for (const r of regions) {
    const divisions = division ? [division] : Object.keys(HIERARCHY[r] || {});
    for (const d of divisions) {
      const mrcs = HIERARCHY[r]?.[d];
      if (!mrcs) continue;
      Object.keys(mrcs).forEach((m) => set.add(m));
    }
  }

  const result = [...set].sort();
  return result.length > 0 ? result : [...MRCS];
}

/** Agences disponibles selon région + division + MRC */
export function getAgencesCascade(
  region: string,
  division: string,
  mrc: string
): string[] {
  // Aucun filtre → tout
  if (!region && !division && !mrc) return [...AGENCES];

  const set = new Set<string>();

  const regions = region ? [region] : Object.keys(HIERARCHY);
  for (const r of regions) {
    const divisions = division ? [division] : Object.keys(HIERARCHY[r] || {});
    for (const d of divisions) {
      const mrcs = HIERARCHY[r]?.[d];
      if (!mrcs) continue;
      const mrcKeys = mrc ? [mrc] : Object.keys(mrcs);
      for (const m of mrcKeys) {
        (mrcs[m] || []).forEach((a) => set.add(a));
      }
    }
  }

  const result = [...set].sort();
  return result.length > 0 ? result : [...AGENCES];
}
