// api/src/services/socadel-quick-register.service.js
'use strict';

const { query } = require('../config/database');
const {
  normalizePhone,
  isValidPhone237,
  normalizeIdentite,
  countPhoneOnItinerary,
  countContractsForPhone,
  getWhatsappPrimary,
  addSecondaryPhone,
  buildResponsableLabel,
  collectorFromUser
} = require('./socadel-collect.service');
const logger = require('../utils/logger');

const MAX_CONTRACTS_PER_PHONE = 10;

/**
 * Recherche par service_no OU meter_no
 * Retourne contrats groupés + registry + primary WhatsApp
 */
async function quickLookup(searchTerm) {
  const q = String(searchTerm || '').trim();
  if (!q || q.length < 3) {
    const err = new Error('Saisissez au moins 3 caractères (contrat ou compteur)');
    err.statusCode = 400;
    throw err;
  }

  const contacts = await query(
    `SELECT
       id, service_no, meter_no, noms, itineraires, desc_itin, ref_geo,
       numero_telephone, rapport, identite, check_status, check_date,
       statut, responsable, activated_at, api_status, api_date,
       region, division, agence, categorie, mrc,
       collected_by_type, collected_by_label, updated_at,
       gps_lat, gps_lng, gps_accuracy, gps_captured_at
     FROM socadel_contacts
     WHERE service_no = $1
        OR meter_no = $1
        OR service_no ILIKE $2
        OR meter_no ILIKE $2
     ORDER BY
       CASE WHEN service_no = $1 OR meter_no = $1 THEN 0 ELSE 1 END,
       updated_at DESC NULLS LAST
     LIMIT 30`,
    [q, `%${q}%`]
  );

  if (!contacts.rows.length) {
    return { found: false, contracts: [], total: 0, message: 'Aucun client trouvé' };
  }

  // Grouper par service_no
  const byContract = new Map();
  for (const row of contacts.rows) {
    const key = row.service_no || String(row.id);
    if (!byContract.has(key)) {
      byContract.set(key, {
        service_no: row.service_no,
        meter_no: row.meter_no,
        noms: row.noms,
        lines: [],
        anyChecked: false,
        allChecked: true
      });
    }
    const g = byContract.get(key);
    g.lines.push(row);
    if (row.check_status === 'OK') g.anyChecked = true;
    else g.allChecked = false;
  }

  const serviceNos = [...byContract.keys()].filter(
    (k) => k && !/^[0-9a-f-]{36}$/i.test(k)
  );

  const reg = serviceNos.length
    ? await query(
        `SELECT contract_number, phone, channel, statut, source, created_at
         FROM client_phone_registry
         WHERE contract_number = ANY($1::text[])
         ORDER BY
           CASE WHEN statut = 'valide' THEN 0 ELSE 1 END,
           created_at DESC`,
        [serviceNos]
      )
    : { rows: [] };

  const primary = serviceNos.length
    ? await query(
        `SELECT contract_number, whatsapp_phone, client_name, activated_at
         FROM whatsapp_valid_contacts
         WHERE contract_number = ANY($1::text[])`,
        [serviceNos]
      )
    : { rows: [] };

  const regByContract = new Map();
  for (const r of reg.rows) {
    if (!regByContract.has(r.contract_number)) regByContract.set(r.contract_number, []);
    regByContract.get(r.contract_number).push(r);
  }

  const primaryByContract = new Map();
  for (const p of primary.rows) {
    primaryByContract.set(p.contract_number, p);
  }

  const contracts = [];
  for (const [, g] of byContract) {
    const sn = g.service_no;
    const phones = [...(regByContract.get(sn) || [])];
    const prim = primaryByContract.get(sn) || null;

    if (!phones.length && prim?.whatsapp_phone) {
      phones.push({
        phone: prim.whatsapp_phone,
        channel: 'whatsapp',
        statut: 'valide',
        source: 'whatsapp_valid_contacts',
        created_at: prim.activated_at
      });
    }

    const editableLines = g.lines.filter((l) => l.check_status !== 'OK');

    contracts.push({
      service_no: sn,
      meter_no: g.meter_no,
      noms: g.noms || prim?.client_name || null,
      primary_whatsapp: prim?.whatsapp_phone || null,
      activated_at: prim?.activated_at || null,
      is_subscribed: !!prim,
      phones,
      has_valid_whatsapp: phones.some(
        (p) => p.channel === 'whatsapp' && p.statut === 'valide'
      ),
      all_checked: g.allChecked,
      any_checked: g.anyChecked,
      can_edit: editableLines.length > 0,
      already_checked: g.allChecked,
      lines: g.lines.map((l) => ({
        id: l.id,
        itineraires: l.itineraires,
        ref_geo: l.ref_geo,
        check_status: l.check_status,
        check_date: l.check_date,
        statut: l.statut,
        numero_telephone: l.numero_telephone,
        rapport: l.rapport,
        identite: l.identite,
        region: l.region,
        division: l.division,
        agence: l.agence,
        gps_lat: l.gps_lat,
        gps_lng: l.gps_lng,
        gps_accuracy: l.gps_accuracy,
        gps_captured_at: l.gps_captured_at
      })),
      editable_ids: editableLines.map((l) => l.id)
    });
  }

  const allChecked =
    contracts.length > 0 && contracts.every((c) => c.all_checked);

  return {
    found: true,
    contracts,
    total: contracts.length,
    all_checked: allChecked,
    message: null
  };
}

