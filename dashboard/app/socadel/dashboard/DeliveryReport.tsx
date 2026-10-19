'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { FiDownload } from 'react-icons/fi';
import { useState } from 'react';

type Stats = {
  total: number;
  total_envois: number;
  delivrees: number;
  consultees: number;
  recues: number;
  // ── Anciens champs (compatibilité) ──
  en_acheminement: number;
  non_delivrees: number;
  // ── Nouveaux champs (split temporel) ──
  en_soumission: number;
  en_attente_recente: number;
  en_attente_prolongee: number;
  // ── Taux ──
  taux_delivrabilite: number;
  taux_consultation: number;
  taux_envoi: number;
};

type DayPoint = {
  jour: string;
  delivrees: number;
  en_acheminement: number;
  non_delivrees: number;
  total: number;
};

type Props = {
  token: string;
  stats: Stats;
  byDay: DayPoint[];
  /** Paramètres actifs (pour l'export CSV aligné) */
  queryString: string;
};

export default function DeliveryReport({ token, stats, byDay, queryString }: Props) {
  const [exporting, setExporting] = useState(false);

  const exportNonDelivrees = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/v1/socadel/export-non-delivrees?${queryString}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        if (res.status === 404) alert('Aucune facture non délivrée sur ce périmètre.');
        else alert("Erreur lors de l'export.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factures_non_delivrees_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur réseau lors de l'export.");
    } finally {
      setExporting(false);
    }
  };

  const total = stats.total_envois || 1;
  const pctDelivrees    = Math.round((stats.delivrees / total) * 1000) / 10;
  const pctAcheminement = Math.round((stats.en_acheminement / total) * 1000) / 10;
  const pctNonDelivrees = Math.round((stats.non_delivrees / total) * 1000) / 10;

  // Sécurité : si le backend n'a pas encore les nouveaux champs, on retombe sur en_acheminement
  const enSoumission        = stats.en_soumission        ?? 0;
  const enAttenteRecente    = stats.en_attente_recente    ?? 0;
  const enAttenteProlongee  = stats.en_attente_prolongee  ?? 0;
  const enAttenteTotal      = enAttenteRecente + enAttenteProlongee;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Rapport de livraison des factures
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {stats.total_envois.toLocaleString('fr-FR')} factures sur{' '}
            {stats.total.toLocaleString('fr-FR')} contrats filtrés
          </p>
        </div>

        <button
          type="button"
          onClick={exportNonDelivrees}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800
                     text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          <FiDownload size={14} />
          {exporting ? 'Export…' : 'Exporter les non délivrées'}
        </button>
      </div>

      {/* Barre de progression */}
      <div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${pctDelivrees}%` }} />
          <div className="bg-amber-400"   style={{ width: `${pctAcheminement}%` }} />
          <div className="bg-rose-500"    style={{ width: `${pctNonDelivrees}%` }} />
        </div>

        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <Legend2 color="bg-emerald-500" label="Délivrées"        pct={pctDelivrees} />
          <Legend2 color="bg-amber-400"   label="En acheminement"  pct={pctAcheminement} />
          <Legend2 color="bg-rose-500"    label="Non délivrées"    pct={pctNonDelivrees} />
        </div>
      </div>

      {/* Cartes synthétiques — 5 indicateurs clairs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card
          label="Taux de délivrabilité"
          value={`${stats.taux_delivrabilite}%`}
          sub={`${stats.delivrees.toLocaleString('fr-FR')} factures reçues`}
          accent="emerald"
        />
        <Card
          label="Taux de consultation"
          value={`${stats.taux_consultation}%`}
          sub={`${stats.consultees.toLocaleString('fr-FR')} ouvertes par les clients`}
          accent="emerald"
        />
        <Card
          label="En cours d'envoi"
          value={enSoumission.toLocaleString('fr-FR')}
          sub="< 1 heure · normal"
          accent="amber"
        />
        <Card
          label="En attente opérateur"
          value={enAttenteTotal.toLocaleString('fr-FR')}
          sub={
            enAttenteProlongee > 0
              ? `dont ${enAttenteProlongee.toLocaleString('fr-FR')} > 24h`
              : 'Routage en cours'
          }
          accent="amber"
        />
        <Card
          label="Non délivrées"
          value={stats.non_delivrees.toLocaleString('fr-FR')}
          sub="Canal indisponible"
          accent="rose"
        />
      </div>

      {/* Évolution */}
      {byDay.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">Évolution quotidienne</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={byDay}>
              <defs>
                <linearGradient id="drDelivrees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="drAcheminement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="drNonDelivrees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="jour"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                }
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="delivrees"       name="Délivrées"       stroke="#10b981" fill="url(#drDelivrees)" />
              <Area type="monotone" dataKey="en_acheminement" name="En acheminement" stroke="#fbbf24" fill="url(#drAcheminement)" />
              <Area type="monotone" dataKey="non_delivrees"   name="Non délivrées"   stroke="#f43f5e" fill="url(#drNonDelivrees)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Legend2({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">{pct}%</span>
    </span>
  );
}

function Card({
  label, value, sub, accent,
}: {
  label: string; value: string; sub: string;
  accent: 'emerald' | 'amber' | 'rose';
}) {
  const colors = {
    emerald: 'from-emerald-50 to-white border-emerald-200 text-emerald-800',
    amber:   'from-amber-50 to-white border-amber-200 text-amber-800',
    rose:    'from-rose-50 to-white border-rose-200 text-rose-800',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[accent]} p-4 rounded-xl border shadow-sm`}>
      <p className="text-[11px] uppercase font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}
