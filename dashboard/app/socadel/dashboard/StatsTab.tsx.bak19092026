'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';
import { REGIONS, DIVISIONS, MRCS, AGENCES } from './filterOptions';

type Props = {
  token: string;
  mode?: 'releveur' | 'agent' | 'leader';
  defaultMatricule?: string;
};

const COLORS = ['#1a6fb5', '#0f5a97', '#34d399', '#f87171', '#fbbf24', '#a78bfa'];

export default function StatsTab({ token, mode = 'leader', defaultMatricule = '' }: Props) {
  const [itineraires, setItineraires] = useState('');
  const [matricule, setMatricule] = useState(defaultMatricule);
  const [region, setRegion] = useState('');
  const [division, setDivision] = useState('');
  const [agence, setAgence] = useState('');
  const [categorie, setCategorie] = useState('');
  const [mrc, setMrc] = useState('');
  const [data, setData] = useState<any>(null);
  const [marketing, setMarketing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (itineraires.trim()) params.set('itineraires', itineraires.trim());
      if (matricule.trim()) params.set('matricule', matricule.trim());
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
  }, [token, itineraires, matricule, region, division, agence, categorie, mrc]);

  useEffect(() => {
    load();
  }, []); // premier chargement global ; filtres via bouton

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

  // ── Collecte via chatbot = N° WhatsApp OK − N° Collectés ──
  const chatbotCollected = Math.max(0, (stats.abonne || 0) - (stats.checked || 0));
  const chatbotPercent =
    stats.abonne > 0
      ? Math.round((chatbotCollected / stats.abonne) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6">
      {/* Filtres */}
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
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Toutes les régions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Toutes les divisions</option>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={mrc}
            onChange={(e) => setMrc(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tous les MRC</option>
            {MRCS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={agence}
            onChange={(e) => setAgence(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Toutes les agences</option>
            {AGENCES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:bg-blue-400"
        >
          {loading ? 'Chargement…' : 'Appliquer les filtres'}
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          ['Total à migrer', stats.total],
          ['N° Collectés', stats.checked],
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

        {/* ── NOUVELLE CARTE : Collecte via chatbot ── */}
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

      {/* Narrative marketing */}
      {marketing?.narrative && (
        <div className="bg-gradient-to-r from-blue-50 to-white p-5 rounded-xl border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Rapport marketing — évolution</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{marketing.narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Abonnés / non abonnés</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieAbonne} dataKey="value" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
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
              <XAxis dataKey="jour" tick={{ fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')} />
              <Legend />
              <Line type="monotone" dataKey="checked" name="N° Collectés" stroke="#1a6fb5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="abonne" name="N° WhatsApp ok" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tops */}
      {[
        { title: 'Top 10 itinéraires', key: 'topItinerary', labelKey: 'itineraires' },
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
                <XAxis dataKey={block.labelKey} tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total à migrer" fill="#1a6fb5" />
                <Bar dataKey="checked" name="N° Collectés" fill="#fbbf24" />
                <Bar dataKey="abonne" name="N° WhatsApp ok" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
