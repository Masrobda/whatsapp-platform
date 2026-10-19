// api/src/routes/v1/socadel.routes.js
'use strict';
const {
  normalizePhone,
  isValidPhone237,
  normalizeIdentite,
  countPhoneOnItinerary,
  getWhatsappPrimary,
  addSecondaryPhone,
  buildResponsableLabel,
  collectorFromUser
} = require('../../services/socadel-collect.service');
const {
  quickLookup,
  quickRegister,
  updateCheckedPhone
} = require('../../services/socadel-quick-register.service');
const { redis } = require('../../config/redis');

async function invalidateStatsCache() {
  try {
    await redis.del('socadel:stats');
    const keys = await redis.keys('socadel:stats:*');
    if (keys && keys.length) await redis.del(...keys);
  } catch (_) {}
}

const { query } = require('../../config/database');
const { generateBordereauPDF } = require('../../services/pdf.service');
const { enqueueSocadelSync } = require('../../queues/socadel.queue');
const liveService = require('../../services/socadel-live.service');

const CACHE_STATS_KEY = 'socadel:stats';
const CACHE_STATS_TTL = 60; // secondes


function computeResponsable({
  checkStatus,
  statut,
  activatedAt,
  checkDate,
  rapport,
  numeroTelephone,
  whatsappPhone
}) {
  if (checkStatus !== 'OK' || statut !== 'ABONNE') return 'AUTRES';
  if (!activatedAt || !checkDate) return 'AUTRES';
  if (String(rapport || '').toUpperCase() !== 'MRA') return 'AUTRES';

  const act = new Date(activatedAt).getTime();
  const chk = new Date(checkDate).getTime();
  if (Number.isNaN(act) || Number.isNaN(chk) || act < chk) return 'AUTRES';

  const entered = normalizePhone(numeroTelephone);
  if (!entered) return 'AUTRES';
  if (whatsappPhone) {
    if (entered !== normalizePhone(whatsappPhone)) return 'AUTRES';
  }
  return 'TERRAIN';
}

async function getRedis(fastify) {
  return fastify.redis || null;
}

async function invalidateStatsCache(fastify) {
  try {
    const redis = await getRedis(fastify);
    if (redis) await redis.del(CACHE_STATS_KEY);
  } catch (_) {}
}

