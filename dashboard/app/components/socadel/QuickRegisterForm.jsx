'use client';

import { useEffect, useState } from 'react';
import { socadelFetch } from '../../lib/socadel-auth';
import {
  captureGps,
  enqueueOffline,
  flushOfflineQueue,
  loadQueue,
  isProbablyOffline,
} from '../../lib/socadel-offline';

const IDENTITES = [
  { value: 'proprietaire', label: 'Propriétaire' },
  { value: 'relation', label: 'Relation' },
  { value: 'locataire', label: 'Locataire' },
  { value: 'bailleur', label: 'Bailleur' },
];

export default function QuickRegisterForm({ token: tokenProp }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contracts, setContracts] = useState([]);
  const [selected, setSelected] = useState([]);

  const [confirmExisting, setConfirmExisting] = useState(false);
  const [phone, setPhone] = useState('');
  const [smsOnly, setSmsOnly] = useState(false);
  const [identite, setIdentite] = useState('proprietaire');
  const [rapport, setRapport] = useState('MRA');

  const [pendingCount, setPendingCount] = useState(0);

  // Récupérer le token (prop ou localStorage)
  const token =
    tokenProp ||
    (typeof window !== 'undefined' ? localStorage.getItem('socadel_token') : null);

  const selectedContracts = contracts.filter((c) => selected.includes(c.service_no));
  const hasValidWa = selectedContracts.some((c) => c.has_valid_whatsapp);
  const primaryPhones = [
    ...new Set(selectedContracts.map((c) => c.primary_whatsapp).filter(Boolean)),
  ];

  /* ─────────────────────────────────────────
     Flush initial + écoute retour réseau
     ───────────────────────────────────────── */
  useEffect(() => {
    setPendingCount(loadQueue().length);

    const tryFlush = async () => {
      if (!token) return;
      if (isProbablyOffline()) return;
      const { sent } = await flushOfflineQueue(token);
      setPendingCount(loadQueue().length);
      if (sent > 0) {
        setSuccess(`${sent} enregistrement(s) hors-ligne synchronisé(s).`);
      }
    };

    tryFlush();

    const onOnline = () => tryFlush();
    window.addEventListener('online', onOnline);

    // Polling léger toutes les 30s si file non vide
    const interval = setInterval(() => {
      if (loadQueue().length > 0) tryFlush();
    }, 30000);

    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ─────────────────────────────────────────
     Recherche
     ───────────────────────────────────────── */
  async function handleSearch(e) {
    e?.preventDefault();
    setError('');
    setSuccess('');
    setContracts([]);
    setSelected([]);
    setConfirmExisting(false);
    setPhone('');
    if (!q.trim() || q.trim().length < 3) {
      setError('Saisissez au moins 3 caractères');
      return;
    }
    setLoading(true);
    try {
      const data = await socadelFetch(
        `/api/v1/socadel/quick-lookup?q=${encodeURIComponent(q.trim())}`
      );
      setContracts(data.contracts || []);
      const editable = (data.contracts || []).filter((c) => c.can_edit);
      setSelected(editable.map((c) => c.service_no));
      if (!editable.length) setError('Tous les clients trouvés sont déjà checkés.');
    } catch (err) {
      if (err.code === 'ALREADY_CHECKED') {
        setError(err.message);
        setContracts(err.data?.data?.contracts || err.data?.contracts || []);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleContract(sn) {
    setSelected((prev) =>
      prev.includes(sn) ? prev.filter((x) => x !== sn) : [...prev, sn]
    );
  }

  /* ─────────────────────────────────────────
     Submit avec GPS + offline
     ───────────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selected.length) {
      setError('Sélectionnez au moins un contrat');
      return;
    }

    setSaving(true);
    try {
      // 1) Capture GPS (jamais bloquant)
      setSuccess('Capture de la position…');
      const gps = await captureGps(12000);
      setSuccess('');

      // 2) Construction du body
      const body = {
        contracts: selected,
        confirm_existing_whatsapp: confirmExisting && hasValidWa,
        sms_only: smsOnly,
        identite,
        rapport: smsOnly ? 'OK' : rapport,
      };
      if (!(confirmExisting && hasValidWa && primaryPhones.length === 1)) {
        body.phone = phone;
      } else if (primaryPhones.length > 1) {
        body.phone = phone;
        body.confirm_existing_whatsapp = false;
      }
      if (gps) Object.assign(body, gps);

      // 3) Hors-ligne → file directe
      if (isProbablyOffline()) {
        enqueueOffline(body);
        setPendingCount(loadQueue().length);
        setSuccess(
          'Hors ligne : enregistrement mis en file. Envoi automatique dès le retour du réseau.'
        );
        resetAfterSuccess();
        return;
      }

      // 4) Tentative d'envoi en ligne
      let res;
      let json;
      try {
        res = await fetch('/api/v1/socadel/quick-register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        json = await res.json().catch(() => ({}));
      } catch {
        // Erreur réseau → file
        enqueueOffline(body);
        setPendingCount(loadQueue().length);
        setSuccess(
          'Erreur réseau : enregistrement mis en file hors-ligne. Synchronisation automatique.'
        );
        resetAfterSuccess();
        return;
      }

      // 5) Erreur serveur transitoire (5xx, 408, 0) → file
      if (!res.ok && (res.status >= 500 || res.status === 0 || res.status === 408)) {
        enqueueOffline(body);
        setPendingCount(loadQueue().length);
        setSuccess(
          'Réseau instable : mis en file hors-ligne. Synchronisation automatique.'
        );
        resetAfterSuccess();
        return;
      }

      // 6) Erreur métier (4xx) → affichage
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec enregistrement');
        return;
      }

      // 7) Succès
      setSuccess(
        json.message ||
          (json.data?.invoice_queued
            ? `Enregistré${gps ? ' (GPS OK)' : ' (GPS indisponible)'}. Facture en cours d’envoi.`
            : `Enregistré${gps ? ' (GPS OK)' : ''}.`)
      );
      resetAfterSuccess();
    } finally {
      setSaving(false);
    }
  }

  function resetAfterSuccess() {
    setContracts([]);
    setSelected([]);
    setQ('');
    setPhone('');
    setConfirmExisting(false);
  }

  const phoneRequired =
    !smsOnly && !(confirmExisting && hasValidWa && primaryPhones.length === 1);

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-24">
      <h2 className="text-lg font-semibold text-slate-800">Enregistrement rapide</h2>
      <p className="text-sm text-slate-500">
        Recherchez par n° de contrat ou compteur, confirmez le WhatsApp, enregistrez.
      </p>

      {pendingCount > 0 && (
        <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
          {pendingCount} enregistrement(s) en attente de synchronisation.
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Contrat ou compteur…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-3 text-base"
          inputMode="numeric"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#1a6fb5] text-white px-4 py-3 font-medium disabled:opacity-50"
        >
          {loading ? '…' : 'OK'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
          {success}
        </div>
      )}

      {contracts.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {contracts.map((c) => (
              <label
                key={c.service_no}
                className={`flex gap-3 p-3 rounded-xl border ${
                  c.can_edit
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-100 bg-slate-50 opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!c.can_edit}
                  checked={selected.includes(c.service_no)}
                  onChange={() => toggleContract(c.service_no)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">
                    {c.noms || 'Client'} — {c.service_no}
                  </div>
                  <div className="text-xs text-slate-500">
                    Compteur : {c.meter_no || '—'}
                    {c.is_subscribed && ' · Déjà abonné digital'}
                    {c.all_checked && ' · Déjà checké'}
                  </div>
                  {c.primary_whatsapp && (
                    <div className="text-xs text-emerald-700 mt-0.5">
                      WhatsApp : {c.primary_whatsapp}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          {hasValidWa && !smsOnly && (
            <label className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <input
                type="checkbox"
                checked={confirmExisting}
                onChange={(e) => setConfirmExisting(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-slate-700">
                Confirmer le numéro WhatsApp existant pour recevoir les factures
                {primaryPhones.length === 1 && (
                  <strong className="block text-[#1a6fb5]">{primaryPhones[0]}</strong>
                )}
                {primaryPhones.length > 1 && (
                  <span className="block text-amber-700 text-xs mt-1">
                    Plusieurs numéros différents : saisissez le numéro à utiliser ci-dessous.
                  </span>
                )}
              </span>
            </label>
          )}

          {(phoneRequired || smsOnly || (confirmExisting && primaryPhones.length > 1)) && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                {smsOnly ? 'Numéro SMS' : 'Numéro WhatsApp'} (+237…)
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2376XXXXXXXX"
                inputMode="tel"
                required={phoneRequired || smsOnly}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
              />
            </label>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={smsOnly}
              onChange={(e) => {
                setSmsOnly(e.target.checked);
                if (e.target.checked) setConfirmExisting(false);
              }}
            />
            <span className="text-sm text-slate-700">
              SMS uniquement (pas de WhatsApp)
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Identité</span>
            <select
              value={identite}
              onChange={(e) => setIdentite(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base bg-white"
            >
              {IDENTITES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>

          {!smsOnly && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Rapport</span>
              <select
                value={rapport}
                onChange={(e) => setRapport(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base bg-white"
              >
                <option value="MRA">MRA</option>
              </select>
            </label>
          )}

          <button
            type="submit"
            disabled={saving || !selected.length}
            className="w-full rounded-xl bg-emerald-600 text-white font-semibold py-3.5 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Valider l’enregistrement'}
          </button>
        </form>
      )}
    </div>
  );
}
