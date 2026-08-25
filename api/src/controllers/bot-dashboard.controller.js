// src/controllers/bot-dashboard.controller.js
const botDashboardService = require('../services/bot-dashboard.service');
const logger = require('../utils/logger');
const sessionService = require('../services/session.service');

class BotDashboardController {
  // GET /api/v1/bot/stats
  async getStats(request, reply) {
    try {
      const stats = await botDashboardService.getStats();
      return reply.code(200).send({ success: true, stats });
    } catch (error) {
      logger.error('[BotDashboard] getStats:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur récupération statistiques' });
    }
  }

  // GET /api/v1/bot/conversations?state=&phone=&locked=&page=&limit=
  async listConversations(request, reply) {
    try {
      const { state, phone, locked, page, limit } = request.query;
      const result = await botDashboardService.listConversations({
        state: state || null,
        phone: phone || null,
        lockedOnly: locked === 'true',
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });
      return reply.code(200).send({ success: true, ...result });
    } catch (error) {
      logger.error('[BotDashboard] listConversations:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur récupération conversations' });
    }
  }

  // POST /api/v1/bot/conversations/:phone/unlock
  async unlockConversation(request, reply) {
    try {
      const { phone } = request.params;
      const unlocked = await botDashboardService.unlockConversation(decodeURIComponent(phone));
      if (!unlocked) {
        return reply.code(404).send({ success: false, error: 'Conversation introuvable' });
      }
      return reply.code(200).send({ success: true, message: 'Conversation débloquée' });
    } catch (error) {
      logger.error('[BotDashboard] unlockConversation:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur déblocage conversation' });
    }
  }

  // GET /api/v1/bot/contracts?search=&page=&limit=
  async listActivatedContacts(request, reply) {
    try {
      const { search, page, limit } = request.query;
      const result = await botDashboardService.listActivatedContacts({
        search: search || null,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });
      return reply.code(200).send({ success: true, ...result });
    } catch (error) {
      logger.error('[BotDashboard] listActivatedContacts:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur récupération contrats activés' });
    }
  }

  // GET /api/v1/bot/invoices/stats?days=30&groupBy=day
async getInvoiceStats(request, reply) {
  try {
    const { days, groupBy } = request.query;
    const stats = await botDashboardService.getLastInvoiceStats({
      days: days ? parseInt(days) : 30,
      groupBy: groupBy || 'day',
    });
    return reply.code(200).send({ success: true, stats });
  } catch (error) {
    logger.error('[BotDashboard] getInvoiceStats:', error.message);
    return reply.code(500).send({ success: false, error: 'Erreur récupération statistiques factures' });
  }
}