async function socadelRoutes(fastify) {
  const auth = { preHandler: [fastify.authenticateJWT] };
 // ── Auth REPORTING live (lecture seule) ──
  const authReporting = {
    preHandler: [
      fastify.authenticateJWT,
      async (request, reply) => {
        const role = request.user?.role;
        const allowed = ['socadel_reporting', 'admin', 'responsable_financier'];
        if (!role || !allowed.includes(role)) {
          return reply.code(403).send({
            success: false,
            code: 'REPORTING_ONLY',
            message: 'Accès réservé au suivi / reporting'
          });
        }
      }
    ]
  };

  // ── GET /itineraries (optionnel admin) ──
  fastify.get('/itineraries', auth, async (request, reply) => {
    const result = await query(`
      SELECT DISTINCT itineraires
      FROM socadel_contacts
      WHERE itineraires IS NOT NULL AND itineraires <> ''
      ORDER BY itineraires
      LIMIT 5000
    `);
    return reply.send({
      success: true,
      data: result.rows.map((r) => r.itineraires)
    });
  });

  // GET /quick-lookup?q=...
fastify.get('/quick-lookup', auth, async (request, reply) => {
  try {
    const q =
      request.query?.q ||
      request.query?.service_no ||
      request.query?.meter_no;
    if (!q) {
      return reply.code(400).send({
        success: false,
        message: 'Paramètre q (contrat ou compteur) requis'
      });
    }
    const data = await quickLookup(q);
    if (data.all_checked) {
      return reply.code(409).send({
        success: false,
        code: 'ALREADY_CHECKED',
        message: 'Tous les clients trouvés sont déjà checkés. Modification interdite.',
        data
      });
    }
    return reply.send({ success: true, ...data });
  } catch (err) {
    return reply.code(err.statusCode || 500).send({
      success: false,
      message: err.message || 'Erreur lookup'
    });
  }
});

// POST /quick-register
   fastify.post('/quick-register', auth, async (request, reply) => {
    try {
      const result = await quickRegister(request.body || {}, request.user);

      try {
        await invalidateStatsCache(fastify);
      } catch (_) {
        try {
          await invalidateStatsCache();
        } catch (__) {}
      }

      // ── Étape 3 : facture auto (async, ne bloque pas la réponse) ──
      if (result.send_invoice && result.phone && result.contracts?.length) {
        setImmediate(() => {
          try {
            const {
              sendLastInvoicesForContracts
            } = require('../../services/socadel-invoice-send.service');

            sendLastInvoicesForContracts({
              contracts: result.contracts,
              recipientPhone: result.phone,
              collector: result.collector
            })
              .then((stats) => {
                request.log?.info?.(
                  { stats },
                  '[quick-register] factures post-collecte'
                ) ||
                  console.log('[quick-register] factures post-collecte', stats);
              })
              .catch((err) => {
                request.log?.error?.(err) ||
                  console.error('[quick-register] facture error:', err.message);
              });
          } catch (err) {
            console.error('[quick-register] require invoice-send:', err.message);
          }
        });
      }

      return reply.send({
        success: true,
        message: result.used_existing_whatsapp
          ? 'Enregistrement OK — numéro WhatsApp existant confirmé. Facture en cours d’envoi.'
          : result.send_invoice
            ? 'Enregistrement OK. Facture en cours d’envoi.'
            : 'Enregistrement OK',
        data: {
          ...result,
          invoice_queued: !!(result.send_invoice && result.phone)
        }
      });
    } catch (err) {
      return reply.code(err.statusCode || 500).send({
        success: false,
        code: err.code || undefined,
        message: err.message || 'Erreur enregistrement'
      });
    }
  });


    // GET /by-service?service_no=201345890
  fastify.get('/by-service', auth, async (request, reply) => {
    const { service_no } = request.query;
    if (!service_no) {
      return reply.code(400).send({ success: false, message: 'service_no requis' });
    }

    const result = await query(
      `SELECT
         id, itineraires, desc_itin, ref_geo, meter_no, noms, service_no,
         numero_telephone, rapport, identite, api_status, api_date, activated_at,
         statut, responsable, check_status, check_date,
         region, division, agence, categorie, mrc,
         collected_by_type, collected_by_label
       FROM socadel_contacts
       WHERE service_no = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [String(service_no).trim()]
    );

    return reply.send({ success: true, data: result.rows });
  });

    // PUT /collect-by-service  — agents Socadel
  fastify.put('/collect-by-service', auth, async (request, reply) => {
    const user = request.user;
    if (user?.role !== 'agent_socadel') {
      return reply.code(403).send({
        success: false,
        message: 'Réservé aux agents Socadel'
      });
    }

    const {
      service_no,
      numero_telephone,
      identite = 'proprietaire',
      rapport = 'MRA'
    } = request.body || {};

    if (!service_no) {
      return reply.code(400).send({ success: false, message: 'service_no requis' });
    }
    if (!isValidPhone237(numero_telephone)) {
      return reply.code(400).send({
        success: false,
        message: 'Numéro obligatoire au format +237XXXXXXXXX'
      });
    }

    const phone = normalizePhone(numero_telephone);
    const idt = normalizeIdentite(identite);
    const rap = String(rapport || 'MRA').toUpperCase() === 'OK' ? 'OK' : 'MRA';
    const collector = collectorFromUser(user);

    const contacts = await query(
      `SELECT * FROM socadel_contacts WHERE service_no = $1 AND (check_status IS DISTINCT FROM 'OK') ORDER BY updated_at DESC`,
      [String(service_no).trim()]
    );

    if (!contacts.rows.length) {
  // Soit inexistant, soit déjà tous checkés
  const any = await query(
    `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked
     FROM socadel_contacts WHERE service_no = $1`,
    [String(service_no).trim()]
  );
  if ((any.rows[0]?.n || 0) === 0) {
    return reply.code(404).send({ success: false, message: 'Aucun client pour ce contrat' });
  }
  return reply.code(409).send({
    success: false,
    code: 'ALREADY_CHECKED',
    message: 'Ce client a déjà été checké. Modification interdite.'
  });
}


    // Limite 10 / itinéraire si l'itinéraire est connu (sur chaque ligne)
    for (const row of contacts.rows) {
      if (row.itineraires) {
        const n = await countPhoneOnItinerary(row.itineraires, phone, row.id);
        if (n >= 10) {
          return reply.code(400).send({
            success: false,
            message: `Numéro déjà utilisé 10 fois sur l'itinéraire ${row.itineraires}`
          });
        }
      }
    }

    const primary = await getWhatsappPrimary(String(service_no).trim());
    if (primary && normalizePhone(primary.whatsapp_phone) !== phone) {
      await addSecondaryPhone({
        contractNumber: String(service_no).trim(),
        phone,
        source: 'collecte',
        collectedByType: 'agent_socadel',
        collectedById: collector.id
      });
    }

    const updatedIds = [];
    for (const row of contacts.rows) {
      const responsable = buildResponsableLabel({
        checkStatus: 'OK',
        statut: row.statut,
        activatedAt: row.activated_at || primary?.activated_at,
        checkDate: new Date(),
        rapport: rap,
        numeroTelephone: phone,
        whatsappPhone: primary?.whatsapp_phone,
        collectedByType: 'agent_socadel',
        collectedByLabel: collector.label
      });

      await query(
        `UPDATE socadel_contacts
         SET numero_telephone = $1,
             rapport = $2,
             identite = $3,
             check_status = 'OK',
             check_date = NOW(),
             responsable = $4,
             collected_by_type = 'agent_socadel',
             collected_by_id = $5,
             collected_by_label = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [phone, rap, idt, responsable, collector.id, collector.label, row.id]
      );
      updatedIds.push(row.id);
    }

    await invalidateStatsCache();

    return reply.send({
      success: true,
      updated: updatedIds.length,
      ids: updatedIds,
      data: {
        service_no: String(service_no).trim(),
        numero_telephone: phone,
        check_status: 'OK',
        identite: idt,
        rapport: rap,
        collected_by_label: collector.label
      }
    });
  });

  // ── GET /data ──
  fastify.get('/data', auth, async (request, reply) => {
    const {
      itineraires,
      meter_no,
      service_no,
      page = 1,
      limit: rawLimit = 50
    } = request.query;

    if (!itineraires) {
      return reply.code(400).send({ success: false, message: 'Paramètre itineraires requis' });
    }

    const list = String(itineraires)
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean);

    if (list.length === 0) {
      return reply.code(400).send({ success: false, message: 'Aucun itinéraire valide' });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 50, 1), 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limit;

    const params = [list];
    let where = `WHERE itineraires = ANY($1::text[])`;

    if (meter_no) {
      params.push(`%${meter_no}%`);
      where += ` AND meter_no ILIKE $${params.length}`;
    }
    if (service_no) {
      params.push(`%${service_no}%`);
      where += ` AND service_no ILIKE $${params.length}`;
    }

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM socadel_contacts ${where}`,
      params
    );
    const total = countRes.rows[0].total;

    const dataRes = await query(
    `SELECT
         id,
         itineraires,
         desc_itin,
         ref_geo,
         meter_no,
         noms,
         service_no,
         numero_telephone,
         rapport,
         identite,
         api_status,
         api_date,
         activated_at,
         statut,
         responsable,
         check_status,
         check_date,
         region, division, agence, categorie, mrc,
         collected_by_type, collected_by_label,
         created_at, updated_at
       FROM socadel_contacts
       ${where}
       ORDER BY itineraires, ref_geo
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return reply.send({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page: pageNum,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  });

    // GET /itinerary-desc?itineraires=125370,125369
  fastify.get('/itinerary-desc', auth, async (request, reply) => {
    const { itineraires } = request.query;
    if (!itineraires) {
      return reply.code(400).send({ success: false, message: 'itineraires requis' });
    }
    const list = String(itineraires).split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length) {
      return reply.code(400).send({ success: false, message: 'Aucun itinéraire valide' });
    }

    const result = await query(
      `SELECT itineraires, desc_itin
       FROM socadel_itinerary_desc
       WHERE itineraires = ANY($1::text[])
       ORDER BY itineraires`,
      [list]
    );

    // Fallback : distinct depuis contacts si pas dans la table lookup
    if (result.rows.length < list.length) {
      const found = new Set(result.rows.map((r) => r.itineraires));
      const missing = list.filter((i) => !found.has(i));
      if (missing.length) {
        const fb = await query(
          `SELECT DISTINCT ON (itineraires) itineraires, desc_itin
           FROM socadel_contacts
           WHERE itineraires = ANY($1::text[])
             AND desc_itin IS NOT NULL AND desc_itin <> ''
           ORDER BY itineraires, updated_at DESC NULLS LAST`,
          [missing]
        );
        result.rows.push(...fb.rows);
      }
    }

    return reply.send({ success: true, data: result.rows });
  });

  // ── PUT /update-check ──

  // ── PUT /update-check ──
fastify.put('/update-check', auth, async (request, reply) => {
  const { id, check_status } = request.body || {};
  if (!id) return reply.code(400).send({ success: false, message: 'id requis' });

  const current = await query(
    `SELECT statut, activated_at, check_date, rapport, numero_telephone, service_no, check_status
     FROM socadel_contacts WHERE id = $1`,
    [id]
  );
  if (current.rows.length === 0) {
    return reply.code(404).send({ success: false, message: 'Contact introuvable' });
  }

  const row = current.rows[0];

  // Blocage si déjà checké (même pour un uncheck)
  if (row.check_status === 'OK') {
    return reply.code(409).send({
      success: false,
      code: 'ALREADY_CHECKED',
      message: 'Ce client a déjà été checké. Aucune modification n’est autorisée.'
    });
  }

  const isOk = check_status === 'OK';
  const newCheckDate = isOk ? new Date() : null;

  let whatsappPhone = null;
  if (row.service_no) {
    const valid = await query(
      `SELECT whatsapp_phone FROM whatsapp_valid_contacts WHERE contract_number = $1 LIMIT 1`,
      [row.service_no]
    );
    if (valid.rows[0]) whatsappPhone = valid.rows[0].whatsapp_phone;
  }

  const responsable = computeResponsable({
    checkStatus: isOk ? 'OK' : null,
    statut: row.statut || 'NON ABONNE',
    activatedAt: row.activated_at,
    checkDate: newCheckDate || row.check_date,
    rapport: row.rapport || 'OK',
    numeroTelephone: row.numero_telephone,
    whatsappPhone
  });

  await query(
    `UPDATE socadel_contacts
     SET check_status = $1,
         check_date   = CASE WHEN $1 = 'OK' THEN NOW() ELSE NULL END,
         responsable  = $2,
         updated_at   = NOW()
     WHERE id = $3`,
    [isOk ? 'OK' : null, responsable, id]
  );

  await invalidateStatsCache(fastify);

  return reply.send({
    success: true,
    data: {
      check_status: isOk ? 'OK' : null,
      check_date: isOk ? new Date().toISOString() : null,
      responsable
    }
  });
});

  // ── PUT /update-rapport ──
  // ── PUT /update-rapport ──
fastify.put('/update-rapport', auth, async (request, reply) => {
  const { id, rapport, numero_telephone } = request.body || {};
  if (!id) return reply.code(400).send({ success: false, message: 'id requis' });

  const r = String(rapport || 'OK').toUpperCase();
  if (r !== 'OK' && r !== 'MRA') {
    return reply.code(400).send({ success: false, message: 'rapport doit être OK ou MRA' });
  }

  const current = await query(`SELECT * FROM socadel_contacts WHERE id = $1`, [id]);
  if (!current.rows.length) {
    return reply.code(404).send({ success: false, message: 'Contact introuvable' });
  }

  const row = current.rows[0];

  // Blocage si déjà checké
  if (row.check_status === 'OK') {
    return reply.code(409).send({
      success: false,
      code: 'ALREADY_CHECKED',
      message: 'Ce client a déjà été checké. Aucune modification n’est autorisée.'
    });
  }

  const collector = collectorFromUser(request.user);

  let phone = row.numero_telephone;
  if (r === 'MRA') {
    if (!isValidPhone237(numero_telephone)) {
      return reply.code(400).send({
        success: false,
        message: 'Pour MRA, numéro obligatoire au format +237XXXXXXXXX'
      });
    }
    phone = normalizePhone(numero_telephone);

    if (row.itineraires) {
      const n = await countPhoneOnItinerary(row.itineraires, phone, id);
      if (n >= 10) {
        return reply.code(400).send({
          success: false,
          message: 'Ce numéro est déjà utilisé sur 10 clients de cet itinéraire (maximum autorisé).'
        });
      }
    }

    const primary = await getWhatsappPrimary(row.service_no);
    if (primary && normalizePhone(primary.whatsapp_phone) !== phone) {
      await addSecondaryPhone({
        contractNumber: row.service_no,
        phone,
        source: 'collecte',
        collectedByType: collector.type,
        collectedById: collector.id
      });
    }
  }

  const primary = await getWhatsappPrimary(row.service_no);
  const responsable = buildResponsableLabel({
    checkStatus: row.check_status,
    statut: row.statut,
    activatedAt: row.activated_at || primary?.activated_at,
    checkDate: row.check_date,
    rapport: r,
    numeroTelephone: phone,
    whatsappPhone: primary?.whatsapp_phone,
    collectedByType: collector.type,
    collectedByLabel: collector.label
  });

  await query(
    `UPDATE socadel_contacts
     SET rapport = $1,
         numero_telephone = CASE WHEN $1 = 'MRA' THEN $2 ELSE numero_telephone END,
         responsable = $3,
         collected_by_type = COALESCE($4, collected_by_type),
         collected_by_id = COALESCE($5, collected_by_id),
         collected_by_label = COALESCE($6, collected_by_label),
         updated_at = NOW()
     WHERE id = $7`,
    [
      r,
      phone,
      responsable,
      collector.type,
      collector.id,
      collector.label,
      id
    ]
  );

  await invalidateStatsCache(fastify);

  return reply.send({
    success: true,
    data: {
      rapport: r,
      numero_telephone: r === 'MRA' ? phone : row.numero_telephone,
      responsable
    }
  });
});


  // ── PUT /update-identite ──
fastify.put('/update-identite', auth, async (request, reply) => {
  const { id, identite } = request.body || {};
  if (!id) return reply.code(400).send({ success: false, message: 'id requis' });

  const val = String(identite || 'proprietaire').toLowerCase();
  const allowed = ['proprietaire', 'relation', 'locataire', 'bailleur'];
  if (!allowed.includes(val)) {
    return reply.code(400).send({
      success: false,
      message: 'identite doit être : proprietaire, relation, locataire ou bailleur'
    });
  }

  const current = await query(`SELECT check_status FROM socadel_contacts WHERE id = $1`, [id]);
  if (!current.rows.length) {
    return reply.code(404).send({ success: false, message: 'Contact introuvable' });
  }

  const row = current.rows[0];
  if (row.check_status === 'OK') {
    return reply.code(409).send({
      success: false,
      code: 'ALREADY_CHECKED',
      message: 'Client déjà checké — modification impossible.'
    });
  }

  const result = await query(
    `UPDATE socadel_contacts SET identite = $1, updated_at = NOW()
     WHERE id = $2 RETURNING identite`,
    [val, id]
  );

  return reply.send({ success: true, data: { identite: result.rows[0].identite } });
});

  // ── PUT /check-itinerary ──
  fastify.put('/check-itinerary', auth, async (request, reply) => {
    const { itineraires, check_status } = request.body || {};
    if (!itineraires) {
      return reply.code(400).send({ success: false, message: 'itineraires requis' });
    }

    const list = Array.isArray(itineraires)
      ? itineraires.map((i) => String(i).trim()).filter(Boolean)
      : String(itineraires).split(/[,;\s]+/).map((i) => i.trim()).filter(Boolean);

    if (list.length === 0) {
      return reply.code(400).send({ success: false, message: 'Aucun itinéraire valide' });
    }

    const isOk = check_status === 'OK';

    const result = await query(
      `UPDATE socadel_contacts sc
       SET
         check_status = $1,
         check_date   = CASE WHEN $1 = 'OK' THEN NOW() ELSE NULL END,
         responsable  = CASE
           WHEN $1 = 'OK'
            AND sc.statut = 'ABONNE'
            AND sc.activated_at IS NOT NULL
            AND sc.activated_at >= NOW()
            AND UPPER(COALESCE(sc.rapport, 'OK')) = 'MRA'
            AND sc.numero_telephone IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM whatsapp_valid_contacts w
              WHERE w.contract_number = sc.service_no
                AND regexp_replace(w.whatsapp_phone, '[^0-9+]', '', 'g')
                  = regexp_replace(sc.numero_telephone, '[^0-9+]', '', 'g')
            )
           THEN 'TERRAIN'
           ELSE 'AUTRES'
         END,
         updated_at = NOW()
       WHERE itineraires = ANY($2::text[])
       AND (check_status IS DISTINCT FROM 'OK') 
      RETURNING id`,
      [isOk ? 'OK' : null, list]
    );

    await invalidateStatsCache(fastify);

    return reply.send({
      success: true,
      updated: result.rowCount,
      check_status: isOk ? 'OK' : null
    });
  });

  // ── POST /sync → file BullMQ (non bloquant) ──
  fastify.post('/sync', auth, async (request, reply) => {
    try {
      const jobId = await enqueueSocadelSync({
        requestedBy: request.user?.username || 'agent'
      });
      return reply.send({
        success: true,
        queued: true,
        jobId,
        message: 'Synchronisation en file d’attente'
      });
    } catch (err) {
      request.log?.error?.(err) || console.error('[socadel/sync]', err);
      return reply.code(500).send({ success: false, message: 'Impossible d’enfiler la sync' });
    }
  });

  // ── GET /export-pdf ──
  fastify.get('/export-pdf', auth, async (request, reply) => {
    const { itineraires } = request.query;
    if (!itineraires) {
      return reply.code(400).send({ success: false, message: 'itineraires requis' });
    }
    const list = String(itineraires).split(',').map((i) => i.trim()).filter(Boolean);
    if (list.length === 0) {
      return reply.code(400).send({ success: false, message: 'Aucun itinéraire valide' });
    }

    try {
      const result = await query(
        `SELECT * FROM socadel_contacts
         WHERE itineraires = ANY($1::text[])
         ORDER BY itineraires, service_no`,
        [list]
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'Aucune donnée pour les itinéraires sélectionnés'
        });
      }
      if (result.rows.length > 15000) {
        return reply.code(413).send({
          success: false,
          message: 'Trop de lignes pour un export PDF unique (max 15000). Filtrez les itinéraires.'
        });
      }

      const pdfBuffer = await generateBordereauPDF(result.rows, list);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="bordereau_socadel_${Date.now()}.pdf"`)
        .send(pdfBuffer);
    } catch (err) {
      request.log?.error?.(err) || console.error('[socadel/export-pdf]', err);
      return reply.code(500).send({ success: false, message: 'Erreur génération PDF' });
    }
  });

  // ── GET /export-csv ──
  fastify.get('/export-csv', auth, async (request, reply) => {
    const { itineraires, meter_no, service_no } = request.query;
    if (!itineraires) {
      return reply.code(400).send({ success: false, message: 'itineraires requis' });
    }
    const list = String(itineraires).split(',').map((i) => i.trim()).filter(Boolean);
    if (list.length === 0) {
      return reply.code(400).send({ success: false, message: 'Aucun itinéraire valide' });
    }

    const params = [list];
    let where = `WHERE itineraires = ANY($1::text[])`;
    if (meter_no) {
      params.push(`%${meter_no}%`);
      where += ` AND meter_no ILIKE $${params.length}`;
    }
    if (service_no) {
      params.push(`%${service_no}%`);
      where += ` AND service_no ILIKE $${params.length}`;
    }

    try {
      const result = await query(
        `SELECT
           region, division, agence, service_no, noms, categorie, mrc,
           ref_geo, itineraires, meter_no, numero_telephone, identite, rapport,
           check_status, check_date, api_status, api_date,
           statut, responsable, activated_at
         FROM socadel_contacts
         ${where}
         ORDER BY itineraires, ref_geo
         LIMIT 50000`,
        params
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'Aucune donnée pour les itinéraires sélectionnés'
        });
      }

      const headers = [
        'REGION', 'DIVISION', 'AGENCE', 'SERVICE_NO', 'NOMS', 'CATEGORIE', 'MRC',
        'REF_GEO', 'ITINERAIRE', 'METER_NO', 'NUMERO_TELEPHONE', 'IDENTITE', 'RAPPORT',
        'CHECK', 'CHECK_DATE', 'API', 'API_DATE', 'STATUT', 'RESPONSABLE', 'DATE_ABONNEMENT'
      ];

      const escapeCsv = (val) => {
        if (val == null || val === '') return '';
        const s = String(val);
        if (/^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s))) {
          return `"${new Date(s).toLocaleString('fr-FR').replace(/"/g, '""')}"`;
        }
        if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };

      const lines = [headers.join(';')];
      for (const row of result.rows) {
        lines.push(
          [
            row.region, row.division, row.agence, row.service_no, row.noms, row.categorie, row.mrc,
            row.ref_geo, row.itineraires, row.meter_no, row.numero_telephone, row.identite, row.rapport,
            row.check_status, row.check_date, row.api_status, row.api_date,
            row.statut, row.responsable, row.activated_at
          ].map(escapeCsv).join(';')
        );
      }

      const csv = '\uFEFF' + lines.join('\r\n');
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="export_socadel_${Date.now()}.csv"`)
        .send(csv);
    } catch (err) {
      request.log?.error?.(err) || console.error('[socadel/export-csv]', err);
      return reply.code(500).send({ success: false, message: 'Erreur génération CSV' });
    }
  });

  // GET /progress?itineraires=125370,125369
fastify.get('/progress', auth, async (request, reply) => {
  const { itineraires } = request.query;
  if (!itineraires) {
    return reply.code(400).send({ success: false, message: 'itineraires requis' });
  }

  const list = String(itineraires)
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  if (list.length === 0) {
    return reply.code(400).send({ success: false, message: 'Aucun itinéraire valide' });
  }

  const result = await query(
    `SELECT
       itineraires,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
       COUNT(*) FILTER (WHERE check_status IS NULL OR check_status <> 'OK')::int AS remaining,
       COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
       COUNT(*) FILTER (WHERE UPPER(COALESCE(rapport, 'OK')) = 'MRA')::int AS mra
     FROM socadel_contacts
     WHERE itineraires = ANY($1::text[])
     GROUP BY itineraires
     ORDER BY itineraires`,
    [list]
  );

  const rows = result.rows.map((r) => ({
    ...r,
    percent: r.total > 0 ? Math.round((r.checked / r.total) * 1000) / 10 : 0
  }));

  const global = rows.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.checked += r.checked;
      acc.remaining += r.remaining;
      return acc;
    },
    { total: 0, checked: 0, remaining: 0 }
  );
  global.percent =
    global.total > 0 ? Math.round((global.checked / global.total) * 1000) / 10 : 0;

  return reply.send({ success: true, byItinerary: rows, global });
});

  // ── GET /stats (cache Redis 60s) ──
  fastify.get('/stats', auth, async (request, reply) => {
    const q = request.query || {};
    const filters = {
      itineraires: q.itineraires ? String(q.itineraires).trim() : '',
      matricule: q.matricule ? String(q.matricule).trim() : '',
      // Nouveau : téléphone releveur (ou tout non-agent)
      phone: q.phone ? String(q.phone).trim() : '',
      region: q.region ? String(q.region).trim() : '',
      division: q.division ? String(q.division).trim() : '',
      agence: q.agence ? String(q.agence).trim() : '',
      categorie: q.categorie ? String(q.categorie).trim() : '',
      mrc: q.mrc ? String(q.mrc).trim() : ''
    };

    const cacheKey =
      'socadel:stats:v12:' +
      Buffer.from(JSON.stringify(filters)).toString('base64url').slice(0, 160);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return reply.send(JSON.parse(cached));
    } catch (_) {}

    const params = [];
    const where = ['1=1'];

    if (filters.itineraires) {
      const list = filters.itineraires.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        params.push(list);
        where.push(`itineraires = ANY($${params.length}::text[])`);
      }
    }

    // Agents Socadel — matricule
    if (filters.matricule) {
      params.push(filters.matricule);
      const i = params.length;
      where.push(
        `(collected_by_type = 'agent_socadel' AND (collected_by_label = $${i} OR collected_by_label = 'AGENT ' || $${i}))`
      );
    }

    // Releveurs / partenaires — téléphone
    if (filters.phone) {
      const digits = filters.phone.replace(/\D/g, '');
      const variants = [
        filters.phone,
        digits.startsWith('237') ? `+${digits}` : null,
        digits.length === 9 ? `+237${digits}` : null,
        digits.length >= 9 ? digits.slice(-9) : null,
      ].filter(Boolean);

      // ── Pré-résolution des IDs releveurs (avec cache Redis 60s) ──
      const cacheKey = `socadel:releveurs:byphone:${digits}`;
      let releveurIds = [];
      let releveurNames = [];

      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          releveurIds = parsed.ids || [];
          releveurNames = parsed.names || [];
        }
      } catch (_) {}

      if (releveurIds.length === 0 && releveurNames.length === 0) {
        const r = await query(
          `SELECT id, full_name, phone
           FROM socadel_releveurs
           WHERE phone = ANY($1::text[])
              OR regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')
                 LIKE '%' || $2 || '%'`,
          [variants, digits]
        );
        releveurIds = r.rows.map((x) => x.id);
        releveurNames = r.rows.map((x) => x.full_name).filter(Boolean);
        // Le téléphone peut aussi être stocké directement dans collected_by_label
        releveurNames.push(filters.phone);

        try {
          await redis.set(
            cacheKey,
            JSON.stringify({ ids: releveurIds, names: releveurNames }),
            'EX',
            60
          );
        } catch (_) {}
      }

      // ── Filtre : utilise les index (label + id) ──
      params.push(releveurNames);
      const iNames = params.length;

      params.push(releveurIds);
      const iIds = params.length;

      where.push(`(
        COALESCE(collected_by_type, '') <> 'agent_socadel'
        AND (
          collected_by_label = ANY($${iNames}::text[])
          OR collected_by_id = ANY($${iIds}::uuid[])
        )
      )`);
    }

    if (filters.region) {
      params.push(filters.region);
      where.push(`region = $${params.length}`);
    }
    if (filters.division) {
      params.push(filters.division);
      where.push(`division = $${params.length}`);
    }
    if (filters.agence) {
      params.push(filters.agence);
      where.push(`agence = $${params.length}`);
    }
    if (filters.categorie) {
      params.push(filters.categorie);
      where.push(`categorie = $${params.length}`);
    }
    if (filters.mrc) {
      params.push(filters.mrc);
      where.push(`mrc = $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const [global, byRegion, byDivision, byAgence, byMrc, byItinerary, byAgent, byReleveur, byDay, nonAbonneSplit] =
      await Promise.all([
        query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE numero_telephone IS NOT NULL AND numero_telephone <> '')::int AS with_phone,
             COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
             COUNT(*) FILTER (WHERE statut = 'NON ABONNE')::int AS non_abonne,
             COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
             COUNT(*) FILTER (WHERE check_status = 'OK' AND statut = 'NON ABONNE')::int AS checked_non_abonne,
                          COUNT(*) FILTER (
               WHERE check_status = 'OK' AND statut = 'NON ABONNE'
                 AND UPPER(COALESCE(rapport, 'MRA')) = 'OK'
             )::int AS non_abonne_sms,

             COUNT(*) FILTER (
               WHERE check_status = 'OK' AND statut = 'NON ABONNE'
                 AND UPPER(COALESCE(rapport, 'MRA')) = 'MRA'
             )::int AS non_abonne_whatsapp,
             COUNT(*) FILTER (WHERE api_status = 'OK')::int AS api_ok,
             COUNT(*) FILTER (WHERE api_status = 'NOK')::int AS api_nok,
             COUNT(*) FILTER (WHERE responsable = 'TERRAIN')::int AS terrain,
             COUNT(*) FILTER (WHERE collected_by_type = 'agent_socadel')::int AS by_agent,
             COUNT(*) FILTER (WHERE collected_by_type = 'releveur')::int AS by_releveur,
             COUNT(*) FILTER (WHERE UPPER(COALESCE(rapport,'OK')) = 'MRA')::int AS mra
           FROM socadel_contacts
           WHERE ${whereSql}`,
          params
        ),
        query(
          `SELECT region,
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
                  COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked
           FROM socadel_contacts
           WHERE ${whereSql} AND region IS NOT NULL AND region <> ''
           GROUP BY region
           ORDER BY total DESC
           LIMIT 5`,
          params
        ),
        query(
          `SELECT division,
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
                  COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked
           FROM socadel_contacts
           WHERE ${whereSql} AND division IS NOT NULL AND division <> ''
           GROUP BY division
           ORDER BY total DESC
           LIMIT 10`,
          params
        ),
        query(
          `SELECT agence,
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
                  COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked
           FROM socadel_contacts
           WHERE ${whereSql} AND agence IS NOT NULL AND agence <> ''
           GROUP BY agence
           ORDER BY total DESC
           LIMIT 10`,
          params
        ),
        query(
          `SELECT mrc,
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
                  COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked
           FROM socadel_contacts
           WHERE ${whereSql} AND mrc IS NOT NULL AND mrc <> ''
           GROUP BY mrc
           ORDER BY total DESC
           LIMIT 10`,
          params
        ),
        query(
          `SELECT itineraires,
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
                  COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked
           FROM socadel_contacts
           WHERE ${whereSql} AND itineraires IS NOT NULL AND itineraires <> ''
           GROUP BY itineraires
           ORDER BY checked DESC, total DESC
           LIMIT 10`,
          params
        ),
        query(
          `SELECT COALESCE(collected_by_label, '—') AS agent,
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
                  COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne
           FROM socadel_contacts
           WHERE ${whereSql}
             AND collected_by_type = 'agent_socadel'
             AND collected_by_label IS NOT NULL
           GROUP BY collected_by_label
           ORDER BY checked DESC, total DESC
           LIMIT 10`,
          params
        ),
        // Top releveurs (même logique que top agents)
        query(
          `SELECT
             COALESCE(collected_by_label, '—') AS releveur,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
             COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne
           FROM socadel_contacts
           WHERE ${whereSql}
             AND collected_by_type = 'releveur'
             AND collected_by_label IS NOT NULL
           GROUP BY collected_by_label
           ORDER BY checked DESC, total DESC
           LIMIT 10`,
          params
        ),
        query(
          `SELECT DATE(COALESCE(check_date, api_date, updated_at)) AS jour,
                  COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
                  COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne,
                  COUNT(*) FILTER (WHERE collected_by_type = 'agent_socadel')::int AS by_agent,
                  COUNT(*) FILTER (WHERE collected_by_type = 'releveur')::int AS by_releveur
           FROM socadel_contacts
           WHERE ${whereSql}
             AND COALESCE(check_date, api_date, updated_at) >= NOW() - INTERVAL '30 days'
           GROUP BY jour
           ORDER BY jour`,
          params
        ),
               query(
          `WITH fc AS (
             SELECT service_no, UPPER(COALESCE(rapport, 'MRA')) AS rap
             FROM socadel_contacts
             WHERE ${whereSql}
               AND check_status = 'OK'
               AND statut = 'NON ABONNE'
           ),
           inv AS (
             SELECT
               contract_number,
               BOOL_OR(status = 'sent')    AS has_sent,
               BOOL_OR(status = 'pending') AS has_pending,
               BOOL_OR(status = 'failed')  AS has_failed
             FROM socadel_invoice_pending
             WHERE status IN ('sent', 'pending', 'failed')
             GROUP BY contract_number
           )
           SELECT
             COUNT(*) FILTER (WHERE fc.rap = 'MRA')::int                                      AS non_abonne_total,
             COUNT(*) FILTER (WHERE fc.rap = 'MRA' AND inv.has_sent)::int                     AS non_abonne_sent,
             COUNT(*) FILTER (WHERE fc.rap = 'MRA' AND inv.has_pending)::int                  AS non_abonne_pending,
             COUNT(*) FILTER (WHERE fc.rap = 'MRA' AND inv.has_failed)::int                   AS non_abonne_failed,
             COUNT(*) FILTER (WHERE fc.rap = 'MRA' AND inv.contract_number IS NULL)::int      AS non_abonne_sans_envoi,
             COUNT(*) FILTER (WHERE fc.rap = 'OK')::int                                        AS non_abonne_sms
           FROM fc
           LEFT JOIN inv ON inv.contract_number = fc.service_no`,
          params
        )
      ]);
      
          const g = global.rows[0];
    const split = nonAbonneSplit.rows[0] || {};

    const payload = {
      success: true,
      filters,
      stats: {
        ...g,
        non_abonne_total:       Number(split.non_abonne_total       || 0),
        non_abonne_sent:        Number(split.non_abonne_sent        || 0),
        non_abonne_pending:     Number(split.non_abonne_pending     || 0),
        non_abonne_failed:      Number(split.non_abonne_failed      || 0),
        non_abonne_sans_envoi:  Number(split.non_abonne_sans_envoi  || 0),
        non_abonne_sms:         Number(split.non_abonne_sms         || 0),
        taux_abonnement: g.total > 0 ? Math.round((g.abonne / g.total) * 1000) / 10 : 0,
        taux_check: g.total > 0 ? Math.round((g.checked / g.total) * 1000) / 10 : 0,
        taux_api_ok: g.total > 0 ? Math.round((g.api_ok / g.total) * 1000) / 10 : 0
      },
   
      topRegion: byRegion.rows,
      topDivision: byDivision.rows,
      topAgence: byAgence.rows,
      topMrc: byMrc.rows,
      topItinerary: byItinerary.rows,
      topAgent: byAgent.rows,
      topReleveur: byReleveur.rows,
      byDay: byDay.rows
    };

    try {
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', 60);
    } catch (_) {}

    return reply.send(payload);
  });

  // Listes pour les dropdowns
fastify.get('/live/options', authReporting, async (req, reply) => {
  const options = await liveService.getFilterOptions();
  return reply.send({ success: true, options });
});

// Page + KPI
fastify.get('/live', authReporting, async (req, reply) => {
  const result = await liveService.searchLive(req.query);
  return reply.send({ success: true, ...result });
});

// Export CSV = TOUT le filtre
fastify.get('/live/export.csv', authReporting, async (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="socadel_collecte_${Date.now()}.csv"`,
    'Cache-Control': 'no-store',
  });
  // BOM Excel
  reply.raw.write('\uFEFF');
  for await (const chunk of liveService.exportCsvStream(req.query)) {
    reply.raw.write(chunk);
  }
  reply.raw.end();
});

