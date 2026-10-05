// src/routes/v1/phase3.routes.js
// Routes Phase 3 : A/B Testing, Scoring IA, Timing IA, Multi-canal
const { authenticateJWT } = require('../../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../../middlewares/role.middleware');
const abTestService  = require('../../services/abtest.service');
const aiService      = require('../../services/ai.service');
const mcService      = require('../../services/multichannel.service');
const logger         = require('../../utils/logger');

async function phase3Routes(fastify, options) {

  // ============================================================
  // A/B TESTING
  // ============================================================

  fastify.get('/ab-tests', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role === 'admin' ? (req.query.clientId||req.user.id) : req.user.id;
      const result = await abTestService.getABTests(clientId, {
        page: req.query.page||1, limit: req.query.limit||20,
        status: req.query.status, campaign_id: req.query.campaign_id
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/ab-tests', { preHandler: [authenticateJWT],
    schema: {
      body: {
        type: 'object', required: ['name','variants'],
        properties: {
          name: { type:'string' },
          campaign_id: { type:'string', format:'uuid' },
          test_type: { type:'string', enum:['template','send_time','content'] },
          winner_criteria: { type:'string', enum:['delivery_rate','read_rate','reply_rate'] },
          winner_threshold: { type:'number', minimum:80, maximum:99 },
          min_sample_size: { type:'integer', minimum:10 },
          auto_select_winner: { type:'boolean' },
          test_duration_hours: { type:'integer', minimum:1, maximum:168 },
          traffic_split: { type:'object' },
          variants: { type:'array', minItems:2, maxItems:5,
            items: { type:'object', required:['template_name'],
              properties: {
                variant_name: { type:'string' }, label: { type:'string' },
                template_name: { type:'string' }, template_params: { type:'object' },
                send_hour: { type:'integer', minimum:0, maximum:23 },
                phone_number: { type:'string' }
              }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await abTestService.createABTest(req.user.id, req.user.id, req.body);
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/ab-tests/:id', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const test = await abTestService.getABTestById(req.params.id, req.user.id);
      return reply.send({ success:true, test });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/ab-tests/:id/results', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await abTestService.getABTestResults(req.params.id, req.user.id);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/ab-tests/:id/launch', { preHandler: [authenticateJWT],
    schema: {
      body: {
        type: 'object', required: ['contacts'],
        properties: {
          contacts: { type:'array', minItems:1,
            items: { type:'object', properties: {
              phone_number:{ type:'string' }, name:{ type:'string' }, variables:{ type:'object' }
            }}
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await abTestService.launchABTest(
        req.params.id, req.user.id, req.user.id, req.body.contacts
      );
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/ab-tests/:id/evaluate', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await abTestService.evaluateWinner(req.params.id, req.user.id);
      return reply.send({ success:true, ...result });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/ab-tests/:id/select-winner', { preHandler: [authenticateJWT],
    schema: { body: { type:'object', required:['variant_name'], properties: { variant_name:{ type:'string' } } } }
  }, async (req, reply) => {
    try {
      const result = await abTestService.forceSelectWinner(req.params.id, req.user.id, req.body.variant_name);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/ab-tests/:id/refresh-stats', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      await abTestService.refreshVariantStats(req.params.id);
      return reply.send({ success:true, message:'Stats rafraîchies' });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // ============================================================
  // SCORING IA DES CONTACTS
  // ============================================================

  fastify.get('/ai/scores', { preHandler: [authenticateJWT],
    schema: {
      querystring: { type:'object', properties: {
        page:{ type:'integer' }, limit:{ type:'integer' }, segment:{ type:'string' },
        min_score:{ type:'number' }, search:{ type:'string' }, sort:{ type:'string' }
      }}
    }
  }, async (req, reply) => {
    try {
      const clientId = req.user.role==='admin' ? (req.query.clientId||req.user.id) : req.user.id;
      const result = await aiService.getContactScores(clientId, {
        page: req.query.page||1, limit: req.query.limit||50,
        segment: req.query.segment, min_score: req.query.min_score,
        search: req.query.search, sort: req.query.sort
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/ai/scores/compute', { preHandler: [authenticateJWT],
    schema: {
      body: { type:'object',
        properties: {
          phone_number: { type:'string' },
          campaign_id: { type:'string', format:'uuid' },
          use_ai: { type:'boolean', default:false },
          batch_size: { type:'integer', default:50 }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const clientId = req.user.id;
      const { phone_number, campaign_id, use_ai=false, batch_size=50 } = req.body;

      if (phone_number) {
        // Score un seul contact
        const result = await aiService.scoreContact(clientId, phone_number, use_ai);
        return reply.send(result);
      } else if (campaign_id) {
        // Score tous les contacts d'une campagne (asynchrone)
        reply.send({ success:true, message:'Calcul des scores en cours...', campaign_id });
        aiService.scoreCampaignContacts(clientId, campaign_id, use_ai, batch_size)
          .then(r => logger.info(`[AI SCORE] Campagne ${campaign_id}: ${r.processed} scorés`))
          .catch(err => logger.error('[AI SCORE] Erreur batch:', err));
      } else {
        throw { statusCode:400, message:'phone_number ou campaign_id requis' };
      }
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // ============================================================
  // OPTIMISATION HORAIRE IA
  // ============================================================

  fastify.get('/ai/timing', { preHandler: [authenticateJWT],
    schema: {
      querystring: { type:'object', properties: {
        campaign_id: { type:'string', format:'uuid' },
        category: { type:'string' },
        audience_size: { type:'integer' }
      }}
    }
  }, async (req, reply) => {
    try {
      const clientId = req.user.id;
      const result = await aiService.getTimingRecommendation(clientId, req.query.campaign_id, {
        category: req.query.category, audience_size: parseInt(req.query.audience_size)||0
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.post('/ai/timing/build-profile', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const result = await aiService.buildTimingProfile(req.user.id);
      return reply.send({ success:true, profile:result });
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  fastify.get('/ai/campaigns/:id/analyze', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role==='admin' ? null : req.user.id;
      const result = await aiService.analyzeCampaignWithAI(clientId||req.user.id, req.params.id);
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // ============================================================
  // MULTI-CANAL
  // ============================================================

  // Stats globales multi-canal
  fastify.get('/multichannel/stats', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role==='admin' ? (req.query.clientId||req.user.id) : req.user.id;
      const result = await mcService.getChannelStats(clientId, req.query.period||'30days');
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Messages multi-canal
  fastify.get('/multichannel/messages', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const clientId = req.user.role==='admin' ? (req.query.clientId||req.user.id) : req.user.id;
      const result = await mcService.getMultichannelMessages(clientId, {
        page: req.query.page||1, limit: req.query.limit||50,
        channel: req.query.channel, status: req.query.status, search: req.query.search
      });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Envoyer un SMS
  fastify.post('/multichannel/sms/send', { preHandler: [authenticateJWT],
    schema: {
      body: { type:'object', required:['phone','message'],
        properties: {
          phone: { type:'string' }, message: { type:'string' },
          campaign_id: { type:'string', format:'uuid' },
          template_params: { type:'object' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await mcService.sendSMS(req.user.id, req.body.phone, req.body.message, {
        campaign_id: req.body.campaign_id, template_params: req.body.template_params
      });
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Envoyer un Email
  fastify.post('/multichannel/email/send', { preHandler: [authenticateJWT],
    schema: {
      body: { type:'object', required:['to','subject'],
        properties: {
          to: { type:'string', format:'email' }, subject: { type:'string' },
          html_content: { type:'string' }, text_content: { type:'string' },
          recipient_name: { type:'string' }, campaign_id: { type:'string', format:'uuid' },
          template_params: { type:'object' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { to, subject, html_content, text_content, recipient_name, campaign_id, template_params } = req.body;
      const result = await mcService.sendEmail(req.user.id, to, subject, html_content, text_content, {
        campaign_id, recipientName: recipient_name, template_params
      });
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Envoi avec fallback multi-canal
  fastify.post('/multichannel/send', { preHandler: [authenticateJWT],
    schema: {
      body: { type:'object', required:['recipient','content'],
        properties: {
          recipient: { type:'object', properties: {
            phone: { type:'string' }, email: { type:'string' }, name: { type:'string' }
          }},
          content: { type:'object', properties: {
            text: { type:'string' }, sms: { type:'string' },
            html: { type:'string' }, subject: { type:'string' },
            phone_number: { type:'string' }
          }},
          channels: { type:'array', items: { type:'string', enum:['whatsapp','sms','email'] } },
          campaign_id: { type:'string', format:'uuid' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { recipient, content, channels=['whatsapp','sms','email'], campaign_id } = req.body;
      const result = await mcService.sendWithFallback(req.user.id, recipient, content, { channels, campaign_id });
      return reply.send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Configuration providers SMS
  fastify.post('/multichannel/providers/sms', { preHandler: [authenticateJWT],
    schema: {
      body: { type:'object', required:['provider_name','api_key'],
        properties: {
          provider_name: { type:'string', enum:['africas_talking','nexah','twilio','vonage'] },
          api_key: { type:'string' }, api_secret: { type:'string' },
          sender_id: { type:'string' }, config: { type:'object' },
          cost_per_sms: { type:'number' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await mcService.configureSMSProvider(req.user.id, req.body);
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Configuration providers Email
  fastify.post('/multichannel/providers/email', { preHandler: [authenticateJWT],
    schema: {
      body: { type:'object', required:['provider_name','api_key','from_email'],
        properties: {
          provider_name: { type:'string', enum:['brevo','sendgrid','mailgun','amazon_ses','smtp'] },
          api_key: { type:'string' }, from_email: { type:'string', format:'email' },
          from_name: { type:'string' }, reply_to: { type:'string' },
          config: { type:'object' }, cost_per_email: { type:'number' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const result = await mcService.configureEmailProvider(req.user.id, req.body);
      return reply.code(201).send(result);
    } catch (e) { return reply.code(e.statusCode||500).send({ success:false, message:e.message }); }
  });

  // Liste des providers configurés
  fastify.get('/multichannel/providers', { preHandler: [authenticateJWT] }, async (req, reply) => {
    try {
      const { query } = require('../../config/database');
      const clientId = req.user.id;
      const [smsRes, emailRes] = await Promise.all([
        query(`SELECT id, provider_name, sender_id, is_active, messages_sent, cost_per_sms, last_used_at
               FROM sms_providers WHERE client_id = $1`, [clientId]),
        query(`SELECT id, provider_name, from_email, from_name, is_active, messages_sent, cost_per_email, last_used_at
               FROM email_providers WHERE client_id = $1`, [clientId])
      ]);
      return reply.send({ success:true, sms: smsRes.rows, email: emailRes.rows });
    } catch (e) { return reply.code(500).send({ success:false, message:e.message }); }
  });
}

module.exports = phase3Routes;
