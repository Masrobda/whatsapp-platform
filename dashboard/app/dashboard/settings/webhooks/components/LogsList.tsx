// app/dashboard/settings/webhooks/components/LogsList.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiClock,
  FiAlertCircle,
  FiCheckCircle,
  FiSend,
  FiInbox,
  FiEye,
} from 'react-icons/fi';
import Pagination from '@/components/ui/Pagination';
import { copyToClipboard } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────
interface WebhookLog {
  id: string;
  webhook_id: string;
  url?: string;
  event: string;
  payload: any;
  response_status: number;
  response_body?: string;
  duration_ms: number;
  created_at: string;
}

// ── Design tokens ────────────────────────────────────────────
// (recopiés depuis page.tsx pour autonomie)
const BRAND = '#2d7a3e';

const AVAILABLE_EVENTS = [
  { value: 'message.sent', label: 'Message envoyé', icon: FiSend },
  { value: 'message.delivered', label: 'Message délivré', icon: FiCheckCircle },
  { value: 'message.read', label: 'Message lu', icon: FiEye },
  { value: 'message.failed', label: "Échec d'envoi", icon: FiAlertCircle },
  { value: 'message.incoming', label: 'Réponse reçue', icon: FiInbox },
];

const EVENT_STYLES: Record<string, { badge: string }> = {
  'message.sent':      { badge: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  'message.delivered': { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  'message.read':      { badge: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  'message.failed':    { badge: 'bg-red-50 text-red-700 ring-red-600/20' },
  'message.incoming':  { badge: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  'message.test':      { badge: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
};

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  AVAILABLE_EVENTS.map((e) => [e.value, e.label])
);

// ── UI atoms ──────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: any;
  title: string;
  hint: string;
}) {
  return (
    <div className="text-center py-16 px-6 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
      <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
        <Icon size={20} className="text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">{hint}</p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

// ── Props ────────────────────────────────────────────────────
interface LogsListProps {
  apiUrl: string;
  token: () => string;
  activeTab: string;
  logs: WebhookLog[];
  setLogs: (logs: WebhookLog[]) => void;
  logTotal: number;
  setLogTotal: (total: number) => void;
  logPage: number;
  setLogPage: (page: number) => void;
  showToast: (type: 'ok' | 'err' | 'warn', msg: string) => void;
}

// ── Composant principal ──────────────────────────────────────
export function LogsList({
  apiUrl,
  token,
  activeTab,
  logs,
  setLogs,
  logTotal,
  setLogTotal,
  logPage,
  setLogPage,
  showToast,
}: LogsListProps) {
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState<{ total: number; by_event: Record<string, number> } | null>(null);

  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const LOG_LIMIT = 20;

  const loadFilteredLogs = useCallback(
    async (force = false) => {
      if (isLoadingRef.current && !force) return;
      if (!mountedRef.current) return;

      isLoadingRef.current = true;
      setLogsLoading(true);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        let url = `${apiUrl}/webhooks/client/logs?page=${logPage}&limit=${LOG_LIMIT}`;
        if (filterEvent) url += `&event_type=${filterEvent}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token()}` },
          signal: controller.signal,
        });
        const data = await res.json();

        if (!mountedRef.current) return;
        if (data.success) {
          setLogs(data.logs || []);
          setLogTotal(data.total || 0);
        } else {
          showToast('err', data.message || 'Impossible de charger les logs');
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (mountedRef.current) {
          showToast('err', 'Impossible de charger les logs');
        }
      } finally {
        if (mountedRef.current) {
          setLogsLoading(false);
          isLoadingRef.current = false;
        }
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [apiUrl, logPage, filterEvent, token, setLogs, setLogTotal, showToast]
  );

  const loadStats = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const res = await fetch(`${apiUrl}/webhooks/client/logs/stats`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (mountedRef.current && data.success) {
        setStats(data);
      }
    } catch {
      // ignore
    }
  }, [apiUrl, token]);

  useEffect(() => {
    mountedRef.current = true;

    if (activeTab !== 'logs') {
      mountedRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      loadFilteredLogs();
      loadStats();
    }, 200);

    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [activeTab, logPage, filterEvent, loadFilteredLogs, loadStats]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterEvent(e.target.value);
    setLogPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
        <label htmlFor="event-filter" className="text-sm font-medium text-gray-700">
          Filtrer :
        </label>
        <select
          id="event-filter"
          value={filterEvent}
          onChange={handleFilterChange}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-[var(--brand)] outline-none"
          style={{ '--brand': BRAND } as React.CSSProperties}
        >
          <option value="">Tous les événements</option>
          {AVAILABLE_EVENTS.map((ev) => (
            <option key={ev.value} value={ev.value}>
              {ev.label}
            </option>
          ))}
          <option value="message.test">Test</option>
        </select>

        {stats && (
          <div className="flex flex-wrap gap-2 ml-auto">
            {Object.keys(EVENT_LABEL).map((ev) => {
              const style = EVENT_STYLES[ev] || EVENT_STYLES['message.test'];
              return (
                <span
                  key={ev}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold ring-1 ring-inset ${style.badge}`}
                >
                  {stats.by_event[ev] || 0}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {logsLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : logs.length === 0 ? (
          <EmptyState
            icon={FiClock}
            title="Aucun log pour le moment"
            hint="Les appels webhook apparaîtront ici dès qu'un événement sera déclenché."
          />
        ) : (
          <>
            {logs.map((log) => {
              const event = log.event || 'unknown';
              const style = EVENT_STYLES[event] || EVENT_STYLES['message.test'];
              const payload = log.payload || {};
              const status = log.response_status || 200;
              const data = payload.data || payload;
              const recipient = data.recipient || data.recipient_phone || data.to || data.from || null;
              const messageId = data.message_id || data.id || null;
              const ok = status >= 200 && status < 300;

              return (
                <div
                  key={log.id}
                  className="border border-gray-200 rounded-2xl p-4 bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="flex justify-between items-start gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${style.badge}`}
                      >
                        {EVENT_LABEL[event] || event}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        HTTP {status || '—'}
                      </span>
                      {recipient && (
                        <span className="text-sm text-gray-700 font-mono">→ {recipient}</span>
                      )}
                      {messageId && (
                        <code
                          className="text-xs text-gray-400 truncate max-w-[150px]"
                          title={messageId}
                        >
                          #{String(messageId).slice(0, 8)}…
                        </code>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                      <span>{log.duration_ms ?? '—'}ms</span>
                      <span>{relativeTime(log.created_at)}</span>
                    </div>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700 select-none">
                      Voir le payload complet
                    </summary>
                    <pre className="mt-2 p-3 bg-[#0d1117] text-emerald-300 rounded-lg overflow-x-auto max-h-60 leading-relaxed">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}

            {logTotal > LOG_LIMIT && (
              <Pagination
                currentPage={logPage}
                totalPages={Math.ceil(logTotal / LOG_LIMIT)}
                onPageChange={setLogPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
