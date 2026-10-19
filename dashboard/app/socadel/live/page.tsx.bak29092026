'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = Record<string, unknown>;

const emptyFilters = {
  region: '',
  division: '',
  agence: '',
  mrc: '',
  statut: '',
  check_status: '',
  api_status: '',
  responsable: '',
  collected_by: '',
  service_no: '',
  meter_no: '',
  check_from: '',
  check_to: '',
  activated_from: '',
  activated_to: '',
  has_gps: '',
};

export default function SocadelLivePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [options, setOptions] = useState<{
    regions: string[];
    divisions: string[];
    agences: string[];
    mrcs: string[];
  }>({ regions: [], divisions: [], agences: [], mrcs: [] });

  const [data, setData] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const limit = 50;

  // ── Auth : lecture du token + redirection si absent ──
  useEffect(() => {
    const t = localStorage.getItem('socadel_reporting_token');
    if (!t) {
      router.replace('/socadel/reporting/login');
      return;
    }
    setToken(t);
  }, [router]);

  const logout = () => {
    localStorage.removeItem('socadel_reporting_token');
    localStorage.removeItem('socadel_reporting_role');
    localStorage.removeItem('socadel_reporting_user');
    router.replace('/socadel/reporting/login');
  };

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(limit));
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    return p.toString();
  }, [filters, page]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/socadel/live?${qs()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Si le token est expiré / refusé → retour login
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
        setTotal(json.pagination?.total || 0);
        setPages(json.pagination?.pages || 1);
        setKpis(json.kpis || {});
      }
    } finally {
      setLoading(false);
    }
  }, [token, qs]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/socadel/live/options', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => j.options && setOptions(j.options))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh live toutes les 60s
  useEffect(() => {
    if (!token) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load, token]);

  const setF = (k: string, v: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [k]: v }));
  };

  const exportWithAuth = async () => {
    if (!token) return;
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    const res = await fetch(`/api/v1/socadel/live/export.csv?${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Erreur export');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socadel_collecte_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Écran de chargement tant que le token n’est pas lu ──
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-700">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-[1600px] mx-auto space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Suivi live — Collecte WhatsApp</h1>
          <p className="text-sm text-slate-500">
            Filtres avancés · pagination · export = tout le filtre (pas seulement la page)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 rounded-lg bg-slate-200 text-sm font-medium"
          >
            Actualiser
          </button>
          <button
            type="button"
            onClick={exportWithAuth}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
          >
            Export CSV / Excel
          </button>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['Total filtre', kpis.total],
          ['Abonnés', kpis.abonnes],
          ['Checkés', kpis.checks],
          ['API OK', kpis.api_ok],
          ['Terrain', kpis.terrain],
        ].map(([label, val]) => (
          <div key={String(label)} className="bg-white rounded-xl border border-blue-100 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-blue-900">{val ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-blue-100 p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Select label="Région" value={filters.region} onChange={(v) => setF('region', v)} options={options.regions} />
        <Select label="Division" value={filters.division} onChange={(v) => setF('division', v)} options={options.divisions} />
        <Select label="Agence" value={filters.agence} onChange={(v) => setF('agence', v)} options={options.agences} />
        <Select label="MRC" value={filters.mrc} onChange={(v) => setF('mrc', v)} options={options.mrcs} />
        <Select
          label="Statut"
          value={filters.statut}
          onChange={(v) => setF('statut', v)}
          options={['ABONNE', 'NON ABONNE']}
        />
        <Select
          label="Check"
          value={filters.check_status}
          onChange={(v) => setF('check_status', v)}
          options={[
            { value: 'OK', label: 'Checké' },
            { value: 'NULL', label: 'Non checké' },
          ]}
        />
        <Select
          label="API"
          value={filters.api_status}
          onChange={(v) => setF('api_status', v)}
          options={['OK', 'NOK']}
        />
        <Select
          label="Responsable"
          value={filters.responsable}
          onChange={(v) => setF('responsable', v)}
          options={['TERRAIN', 'AUTRES']}
        />
        <Select
          label="Abonné / collecté par"
          value={filters.collected_by}
          onChange={(v) => setF('collected_by', v)}
          options={[
            { value: 'releveur', label: 'Releveur' },
            { value: 'agent', label: 'Agent Socadel' },
            { value: 'terrain', label: 'Terrain' },
            { value: 'autres', label: 'Autres' },
          ]}
        />
        <Field label="Contrat" value={filters.service_no} onChange={(v) => setF('service_no', v)} />
        <Field label="Compteur" value={filters.meter_no} onChange={(v) => setF('meter_no', v)} />
        <Select
          label="GPS"
          value={filters.has_gps}
          onChange={(v) => setF('has_gps', v)}
          options={[
            { value: '1', label: 'Avec GPS' },
            { value: '0', label: 'Sans GPS' },
          ]}
        />
        <Field label="Check du" type="date" value={filters.check_from} onChange={(v) => setF('check_from', v)} />
        <Field label="Check au" type="date" value={filters.check_to} onChange={(v) => setF('check_to', v)} />
        <Field label="Abonné du" type="date" value={filters.activated_from} onChange={(v) => setF('activated_from', v)} />
        <Field label="Abonné au" type="date" value={filters.activated_to} onChange={(v) => setF('activated_to', v)} />
        <button
          type="button"
          className="col-span-2 text-sm text-red-600 underline self-end mb-2"
          onClick={() => {
            setFilters(emptyFilters);
            setPage(1);
          }}
        >
          Réinitialiser les filtres
        </button>
      </div>

      <p className="text-sm text-slate-600">
        {total.toLocaleString('fr-FR')} ligne(s) — page {page} / {pages}
        {loading ? ' · Chargement…' : ''}
      </p>

      <div className="bg-white rounded-xl border border-blue-100 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-blue-50 text-blue-900">
            <tr>
              {[
                'Région', 'Division', 'Agence', 'Contrat', 'Noms', 'Tél',
                'Check', 'Check date', 'Statut', 'Activé le', 'Responsable',
                'Collecté par', 'API', 'GPS',
              ].map((h) => (
                <th key={h} className="px-2 py-2 text-left whitespace-nowrap font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={String(r.id)} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-2 py-1.5 whitespace-nowrap">{String(r.region || '—')}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{String(r.division || '—')}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{String(r.agence || '—')}</td>
                <td className="px-2 py-1.5 font-mono">{String(r.service_no || '')}</td>
                <td className="px-2 py-1.5 max-w-[140px] truncate">{String(r.noms || '')}</td>
                <td className="px-2 py-1.5 font-mono">{String(r.numero_telephone || '')}</td>
                <td className="px-2 py-1.5">{String(r.check_status || '—')}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {r.check_date ? new Date(String(r.check_date)).toLocaleString('fr-FR') : '—'}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={
                      r.statut === 'ABONNE'
                        ? 'text-emerald-700 font-semibold'
                        : 'text-red-600'
                    }
                  >
                    {String(r.statut || 'NON ABONNE')}
                  </span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {r.activated_at
                    ? new Date(String(r.activated_at)).toLocaleString('fr-FR')
                    : '—'}
                </td>
                <td className="px-2 py-1.5">{String(r.responsable || '—')}</td>
                <td className="px-2 py-1.5">
                  {String(r.abonne_par_label || r.collected_by_label || r.collected_by_type || '—')}
                </td>
                <td className="px-2 py-1.5">{String(r.api_status || '—')}</td>
                <td className="px-2 py-1.5">
                  {r.gps_lat != null ? `${Number(r.gps_lat).toFixed(4)}, ${Number(r.gps_lng).toFixed(4)}` : '—'}
                </td>
              </tr>
            ))}
            {!data.length && !loading && (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-slate-400">
                  Aucune donnée pour ces filtres
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40"
        >
          Précédent
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-slate-600 font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label className="block text-xs">
      <span className="text-slate-600 font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
      >
        <option value="">Tous</option>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}
