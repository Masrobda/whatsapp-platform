// app/sessions/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';

// ⚠️ À adapter : URL de base de votre API et récupération du token JWT.
// Remplacez getAuthToken() par votre mécanisme d'auth existant (contexte,
// cookie, store...) si ce n'est pas déjà un simple localStorage.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com';

// Nettoyer la base pour ne garder que le domaine
const baseUrl = API_BASE.replace(/\/api\/v1\/?$/, ''); // retire /api/v1 final s'il existe

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

type SessionStats = {
  active: string;
  expiring_soon: string;
  expired: string;
  total: string;
};

type SessionRow = {
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

function formatCountdown(expiresAt: string, status: string) {
  if (status !== 'active') return '—';
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Expire à l\'instant';
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes}min restantes`;
}

function StatusBadge({ status, expiresAt }: { status: string; expiresAt: string }) {
  const isExpiringSoon =
    status === 'active' && new Date(expiresAt).getTime() - Date.now() < 3600000;

  if (status === 'expired') {
    return <span className="badge-warning bg-red-100 text-red-700">Expirée</span>;
  }
  if (isExpiringSoon) {
    return <span className="badge-warning">Expire bientôt</span>;
  }
  return <span className="badge-success">Active</span>;
}

export default function SessionsDashboardPage() {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [phoneFilter, setPhoneFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reengageTarget, setReengageTarget] = useState<SessionRow | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch('/sessions/stats');
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const loadSessions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (phoneFilter) params.set('phone', phoneFilter);
      params.set('page', String(page));
      params.set('limit', String(pagination.limit));

      const data = await apiFetch(`/sessions?${params.toString()}`);
      setSessions(data.sessions);
      setPagination(data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, phoneFilter, pagination.limit]);

  useEffect(() => {
    loadStats();
    loadSessions(1);
    const interval = setInterval(() => {
      loadStats();
      loadSessions(pagination.page);
    }, 30000); // auto-refresh toutes les 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, phoneFilter]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Sessions WhatsApp (fenêtre 24h)</h1>
        <p className="text-neutral-500">
          Suivi des fenêtres de conversation ouvertes par les réponses clients.
        </p>
      </div>

      {error && (
        <div className="alert-info border-red-400 bg-red-50 text-red-700">{error}</div>
      )}

      {/* Cartes de stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Sessions actives" value={stats?.active} color="primary" />
        <StatCard label="Expirent dans <1h" value={stats?.expiring_soon} color="secondary" />
        <StatCard label="Expirées" value={stats?.expired} color="accent" isDanger />
        <StatCard label="Total suivi" value={stats?.total} color="primary" />
      </div>

      {/* Filtres */}
      <div className="card flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-neutral-600 mb-1">Statut</label>
          <select
            className="text-input px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
          />
        </div>
        <button className="btn-outline" onClick={() => loadSessions(1)}>
          Rafraîchir
        </button>
      </div>

      {/* Table des sessions */}
      <div className="card overflow-x-auto">
        <table className="table-standard">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Numéro</th>
              <th className="px-4 py-2 text-left">Client</th>
              <th className="px-4 py-2 text-left">Statut</th>
              <th className="px-4 py-2 text-left">Fenêtre</th>
              <th className="px-4 py-2 text-left">Dernier message reçu</th>
              <th className="px-4 py-2 text-left">Relances</th>
              <th className="px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">Chargement...</td></tr>
            )}
            {!loading && sessions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">Aucune session trouvée</td></tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">{s.recipient_phone}</td>
                <td className="px-4 py-2 text-neutral-500 text-sm">{s.client_id.slice(0, 8)}...</td>
                <td className="px-4 py-2"><StatusBadge status={s.status} expiresAt={s.window_expires_at} /></td>
                <td className="px-4 py-2 text-sm">{formatCountdown(s.window_expires_at, s.status)}</td>
                <td className="px-4 py-2 text-sm text-neutral-500">
                  {s.last_inbound_at ? new Date(s.last_inbound_at).toLocaleString('fr-FR') : '—'}
                </td>
                <td className="px-4 py-2 text-sm">{s.reengagement_count}</td>
                <td className="px-4 py-2">
                  {s.status === 'expired' && (
                    <button className="btn-outline text-sm px-3 py-1" onClick={() => setReengageTarget(s)}>
                      Relancer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4 text-sm text-neutral-500">
          <span>{pagination.total} session(s) — page {pagination.page}/{pagination.totalPages || 1}</span>
          <div className="flex gap-2">
            <button
              className="btn-outline px-3 py-1"
              disabled={pagination.page <= 1}
              onClick={() => loadSessions(pagination.page - 1)}
            >
              Précédent
            </button>
            <button
              className="btn-outline px-3 py-1"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadSessions(pagination.page + 1)}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {reengageTarget && (
        <ReengageModal
          session={reengageTarget}
          onClose={() => setReengageTarget(null)}
          onSuccess={() => {
            setReengageTarget(null);
            loadSessions(pagination.page);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  isDanger,
}: {
  label: string;
  value?: string;
  color: string;
  isDanger?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${isDanger ? 'text-red-600' : 'text-primary'}`}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function ReengageModal({
  session,
  onClose,
  onSuccess,
}: {
  session: SessionRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState(session.channel_number || '');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('fr');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!phoneNumber || !templateName) {
      setFormError('Numéro émetteur et nom du template requis');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch(`/sessions/${session.client_id}/${encodeURIComponent(session.recipient_phone)}/reengage`, {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          template_name: templateName,
          template_language: templateLanguage,
          template_params: {},
        }),
      });
      onSuccess();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="card w-full max-w-md">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Relancer {session.recipient_phone}</h2>
        </div>

        {formError && <div className="alert-info border-red-400 bg-red-50 text-red-700 mb-4">{formError}</div>}

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Numéro émetteur (channel)</label>
            <input className="text-input px-3 py-2 w-full" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Nom du template approuvé</label>
            <input className="text-input px-3 py-2 w-full" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="ex: relance_24h" />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 mb-1">Langue</label>
            <input className="text-input px-3 py-2 w-full" value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-outline" onClick={onClose} disabled={submitting}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Envoi...' : 'Envoyer le template'}
          </button>
        </div>
      </div>
    </div>
  );
}