fastify.post('/update-phone', auth, async (req, reply) => {
  try {
    const data = await updateCheckedPhone(req.body || {}, req.user);
    return reply.send({ success: true, ...data });
  } catch (e) {
    return reply.code(e.statusCode || 500).send({
      success: false,
      code: e.code || undefined,
      message: e.message || 'Erreur mise à jour numéro',
      collector: e.collector || undefined,
    });
  }
});


     // ── GET /export-non-abonnes — Export CSV des checkés non abonnés ──
  fastify.get('/export-non-abonnes', auth, async (request, reply) => {
    const q = request.query || {};

    // ── Construit les mêmes filtres que /stats ──
    const params = [];
    const where = ['1=1'];

    if (q.itineraires) {
      const list = String(q.itineraires).split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        params.push(list);
        where.push(`sc.itineraires = ANY($${params.length}::text[])`);
      }
    }

    if (q.matricule) {
      params.push(q.matricule);
      const i = params.length;
      where.push(
        `(sc.collected_by_type = 'agent_socadel' AND (sc.collected_by_label = $${i} OR sc.collected_by_label = 'AGENT ' || $${i}))`
      );
    }

    if (q.phone) {
      const digits = q.phone.replace(/\D/g, '');
      params.push(`%${digits}%`);
      where.push(
        `(COALESCE(sc.collected_by_type,'') <> 'agent_socadel'
          AND regexp_replace(COALESCE(sc.collected_by_label,''), '[^0-9]', '', 'g') LIKE $${params.length})`
      );
    }

    if (q.region)    { params.push(q.region);    where.push(`sc.region    = $${params.length}`); }
    if (q.division)  { params.push(q.division);  where.push(`sc.division  = $${params.length}`); }
    if (q.agence)    { params.push(q.agence);    where.push(`sc.agence    = $${params.length}`); }
    if (q.categorie) { params.push(q.categorie); where.push(`sc.categorie = $${params.length}`); }
    if (q.mrc)       { params.push(q.mrc);       where.push(`sc.mrc       = $${params.length}`); }

    const whereSql = where.join(' AND ');

    try {
      const result = await query(
        `WITH inv AS (
           SELECT
             contract_number,
             BOOL_OR(status = 'sent')    AS has_sent,
             BOOL_OR(status = 'pending') AS has_pending,
             BOOL_OR(status = 'failed')  AS has_failed,
             MAX(created_at)             AS last_attempt_at,
             MAX(last_error)             AS last_error
           FROM socadel_invoice_pending
           WHERE status IN ('sent', 'pending', 'failed')
           GROUP BY contract_number
         )
         SELECT
           sc.service_no,
           sc.noms,
           sc.numero_telephone,
           sc.region, sc.division, sc.agence, sc.mrc, sc.itineraires,
           sc.collected_by_type, sc.collected_by_label,
           sc.check_date,
           sc.rapport,
           sc.statut,
           inv.has_sent, inv.has_pending, inv.has_failed,
           inv.last_attempt_at, inv.last_error
         FROM socadel_contacts sc
         LEFT JOIN inv ON inv.contract_number = sc.service_no
         WHERE ${whereSql}
           AND sc.check_status = 'OK'
           AND sc.statut = 'NON ABONNE'
         ORDER BY sc.check_date DESC NULLS LAST
         LIMIT 50000`,
        params
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'Aucun client checké non abonné sur ce périmètre'
        });
      }

      const escapeCsv = (val) => {
        if (val == null || val === '') return '';
        const s = String(val);
        if (/^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s))) {
          return `"${new Date(s).toLocaleString('fr-FR').replace(/"/g, '""')}"`;
        }
        if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };

      // Statut "pro" de la facture
      const statutFacture = (row) => {
        if (row.has_sent)    return 'En attente opérateur';
        if (row.has_pending) return "En cours d'envoi";
        if (row.has_failed)  return 'Non délivrée';
        return 'Sans envoi';
      };

      // Motif neutre
      const motifNeutre = (err) => {
        if (!err) return '';
        const e = String(err).toLowerCase();
        if (/not found|invalid|not a valid/.test(e)) return 'Numéro non joignable';
        if (/opt.?out|unsubscribed/.test(e))          return 'Client désinscrit';
        if (/rate.?limit|429/.test(e))                return "Limite d'envoi atteinte";
        if (/timeout|econn|network/.test(e))          return 'Délai technique dépassé';
        return 'Canal indisponible';
      };

      const headers = [
        'CONTRAT',
        'NOM CLIENT',
        'TELEPHONE',
        'REGION',
        'DIVISION',
        'AGENCE',
        'MRC',
        'ITINERAIRE',
        'RAPPORT',
        'COLLECTE PAR',
        'DATE CHECK',
        'STATUT FACTURE',
        'DERNIERE TENTATIVE',
        'MOTIF'
      ];

      const lines = [headers.join(';')];
      for (const row of result.rows) {
        const collectePar = row.collected_by_label
          || (row.collected_by_type === 'agent_socadel' ? 'Agent'
            : row.collected_by_type === 'releveur' ? 'Releveur'
            : '—');

        lines.push(
          [
            row.service_no,
            row.noms,
            row.numero_telephone,
            row.region,
            row.division,
            row.agence,
            row.mrc,
            row.itineraires,
            row.rapport,
            collectePar,
            row.check_date,
            statutFacture(row),
            row.last_attempt_at,
            motifNeutre(row.last_error)
          ]
            .map(escapeCsv)
            .join(';')
        );
      }

      const csv = '\uFEFF' + lines.join('\r\n');
      const filename = `checkes_non_abonnes_${new Date().toISOString().slice(0, 10)}.csv`;

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Cache-Control', 'no-store')
        .send(csv);
    } catch (err) {
      request.log?.error?.(err) || console.error('[socadel/export-non-abonnes]', err);
      return reply.code(500).send({
        success: false,
        message: 'Erreur génération du rapport'
      });
    }
  });

  fastify.post('/rapport-collecte', auth, async (request, reply) => {
    const role = request.user?.role;
    const allowed = ['admin', 'socadel_reporting', 'responsable_financier'];
    if (!role || !allowed.includes(role)) {
      return reply.code(403).send({ success: false, message: 'Accès réservé' });
    }
 
    const { destinataires } = request.body || {};
    const tos = Array.isArray(destinataires) && destinataires.length
      ? destinataires
      : (process.env.RAPPORT_COLLECTE_EMAILS || 'patrick.tondjou@camlight.cm')
          .split(',').map(s => s.trim()).filter(Boolean);
 
    try {
      const { sendRapportCollecte } = require('../../services/rapport-collecte.service');
      const result = await sendRapportCollecte(tos);
      return reply.send(result);
    } catch (err) {
      request.log?.error?.(err) || console.error('[rapport-collecte]', err);
      return reply.code(500).send({ success: false, message: err.message });
    }
  });

    // GET /marketing-report?from=2026-01-01&to=2026-12-31
  fastify.get('/marketing-report', auth, async (request, reply) => {
    const { from, to } = request.query || {};
    const fromDate = from ? new Date(String(from)) : new Date(Date.now() - 30 * 86400000);
    const toDate = to ? new Date(String(to)) : new Date();

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return reply.code(400).send({ success: false, message: 'Dates invalides' });
    }

    const params = [fromDate.toISOString(), toDate.toISOString()];

    const [kpi, byChannel, byRegion, timeline, secondary] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS contacts_touches,
           COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checks,
           COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonnes,
           COUNT(*) FILTER (WHERE UPPER(COALESCE(rapport,'OK')) = 'MRA')::int AS mra,
           COUNT(*) FILTER (WHERE responsable = 'TERRAIN')::int AS terrain
         FROM socadel_contacts
         WHERE COALESCE(check_date, updated_at) BETWEEN $1::timestamptz AND $2::timestamptz`,
        params
      ),
      query(
        `SELECT COALESCE(collected_by_type, 'autre') AS canal,
                COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked
         FROM socadel_contacts
         WHERE COALESCE(check_date, updated_at) BETWEEN $1::timestamptz AND $2::timestamptz
         GROUP BY 1
         ORDER BY n DESC`,
        params
      ),
      query(
        `SELECT region,
                COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
                COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne
         FROM socadel_contacts
         WHERE COALESCE(check_date, updated_at) BETWEEN $1::timestamptz AND $2::timestamptz
           AND region IS NOT NULL
         GROUP BY region
         ORDER BY checked DESC
         LIMIT 5`,
        params
      ),
      query(
        `SELECT DATE(COALESCE(check_date, updated_at)) AS jour,
                COUNT(*) FILTER (WHERE check_status = 'OK')::int AS checked,
                COUNT(*) FILTER (WHERE statut = 'ABONNE')::int AS abonne
         FROM socadel_contacts
         WHERE COALESCE(check_date, updated_at) BETWEEN $1::timestamptz AND $2::timestamptz
         GROUP BY 1
         ORDER BY 1`,
        params
      ),
      query(
        `SELECT COUNT(*)::int AS numeros_secondaires
         FROM whatsapp_contact_phones
         WHERE is_primary = false
           AND created_at BETWEEN $1::timestamptz AND $2::timestamptz`,
        params
      )
    ]);

    const k = kpi.rows[0];
    const channels = byChannel.rows;
    const totalChan = channels.reduce((s, c) => s + Number(c.n), 0) || 1;
    const share = Object.fromEntries(
      channels.map((c) => [c.canal, Math.round((c.n / totalChan) * 1000) / 10])
    );

    const topZones = byRegion.rows.map((r) => r.region).filter(Boolean);
    const narrative = [
      `Sur la période du ${fromDate.toLocaleDateString('fr-FR')} au ${toDate.toLocaleDateString('fr-FR')},`,
      `${k.checks} checks terrain/agent ont été enregistrés sur ${k.contacts_touches} lignes touchées,`,
      `dont ${k.abonnes} clients au statut ABONNÉ (${k.total ? '' : ''}${k.contacts_touches ? Math.round((k.abonnes / Math.max(k.contacts_touches, 1)) * 100) : 0} %).`,
      share.agent_socadel != null
        ? `Les agents Socadel représentent environ ${share.agent_socadel || 0} % des collectes tracées, les releveurs ${share.releveur || 0} %.`
        : '',
      topZones.length
        ? `Les zones les plus dynamiques : ${topZones.join(', ')}.`
        : '',
      ` ${secondary.rows[0]?.numeros_secondaires || 0} numéros WhatsApp additionnels ont été capturés sans écraser les abonnements déjà actifs,`,
      `conformément à la politique de non-modification du numéro principal.`
    ]
      .filter(Boolean)
      .join(' ');

    return reply.send({
      success: true,
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      kpi: k,
      byChannel: channels,
      share,
      topRegion: byRegion.rows,
      timeline: timeline.rows,
      secondaryPhones: secondary.rows[0]?.numeros_secondaires || 0,
      narrative
    });
  });

}

module.exports = socadelRoutes;
