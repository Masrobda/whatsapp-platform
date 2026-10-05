// app/dashboard/settings/webhooks/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Tabs from '@/components/ui/Tabs';
import Pagination from '@/components/ui/Pagination';
import {
  FiPlus, FiTrash2, FiEdit2, FiCheck, FiX, FiRefreshCw,
  FiClock, FiAlertCircle, FiCheckCircle, FiCopy,
  FiEye, FiEyeOff, FiBell, FiShield, FiZap, FiLoader,
  FiActivity, FiCode, FiAlertTriangle, FiArrowRight,
  FiKey, FiLink, FiToggleLeft, FiToggleRight
} from 'react-icons/fi';
import { copyToClipboard } from '@/lib/utils';
import Cookies from 'js-cookie';

// ── Types ────────────────────────────────────────────────────
interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  last_status?: number;
  last_error?: string;
}

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

// ── Constants ─────────────────────────────────────────────────
const AVAILABLE_EVENTS = [
  { value: 'message.sent',      label: 'Message envoyé',   icon: '📨', desc: 'Accepté par les serveurs WhatsApp' },
  { value: 'message.delivered', label: 'Message délivré',  icon: '✅', desc: 'Reçu sur le téléphone du destinataire' },
  { value: 'message.read',      label: 'Message lu',       icon: '👁️', desc: 'Ouvert par le destinataire' },
  { value: 'message.failed',    label: 'Échec d\'envoi',   icon: '❌', desc: 'Le message n\'a pas pu être délivré' },
  { value: 'message.incoming',  label: 'Réponse reçue',   icon: '💬', desc: 'Un contact vous répond sur WhatsApp' },
];

const EVENT_COLORS: Record<string, string> = {
  'message.sent':      'bg-blue-100 text-blue-700 border-blue-200',
  'message.delivered': 'bg-green-100 text-green-700 border-green-200',
  'message.read':      'bg-purple-100 text-purple-700 border-purple-200',
  'message.failed':    'bg-red-100 text-red-700 border-red-200',
  'message.incoming':  'bg-amber-100 text-amber-700 border-amber-200',
  'message.test':      'bg-gray-100 text-gray-700 border-gray-200',
};

