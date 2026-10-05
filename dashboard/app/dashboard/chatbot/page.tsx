// app/dashboard/chatbot/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';

// URL de base (nettoyée pour éviter le double /api/v1)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com';
const baseUrl = API_BASE.replace(/\/api\/v1\/?$/, '');

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || 'Erreur API');
  }
  return data;
}

// ─── TYPES ─────────────────────────────────────────────────────────
type Stats = {
  conversations: {
    lang_select: string;
    main_menu: string;
    invoice_input: string;
    invoice_confirm: string;
    last_invoice_input: string;
    currently_locked: string;
    active_today: string;
    total_conversations: string;
  };
  contacts: { total_activated: string; activated_today: string };
  link_clicks: { clicks_total: string; clicks_today: string };
};

type Conversation = {
  phone: string;
  language: string | null;
  state: string;
  contact_name: string | null;
  draft_contract_number: string | null;
  draft_client_name: string | null;
  invoice_attempts: number;
  locked_until: string | null;
  last_message_at: string;
  created_at: string;
};

type ActivatedContact = {
  contract_number: string;
  client_name: string;
  whatsapp_phone: string;
  activated_at: string;
};

type LinkClick = {
  date: string;
  clicks: number;
};

type InvoiceStat = {
  date: string;
  count: number;
};

type ContractInvoiceStats = {
  total_contracts: number;
  total_invoices: number;
  avg_invoices: number;
};

type PaymentClickStats = {
  byMethod: { method: string; count: number }[];
  byDay: { jour: string; count: number }[];
};

type WhatsappSession = {
  id: string;
  client_id: string;
  recipient_phone: string;
  channel_number: string;
  status: 'active' | 'expired';
  window_opened_at: string;
  window_expires_at: string;
  last_inbound_at: string | null;
  last_template_sent_at: string | null;
  reengagement_count: number;
};

type WhatsappStats = {
  active: string;
  expiring_soon: string;
  expired: string;
  total: string;
};

// ── Audit métier : envois réels de factures (invoice_send_logs) ──
type InvoiceSend = {
  id: number;
  contract_number: string;
  client_name: string | null;
  recipient_phone: string;
  numero_facture: string | null;
  montant: string | null;
  pdf_link: string | null;
  invoice_month: string | null;
  template_name: string | null;
  template_lang: string | null;
  channel_number: string | null;
  status: 'sent' | 'failed' | string;
  error_message: string | null;
  source: string | null;
  previous_sent_at: string | null;
  previous_numero_facture: string | null;
  sent_at: string;
  created_at: string;
};

type InvoiceSendStats = {
  total: number;
  sent: number;
  failed: number;
  today: number;
  contracts: number;
  phones: number;
};

// ─── CONSTANTES ────────────────────────────────────────────────────
const STATE_LABELS: Record<string, string> = {
  LANG_SELECT: 'Choix de langue',
  MAIN_MENU: 'Menu principal',
  INVOICE_CONTRACT_INPUT: 'Saisie contrat (facture digitale)',
  INVOICE_CONFIRM: 'Confirmation contrat',
  LAST_INVOICE_CONTRACT_INPUT: 'Saisie contrat (dernière facture)',
};

const SOURCE_LABELS: Record<string, string> = {
  chatbot: 'Chatbot',
  shortcut_button: 'Bouton raccourci',
  quick_register: 'Enregistrement rapide',
  last_invoice: 'Dernière facture',
};

function formatSource(source: string | null | undefined): string {
  if (!source) return '—';
  return SOURCE_LABELS[source] || source;
}

function isLocked(lockedUntil: string | null) {
  return !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();
}