// GET /api/v1/bot/invoices/export?search=&from=&to=
async exportInvoices(request, reply) {
  try {
    const { search, from, to } = request.query;
    const rows = await botDashboardService.exportLastInvoices({ search, from, to });

    // Construction du CSV
    let csv = 'Téléphone,Contrat saisi,Nom client,Nom contact,Tentatives,Verrouillé,Dernier message,Créé le\n';
    rows.forEach(row => {
      csv += [
        row.phone,
        row.draft_contract_number || '',
        row.draft_client_name || '',
        row.contact_name || '',
        row.invoice_attempts,
        row.locked_until ? 'Oui' : 'Non',
        new Date(row.last_message_at).toLocaleString('fr-FR'),
        new Date(row.created_at).toLocaleString('fr-FR'),
      ].join(',') + '\n';
    });

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename=factures_${new Date().toISOString().slice(0,10)}.csv`);
    return reply.send(csv);
  } catch (error) {
    logger.error('[BotDashboard] exportInvoices:', error.message);
    return reply.code(500).send({ success: false, error: 'Erreur export' });
  }
}

  // GET /api/v1/bot/contracts/invoice-stats
async getContractInvoiceStats(request, reply) {
  try {
    const stats = await botDashboardService.getContractInvoiceStats();
    return reply.code(200).send({ success: true, stats });
  } catch (error) {
    logger.error('[BotDashboard] getContractInvoiceStats:', error.message);
    return reply.code(500).send({ success: false, error: 'Erreur récupération statistiques contrats' });
  }
}

// GET /api/v1/bot/payment-clicks?days=30
async getPaymentClickStats(request, reply) {
  try {
    const { days } = request.query;
    const stats = await botDashboardService.getPaymentClickStats(days ? parseInt(days) : 30);
    return reply.code(200).send({ success: true, stats });
  } catch (error) {
    logger.error('[BotDashboard] getPaymentClickStats:', error.message);
    return reply.code(500).send({ success: false, error: 'Erreur récupération statistiques paiements' });
  }
}

// GET /api/v1/bot/whatsapp-sessions/stats
async getWhatsappSessionStats(request, reply) {
  try {
    // clientId = null ⇒ toutes les sessions (tous clients)
    const stats = await sessionService.getSessionStats({ clientId: null });
    return reply.code(200).send({ success: true, stats });
  } catch (error) {
    logger.error('[BotDashboard] getWhatsappSessionStats:', error.message);
    return reply.code(500).send({ success: false, error: 'Erreur récupération statistiques sessions WhatsApp' });
  }
}

// GET /api/v1/bot/whatsapp-sessions?status=&phone=&page=&limit=
async listWhatsappSessions(request, reply) {
  try {
    const { status, phone, page, limit } = request.query;
    const result = await sessionService.listSessions({
      clientId: null,            // toutes les sessions
      status: status || null,
      phone: phone || null,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    return reply.code(200).send({ success: true, ...result });
  } catch (error) {
    logger.error('[BotDashboard] listWhatsappSessions:', error.message);
    return reply.code(500).send({ success: false, error: 'Erreur récupération sessions WhatsApp' });
  }
}

// GET /api/v1/bot/whatsapp-sessions/export?status=&phone=
async exportWhatsappSessions(request, reply) {
  try {
    const { status, phone } = request.query;
    // On récupère toutes les sessions (sans pagination) pour l'export
    const result = await sessionService.listSessions({
      clientId: null,
      status: status || null,
      phone: phone || null,
      page: 1,
      limit: 10000, // suffisant pour un export
    });
    const sessions = result.sessions;

    let csv = 'Client ID,Numéro destinataire,Numéro canal,Statut,Ouverte le,Expire le,Dernier entrant,Dernier template,Relances\n';
    sessions.forEach(s => {
      csv += [
        s.client_id,
        s.recipient_phone,
        s.channel_number || '',
        s.status,
        new Date(s.window_opened_at).toLocaleString('fr-FR'),
        new Date(s.window_expires_at).toLocaleString('fr-FR'),
        s.last_inbound_at ? new Date(s.last_inbound_at).toLocaleString('fr-FR') : '',
        s.last_template_sent_at ? new Date(s.last_template_sent_at).toLocaleString('fr-FR') : '',
        s.reengagement_count || 0,
      ].join(',') + '\n';
    });

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename=whatsapp_sessions_${new Date().toISOString().slice(0,10)}.csv`);
    return reply.send(csv);
  } catch (error) {
    logger.error('[BotDashboard] exportWhatsappSessions:', error.message);
    return reply.code(500).send({ success: false, error: 'Erreur export sessions WhatsApp' });
  }
}

  // GET /api/v1/bot/whatsapp-sessions/stats/period?groupBy=month&year=2024&month=1
async getSessionStatsByPeriod(request, reply) {
  try {
    const { groupBy, year, month } = request.query;
    const stats = await sessionService.getSessionStatsByPeriod({
      groupBy: groupBy || 'month',
      year: year ? parseInt(year) : null,
      month: month ? parseInt(month) : null,
    });
    return reply.code(200).send({ success: true, stats });
  } catch (error) {
    logger.error('[SessionController] getSessionStatsByPeriod:', error.message);
    return reply.code(400).send({ success: false, error: error.message });
  }
}

  // GET /api/v1/bot/link-clicks?days=7
  async getLinkClicks(request, reply) {
    try {
      const { days } = request.query;
      const clicks = await botDashboardService.getLinkClickStats(days ? parseInt(days) : 7);
      return reply.code(200).send({ success: true, clicks });
    } catch (error) {
      logger.error('[BotDashboard] getLinkClicks:', error.message);
      return reply.code(500).send({ success: false, error: 'Erreur récupération clics' });
    }
  }
}

module.exports = new BotDashboardController();