function genSecret(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  }
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ── Main Component ────────────────────────────────────────────
export default function WebhooksSettingsPage() {
  const [webhooks, setWebhooks]       = useState<Webhook[]>([]);
  const [logs, setLogs]               = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState('webhooks');
  const [toast, setToast]             = useState<{ type: 'ok' | 'err' | 'warn'; msg: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});

  // Formulaire
  const [formUrl, setFormUrl]         = useState('');
  const [formSecret, setFormSecret]   = useState('');
  const [formEvents, setFormEvents]   = useState<string[]>(['message.delivered', 'message.read', 'message.failed']);
  const [showFormSecret, setShowFormSecret] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied]           = useState<string | null>(null);

  // Secret modal après création
  const [createdWebhook, setCreatedWebhook] = useState<Webhook | null>(null);
  const [showCreatedSecret, setShowCreatedSecret] = useState(false);

  // Logs pagination
  const [logPage, setLogPage]         = useState(1);
  const [logTotal, setLogTotal]       = useState(0);
  const LOG_LIMIT = 20;

  const token = () => Cookies.get('token') || localStorage.getItem('token') || '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const showToast = (type: 'ok' | 'err' | 'warn', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Loaders ──────────────────────────────────────────────────
  useEffect(() => { loadWebhooks(); }, []);
  useEffect(() => { if (activeTab === 'logs') loadLogs(); }, [activeTab, logPage]);

  const loadWebhooks = async () => {
    setIsLoading(true);
    try {
      const res  = await fetch(`${apiUrl}/webhooks/client`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (data.success) setWebhooks(data.webhooks || []);
    } catch { showToast('err', 'Impossible de charger les webhooks'); }
    finally { setIsLoading(false); }
  };

  const loadLogs = async () => {
    try {
      const res  = await fetch(`${apiUrl}/webhooks/client/logs?page=${logPage}&limit=${LOG_LIMIT}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (data.success) { setLogs(data.logs || []); setLogTotal(data.total || 0); }
    } catch { showToast('err', 'Impossible de charger les logs'); }
  };

  // ── CRUD ──────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingId(null);
    setFormUrl('');
    setFormSecret('');
    setFormEvents(['message.delivered', 'message.read', 'message.failed']);
    setShowFormSecret(false);
  };

  const startEdit = (w: Webhook) => {
    setEditingId(w.id);
    setFormUrl(w.url);
    setFormSecret(w.secret || '');
    setFormEvents(w.events || []);
    setShowFormSecret(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveWebhook = async () => {
    if (!formUrl.trim()) { showToast('warn', 'Veuillez entrer une URL valide'); return; }
    if (formEvents.length === 0) { showToast('warn', 'Sélectionnez au moins un événement'); return; }

    setIsSaving(true);
    try {
      const isEdit = !!editingId;
      const method = isEdit ? 'PUT' : 'POST';
      const url    = isEdit
        ? `${apiUrl}/webhooks/client/${editingId}`
        : `${apiUrl}/webhooks/client`;

      const body: any = { url: formUrl, events: formEvents };
      if (formSecret) body.secret = formSecret;
      if (isEdit) body.is_active = webhooks.find(w => w.id === editingId)?.is_active ?? true;

      const res  = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        showToast('ok', isEdit ? 'Webhook mis à jour ✓' : 'Webhook créé ✓');
        if (!isEdit && data.webhook) {
          setCreatedWebhook(data.webhook);
          setShowCreatedSecret(true);
        }
        resetForm();
        await loadWebhooks();
      } else {
        showToast('err', data.message || 'Erreur lors de la sauvegarde');
      }
    } catch (e: any) {
      showToast('err', e.message || 'Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Supprimer ce webhook définitivement ?')) return;
    try {
      const res  = await fetch(`${apiUrl}/webhooks/client/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (data.success) { showToast('ok', 'Webhook supprimé'); await loadWebhooks(); }
      else showToast('err', data.message || 'Erreur suppression');
    } catch { showToast('err', 'Erreur réseau'); }
  };

  const toggleWebhook = async (w: Webhook) => {
    try {
      const res  = await fetch(`${apiUrl}/webhooks/client/${w.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: w.url, events: w.events, is_active: !w.is_active })
      });
      const data = await res.json();
      if (data.success) await loadWebhooks();
    } catch { showToast('err', 'Erreur réseau'); }
  };

  const testWebhook = async (w: Webhook) => {
    setTestLoading(p => ({ ...p, [w.id]: true }));
    setTestResults(p => ({ ...p, [w.id]: null }));
    try {
      const res  = await fetch(`${apiUrl}/webhooks/client/${w.id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setTestResults(p => ({ ...p, [w.id]: data }));
      setTimeout(() => setTestResults(p => ({ ...p, [w.id]: null })), 6000);
    } catch {
      setTestResults(p => ({ ...p, [w.id]: { success: false, message: 'Erreur de connexion' } }));
    } finally {
      setTestLoading(p => ({ ...p, [w.id]: false }));
    }
  };

  const copyText = async (text: string, key: string) => {
    await copyToClipboard(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── UI helpers ────────────────────────────────────────────────
  const StatusIcon = ({ status }: { status?: number }) => {
    if (!status) return <FiClock className="text-gray-400" size={14} />;
    return status >= 200 && status < 300
      ? <FiCheckCircle className="text-green-500" size={14} />
      : <FiAlertCircle className="text-red-500" size={14} />;
  };

  // ── SECRET REVEAL MODAL ───────────────────────────────────────
  const SecretModal = () => {
    if (!showCreatedSecret || !createdWebhook) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="bg-amber-500 p-5 text-white">
            <div className="flex items-center gap-3 mb-1">
              <FiKey size={22} />
              <h2 className="text-lg font-bold">Notez votre secret maintenant !</h2>
            </div>
            <p className="text-amber-100 text-sm">Il ne sera plus affiché en clair après fermeture.</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">URL</label>
              <p className="font-mono text-sm bg-gray-50 px-3 py-2 rounded-lg border break-all">{createdWebhook.url}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Secret (HMAC-SHA256)</label>
              <div className="flex gap-2 items-center">
                <p className="flex-1 font-mono text-sm bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg break-all text-amber-900 select-all">
                  {createdWebhook.secret}
                </p>
                <button
                  onClick={() => copyText(createdWebhook.secret, 'modal-secret')}
                  className="shrink-0 p-2 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                >
                  {copied === 'modal-secret' ? <FiCheck className="text-green-600" /> : <FiCopy className="text-amber-700" />}
                </button>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <strong>Comment l'utiliser :</strong> Stockez ce secret dans une variable d'environnement
              (<code>WEBHOOK_SECRET</code>) sur votre serveur et vérifiez le header
              <code className="bg-amber-100 px-1 rounded mx-1">X-Webhook-Signature</code> à chaque requête.
            </div>
            <Button onClick={() => { setShowCreatedSecret(false); setCreatedWebhook(null); }} className="w-full">
              J'ai bien noté mon secret <FiCheck className="ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ── FORM ──────────────────────────────────────────────────────
  const FormSection = () => (
    <Card className="border-2 border-dashed border-[#2d7a3e]/30 bg-[#f0f7f3]/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {editingId ? <><FiEdit2 size={18} /> Modifier le webhook</> : <><FiPlus size={18} /> Nouveau webhook</>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* URL */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            URL de réception <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 items-center">
            <FiLink className="text-gray-400 shrink-0" />
            <input
              type="url"
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
              placeholder="https://votre-serveur.com/webhook/numericexport"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[#2d7a3e] focus:ring-2 focus:ring-[#2d7a3e]/20 outline-none transition"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">URL publique HTTPS accessible depuis internet</p>
        </div>

        {/* Secret */}
        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-2">
            <FiShield size={14} className="text-[#2d7a3e]" />
            Secret de signature
            <span className="text-xs font-normal text-gray-400 ml-1">(optionnel — généré automatiquement si vide)</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showFormSecret ? 'text' : 'password'}
                value={formSecret}
                onChange={e => setFormSecret(e.target.value)}
                placeholder="Laissez vide pour une génération automatique sécurisée"
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:border-[#2d7a3e] focus:ring-2 focus:ring-[#2d7a3e]/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowFormSecret(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showFormSecret ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            <Button type="button" variant="outline" onClick={() => { setFormSecret(genSecret()); setShowFormSecret(true); }}>
              <FiRefreshCw size={14} className="mr-1" /> Générer
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Utilisé pour signer chaque payload avec HMAC-SHA256 → header <code className="bg-gray-100 px-1 rounded">X-Webhook-Signature</code>
          </p>
        </div>

        {/* Events */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Événements à recevoir <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_EVENTS.map(ev => {
              const checked = formEvents.includes(ev.value);
              return (
                <label
                  key={ev.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    checked
                      ? 'border-[#2d7a3e] bg-[#f0f7f3]'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => setFormEvents(
                      e.target.checked
                        ? [...formEvents, ev.value]
                        : formEvents.filter(v => v !== ev.value)
                    )}
                    className="mt-0.5 accent-[#2d7a3e]"
                  />
                  <div>
                    <span className="text-sm font-medium">{ev.icon} {ev.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{ev.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button onClick={saveWebhook} disabled={isSaving} className="flex items-center gap-2">
            {isSaving
              ? <><FiLoader className="animate-spin" size={14} /> Enregistrement...</>
              : <><FiCheck size={14} /> {editingId ? 'Mettre à jour' : 'Créer le webhook'}</>
            }
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>
              <FiX size={14} className="mr-1" /> Annuler
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // ── WEBHOOKS LIST ─────────────────────────────────────────────
  const WebhooksList = () => {
    if (isLoading) return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d7a3e]" />
      </div>
    );

    if (webhooks.length === 0) return (
      <div className="text-center py-16 border-2 border-dashed rounded-xl text-gray-400">
        <FiBell size={48} className="mx-auto mb-4 opacity-20" />
        <p className="font-medium">Aucun webhook configuré</p>
        <p className="text-sm mt-1">Remplissez le formulaire ci-dessus pour en créer un</p>
      </div>
    );

    return (
      <div className="space-y-3">
        {webhooks.map(w => {
          const test = testResults[w.id];
          return (
            <div key={w.id} className="border rounded-xl p-5 bg-white hover:shadow-sm transition-shadow">
              {/* Header */}
              <div className="flex justify-between items-start gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${w.is_active ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-gray-300'}`} />
                    <code className="text-sm font-mono bg-gray-100 px-2.5 py-1 rounded-lg truncate max-w-xs" title={w.url}>
                      {w.url}
                    </code>
                    <button
                      onClick={() => toggleWebhook(w)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        w.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {w.is_active ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />}
                      {w.is_active ? 'Actif' : 'Inactif'}
                    </button>
                  </div>
                  {/* Events */}
                  <div className="flex flex-wrap gap-1.5">
                    {(w.events || []).map(ev => (
                      <span key={ev} className={`px-2 py-0.5 rounded-full text-xs font-medium border ${EVENT_COLORS[ev] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => testWebhook(w)}
                    disabled={testLoading[w.id]}
                    title="Tester ce webhook"
                    className="p-2 rounded-lg border border-gray-200 hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-50"
                  >
                    {testLoading[w.id]
                      ? <FiLoader size={15} className="animate-spin text-amber-500" />
                      : <FiZap size={15} className="text-amber-500" />}
                  </button>
                  <button
                    onClick={() => startEdit(w)}
                    title="Modifier"
                    className="p-2 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <FiEdit2 size={15} className="text-blue-500" />
                  </button>
                  <button
                    onClick={() => deleteWebhook(w.id)}
                    title="Supprimer"
                    className="p-2 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                  >
                    <FiTrash2 size={15} className="text-red-500" />
                  </button>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3 flex-wrap">
                <span>Créé {new Date(w.created_at).toLocaleString('fr-FR')}</span>
                {w.last_triggered_at && (
                  <span className="flex items-center gap-1">
                    <FiActivity size={11} />
                    Dernier appel : {new Date(w.last_triggered_at).toLocaleString('fr-FR')}
                  </span>
                )}
                {w.last_status && (
                  <span className="flex items-center gap-1">
                    <StatusIcon status={w.last_status} />
                    HTTP {w.last_status}
                  </span>
                )}
              </div>

              {/* Secret row */}
              {w.secret && (
                <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <FiShield size={13} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 shrink-0">Secret :</span>
                  <code className="flex-1 text-xs font-mono text-gray-700 truncate">
                    {showSecrets[w.id] ? w.secret : '•'.repeat(Math.min(w.secret.length, 48))}
                  </code>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setShowSecrets(p => ({ ...p, [w.id]: !p[w.id] }))}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title={showSecrets[w.id] ? 'Masquer' : 'Afficher'}
                    >
                      {showSecrets[w.id] ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                    </button>
                    <button
                      onClick={() => copyText(w.secret, `secret-${w.id}`)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Copier"
                    >
                      {copied === `secret-${w.id}` ? <FiCheck size={13} className="text-green-500" /> : <FiCopy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Test result */}
              {test && (
                <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  test.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {test.success
                    ? <FiCheckCircle size={15} className="shrink-0" />
                    : <FiAlertCircle size={15} className="shrink-0" />}
                  <span className="font-medium">{test.success ? 'Test réussi' : 'Test échoué'}</span>
                  <span className="text-xs opacity-80 ml-1">
                    {test.message}{test.duration ? ` · ${test.duration}ms` : ''}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── LOGS ──────────────────────────────────────────────────────
  const LogsList = () => (
    <div className="space-y-3">
      {logs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-gray-400">
          <FiClock size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">Aucun log pour le moment</p>
          <p className="text-sm mt-1">Les appels webhook apparaîtront ici</p>
        </div>
      ) : (
        <>
          {logs.map(log => (
            <div key={log.id} className="border rounded-xl p-4 bg-white hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusIcon status={log.response_status} />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${EVENT_COLORS[log.event] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {log.event}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                    log.response_status >= 200 && log.response_status < 300
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    HTTP {log.response_status || '—'}
                  </span>
                  {log.url && (
                    <code className="text-xs text-gray-400 truncate max-w-[200px]" title={log.url}>{log.url}</code>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                  <span>{log.duration_ms}ms</span>
                  <span>{new Date(log.created_at).toLocaleString('fr-FR')}</span>
                </div>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 select-none">
                  Voir le payload
                </summary>
                <pre className="mt-2 p-3 bg-[#0d1117] text-green-300 rounded-lg overflow-x-auto max-h-40 leading-relaxed">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </details>

              {log.response_body && (
                <details className="text-xs mt-1">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700 select-none">
                    Réponse de votre serveur
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded-lg overflow-x-auto max-h-24 text-gray-700">
                    {log.response_body}
                  </pre>
                </details>
              )}

              {log.response_status !== 200 && log.response_status !== 0 && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <FiAlertTriangle size={12} /> HTTP {log.response_status} — Vérifiez que votre endpoint répond bien avec 200
                </p>
              )}
            </div>
          ))}
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
  );

  // ── CODE EXAMPLE ──────────────────────────────────────────────
  const CodeExample = () => (
    <Card>
      <CardHeader>
        <CardTitle>💻 Recevoir un webhook — Node.js (Express)</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-[#0d1117] text-white p-5 rounded-xl overflow-x-auto text-sm leading-relaxed">
{`const express = require('express');
const crypto  = require('crypto');
const app     = express();

app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // votre secret

app.post('/webhook/numericexport', (req, res) => {
  // ① Répondre 200 immédiatement (timeout = 10s)
  res.sendStatus(200);

  // ② Vérifier la signature HMAC-SHA256
  const sig      = req.headers['x-webhook-signature'];
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig || ''), Buffer.from(expected))) {
    console.error('❌ Signature invalide — requête ignorée');
    return;
  }

  // ③ Traiter l'événement de façon asynchrone
  const { event, timestamp, data } = req.body;

  switch (event) {
    case 'message.sent':
      console.log(\`✉️  \${data.recipient} — message accepté\`);
      break;
    case 'message.delivered':
      // db.query('UPDATE messages SET status=$1 WHERE id=$2', ['delivered', data.message_id])
      console.log(\`✅ \${data.recipient} — délivré à \${data.delivered_at}\`);
      break;
    case 'message.read':
      console.log(\`👁️  \${data.recipient} — lu à \${data.read_at}\`);
      break;
    case 'message.failed':
      console.error(\`❌ \${data.recipient} — échec [\${data.message_id}]\`);
      break;
    case 'message.incoming':
      console.log(\`💬 Réponse de \${data.from}: "\${data.message}"\`);
      break;
  }
});

app.listen(3000);`}
        </pre>
      </CardContent>
    </Card>
  );

  // ── TABS ──────────────────────────────────────────────────────
  const tabs = [
    { id: 'webhooks', label: `📋 Mes webhooks (${webhooks.length})`, content: <WebhooksList /> },
    { id: 'logs',     label: '📜 Historique',                         content: <LogsList /> },
    { id: 'code',     label: '💻 Code exemple',                       content: <CodeExample /> },
  ];

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">
      {/* Secret modal */}
      <SecretModal />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-40 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'ok'   ? 'bg-green-600 text-white' :
          toast.type === 'warn' ? 'bg-amber-500 text-white' :
                                  'bg-red-600 text-white'
        }`}>
          {toast.type === 'ok'   && <FiCheckCircle size={16} />}
          {toast.type === 'warn' && <FiAlertTriangle size={16} />}
          {toast.type === 'err'  && <FiAlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark">Configuration Webhooks</h1>
        <p className="text-gray-500 mt-1">Recevez les événements en temps réel sur votre propre serveur</p>
      </div>

      {/* Form */}
      <FormSection />

      {/* List + Logs + Code */}
      <Tabs tabs={tabs} defaultTab="webhooks" onTabChange={setActiveTab} />

      {/* Security reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <FiShield size={16} /> Bonnes pratiques de sécurité
        </h3>
        <ul className="text-sm text-blue-700 space-y-1.5">
          <li className="flex items-start gap-2"><FiCheck size={14} className="mt-0.5 shrink-0 text-blue-500" /> Stockez le secret dans une variable d'environnement, jamais dans votre code</li>
          <li className="flex items-start gap-2"><FiCheck size={14} className="mt-0.5 shrink-0 text-blue-500" /> Vérifiez <code className="bg-blue-100 px-1 rounded">X-Webhook-Signature</code> sur chaque requête avec <code className="bg-blue-100 px-1 rounded">timingSafeEqual</code></li>
          <li className="flex items-start gap-2"><FiCheck size={14} className="mt-0.5 shrink-0 text-blue-500" /> Répondez HTTP 200 <strong>immédiatement</strong> avant de traiter (timeout : 10s)</li>
          <li className="flex items-start gap-2"><FiCheck size={14} className="mt-0.5 shrink-0 text-blue-500" /> En cas d'échec, notre système effectue jusqu'à 3 nouvelles tentatives automatiques</li>
          <li className="flex items-start gap-2"><FiCheck size={14} className="mt-0.5 shrink-0 text-blue-500" /> Utilisez HTTPS uniquement — les URL HTTP sont rejetées</li>
        </ul>
      </div>
    </div>
  );
}