function lockCountdown(lockedUntil: string) {
  const ms = new Date(lockedUntil).getTime() - Date.now();
  if (ms <= 0) return 'Expiré';
  return `${Math.ceil(ms / 60000)} min restantes`;
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────
export default function ChatbotDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<
    'conversations' | 'contracts' | 'invoices' | 'invoice_sends' | 'clicks' | 'payments' | 'sessions' | 'whatsapp'
  >('conversations');

  // Conversations (toutes)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convPagination, setConvPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [stateFilter, setStateFilter] = useState('');
  const [lockedOnly, setLockedOnly] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState('');

  // Contacts activés
  const [contacts, setContacts] = useState<ActivatedContact[]>([]);
  const [contactsPagination, setContactsPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [contractSearch, setContractSearch] = useState('');

  // Dernières factures (LAST_INVOICE_CONTRACT_INPUT) — funnel conversation
  const [invoices, setInvoices] = useState<Conversation[]>([]);
  const [invPagination, setInvPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [invSearch, setInvSearch] = useState('');
  const [invDateFilter, setInvDateFilter] = useState('');

  // Stats des factures (évolution quotidienne, funnel)
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStat[]>([]);
  const [loadingInvoiceStats, setLoadingInvoiceStats] = useState(false);

  // ── Audit métier : Factures envoyées (invoice_send_logs) ──
  const [invoiceSends, setInvoiceSends] = useState<InvoiceSend[]>([]);
  const [invoiceSendsPagination, setInvoiceSendsPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [sendSearch, setSendSearch] = useState('');
  const [sendStatusFilter, setSendStatusFilter] = useState('');
  const [sendSourceFilter, setSendSourceFilter] = useState('');
  const [sendFrom, setSendFrom] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [invoiceSendStats, setInvoiceSendStats] = useState<InvoiceSendStats | null>(null);
  const [loadingInvoiceSends, setLoadingInvoiceSends] = useState(false);

  // Clics sur le lien (général)
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [loadingClicks, setLoadingClicks] = useState(false);

  // Statistiques paiements
  const [contractStats, setContractStats] = useState<ContractInvoiceStats | null>(null);
  const [paymentStats, setPaymentStats] = useState<PaymentClickStats | null>(null);
  const [loadingPaymentStats, setLoadingPaymentStats] = useState(false);
  const [paymentDays, setPaymentDays] = useState(30);

  // États pour l'onglet "Sessions WhatsApp 24h"
  const [whatsappStats, setWhatsappStats] = useState<WhatsappStats | null>(null);
  const [whatsappList, setWhatsappList] = useState<WhatsappSession[]>([]);
  const [whatsappPagination, setWhatsappPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [whatsappStatusFilter, setWhatsappStatusFilter] = useState('');
  const [whatsappPhoneFilter, setWhatsappPhoneFilter] = useState('');
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  const [periodGroupBy, setPeriodGroupBy] = useState<'month' | 'year'>('month');
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodStats, setPeriodStats] = useState<{ global: any; distribution: { period: string; count: number }[] } | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  // États communs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── CHARGEMENT DES DONNÉES ────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch('/bot/stats');
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const loadConversations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set('state', stateFilter);
      if (phoneFilter) params.set('phone', phoneFilter);
      if (lockedOnly) params.set('locked', 'true');
      params.set('page', String(page));
      params.set('limit', '20');

      const data = await apiFetch(`/bot/conversations?${params.toString()}`);
      setConversations(data.conversations);
      setConvPagination(data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, phoneFilter, lockedOnly]);

  const loadContacts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (contractSearch) params.set('search', contractSearch);
      params.set('page', String(page));
      params.set('limit', '20');

      const data = await apiFetch(`/bot/contracts?${params.toString()}`);
      setContacts(data.contacts);
      setContactsPagination(data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractSearch]);

  const loadInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('state', 'LAST_INVOICE_CONTRACT_INPUT');
      params.set('limit', '50');
      if (page > 1) params.set('page', String(page));

      const data = await apiFetch(`/bot/conversations?${params.toString()}`);
      let filtered = data.conversations;

      if (invSearch) {
        const searchLower = invSearch.toLowerCase();
        filtered = filtered.filter((c: Conversation) =>
          c.phone.toLowerCase().includes(searchLower) ||
          (c.draft_contract_number && c.draft_contract_number.toLowerCase().includes(searchLower)) ||
          (c.draft_client_name && c.draft_client_name.toLowerCase().includes(searchLower)) ||
          (c.contact_name && c.contact_name.toLowerCase().includes(searchLower))
        );
      }

      if (invDateFilter) {
        const now = new Date();
        let cutoff = new Date();
        if (invDateFilter === 'today') {
          cutoff.setHours(0, 0, 0, 0);
        } else if (invDateFilter === 'week') {
          cutoff.setDate(now.getDate() - 7);
        } else if (invDateFilter === 'month') {
          cutoff.setDate(now.getDate() - 30);
        }
        filtered = filtered.filter((c: Conversation) => new Date(c.last_message_at) >= cutoff);
      }

      const limit = 20;
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);

      setInvoices(paginated);
      setInvPagination({ total, page, totalPages });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [invSearch, invDateFilter]);

  const loadInvoiceStats = useCallback(async (days = 30, groupBy = 'day') => {
    setLoadingInvoiceStats(true);
    try {
      const data = await apiFetch(`/bot/invoices/stats?days=${days}&groupBy=${groupBy}`);
      setInvoiceStats(data.stats || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingInvoiceStats(false);
    }
  }, []);

  // ── AUDIT MÉTIER : factures réellement envoyées ──
  const loadInvoiceSends = useCallback(async (page = 1) => {
    setLoadingInvoiceSends(true);
    try {
      const params = new URLSearchParams();
      if (sendSearch) params.set('search', sendSearch);
      if (sendStatusFilter) params.set('status', sendStatusFilter);
      if (sendSourceFilter) params.set('source', sendSourceFilter);
      if (sendFrom) params.set('from', sendFrom);
      if (sendTo) params.set('to', sendTo);
      params.set('page', String(page));
      params.set('limit', '20');

      const data = await apiFetch(`/bot/invoice-sends?${params.toString()}`);
      setInvoiceSends(data.rows || []);
      setInvoiceSendsPagination(data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingInvoiceSends(false);
    }
  }, [sendSearch, sendStatusFilter, sendSourceFilter, sendFrom, sendTo]);

  const loadInvoiceSendStats = useCallback(async (days = 30) => {
    try {
      const data = await apiFetch(`/bot/invoice-sends/stats?days=${days}`);
      setInvoiceSendStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const exportInvoiceSends = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sendSearch) params.set('search', sendSearch);
      if (sendStatusFilter) params.set('status', sendStatusFilter);
      if (sendSourceFilter) params.set('source', sendSourceFilter);
      if (sendFrom) params.set('from', sendFrom);
      if (sendTo) params.set('to', sendTo);

      const url = `${baseUrl}/api/v1/bot/invoice-sends/export?${params.toString()}`;
      const token = getAuthToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur export');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `invoice_sends_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } catch (err: any) {
      setError(err.message);
    }
  }, [sendSearch, sendStatusFilter, sendSourceFilter, sendFrom, sendTo]);

  const loadLinkClicks = useCallback(async (days = 7) => {
    setLoadingClicks(true);
    try {
      const data = await apiFetch(`/bot/link-clicks?days=${days}`);
      setLinkClicks(data.clicks || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingClicks(false);
    }
  }, []);

  const loadContractInvoiceStats = useCallback(async () => {
    try {
      const data = await apiFetch('/bot/contracts/invoice-stats');
      setContractStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const loadPaymentClickStats = useCallback(async (days = 30) => {
    setLoadingPaymentStats(true);
    try {
      const data = await apiFetch(`/bot/payment-clicks?days=${days}`);
      setPaymentStats(data.stats);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPaymentStats(false);
    }
  }, []);

  async function handleUnlock(phone: string) {
    try {
      await apiFetch(`/bot/conversations/${encodeURIComponent(phone)}/unlock`, { method: 'POST' });
      loadConversations(convPagination.page);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Nouvelles fonctions pour WhatsApp Sessions
  const loadWhatsappStats = useCallback(async () => {
    try {
      const data = await apiFetch('/bot/whatsapp-sessions/stats');
      setWhatsappStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const loadWhatsappSessions = useCallback(async (page = 1) => {
    setWhatsappLoading(true);
    try {
      const params = new URLSearchParams();
      if (whatsappStatusFilter) params.set('status', whatsappStatusFilter);
      if (whatsappPhoneFilter) params.set('phone', whatsappPhoneFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const data = await apiFetch(`/bot/whatsapp-sessions?${params.toString()}`);
      setWhatsappList(data.sessions);
      setWhatsappPagination(data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWhatsappLoading(false);
    }
  }, [whatsappStatusFilter, whatsappPhoneFilter]);

  const exportWhatsappSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (whatsappStatusFilter) params.set('status', whatsappStatusFilter);
      if (whatsappPhoneFilter) params.set('phone', whatsappPhoneFilter);

      const url = `${baseUrl}/api/v1/bot/whatsapp-sessions/export?${params.toString()}`;
      const token = getAuthToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur export');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `whatsapp_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } catch (err: any) {
      setError(err.message);
    }
  }, [whatsappStatusFilter, whatsappPhoneFilter]);

  const loadPeriodStats = useCallback(async () => {
    setPeriodLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('groupBy', periodGroupBy);
      params.set('year', String(periodYear));
      if (periodGroupBy === 'month') {
        params.set('month', String(periodMonth));
      }
      const data = await apiFetch(`/bot/whatsapp-sessions/stats/period?${params.toString()}`);
      setPeriodStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPeriodLoading(false);
    }
  }, [periodGroupBy, periodYear, periodMonth]);

  // ─── EXPORT CSV (funnel conversations) ──────────────────────────
  async function exportInvoices() {
    try {
      const params = new URLSearchParams();
      if (invSearch) params.set('search', invSearch);
      if (invDateFilter) {
        const now = new Date();
        let from, to;
        if (invDateFilter === 'today') {
          from = now.toISOString().slice(0, 10);
          to = now.toISOString().slice(0, 10);
        } else if (invDateFilter === 'week') {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          from = d.toISOString().slice(0, 10);
        } else if (invDateFilter === 'month') {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          from = d.toISOString().slice(0, 10);
        }
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }

      const url = `${baseUrl}/api/v1/bot/invoices/export?${params.toString()}`;
      const token = getAuthToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur export');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `factures_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ─── EFFETS ─────────────────────────────────────────────────────

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'conversations') loadConversations(1);
  }, [tab, stateFilter, phoneFilter, lockedOnly, loadConversations]);

  useEffect(() => {
    if (tab === 'contracts') loadContacts(1);
  }, [tab, contractSearch, loadContacts]);

  useEffect(() => {
    if (tab === 'invoices') {
      loadInvoices(1);
      loadInvoiceStats(30, 'day');
    }
  }, [tab, invSearch, invDateFilter, loadInvoices, loadInvoiceStats]);

  // Nouvel onglet : Factures envoyées
  useEffect(() => {
    if (tab === 'invoice_sends') {
      loadInvoiceSends(1);
      loadInvoiceSendStats(30);
    }
  }, [tab, sendSearch, sendStatusFilter, sendSourceFilter, sendFrom, sendTo, loadInvoiceSends, loadInvoiceSendStats]);

  useEffect(() => {
    if (tab === 'clicks') loadLinkClicks(7);
  }, [tab, loadLinkClicks]);

  useEffect(() => {
    if (tab === 'payments') {
      loadContractInvoiceStats();
      loadPaymentClickStats(paymentDays);
    }
  }, [tab, paymentDays, loadContractInvoiceStats, loadPaymentClickStats]);

  useEffect(() => {
    if (tab === 'whatsapp') {
      loadWhatsappStats();
      loadWhatsappSessions(1);
    }
  }, [tab, whatsappStatusFilter, whatsappPhoneFilter, loadWhatsappStats, loadWhatsappSessions]);

  useEffect(() => {
    if (tab === 'whatsapp') {
      loadWhatsappStats();
      loadWhatsappSessions(1);
      loadPeriodStats();
    }
  }, [tab, whatsappStatusFilter, whatsappPhoneFilter, periodGroupBy, periodYear, periodMonth, loadWhatsappStats, loadWhatsappSessions, loadPeriodStats]);

  // ─── RENDU ──────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Chatbot Socadel</h1>
        <p className="text-neutral-500">Suivi des conversations, abonnements et activité du bot WhatsApp.</p>
      </div>

      {error && <div className="alert-info border-red-400 bg-red-50 text-red-700">{error}</div>}

      {/* Cartes de stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Conversations actives (24h)" value={stats?.conversations.active_today} />
        <StatCard label="Comptes bloqués" value={stats?.conversations.currently_locked} isDanger />
        <StatCard label="Abonnements activés" value={stats?.contacts.total_activated} />
        <StatCard label="Activés aujourd'hui" value={stats?.contacts.activated_today} />
        <StatCard label="Dernières factures" value={stats?.conversations.last_invoice_input} />
      </div>

      {/* Répartition par état */}
      <div className="card">
        <h2 className="text-sm font-semibold text-neutral-600 mb-3">Répartition des conversations par étape</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <StateChip label="Choix langue" value={stats?.conversations.lang_select} />
          <StateChip label="Menu principal" value={stats?.conversations.main_menu} />
          <StateChip label="Saisie contrat" value={stats?.conversations.invoice_input} />
          <StateChip label="Confirmation" value={stats?.conversations.invoice_confirm} />
          <StateChip label="Dernière facture" value={stats?.conversations.last_invoice_input} />
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-4 border-b border-neutral-200 overflow-x-auto">
        <button
          className={`pb-2 px-1 ${tab === 'conversations' ? 'nav-link-active' : 'nav-link'}`}
          onClick={() => setTab('conversations')}
        >
          Conversations
        </button>
        <button
          className={`pb-2 px-1 ${tab === 'contracts' ? 'nav-link-active' : 'nav-link'}`}
          onClick={() => setTab('contracts')}
        >
          Abonnements activés
        </button>
        <button
          className={`pb-2 px-1 ${tab === 'invoices' ? 'nav-link-active' : 'nav-link'}`}
          onClick={() => setTab('invoices')}
        >
          Dernières factures
        </button>
        <button
          className={`pb-2 px-1 ${tab === 'invoice_sends' ? 'nav-link-active' : 'nav-link'}`}
          onClick={() => setTab('invoice_sends')}
        >
          Factures envoyées
        </button>
        <button
          className={`pb-2 px-1 ${tab === 'clicks' ? 'nav-link-active' : 'nav-link'}`}
          onClick={() => setTab('clicks')}
        >
          Clics sur le lien
        </button>
        <button
          className={`pb-2 px-1 ${tab === 'payments' ? 'nav-link-active' : 'nav-link'}`}
          onClick={() => setTab('payments')}
        >
          Paiements
        </button>
        <button className={`pb-2 px-1 ${tab === 'sessions' ? 'nav-link-active' : 'nav-link'}`} onClick={() => setTab('sessions')}>Sessions Chat</button>
        <button className={`pb-2 px-1 ${tab === 'whatsapp' ? 'nav-link-active' : 'nav-link'}`} onClick={() => setTab('whatsapp')}>WhatsApp 24h</button>
      </div>

      {/* ─── CONTENU DES ONGLETS ────────────────────────────────── */}

      {tab === 'conversations' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Étape</label>
              <select className="text-input px-3 py-2" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                <option value="">Toutes</option>
                {Object.entries(STATE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Numéro</label>
              <input className="text-input px-3 py-2" placeholder="+237..." value={phoneFilter} onChange={(e) => setPhoneFilter(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" checked={lockedOnly} onChange={(e) => setLockedOnly(e.target.checked)} />
              Bloqués uniquement
            </label>
            <button className="btn-outline" onClick={() => loadConversations(1)}>Rafraîchir</button>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Numéro</th>
                  <th className="px-4 py-2 text-left">Nom</th>
                  <th className="px-4 py-2 text-left">Langue</th>
                  <th className="px-4 py-2 text-left">Étape</th>
                  <th className="px-4 py-2 text-left">Tentatives</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                  <th className="px-4 py-2 text-left">Dernier message</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">Chargement...</td></tr>}
                {!loading && conversations.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">Aucune conversation</td></tr>
                )}
                {conversations.map((c) => (
                  <tr key={c.phone}>
                    <td className="px-4 py-2">{c.phone}</td>
                    <td className="px-4 py-2">{c.contact_name || '—'}</td>
                    <td className="px-4 py-2 uppercase text-sm">{c.language || '—'}</td>
                    <td className="px-4 py-2 text-sm">{STATE_LABELS[c.state] || c.state}</td>
                    <td className="px-4 py-2 text-sm">{c.invoice_attempts}/3</td>
                    <td className="px-4 py-2">
                      {isLocked(c.locked_until) ? (
                        <span className="badge-warning bg-red-100 text-red-700">Bloqué — {lockCountdown(c.locked_until!)}</span>
                      ) : (
                        <span className="badge-success">Actif</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-neutral-500">{new Date(c.last_message_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2">
                      {isLocked(c.locked_until) && (
                        <button className="btn-outline text-sm px-3 py-1" onClick={() => handleUnlock(c.phone)}>
                          Débloquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={convPagination} onChange={(p) => loadConversations(p)} />
          </div>
        </div>
      )}

      {tab === 'contracts' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Recherche</label>
              <input
                className="text-input px-3 py-2"
                placeholder="N° contrat, nom, numéro..."
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
              />
            </div>
            <button className="btn-outline" onClick={() => loadContacts(1)}>Rafraîchir</button>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Contrat</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Numéro WhatsApp</th>
                  <th className="px-4 py-2 text-left">Activé le</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-500">Chargement...</td></tr>}
                {!loading && contacts.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-500">Aucun abonnement activé</td></tr>
                )}
                {contacts.map((c) => (
                  <tr key={`${c.contract_number}-${c.whatsapp_phone}`}>
                    <td className="px-4 py-2">{c.contract_number}</td>
                    <td className="px-4 py-2">{c.client_name}</td>
                    <td className="px-4 py-2">{c.whatsapp_phone}</td>
                    <td className="px-4 py-2 text-sm text-neutral-500">{new Date(c.activated_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={contactsPagination} onChange={(p) => loadContacts(p)} />
          </div>
        </div>
      )}

      {/* ═══════════════ DERNIÈRES FACTURES (funnel conversation) ═══════════════ */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Recherche (téléphone, contrat, client)</label>
              <input
                className="text-input px-3 py-2"
                placeholder="Rechercher..."
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Période</label>
              <select className="text-input px-3 py-2" value={invDateFilter} onChange={(e) => setInvDateFilter(e.target.value)}>
                <option value="">Toutes</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">7 derniers jours</option>
                <option value="month">30 derniers jours</option>
              </select>
            </div>
            <button className="btn-outline" onClick={() => loadInvoices(1)}>Rafraîchir</button>
            <button className="btn-outline" onClick={exportInvoices}>
              Exporter CSV
            </button>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-neutral-600 mb-2">Évolution des dernières factures (30 derniers jours)</h3>
            {loadingInvoiceStats ? (
              <div className="text-neutral-500">Chargement...</div>
            ) : invoiceStats.length === 0 ? (
              <div className="text-neutral-500">Aucune donnée</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-standard text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-1">Date</th>
                      <th className="px-3 py-1">Nombre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceStats.map((stat) => (
                      <tr key={stat.date}>
                        <td className="px-3 py-1">{new Date(stat.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-3 py-1 font-semibold">{stat.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Numéro</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Contrat saisi</th>
                  <th className="px-4 py-2 text-left">Date du dernier message</th>
                  <th className="px-4 py-2 text-left">Tentatives</th>
                  <th className="px-4 py-2 text-left">Blocage</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">Chargement...</td></tr>}
                {!loading && invoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">Aucune dernière facture en attente</td></tr>
                )}
                {invoices.map((c) => (
                  <tr key={c.phone}>
                    <td className="px-4 py-2">{c.phone}</td>
                    <td className="px-4 py-2">{c.draft_client_name || c.contact_name || '—'}</td>
                    <td className="px-4 py-2">{c.draft_contract_number || '—'}</td>
                    <td className="px-4 py-2 text-sm text-neutral-500">{new Date(c.last_message_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-sm">{c.invoice_attempts}/3</td>
                    <td className="px-4 py-2">
                      {isLocked(c.locked_until) ? (
                        <span className="badge-warning bg-red-100 text-red-700">Bloqué</span>
                      ) : (
                        <span className="badge-success">Actif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={invPagination} onChange={(p) => loadInvoices(p)} />
          </div>
        </div>
      )}

      {/* ═══════════════ FACTURES ENVOYÉES (audit métier : invoice_send_logs) ═══════════════ */}
      {tab === 'invoice_sends' && (
        <div className="space-y-4">
          {/* Stats globales envois */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <StatCard label="Total envois (30j)" value={invoiceSendStats ? String(invoiceSendStats.total) : undefined} />
            <StatCard label="Réussis" value={invoiceSendStats ? String(invoiceSendStats.sent) : undefined} />
            <StatCard
              label="Échoués"
              value={invoiceSendStats ? String(invoiceSendStats.failed) : undefined}
              isDanger={!!invoiceSendStats && invoiceSendStats.failed > 0}
            />
            <StatCard label="Aujourd'hui" value={invoiceSendStats ? String(invoiceSendStats.today) : undefined} />
            <StatCard label="Contrats uniques" value={invoiceSendStats ? String(invoiceSendStats.contracts) : undefined} />
            <StatCard label="Numéros uniques" value={invoiceSendStats ? String(invoiceSendStats.phones) : undefined} />
          </div>

          {/* Filtres */}
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Recherche</label>
              <input
                className="text-input px-3 py-2"
                placeholder="Contrat, client, téléphone, n° facture..."
                value={sendSearch}
                onChange={(e) => setSendSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Statut</label>
              <select
                className="text-input px-3 py-2"
                value={sendStatusFilter}
                onChange={(e) => setSendStatusFilter(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="sent">Envoyé</option>
                <option value="failed">Échoué</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Source</label>
              <select
                className="text-input px-3 py-2"
                value={sendSourceFilter}
                onChange={(e) => setSendSourceFilter(e.target.value)}
              >
                <option value="">Toutes</option>
                <option value="chatbot">Chatbot</option>
                <option value="shortcut_button">Bouton raccourci</option>
                <option value="quick_register">Enregistrement rapide</option>
                <option value="last_invoice">Dernière facture</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Du</label>
              <input
                type="date"
                className="text-input px-3 py-2"
                value={sendFrom}
                onChange={(e) => setSendFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Au</label>
              <input
                type="date"
                className="text-input px-3 py-2"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
              />
            </div>
            <button className="btn-outline" onClick={() => loadInvoiceSends(1)}>Rafraîchir</button>
            <button className="btn-outline" onClick={exportInvoiceSends}>Exporter CSV</button>
          </div>

          {/* Tableau des envois */}
          <div className="card overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Contrat</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Téléphone</th>
                  <th className="px-4 py-2 text-left">N° facture</th>
                  <th className="px-4 py-2 text-left">Montant</th>
                  <th className="px-4 py-2 text-left">Mois</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-left">Envoyé le</th>
                  <th className="px-4 py-2 text-left">Envoi précédent</th>
                </tr>
              </thead>
              <tbody>
                {loadingInvoiceSends && (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-neutral-500">Chargement...</td></tr>
                )}
                {!loadingInvoiceSends && invoiceSends.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-neutral-500">Aucun envoi enregistré</td></tr>
                )}
                {invoiceSends.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium">{s.contract_number}</td>
                    <td className="px-4 py-2">{s.client_name || '—'}</td>
                    <td className="px-4 py-2">{s.recipient_phone}</td>
                    <td className="px-4 py-2">{s.numero_facture || '—'}</td>
                    <td className="px-4 py-2">{s.montant || '—'}</td>
                    <td className="px-4 py-2">{s.invoice_month || '—'}</td>
                    <td className="px-4 py-2">
                      {s.status === 'sent' ? (
                        <span className="badge-success">Envoyé</span>
                      ) : (
                        <span className="badge-warning bg-red-100 text-red-700" title={s.error_message || ''}>
                          Échoué
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">{formatSource(s.source)}</td>
                    <td className="px-4 py-2 text-sm text-neutral-500">
                      {s.sent_at ? new Date(s.sent_at).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {s.previous_sent_at ? (
                        <>
                          {new Date(s.previous_sent_at).toLocaleDateString('fr-FR')}
                          {s.previous_numero_facture ? ` — ${s.previous_numero_facture}` : ''}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={invoiceSendsPagination} onChange={(p) => loadInvoiceSends(p)} />
          </div>
        </div>
      )}

      {tab === 'clicks' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Période (jours)</label>
              <select
                className="text-input px-3 py-2"
                defaultValue={7}
                onChange={(e) => loadLinkClicks(parseInt(e.target.value))}
              >
                <option value={7}>7 derniers jours</option>
                <option value={14}>14 derniers jours</option>
                <option value={30}>30 derniers jours</option>
              </select>
            </div>
            <button className="btn-outline" onClick={() => loadLinkClicks()}>Rafraîchir</button>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Nombre de clics</th>
                </tr>
              </thead>
              <tbody>
                {loadingClicks && (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-500">Chargement...</td></tr>
                )}
                {!loadingClicks && linkClicks.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-500">Aucun clic enregistré</td></tr>
                )}
                {linkClicks.map((item) => (
                  <tr key={item.date}>
                    <td className="px-4 py-2">{new Date(item.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2 font-semibold">{item.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total contrats"
              value={contractStats?.total_contracts != null ? String(contractStats.total_contracts) : '—'}
            />
            <StatCard
              label="Total factures envoyées"
              value={contractStats?.total_invoices != null ? String(contractStats.total_invoices) : '—'}
            />
            <StatCard
              label="Moyenne factures/contrat"
              value={
                contractStats?.avg_invoices != null && !isNaN(contractStats.avg_invoices)
                  ? Number(contractStats.avg_invoices).toFixed(1)
                  : '—'
              }
            />
          </div>

          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Période (jours)</label>
              <select
                className="text-input px-3 py-2"
                value={paymentDays}
                onChange={(e) => setPaymentDays(parseInt(e.target.value))}
              >
                <option value={7}>7 derniers jours</option>
                <option value={30}>30 derniers jours</option>
                <option value={60}>60 derniers jours</option>
                <option value={90}>90 derniers jours</option>
              </select>
            </div>
            <button className="btn-outline" onClick={() => loadPaymentClickStats(paymentDays)}>Rafraîchir</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-2">Clics de paiement par méthode</h3>
              {loadingPaymentStats ? (
                <div className="text-neutral-500">Chargement...</div>
              ) : paymentStats?.byMethod?.length ? (
                <table className="table-standard text-sm w-full">
                  <thead>
                    <tr><th className="px-3 py-1">Méthode</th><th className="px-3 py-1">Nombre</th></tr>
                  </thead>
                  <tbody>
                    {paymentStats.byMethod.map((item) => (
                      <tr key={item.method}>
                        <td className="px-3 py-1">{item.method || 'Inconnu'}</td>
                        <td className="px-3 py-1 font-semibold">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-neutral-500">Aucune donnée</div>
              )}
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-2">Clics de paiement par jour</h3>
              {loadingPaymentStats ? (
                <div className="text-neutral-500">Chargement...</div>
              ) : paymentStats?.byDay?.length ? (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="table-standard text-sm w-full">
                    <thead>
                      <tr><th className="px-3 py-1">Date</th><th className="px-3 py-1">Nombre</th></tr>
                    </thead>
                    <tbody>
                      {paymentStats.byDay.map((item) => (
                        <tr key={item.jour}>
                          <td className="px-3 py-1">{new Date(item.jour).toLocaleDateString('fr-FR')}</td>
                          <td className="px-3 py-1 font-semibold">{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-neutral-500">Aucune donnée</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NOUVEL ONGLET : WhatsApp Sessions 24h */}
      {tab === 'whatsapp' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Sessions actives" value={whatsappStats?.active} />
            <StatCard label="Expirent < 1h" value={whatsappStats?.expiring_soon} isDanger />
            <StatCard label="Expirées" value={whatsappStats?.expired} />
            <StatCard label="Total" value={whatsappStats?.total} />
          </div>

          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Période</label>
              <select className="text-input px-3 py-2" value={periodGroupBy} onChange={(e) => setPeriodGroupBy(e.target.value as 'month' | 'year')}>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Année</label>
              <input type="number" className="text-input px-3 py-2 w-24" value={periodYear} onChange={(e) => setPeriodYear(parseInt(e.target.value) || new Date().getFullYear())} />
            </div>
            {periodGroupBy === 'month' && (
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Mois</label>
                <select className="text-input px-3 py-2" value={periodMonth} onChange={(e) => setPeriodMonth(parseInt(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="btn-outline" onClick={loadPeriodStats}>Appliquer</button>
          </div>

          {!periodLoading && periodStats && (
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-2">
                Statistiques pour {periodGroupBy === 'month' ? `le mois ${periodMonth}/${periodYear}` : `l'année ${periodYear}`}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <StatCard label="Total sessions" value={periodStats.global.total} />
                <StatCard label="Actives (en cours)" value={periodStats.global.active} />
                <StatCard label="Moyenne par jour" value={periodStats.distribution.length ? (periodStats.distribution.reduce((acc, d) => acc + d.count, 0) / periodStats.distribution.length).toFixed(1) : '0'} />
              </div>
              {periodStats.distribution.length > 0 && (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="table-standard text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-1">{periodGroupBy === 'month' ? 'Jour' : 'Mois'}</th>
                        <th className="px-3 py-1">Nombre de sessions ouvertes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodStats.distribution.map((d) => (
                        <tr key={d.period}>
                          <td className="px-3 py-1">{new Date(d.period).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td className="px-3 py-1 font-semibold">{d.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Statut</label>
              <select
                className="text-input px-3 py-2"
                value={whatsappStatusFilter}
                onChange={(e) => setWhatsappStatusFilter(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="active">Active</option>
                <option value="expired">Expirée</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Numéro</label>
              <input
                className="text-input px-3 py-2"
                placeholder="+237..."
                value={whatsappPhoneFilter}
                onChange={(e) => setWhatsappPhoneFilter(e.target.value)}
              />
            </div>
            <button className="btn-outline" onClick={() => loadWhatsappSessions(1)}>Rafraîchir</button>
            <button className="btn-outline" onClick={exportWhatsappSessions}>Exporter CSV</button>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Client ID</th>
                  <th className="px-4 py-2 text-left">Numéro</th>
                  <th className="px-4 py-2 text-left">Canal</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                  <th className="px-4 py-2 text-left">Ouverture</th>
                  <th className="px-4 py-2 text-left">Expiration</th>
                  <th className="px-4 py-2 text-left">Dernier entrant</th>
                  <th className="px-4 py-2 text-left">Relances</th>
                </tr>
              </thead>
              <tbody>
                {whatsappLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">Chargement...</td></tr>}
                {!whatsappLoading && whatsappList.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">Aucune session trouvée</td></tr>
                )}
                {whatsappList.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-sm">{s.client_id.slice(0, 8)}…</td>
                    <td className="px-4 py-2">{s.recipient_phone}</td>
                    <td className="px-4 py-2">{s.channel_number || '—'}</td>
                    <td className="px-4 py-2">
                      {s.status === 'active' ? (
                        <span className="badge-success">Active</span>
                      ) : (
                        <span className="badge-warning bg-red-100 text-red-700">Expirée</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">{new Date(s.window_opened_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-sm">{new Date(s.window_expires_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-sm">{s.last_inbound_at ? new Date(s.last_inbound_at).toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-2 text-sm">{s.reengagement_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={whatsappPagination} onChange={(p) => loadWhatsappSessions(p)} />
          </div>
        </div>
      )}

    </div>
  );
}

// ─── COMPOSANTS UTILITAIRES ──────────────────────────────────────

function StatCard({ label, value, isDanger }: { label: string; value?: string; isDanger?: boolean }) {
  return (
    <div className="card">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${isDanger ? 'text-red-600' : 'text-primary'}`}>{value ?? '—'}</div>
    </div>
  );
}

function StateChip({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-neutral-100 rounded-lg px-3 py-2 text-center">
      <div className="text-lg font-semibold text-primary">{value ?? '—'}</div>
      <div className="text-neutral-500">{label}</div>
    </div>
  );
}

function Pagination({
  pagination,
  onChange,
}: {
  pagination: { total: number; page: number; totalPages: number };
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex justify-between items-center mt-4 text-sm text-neutral-500">
      <span>{pagination.total} résultat(s) — page {pagination.page}/{pagination.totalPages || 1}</span>
      <div className="flex gap-2">
        <button className="btn-outline px-3 py-1" disabled={pagination.page <= 1} onClick={() => onChange(pagination.page - 1)}>
          Précédent
        </button>
        <button className="btn-outline px-3 py-1" disabled={pagination.page >= pagination.totalPages} onClick={() => onChange(pagination.page + 1)}>
          Suivant
        </button>
      </div>
    </div>
  );
}
