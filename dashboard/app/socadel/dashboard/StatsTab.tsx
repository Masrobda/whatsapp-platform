'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  REGIONS,
  DIVISIONS,
  MRCS,
  AGENCES,
  getDivisionsForRegion,
  getMrcsCascade,
  getAgencesCascade
} from './filterOptions';
import { FiDownload } from 'react-icons/fi';

type Props = {
  token: string;
  mode?: 'releveur' | 'agent' | 'leader';
  defaultMatricule?: string;
  defaultPhone?: string;
};

const COLORS = ['#1a6fb5', '#0f5a97', '#34d399', '#f87171', '#fbbf24', '#a78bfa'];

export default function StatsTab({
  token,
  mode = 'leader',
  defaultMatricule = '',
  defaultPhone = ''
}: Props) {
  const [itineraires, setItineraires] = useState('');
  const [matricule, setMatricule] = useState(defaultMatricule);
  const [phone, setPhone] = useState(defaultPhone);
  const [region, setRegion] = useState('');
  const [division, setDivision] = useState('');
  const [agence, setAgence] = useState('');
  const [categorie, setCategorie] = useState('');
  const [mrc, setMrc] = useState('');
  const [data, setData] = useState<any>(null);
  const [marketing, setMarketing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportingNonAbonnes, setExportingNonAbonnes] = useState(false);

    // ── Cascade : options disponibles selon les parents sélectionnés ──
  const availableDivisions = getDivisionsForRegion(region);
  const availableMrcs      = getMrcsCascade(region, division);
  const availableAgences   = getAgencesCascade(region, division, mrc);

  // ── Handlers cascade : reset des enfants quand un parent change ──
  const handleRegionChange = (val: string) => {
    setRegion(val);
    setDivision('');
    setMrc('');
    setAgence('');
  };

  const handleDivisionChange = (val: string) => {
    setDivision(val);
    setMrc('');
    setAgence('');
  };

  const handleMrcChange = (val: string) => {
    setMrc(val);
    setAgence('');
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (itineraires.trim()) params.set('itineraires', itineraires.trim());
      if (matricule.trim()) params.set('matricule', matricule.trim());
      if (phone.trim()) params.set('phone', phone.trim());
      if (region.trim()) params.set('region', region.trim());
      if (division.trim()) params.set('division', division.trim());
      if (agence.trim()) params.set('agence', agence.trim());
      if (categorie.trim()) params.set('categorie', categorie.trim());
      if (mrc.trim()) params.set('mrc', mrc.trim());

      const res = await fetch(`/api/v1/socadel/stats?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) {
        setError('Impossible de charger les statistiques');
        return;
      }
      setData(json);

      const mRes = await fetch('/api/v1/socadel/marketing-report', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mJson = await mRes.json();
      if (mJson.success) setMarketing(mJson);
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [token, itineraires, matricule, phone, region, division, agence, categorie, mrc]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return <div className="p-12 text-center text-blue-500">Chargement des statistiques…</div>;
  }
  if (error && !data) {
    return <div className="p-12 text-center text-red-500">{error}</div>;
  }
  if (!data) return null;

  const { stats } = data;
  const pieAbonne = [
    { name: 'Abonné', value: stats.abonne },
    { name: 'Non abonné', value: stats.non_abonne }
  ];

  // ── Checkés non abonnés — total + décomposition ──
  const checkedNonAbonne = stats.checked_non_abonne || 0;

  // Décomposition par statut réel de la facture
  const nonAbonneSent      = stats.non_abonne_sent       || 0;
  const nonAbonnePending   = stats.non_abonne_pending    || 0;
  const nonAbonneFailed    = stats.non_abonne_failed     || 0;
  const nonAbonneSansEnvoi = stats.non_abonne_sans_envoi || 0;
  const nonAbonneSms       = stats.non_abonne_sms || 0;

  // ── Checkés abonnés = checks "efficaces" (ont abouti à un abonné) ──
  const checkedAbonne = Math.max(0, (stats.checked || 0) - checkedNonAbonne);

  // ── Collecte via chatbot = WhatsApp OK − Checkés abonnés ──
  const chatbotCollected = Math.max(0, (stats.abonne || 0) - checkedAbonne);
  const chatbotPercent =
    stats.abonne > 0 ? Math.round((chatbotCollected / stats.abonne) * 1000) / 10 : 0;

  // ── Query string des filtres actifs (pour les exports CSV) ──
  const queryString = new URLSearchParams(
    Object.entries({
      itineraires, matricule, phone, region, division, agence, categorie, mrc
    }).filter(([, v]) => v && String(v).trim())
  ).toString();

  const exportNonAbonnes = async () => {
    if (!token) return;
    setExportingNonAbonnes(true);
    try {
      const res = await fetch(
        `/api/v1/socadel/export-non-abonnes?${queryString}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        if (res.status === 404) alert('Aucun client checké non abonné sur ce périmètre.');
        else alert("Erreur lors de l'export.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checkes_non_abonnes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur réseau lors de l'export.");
    } finally {
      setExportingNonAbonnes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Filtres ── */}
      <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-blue-800">Filtres</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(mode === 'releveur' || mode === 'leader') && (
            <input
              placeholder="Itinéraires (ex: 125370,125369)"
              value={itineraires}
              onChange={(e) => setItineraires(e.target.value)}
              className="border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          )}

          {(mode === 'agent' || mode === 'leader') && (
            <input
              placeholder="Matricule agent"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              className="border border-blue-200 rounded-lg px-3 py-2 text-sm"
            />
          )}

          {(mode === 'releveur' || mode === 'leader') && (
            <input
              placeholder="Téléphone releveur (ex: +2376XXXXXXXX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          )}
                    <select
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Toutes les régions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={division}
            onChange={(e) => handleDivisionChange(e.target.value)}
            disabled={availableDivisions.length === 0}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {region ? `Divisions de ${region}` : 'Toutes les divisions'}
            </option>
            {availableDivisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={mrc}
            onChange={(e) => handleMrcChange(e.target.value)}
            disabled={availableMrcs.length === 0}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {division ? `MRC de ${division}` : region ? `MRC de ${region}` : 'Tous les MRC'}
            </option>
            {availableMrcs.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={agence}
            onChange={(e) => setAgence(e.target.value)}
            disabled={availableAgences.length === 0}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {mrc ? `Agences de ${mrc}` : division ? `Agences de ${division}` : region ? `Agences de ${region}` : 'Toutes les agences'}
            </option>
            {availableAgences.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:bg-blue-400"
          >
            {loading ? 'Chargement…' : 'Appliquer les filtres'}
          </button>
          <button
            onClick={() => {
              setItineraires('');
              setMatricule(defaultMatricule);
              setPhone(defaultPhone);
              setRegion('');
              setDivision('');
              setAgence('');
              setCategorie('');
              setMrc('');
            }}
            className="px-3 py-2 text-sm text-slate-600 underline"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          ['Total à migrer', stats.total],
          ['N° Collectés', stats.with_phone],
          ['N° Checker', stats.checked],
          ['N° WhatsApp ok', stats.abonne],
          ['Taux collecte %', stats.taux_check],
          ['Taux WhatsApp %', stats.taux_abonnement],
          ['Agents', stats.by_agent],
          ['Releveurs', stats.by_releveur]
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm"
          >
            <p className="text-[11px] uppercase text-blue-600/80 font-medium">{label}</p>
            <p className="text-xl font-bold text-blue-900 mt-1">{value ?? 0}</p>
          </div>
        ))}

        {/* Collecte via chatbot */}
        <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-200 shadow-sm">
          <p className="text-[11px] uppercase text-emerald-700 font-medium">
            Collecte via chatbot
          </p>
          <p className="text-xl font-bold text-emerald-800 mt-1">
            {chatbotCollected.toLocaleString('fr-FR')}
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            {chatbotPercent}% des WhatsApp OK
          </p>
        </div>
      </div>

      {/* ── Checkés non abonnés — décomposition ── */}
      <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-baseline gap-3">
            <p className="text-[11px] uppercase text-blue-600/80 font-medium">
              Checkés non abonnés
            </p>
            <p className="text-2xl font-bold text-blue-900">
              {checkedNonAbonne.toLocaleString('fr-FR')}
            </p>
          </div>
          <button
            type="button"
            onClick={exportNonAbonnes}
            disabled={exportingNonAbonnes || checkedNonAbonne === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800
                       text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <FiDownload size={13} />
            {exportingNonAbonnes ? 'Export…' : 'Exporter CSV'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* En attente Meta (sent) */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <p className="text-[10px] uppercase text-amber-800 font-semibold">
                En attente Meta
              </p>
            </div>
            <p className="text-lg font-bold text-amber-900">
              {nonAbonneSent.toLocaleString('fr-FR')}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5">
              Transmis · attente retour
            </p>
          </div>

          {/* En cours d'envoi (pending) */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <p className="text-[10px] uppercase text-yellow-800 font-semibold">
                En cours d'envoi
              </p>
            </div>
            <p className="text-lg font-bold text-yellow-900">
              {nonAbonnePending.toLocaleString('fr-FR')}
            </p>
            <p className="text-[10px] text-yellow-700 mt-0.5">
              File d'attente
            </p>
          </div>

          {/* Non délivrées (failed) */}
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <p className="text-[10px] uppercase text-rose-800 font-semibold">
                Non délivrées
              </p>
            </div>
            <p className="text-lg font-bold text-rose-900">
              {nonAbonneFailed.toLocaleString('fr-FR')}
            </p>
            <p className="text-[10px] text-rose-700 mt-0.5">
              Contact non whatsapp
            </p>
          </div>

          {/* Jamais envoyées */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <p className="text-[10px] uppercase text-slate-700 font-semibold">
                Sans envoi
              </p>
            </div>
            <p className="text-lg font-bold text-slate-800">
              {nonAbonneSansEnvoi.toLocaleString('fr-FR')}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Aucune facture émise
            </p>
          </div>
                    {/* SMS */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-[10px] uppercase text-blue-800 font-semibold">
                SMS uniquement
              </p>
            </div>
            <p className="text-lg font-bold text-blue-900">
              {nonAbonneSms.toLocaleString('fr-FR')}
            </p>
            <p className="text-[10px] text-blue-700 mt-0.5">
              Sans WhatsApp (SMS)
            </p>
          </div>
        </div>
      </div>

      {/* ── Narrative marketing ── */}
      {marketing?.narrative && (
        <div className="bg-gradient-to-r from-blue-50 to-white p-5 rounded-xl border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            Rapport marketing — évolution
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed">{marketing.narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Abonnés / non abonnés</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieAbonne}
                dataKey="value"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {pieAbonne.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Évolution 30 jours</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.byDay || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="jour"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                }
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')} />
              <Legend />
              <Line type="monotone" dataKey="checked" name="N° Checker" stroke="#1a6fb5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="abonne" name="N° WhatsApp ok" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tops (uniquement graphiques) ── */}
      {[
        { title: 'Top 10 itinéraires', key: 'topItinerary', labelKey: 'itineraires' },
        { title: 'Top 10 releveurs', key: 'topReleveur', labelKey: 'releveur' },
        { title: 'Top 10 agents collecteurs', key: 'topAgent', labelKey: 'agent' },
        { title: 'Top 10 divisions', key: 'topDivision', labelKey: 'division' },
        { title: 'Top 10 agences', key: 'topAgence', labelKey: 'agence' },
        { title: 'Top 10 MRC', key: 'topMrc', labelKey: 'mrc' },
        { title: 'Top 5 régions', key: 'topRegion', labelKey: 'region' }
      ].map((block) => {
        const rows = data[block.key] || [];
        if (!rows.length) return null;
        return (
          <div key={block.key} className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">{block.title}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey={block.labelKey}
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total à migrer" fill="#1a6fb5" />
                <Bar dataKey="checked" name="N° Checker" fill="#fbbf24" />
                <Bar dataKey="abonne" name="N° WhatsApp ok" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
