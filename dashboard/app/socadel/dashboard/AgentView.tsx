'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiLogOut,
  FiSearch,
  FiBarChart2,
  FiArrowLeft
} from 'react-icons/fi';
import StatsTab from './StatsTab';
import {
  captureGps,
  enqueueOffline,
  loadQueue,
  flushOfflineQueue,
  isProbablyOffline
} from '../../lib/socadel-offline';

type ContractLine = {
  id: string;
  itineraires: string | null;
  ref_geo: string | null;
  check_status: string | null;
  check_date: string | null;
  statut: string | null;
  numero_telephone: string | null;
  rapport: string | null;
  identite: string | null;
  region: string | null;
  division: string | null;
  agence: string | null;
};

type ContractCard = {
  service_no: string;
  meter_no: string | null;
  noms: string | null;
  primary_whatsapp: string | null;
  has_valid_whatsapp: boolean;
  can_edit: boolean;
  all_checked: boolean;
  is_subscribed?: boolean;
  lines?: ContractLine[];
};

function QuickRegisterForm({ token }: { token: string }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [contracts, setContracts] = useState<ContractCard[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const [confirmExisting, setConfirmExisting] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [smsOnly, setSmsOnly] = useState(false);
  const [identite, setIdentite] = useState('proprietaire');
  const [rapport, setRapport] = useState<'MRA' | 'OK'>('MRA');

  // Modale « Modifier le numéro »
  const [phoneEdit, setPhoneEdit] = useState<{
    open: boolean;
    lineId: string | null;
    current: string | null;
    digits: string;
  }>({ open: false, lineId: null, current: null, digits: '' });
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneEditMsg, setPhoneEditMsg] = useState('');
  const [phoneEditErr, setPhoneEditErr] = useState('');

  const gpsRef = useRef<{
    gps_lat: number;
    gps_lng: number;
    gps_accuracy: number;
    gps_captured_at: string;
  } | null>(null);

  const selectedContracts = contracts.filter((c) => selected.includes(c.service_no));
  const hasValidWa = selectedContracts.some((c) => c.has_valid_whatsapp);
  const primaryPhones = [
    ...new Set(
      selectedContracts.map((c) => c.primary_whatsapp).filter(Boolean) as string[]
    )
  ];

  const phoneRequired =
    !smsOnly && !(confirmExisting && hasValidWa && primaryPhones.length === 1);

  useEffect(() => {
    let cancelled = false;
    captureGps(5000).then((pos) => {
      if (!cancelled && pos) gpsRef.current = pos;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** termOverride : si fourni, remplace q (clic sur un résultat) */
  const search = async (termOverride?: string) => {
    setErr('');
    setMsg('');
    setContracts([]);
    setSelected([]);
    setConfirmExisting(false);
    setPhoneDigits('');

    const term = (termOverride ?? q).trim();
    if (termOverride !== undefined) setQ(termOverride);

    if (term.length < 3) {
      setErr('Saisissez au moins 3 caractères (contrat ou compteur)');
      return;
    }

    captureGps(5000).then((pos) => {
      if (pos) gpsRef.current = pos;
    });

    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/socadel/quick-lookup?q=${encodeURIComponent(term)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();

      if (res.status === 409 || json.code === 'ALREADY_CHECKED') {
        setErr(json.message || 'Client(s) déjà checké(s)');
        setContracts(json.data?.contracts || json.contracts || []);
        return;
      }
      if (!json.success && !json.found) {
        setErr(json.message || 'Aucun client trouvé');
        return;
      }

      const list: ContractCard[] = json.contracts || [];
      setContracts(list);
      const editable = list.filter((c) => c.can_edit);
      setSelected(editable.map((c) => c.service_no));
      if (!editable.length) {
        setErr('Client non trouvé.');
      }
    } catch {
      setErr('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (sn: string) => {
    setSelected((prev) =>
      prev.includes(sn) ? prev.filter((x) => x !== sn) : [...prev, sn]
    );
  };

  const submit = async () => {
    setErr('');
    setMsg('');
    if (!selected.length) {
      setErr('Sélectionnez au moins un contrat');
      return;
    }

    const body: Record<string, unknown> = {
      contracts: selected,
      confirm_existing_whatsapp:
        confirmExisting && hasValidWa && primaryPhones.length === 1,
      sms_only: smsOnly,
      identite,
      rapport: smsOnly ? 'OK' : rapport
    };

    if (phoneRequired || smsOnly || (confirmExisting && primaryPhones.length > 1)) {
      const digits = phoneDigits.replace(/\D/g, '');
      if (digits.length !== 9) {
        setErr('Numéro : 9 chiffres après +237');
        return;
      }
      body.phone = `+237${digits}`;
      if (primaryPhones.length > 1) {
        body.confirm_existing_whatsapp = false;
      }
    }

    let gps = gpsRef.current;
    if (!gps) {
      gps = await captureGps(2000);
      if (gps) gpsRef.current = gps;
    }
    if (gps) Object.assign(body, gps);

    if (isProbablyOffline()) {
      enqueueOffline(body);
      setMsg(
        'Hors ligne : enregistrement mis en file. Envoi automatique dès le retour du réseau.'
      );
      resetAfterSuccess();
      return;
    }

    setSaving(true);
    try {
      let res: Response;
      try {
        res = await fetch('/api/v1/socadel/quick-register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      } catch {
        enqueueOffline(body);
        setMsg(
          'Erreur réseau : enregistrement mis en file hors-ligne. Synchronisation automatique.'
        );
        resetAfterSuccess();
        return;
      }

      if (!res.ok && (res.status >= 500 || res.status === 0 || res.status === 408)) {
        enqueueOffline(body);
        setMsg('Réseau instable : mis en file hors-ligne. Synchronisation automatique.');
        resetAfterSuccess();
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setErr(json.message || 'Échec enregistrement');
        return;
      }

      setMsg(
        json.message ||
          (json.data?.invoice_queued
            ? `Enregistré${gps ? ' (GPS OK)' : ' (GPS indisponible)'}. Facture en cours d’envoi.`
            : `Enregistré${gps ? ' (GPS OK)' : ''}.`)
      );
      resetAfterSuccess();
    } catch {
      setErr('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  function resetAfterSuccess() {
    setContracts([]);
    setSelected([]);
    setQ('');
    setPhoneDigits('');
    setConfirmExisting(false);
    setSmsOnly(false);
  }

  // ── Modifier le numéro d'une ligne déjà checkée ──
  const openPhoneEdit = (line: ContractLine) => {
    setPhoneEditErr('');
    setPhoneEditMsg('');
    const currentDigits = (line.numero_telephone || '')
      .replace(/^\+?237/, '')
      .replace(/\D/g, '');
    setPhoneEdit({
      open: true,
      lineId: line.id,
      current: line.numero_telephone,
      digits: currentDigits.slice(0, 9)
    });
  };

  const submitPhoneEdit = async () => {
    setPhoneEditErr('');
    setPhoneEditMsg('');
    if (!phoneEdit.lineId) return;

    const digits = phoneEdit.digits.replace(/\D/g, '');
    if (digits.length !== 9) {
      setPhoneEditErr('Le numéro doit contenir 9 chiffres après +237.');
      return;
    }

    setPhoneSaving(true);
    try {
      const res = await fetch('/api/v1/socadel/update-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_id: phoneEdit.lineId,
          phone: `+237${digits}`
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setPhoneEditErr(json.message || 'Échec de la modification');
        return;
      }
      setPhoneEditMsg(
        json.invoice_queued
          ? 'Numéro modifié. Facture renvoyée automatiquement.'
          : 'Numéro modifié.'
      );
      const lastQ = q;
      setTimeout(() => {
        setPhoneEdit({ open: false, lineId: null, current: null, digits: '' });
        setPhoneEditMsg('');
        if (lastQ) search(lastQ);
      }, 1600);
    } catch {
      setPhoneEditErr('Erreur réseau');
    } finally {
      setPhoneSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-16">
      <div>
        <h2 className="text-lg font-semibold text-blue-900">Enregistrement rapide</h2>
        <p className="text-sm text-slate-500 mt-1">
          Recherche par n° de contrat ou compteur — confirmation WhatsApp — validation.
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm space-y-3">
        <label className="text-sm font-semibold text-blue-800">
          Contrat ou compteur
        </label>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Ex: 201345890"
            className="flex-1 border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="button"
            onClick={() => search()}
            disabled={loading}
            className="px-4 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1 disabled:bg-blue-400"
          >
            <FiSearch size={14} /> {loading ? '…' : 'OK'}
          </button>
        </div>
      </div>

      {err && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {err}
        </p>
      )}
      {msg && (
        <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}

      {contracts.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            {contracts.map((c) => {
              const checkedLines = (c.lines || []).filter(
                (l) => l.check_status === 'OK'
              );
              return (
                <div
                  key={c.service_no}
                  role={c.can_edit ? 'button' : undefined}
                  tabIndex={c.can_edit ? 0 : -1}
                  onClick={() => c.can_edit && search(c.service_no)}
                  onKeyDown={(e) => {
                    if (c.can_edit && (e.key === 'Enter' || e.key === ' ')) {
                      search(c.service_no);
                    }
                  }}
                  className={`w-full text-left flex flex-col gap-2 p-3 rounded-xl border transition
                    ${
                      c.can_edit
                        ? 'border-blue-100 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                        : 'border-slate-100 bg-slate-50 opacity-90'
                    }`}
                  title={
                    c.can_edit
                      ? 'Cliquer pour filtrer sur ce contrat'
                      : 'Déjà checké'
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">
                        {c.noms || 'Client'} — {c.service_no}
                      </p>
                      <p className="text-xs text-slate-500">
                        Compteur : {c.meter_no || '—'}
                        {c.is_subscribed ? ' · Abonné digital' : ''}
                        {c.all_checked ? ' · Déjà checké' : ''}
                      </p>
                      {c.primary_whatsapp && (
                        <p className="text-xs text-emerald-700 mt-0.5">
                          WhatsApp : {c.primary_whatsapp}
                        </p>
                      )}
                    </div>
                    {c.can_edit && (
                      <FiSearch size={16} className="text-blue-500 shrink-0" />
                    )}
                  </div>

                  {checkedLines.length > 0 && (
                    <div className="space-y-1">
                      {checkedLines.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5"
                        >
                          <span className="text-emerald-800 font-mono truncate">
                            ✓ {l.numero_telephone || '—'}
                            {l.ref_geo ? ` · ${l.ref_geo}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPhoneEdit(l);
                            }}
                            className="text-blue-700 underline font-medium ml-2 shrink-0"
                          >
                            Modifier le numéro
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasValidWa && !smsOnly && (
            <label className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmExisting}
                onChange={(e) => setConfirmExisting(e.target.checked)}
              />
              <span className="text-sm text-slate-700">
                Confirmer le WhatsApp existant pour les factures
                {primaryPhones.length === 1 && (
                  <strong className="block text-blue-700 font-mono">
                    {primaryPhones[0]}
                  </strong>
                )}
                {primaryPhones.length > 1 && (
                  <span className="block text-amber-700 text-xs mt-1">
                    Plusieurs numéros : saisissez celui à utiliser ci-dessous.
                  </span>
                )}
              </span>
            </label>
          )}

          {(phoneRequired || smsOnly || (confirmExisting && primaryPhones.length > 1)) && (
            <div className="bg-white p-4 rounded-xl border border-blue-100 space-y-2">
              <p className="text-sm font-semibold text-blue-800">
                {smsOnly ? 'Numéro SMS' : 'Numéro WhatsApp'}
              </p>
              <div className="flex items-center gap-2 border border-blue-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                <span className="font-mono text-slate-600 select-none">+237</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  value={phoneDigits}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v.length <= 9) setPhoneDigits(v);
                  }}
                  placeholder="XXXXXXXXX"
                  className="flex-1 outline-none font-mono text-base bg-transparent"
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={smsOnly}
              onChange={(e) => {
                setSmsOnly(e.target.checked);
                if (e.target.checked) setConfirmExisting(false);
              }}
            />
            <span className="text-sm text-slate-700">SMS uniquement (pas de WhatsApp)</span>
          </label>

          <div className="bg-white p-4 rounded-xl border border-blue-100 space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-blue-800">Identité</span>
              <select
                value={identite}
                onChange={(e) => setIdentite(e.target.value)}
                className="mt-1 w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="proprietaire">Propriétaire</option>
                <option value="relation">Relation</option>
                <option value="locataire">Locataire</option>
                <option value="bailleur">Bailleur</option>
              </select>
            </label>

            {!smsOnly && (
              <label className="block">
                <span className="text-sm font-semibold text-blue-800">Rapport</span>
                <select
                  value={rapport}
                  onChange={(e) => setRapport(e.target.value as 'MRA' | 'OK')}
                  disabled={true}
                  className="mt-1 w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none opacity-75"
                >
                  <option value="MRA">MRA</option>
                  <option value="OK">OK</option>
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={saving || !selected.length}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl disabled:bg-emerald-400"
            >
              {saving ? 'Enregistrement…' : 'Valider l’enregistrement'}
            </button>
            <p className="text-xs text-slate-500">
              Check automatique. Facture WhatsApp envoyée si canal WhatsApp.
            </p>
          </div>
        </div>
      )}

      {/* ── Modale modification numéro ── */}
      {phoneEdit.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Modifier le numéro
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Saisissez les <strong>9 chiffres</strong> après <strong>+237</strong>. La
              facture sera renvoyée automatiquement au nouveau numéro.
            </p>

            {phoneEdit.current && (
              <p className="text-xs text-slate-500 mb-3">
                Numéro actuel :{' '}
                <span className="font-mono text-slate-700">{phoneEdit.current}</span>
              </p>
            )}

            <div className="flex items-center gap-2 border border-blue-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
              <span className="text-base font-mono text-slate-600 select-none">+237</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={phoneEdit.digits}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  if (v.length <= 9) {
                    setPhoneEdit((prev) => ({ ...prev, digits: v }));
                  }
                }}
                placeholder="XXXXXXXXX"
                className="flex-1 outline-none bg-transparent font-mono text-base"
                autoFocus
              />
            </div>

            {phoneEditErr && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {phoneEditErr}
              </p>
            )}
            {phoneEditMsg && (
              <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                {phoneEditMsg}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setPhoneEdit({ open: false, lineId: null, current: null, digits: '' })
                }
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                disabled={phoneSaving}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitPhoneEdit}
                disabled={phoneSaving}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {phoneSaving ? 'Enregistrement…' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Vue principale Agent
   ───────────────────────────────────────────── */
export default function AgentView({
  token,
  onLogout
}: {
  token: string;
  onLogout: () => void;
}) {
  const agent = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('socadel_agent') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [view, setView] = useState<'collect' | 'stats'>('collect');
  const [pendingOffline, setPendingOffline] = useState(0);

  useEffect(() => {
    if (!token) return;
    const sync = async () => {
      const n = loadQueue().length;
      setPendingOffline(n);
      if (!n || isProbablyOffline()) return;
      const r = await flushOfflineQueue(token);
      setPendingOffline(r.remaining);
      if (r.sent > 0) {
        console.log(`[offline] ${r.sent} envoi(s) synchronisé(s), reste ${r.remaining}`);
      }
    };
    sync();
    window.addEventListener('online', sync);
    const id = window.setInterval(sync, 60_000);
    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    const tick = () => setPendingOffline(loadQueue().length);
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  if (view === 'stats') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-blue-100 sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView('collect')}
                className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900"
              >
                <FiArrowLeft size={16} />
                Retour collecte
              </button>
              <h1 className="text-lg font-bold text-blue-900">Mes statistiques</h1>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-medium"
            >
              <FiLogOut size={15} /> Déconnexion
            </button>
          </div>
          {pendingOffline > 0 && (
            <div className="bg-amber-50 text-amber-900 text-xs px-3 py-2 text-center border-b border-amber-100">
              {pendingOffline} enregistrement(s) en attente de réseau — sync auto à la reconnexion
            </div>
          )}
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6">
          <StatsTab
            token={token}
            mode="agent"
            defaultMatricule={agent.matricule || ''}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-blue-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/socad.png" alt="Socadel" className="h-9" />
            <div>
              <h1 className="text-lg font-bold text-blue-900">Collecte agent</h1>
              <p className="text-xs text-blue-600/70">
                {agent.matricule ? `Matricule ${agent.matricule}` : 'Agent Socadel'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView('stats')}
              className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium"
            >
              <FiBarChart2 size={15} />
              Mes stats
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-medium"
            >
              <FiLogOut size={15} /> Déconnexion
            </button>
          </div>
        </div>
        {pendingOffline > 0 && (
          <div className="bg-amber-50 text-amber-900 text-xs px-3 py-2 text-center border-b border-amber-100">
            {pendingOffline} enregistrement(s) en attente de réseau — sync auto à la reconnexion
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <QuickRegisterForm token={token} />
      </main>
    </div>
  );
}