/**
 * Enregistrement rapide multi-contrats
 *
 * body:
 * {
 *   contracts: string[] | string,
 *   phone?: string,
 *   confirm_existing_whatsapp?: boolean,
 *   channel?: 'whatsapp' | 'sms',
 *   sms_only?: boolean,
 *   identite?: string,
 *   rapport?: 'MRA' | 'OK',
 *   gps_lat?: number,
 *   gps_lng?: number,
 *   gps_accuracy?: number,
 *   gps_captured_at?: string (ISO),
 *   offline_queued_at?: string (ISO)
 * }
 */
async function quickRegister(body, user) {
  const collector = collectorFromUser(user);

  if (
    !['releveur', 'agent_socadel'].includes(collector.type) &&
    user?.role !== 'socadel'
  ) {
    const err = new Error('Réservé aux releveurs et agents Socadel');
    err.statusCode = 403;
    throw err;
  }

  const {
    contracts: rawContracts,
    phone: rawPhone,
    confirm_existing_whatsapp = false,
    channel: rawChannel,
    sms_only = false,
    identite = 'proprietaire',
    rapport = 'MRA',
    // ── GPS ──
    gps_lat = null,
    gps_lng = null,
    gps_accuracy = null,
    gps_captured_at = null,
    offline_queued_at = null
  } = body || {};

  // ── Validation GPS (légère, ne bloque jamais la collecte) ──
  let lat = gps_lat != null ? Number(gps_lat) : null;
  let lng = gps_lng != null ? Number(gps_lng) : null;
  let acc = gps_accuracy != null ? Number(gps_accuracy) : null;

  if (lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90)) lat = null;
  if (lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180)) lng = null;
  if (acc != null && (Number.isNaN(acc) || acc < 0)) acc = null;

  // Date de capture GPS
  let gpsCapturedAt = null;
  if (gps_captured_at) {
    const d = new Date(gps_captured_at);
    if (!Number.isNaN(d.getTime())) gpsCapturedAt = d;
  } else if (lat != null && lng != null) {
    gpsCapturedAt = new Date();
  }

  // Trace éventuelle d'un envoi différé (pour logs uniquement)
  let offlineQueuedAt = null;
  if (offline_queued_at) {
    const d = new Date(offline_queued_at);
    if (!Number.isNaN(d.getTime())) offlineQueuedAt = d;
  }

  // Liste contrats
  let contractList = [];
  if (Array.isArray(rawContracts)) {
    contractList = rawContracts
      .map((c) => {
        if (c && typeof c === 'object' && c.service_no) return String(c.service_no).trim();
        return String(c).trim();
      })
      .filter(Boolean);
  } else if (typeof rawContracts === 'string') {
    contractList = rawContracts
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (!contractList.length) {
    const err = new Error('Au moins un numéro de contrat (service_no) est requis');
    err.statusCode = 400;
    throw err;
  }
  if (contractList.length > 10) {
    const err = new Error('Maximum 10 contrats par enregistrement');
    err.statusCode = 400;
    throw err;
  }

  const idt = normalizeIdentite(identite);
  const rap = String(rapport || 'MRA').toUpperCase() === 'OK' ? 'OK' : 'MRA';
  const channel =
    sms_only || String(rawChannel || '').toLowerCase() === 'sms'
      ? 'sms'
      : 'whatsapp';

  const rowsRes = await query(
    `SELECT * FROM socadel_contacts
     WHERE service_no = ANY($1::text[])
     ORDER BY service_no, updated_at DESC`,
    [contractList]
  );

  if (!rowsRes.rows.length) {
    const err = new Error('Aucun client trouvé pour ces contrats');
    err.statusCode = 404;
    throw err;
  }

  const byService = new Map();
  for (const row of rowsRes.rows) {
    if (!byService.has(row.service_no)) byService.set(row.service_no, []);
    byService.get(row.service_no).push(row);
  }

  const toProcess = [];
  const skippedChecked = [];

  for (const sn of contractList) {
    const list = byService.get(sn) || [];
    const open = list.filter((r) => r.check_status !== 'OK');
    if (!open.length) {
      if (list.length) skippedChecked.push(sn);
      else {
        const err = new Error(`Contrat introuvable: ${sn}`);
        err.statusCode = 404;
        throw err;
      }
      continue;
    }
    toProcess.push(...open);
  }

  if (!toProcess.length) {
    const err = new Error(
      'Tous les contrats sélectionnés sont déjà checkés. Modification interdite.'
    );
    err.statusCode = 409;
    err.code = 'ALREADY_CHECKED';
    throw err;
  }

  // Résolution téléphone
  let phone = null;
  let usedExisting = false;

  if (confirm_existing_whatsapp) {
    const primaries = [];
    for (const sn of [...new Set(toProcess.map((r) => r.service_no))]) {
      const p = await getWhatsappPrimary(sn);
      if (p?.whatsapp_phone) primaries.push(normalizePhone(p.whatsapp_phone));
    }
    const unique = [...new Set(primaries.filter(Boolean))];

    if (unique.length === 0) {
      const err = new Error(
        'Aucun numéro WhatsApp valide en base pour confirmer. Saisissez un nouveau numéro.'
      );
      err.statusCode = 400;
      throw err;
    }

    if (unique.length > 1) {
      if (!isValidPhone237(rawPhone)) {
        const err = new Error(
          'Les contrats ont des numéros WhatsApp différents. Saisissez le numéro à utiliser (+237...).'
        );
        err.statusCode = 400;
        throw err;
      }
      phone = normalizePhone(rawPhone);
    } else {
      phone = unique[0];
      usedExisting = true;
    }
  } else {
    if (!isValidPhone237(rawPhone)) {
      const err = new Error('Numéro obligatoire au format +237XXXXXXXXX');
      err.statusCode = 400;
      throw err;
    }
    phone = normalizePhone(rawPhone);
  }

  // Limite 10 contrats / numéro
  if (channel === 'whatsapp') {
    const nContracts = await countContractsForPhone(phone);
    const registryCount = await query(
      `SELECT COUNT(DISTINCT contract_number)::int AS n
       FROM client_phone_registry
       WHERE regexp_replace(phone, '[^0-9+]', '', 'g')
           = regexp_replace($1, '[^0-9+]', '', 'g')
         AND statut = 'valide'`,
      [phone]
    );
    const current = Math.max(nContracts, registryCount.rows[0]?.n || 0);
    if (current >= MAX_CONTRACTS_PER_PHONE) {
      const err = new Error(
        `Ce numéro est déjà lié au maximum de ${MAX_CONTRACTS_PER_PHONE} contrats.`
      );
      err.statusCode = 400;
      err.code = 'PHONE_LIMIT_10';
      throw err;
    }
  }

  // Limite 3 / itinéraire
  for (const row of toProcess) {
    if (row.itineraires) {
      const n = await countPhoneOnItinerary(row.itineraires, phone, row.id);
      if (n >= 3) {
        const err = new Error(
          `Numéro déjà utilisé 3 fois sur l'itinéraire ${row.itineraires}`
        );
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const updatedIds = [];
  const registryDone = new Set();

  for (const row of toProcess) {
    const primary = await getWhatsappPrimary(row.service_no);

    if (
      channel === 'whatsapp' &&
      primary &&
      normalizePhone(primary.whatsapp_phone) !== phone
    ) {
      await addSecondaryPhone({
        contractNumber: row.service_no,
        phone,
        source: 'quick_register',
        collectedByType: collector.type,
        collectedById: collector.id
      });
    }

    const responsable = buildResponsableLabel({
      checkStatus: 'OK',
      statut: row.statut,
      activatedAt: row.activated_at || primary?.activated_at,
      checkDate: new Date(),
      rapport: rap,
      numeroTelephone: phone,
      whatsappPhone: primary?.whatsapp_phone,
      collectedByType: collector.type,
      collectedByLabel: collector.label
    });

    // ── UPDATE avec GPS ──
    // Paramètres : $1 phone, $2 rap, $3 idt, $4 responsable,
    //              $5 collected_by_type, $6 collected_by_id, $7 collected_by_label,
    //              $8 lat, $9 lng, $10 acc, $11 gpsCapturedAt,
    //              $12 row.id
    const upd = await query(
      `UPDATE socadel_contacts
       SET numero_telephone = $1,
           rapport = $2,
           identite = $3,
           check_status = 'OK',
           check_date = NOW(),
           responsable = $4,
           collected_by_type = $5,
           collected_by_id = $6,
           collected_by_label = $7,
           gps_lat = COALESCE($8, gps_lat),
           gps_lng = COALESCE($9, gps_lng),
           gps_accuracy = COALESCE($10, gps_accuracy),
           gps_captured_at = COALESCE($11, gps_captured_at),
           updated_at = NOW()
       WHERE id = $12
         AND (check_status IS DISTINCT FROM 'OK')
       RETURNING id`,
      [
        phone,
        rap,
        idt,
        responsable,
        collector.type,
        collector.id,
        collector.label,
        lat,
        lng,
        acc,
        gpsCapturedAt,
        row.id
      ]
    );

    if (upd.rows.length) {
      updatedIds.push(row.id);
    }

    // Registry une fois par contrat
    if (!registryDone.has(row.service_no)) {
      await query(
        `INSERT INTO client_phone_registry
           (contract_number, phone, channel, statut, source, collected_by_type, collected_by_id)
         VALUES ($1, $2, $3, 'valide', 'quick_register', $4, $5)
         ON CONFLICT (contract_number, phone) DO UPDATE SET
           channel = EXCLUDED.channel,
           statut = 'valide',
           updated_at = NOW()`,
        [row.service_no, phone, channel, collector.type, collector.id]
      );
      registryDone.add(row.service_no);
    }
  }

  const servicesDone = [...registryDone];

  logger.info('[quick-register]', {
    collector: collector.type,
    phone,
    channel,
    usedExisting,
    services: servicesDone,
    updated: updatedIds.length,
    gps: lat != null && lng != null
      ? { lat, lng, acc, captured_at: gpsCapturedAt }
      : null,
    offline_queued_at: offlineQueuedAt
  });

  return {
    updated: updatedIds.length,
    ids: updatedIds,
    contracts: servicesDone,
    phone,
    channel,
    used_existing_whatsapp: usedExisting,
    skipped_checked: skippedChecked,
    send_invoice: channel === 'whatsapp' && servicesDone.length > 0,
    collector,
    gps_stored: lat != null && lng != null
  };
}

/**
 * Met à jour le numéro d'une ligne déjà checkée par LE MÊME collecteur.
 * body: { contact_id ou service_no, phone, confirm_whatsapp? }
 */
async function updateCheckedPhone(body, user) {
  const collector = collectorFromUser(user);
  const contactId = body.contact_id || body.id;
  const serviceNo = body.service_no || body.contract;
  const rawPhone = body.phone;

  if (!isValidPhone237(rawPhone)) {
    const err = new Error('Numéro invalide (+237XXXXXXXXX)');
    err.statusCode = 400;
    throw err;
  }
  const phone = normalizePhone(rawPhone);

  if (!contactId && !serviceNo) {
    const err = new Error('contact_id ou service_no requis');
    err.statusCode = 400;
    throw err;
  }

  const res = await query(
    `
    SELECT * FROM socadel_contacts
    WHERE check_status = 'OK'
      AND (
        ($1::uuid IS NOT NULL AND id = $1)
        OR ($2::text IS NOT NULL AND service_no = $2)
      )
    ORDER BY check_date DESC NULLS LAST
    LIMIT 5
    `,
    [contactId || null, serviceNo || null]
  );

  if (!res.rows.length) {
    const err = new Error('Ligne checkée introuvable');
    err.statusCode = 404;
    throw err;
  }

  // Uniquement les checks de cet utilisateur (ou admin)
  const owned = res.rows.filter(
    (r) =>
      user?.role === 'admin' ||
      (r.collected_by_type === collector.type &&
        String(r.collected_by_id) === String(collector.id))
  );

  if (!owned.length) {
    const err = new Error(
      'Vous ne pouvez modifier que les clients que vous avez vous-même checkés'
    );
    err.statusCode = 403;
    throw err;
  }

  const updated = [];
  for (const row of owned) {
    // Limite 3 / itinéraire avec le nouveau numéro
    if (row.itineraires) {
      const n = await countPhoneOnItinerary(row.itineraires, phone, row.id);
      if (n >= 3) {
        const err = new Error(
          `Numéro déjà utilisé 3 fois sur l'itinéraire ${row.itineraires}`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    await query(
      `UPDATE socadel_contacts
       SET numero_telephone = $1,
           updated_at = NOW()
       WHERE id = $2 AND check_status = 'OK'`,
      [phone, row.id]
    );

    await query(
      `INSERT INTO client_phone_registry
         (contract_number, phone, channel, statut, source, collected_by_type, collected_by_id)
       VALUES ($1, $2, 'whatsapp', 'valide', 'phone_update', $3, $4)
       ON CONFLICT (contract_number, phone) DO UPDATE SET
         statut = 'valide', channel = 'whatsapp', updated_at = NOW()`,
      [row.service_no, phone, collector.type, collector.id]
    );

    updated.push({ id: row.id, service_no: row.service_no });
  }

  // Relancer facture pour rattrapage abonnement
  const contracts = [...new Set(updated.map((u) => u.service_no))];
  setImmediate(() => {
    const { sendLastInvoicesForContracts } = require('./socadel-invoice-send.service');
    sendLastInvoicesForContracts({
      contracts,
      recipientPhone: phone,
      collector,
    }).catch((e) => logger.error('[phone-update] invoice', e.message));
  });

  return {
    updated: updated.length,
    contracts,
    phone,
    invoice_queued: true,
  };
}


module.exports = {
  quickLookup,
  quickRegister,
  MAX_CONTRACTS_PER_PHONE,
  updateCheckedPhone
};
