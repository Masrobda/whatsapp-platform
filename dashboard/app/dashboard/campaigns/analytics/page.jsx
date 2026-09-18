'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CampaignAPI } from '@/lib/campaigns/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';
async function api(path, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ── DEMO DATA ─────────────────────────────────────────────────
const DEMO = {
  campaigns: { active_campaigns: 3, total_campaigns: 12, total_sent: 42180, total_delivered: 38940, total_read: 24650, avg_delivery_rate: 92.3, avg_read_rate: 63.4, total_cost: 211.32 },
  inbox:     { open: 4, total_unread: 11, urgent: 1 },
  ab_tests:  { running: 1, completed: 2, total: 4 },
  ai_scores: { champion: 142, loyal: 318, at_risk: 67, inactive: 29 },
  multichannel: [
    { channel: 'whatsapp', total: 28940, delivery_rate: 92.6, total_cost: 144.7 },
    { channel: 'sms',      total: 4200,  delivery_rate: 95.0, total_cost: 210.0 },
    { channel: 'email',    total: 8600,  delivery_rate: 94.8, total_cost: 8.6 },
  ],
  recent_campaigns: [
    { id:'c1', name:'Factures Avril 2026',    status:'completed', sent_count:8420, read_count:4950, delivery_rate:94.8 },
    { id:'c2', name:'Promotion Ramadan',      status:'running',   sent_count:9800, read_count:5800, delivery_rate:92.9 },
    { id:'c3', name:'Relance Impayés Q1',     status:'paused',    sent_count:1200, read_count:680,  delivery_rate:91.7 },
    { id:'c4', name:'Bienvenue Nouveaux',     status:'draft',     sent_count:0,    read_count:0,    delivery_rate:0 },
  ],
  recent_ab: [
    { id:'t1', name:'Template facture vs relance', winner_variant:'B', winner_confidence:97.3, status:'completed' },
    { id:'t2', name:'Horaire matin vs soir',       winner_variant:null, winner_confidence:72.4, status:'running' },
  ],
  timing_insight: { best_hour: 19, best_day: 'Vendredi', predicted_read_rate: 62 },
  daily_7: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    sent: Math.floor(Math.random() * 800 + 300),
    delivered: Math.floor(Math.random() * 750 + 280),
    read: Math.floor(Math.random() * 400 + 150),
  }))
};

// ── STYLES ────────────────────────────────────────────────────
const CHANNEL_CFG = {
  whatsapp: { label: 'WhatsApp', icon: '💬', color: '#2d7a3e', bg: '#e8f5e9' },
  sms:      { label: 'SMS',      icon: '📱', color: '#1976d2', bg: '#e3f2fd' },
  email:    { label: 'Email',    icon: '✉️', color: '#f57c00', bg: '#fff3e0' },
};

const STATUS_CFG = {
  completed: { label: 'Terminée',  color: '#2d7a3e', bg: '#e8f5e9', dot: '#4caf50' },
  running:   { label: 'En cours',  color: '#f57c00', bg: '#fff3e0', dot: '#ff9800', pulse: true },
  paused:    { label: 'Pausée',    color: '#9eada5', bg: '#f0f7f3', dot: '#9eada5' },
  draft:     { label: 'Brouillon', color: '#6b7c74', bg: '#f8faf9', dot: '#cbd5d0' },
};

const SEGMENT_CFG = {
  champion:  { label: '🏆 Champions',  color: '#2d7a3e' },
  loyal:     { label: '💙 Fidèles',    color: '#1976d2' },
  at_risk:   { label: '⚠️ À risque',   color: '#f57c00' },
  inactive:  { label: '😴 Inactifs',   color: '#9eada5' },
};

// ── COMPOSANTS ───────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color, href }) {
  const content = (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8',
      padding: '20px', display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.2s', cursor: href ? 'pointer' : 'default',
      position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `${color}08`, borderRadius: '0 0 0 80px' }} />
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums', fontFamily: "'DM Mono', monospace" }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6b7c74', marginTop: 3, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

function MiniChart({ data }) {
  const max = Math.max(...data.map(d => d.sent), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 1, height: 50 }}>
            <div style={{ flex: 1, background: '#2d7a3e', borderRadius: '2px 2px 0 0', opacity: 0.85,
              height: `${(d.delivered / max) * 100}%`, minHeight: 2 }} />
            <div style={{ flex: 1, background: '#8bc34a', borderRadius: '2px 2px 0 0', opacity: 0.85,
              height: `${(d.read / max) * 100}%`, minHeight: 2 }} />
          </div>
          <div style={{ fontSize: 9, color: '#9eada5', whiteSpace: 'nowrap' }}>{d.date}</div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px',
      borderRadius: 12, background: c.bg, color: c.color, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0,
        ...(c.pulse ? { animation: 'pulse-dot 1.5s infinite' } : {}) }} />
      {c.label}
    </span>
  );
}

function RadialProgress({ value, max, color, size = 80, label, sub }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = size / 2 - 7, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f7f3" strokeWidth={8} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7c74', textAlign: 'center' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#9eada5', textAlign: 'center' }}>{sub}</div>}
    </div>
  );
}

// ── PAGE PRINCIPALE ──────────────────────────────────────────
export default function Phase3Dashboard() {
  const [data, setData] = useState(DEMO);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // On remplace api('/stats') par l'appel à la classe CampaignAPI
      const [campRes, inboxRes, abRes, mcRes, scoresRes] = await Promise.allSettled([
        CampaignAPI.globalStats(),        // ← Nouvelle méthode centralisée
        api('/inbox/stats'),              
        api('/ab-tests?limit=5'),         
        api('/multichannel/stats'),       
        api('/ai/scores?limit=1'),        
      ]);

      setData(prev => ({
        ...prev,
        // ATTENTION : Si CampaignAPI renvoie directement { stats: ... }, 
        // on accède à campRes.value.stats
        campaigns: campRes.status === 'fulfilled' ? campRes.value.stats : prev.campaigns,
        
        inbox: inboxRes.status === 'fulfilled' ? inboxRes.value.stats : prev.inbox,
        
        ab_tests: abRes.status === 'fulfilled' ? {
          running: (abRes.value.tests || []).filter(t => t.status === 'running').length,
          completed: (abRes.value.tests || []).filter(t => t.status === 'completed').length,
          total: abRes.value.tests?.length || 0
        } : prev.ab_tests,
        
        multichannel: mcRes.status === 'fulfilled' ? mcRes.value.stats : prev.multichannel,
        
        ai_scores: scoresRes.status === 'fulfilled' ?
          (scoresRes.value.distribution || []).reduce((acc, d) => ({ ...acc, [d.segment_label]: parseInt(d.count) }), {}) :
          prev.ai_scores,
      }));
    } catch (err) {
      console.warn('Dashboard fallback to demo:', err.message);
    } finally {
      setLoading(false);
    }
}, [api]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleQuickAnalyze = async () => {
    const campaignId = DEMO.recent_campaigns.find(c => c.status === 'completed')?.id;
    if (!campaignId) return;
    setAnalyzing(true);
    try {
      const res = await api(`/ai/campaigns/${campaignId}/analyze`);
      setAiAnalysis(res.analysis);
    } catch {
      // Fallback démo
      setAiAnalysis({
        overall_grade: 'B',
        performance_summary: 'Bonne performance globale avec un taux de lecture de 63%, supérieur à la moyenne secteur.',
        strengths: ['Taux de livraison élevé (92.3%)', 'Engagement fort sur les factures'],
        weaknesses: ['Taux de réponse faible sur SMS', 'Horaire d\'envoi non optimisé'],
        action_items: [
          { priority: 'high', action: 'Décaler les envois WhatsApp à 19h-20h', expected_impact: '+12% de lectures' },
          { priority: 'medium', action: 'Lancer un A/B test sur le template de relance', expected_impact: '+8% de réponses' },
        ],
        benchmark_comparison: { delivery_rate_industry_avg: 89, read_rate_industry_avg: 55, your_position: 'above' },
      });
    } finally { setAnalyzing(false); }
  };

  const d = data;
  const c = d.campaigns;
  const totalSegmented = Object.values(d.ai_scores).reduce((a, b) => a + b, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f8faf9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .dash-card { animation: fadeIn 0.4s ease both; }
        .kpi-link:hover > div { box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-color: currentColor; }
        .quick-action:hover { opacity: 0.85; transform: translateY(-1px); }
      `}</style>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5ebe8', padding: '0 32px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1f1d' }}>Dashboard NumericExport</div>
            <div style={{ fontSize: 12, color: '#9eada5' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchDashboard} style={{ padding: '7px 14px', borderRadius: 10,
              border: '1px solid #e5ebe8', background: 'white', cursor: 'pointer', fontSize: 13, color: '#6b7c74' }}>
              🔄 Actualiser
            </button>
            <button onClick={handleQuickAnalyze} disabled={analyzing} style={{ padding: '7px 14px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #9c27b0, #ba68c8)', color: 'white',
              cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: analyzing ? 0.7 : 1 }}>
              {analyzing ? '⏳ Analyse...' : '🤖 Analyse IA'}
            </button>
            <Link href="/campaigns/create" style={{ padding: '7px 14px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #2d7a3e, #3a9950)', color: 'white',
              textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              🚀 Nouvelle campagne
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── KPIs GLOBAUX ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <div className="kpi-link">
            <KpiCard icon="🚀" label="Campagnes actives" value={c.active_campaigns || 0} color="#2d7a3e"
              sub={`${c.total_campaigns || 0} au total`} href="/campaigns" />
          </div>
          <div className="kpi-link">
            <KpiCard icon="📤" label="Messages envoyés" value={c.total_sent ? (Number(c.total_sent) / 1000).toFixed(1) + 'k' : '0'}
              color="#1976d2" sub={`${c.avg_delivery_rate || 0}% livrés`} href="/campaigns" />
          </div>
          <div className="kpi-link">
            <KpiCard icon="👁️" label="Taux de lecture" value={`${c.avg_read_rate || 0}%`}
              color="#8bc34a" sub="Moyenne 7 derniers jours" href="/reports" />
          </div>
          <div className="kpi-link">
            <KpiCard icon="💬" label="Inbox non lus" value={d.inbox?.total_unread || 0}
              color={d.inbox?.total_unread > 0 ? '#c62828' : '#2d7a3e'}
              sub={`${d.inbox?.open || 0} conversations ouvertes`} href="/inbox" />
          </div>
          <div className="kpi-link">
            <KpiCard icon="💰" label="Coût total" value={`$${(Number(c.total_cost) || 0).toFixed(0)}`}
              color="#f57c00" sub={`≈ ${Math.round((c.total_cost || 0) * 620).toLocaleString('fr-FR')} FCFA`} href="/reports" />
          </div>
        </div>

        {/* ── LIGNE 2 : Graphique + Performance ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div className="dash-card" style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d' }}>📈 Évolution 7 jours</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[['#2d7a3e', 'Livrés'], ['#8bc34a', 'Lus']].map(([c2, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7c74' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c2 }} />{l}
                  </div>
                ))}
              </div>
            </div>
            <MiniChart data={d.daily_7} />
          </div>

          <div className="dash-card" style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', padding: '24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d', marginBottom: 20 }}>🎯 Performance globale</div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <RadialProgress value={c.total_delivered || 0} max={c.total_sent || 1} color="#2d7a3e" size={90}
                label="Livraison" sub={`${c.avg_delivery_rate || 0}%`} />
              <RadialProgress value={c.total_read || 0} max={c.total_delivered || 1} color="#8bc34a" size={90}
                label="Lecture" sub={`${c.avg_read_rate || 0}%`} />
            </div>
            {/* Benchmark */}
            <div style={{ marginTop: 16, padding: '10px', background: '#f0f7f3', borderRadius: 10, fontSize: 12 }}>
              <div style={{ color: '#2d7a3e', fontWeight: 600 }}>vs Industrie</div>
              <div style={{ color: '#6b7c74', marginTop: 3 }}>
                Livraison: secteur ~89% · Lecture: secteur ~55%
              </div>
              <div style={{ color: '#2d7a3e', fontWeight: 500, marginTop: 2 }}>
                ✅ Vos performances sont {(c.avg_delivery_rate || 0) >= 89 ? 'au-dessus' : 'en dessous'} de la moyenne
              </div>
            </div>
          </div>
        </div>

        {/* ── LIGNE 3 : Campagnes récentes + A/B + Scoring ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 20 }}>
          {/* Campagnes récentes */}
          <div className="dash-card" style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f7f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d' }}>🚀 Campagnes récentes</div>
              <Link href="/campaigns" style={{ fontSize: 12, color: '#2d7a3e', textDecoration: 'none', fontWeight: 500 }}>Voir tout →</Link>
            </div>
            {d.recent_campaigns.map((camp, i) => {
              const pct = camp.sent_count > 0 ? Math.round((camp.read_count / camp.sent_count) * 100) : 0;
              return (
                <div key={camp.id} style={{ padding: '12px 20px', borderBottom: i < d.recent_campaigns.length - 1 ? '1px solid #f8faf9' : 'none',
                  display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1f1d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {camp.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <StatusBadge status={camp.status} />
                      <span style={{ fontSize: 11, color: '#9eada5' }}>{camp.sent_count.toLocaleString('fr-FR')} envois</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: pct >= 60 ? '#2d7a3e' : pct >= 40 ? '#f57c00' : '#9eada5' }}>
                      {pct}%
                    </div>
                    <div style={{ fontSize: 10, color: '#9eada5' }}>lus</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* A/B Tests */}
          <div className="dash-card" style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f7f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d' }}>🧪 A/B Tests</div>
              <Link href="/ab-tests" style={{ fontSize: 12, color: '#9c27b0', textDecoration: 'none', fontWeight: 500 }}>Voir tout →</Link>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { l: 'En cours', v: d.ab_tests.running, c: '#f57c00' },
                  { l: 'Terminés', v: d.ab_tests.completed, c: '#2d7a3e' },
                  { l: 'Total', v: d.ab_tests.total, c: '#9c27b0' },
                  { l: 'Succès', v: d.ab_tests.completed > 0 ? `${Math.round((d.ab_tests.completed / d.ab_tests.total) * 100)}%` : '—', c: '#1976d2' },
                ].map(item => (
                  <div key={item.l} style={{ padding: '10px', background: '#f8faf9', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.c }}>{item.v}</div>
                    <div style={{ fontSize: 10, color: '#9eada5', marginTop: 2 }}>{item.l}</div>
                  </div>
                ))}
              </div>
              {d.recent_ab.map(test => (
                <div key={test.id} style={{ padding: '10px', background: '#f8faf9', borderRadius: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1f1d', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusBadge status={test.status} />
                    {test.winner_variant && (
                      <span style={{ fontSize: 11, color: '#2d7a3e', fontWeight: 600 }}>🏆 {test.winner_variant} ({test.winner_confidence?.toFixed(0)}%)</span>
                    )}
                    {!test.winner_variant && test.winner_confidence && (
                      <span style={{ fontSize: 11, color: '#f57c00' }}>{test.winner_confidence?.toFixed(0)}% conf.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring IA */}
          <div className="dash-card" style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f7f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d' }}>🎯 Scoring contacts</div>
              <Link href="/ai" style={{ fontSize: 12, color: '#f57c00', textDecoration: 'none', fontWeight: 500 }}>Voir tout →</Link>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {Object.entries(SEGMENT_CFG).map(([key, cfg]) => {
                const count = d.ai_scores[key] || 0;
                const pct = totalSegmented > 0 ? (count / totalSegmented) * 100 : 0;
                return (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                      <span style={{ color: '#1a1f1d', fontWeight: 600 }}>{count.toLocaleString('fr-FR')}</span>
                    </div>
                    <div style={{ height: 5, background: '#f0f7f3', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 99, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 12, padding: '10px', background: '#f0f7f3', borderRadius: 10, fontSize: 11, color: '#2d7a3e' }}>
                💡 Meilleur envoi: <strong>{d.timing_insight?.best_day} à {d.timing_insight?.best_hour}h</strong>
                <div style={{ color: '#6b7c74', marginTop: 2 }}>Taux de lecture prévu: {d.timing_insight?.predicted_read_rate}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── LIGNE 4 : Multi-canal + Analyse IA ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
          {/* Multi-canal */}
          <div className="dash-card" style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d' }}>📡 Multi-canal</div>
              <Link href="/ai" style={{ fontSize: 12, color: '#6b7c74', textDecoration: 'none' }}>Configurer →</Link>
            </div>
            {(d.multichannel || []).map(stat => {
              const cfg = CHANNEL_CFG[stat.channel] || CHANNEL_CFG.whatsapp;
              return (
                <div key={stat.channel} style={{ display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px', borderRadius: 10, marginBottom: 8, background: '#f8faf9' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: '#1a1f1d' }}>{cfg.label}</span>
                      <span style={{ color: cfg.color, fontWeight: 600 }}>{stat.delivery_rate}%</span>
                    </div>
                    <div style={{ height: 4, background: '#e5ebe8', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stat.delivery_rate}%`, background: cfg.color, borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#9eada5', marginTop: 2 }}>
                      {Number(stat.total).toLocaleString('fr-FR')} msgs · ${(Number(stat.total_cost) || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Analyse IA */}
          <div className="dash-card" style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d' }}>🤖 Analyse IA de la dernière campagne</div>
              {!aiAnalysis && (
                <button onClick={handleQuickAnalyze} disabled={analyzing} style={{ padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#9c27b0', color: 'white', cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: analyzing ? 0.7 : 1 }}>
                  {analyzing ? '⏳' : '🤖 Analyser'}
                </button>
              )}
            </div>

            {!aiAnalysis && !analyzing && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 180, color: '#9eada5', textAlign: 'center', gap: 12 }}>
                <div style={{ fontSize: 40 }}>🤖</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7c74' }}>Analyse IA disponible</div>
                <div style={{ fontSize: 12 }}>Cliquez "Analyser" pour obtenir des insights personnalisés</div>
              </div>
            )}

            {analyzing && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 12 }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e5ebe8', borderTopColor: '#9c27b0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: 13, color: '#6b7c74' }}>Analyse Claude en cours…</div>
              </div>
            )}

            {aiAnalysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0f7f3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#2d7a3e' }}>
                    {aiAnalysis.overall_grade}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: '#4a5852', lineHeight: 1.5 }}>
                    {aiAnalysis.performance_summary}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2d7a3e', marginBottom: 4 }}>✅ Points forts</div>
                    {(aiAnalysis.strengths || []).slice(0, 2).map((s, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#1e5a2f', marginBottom: 2 }}>· {s}</div>
                    ))}
                  </div>
                  <div style={{ background: '#fff3e0', borderRadius: 10, padding: '10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f57c00', marginBottom: 4 }}>⚠️ À améliorer</div>
                    {(aiAnalysis.weaknesses || []).slice(0, 2).map((w, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#e65100', marginBottom: 2 }}>· {w}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1f1d', marginBottom: 6 }}>🎯 Actions prioritaires</div>
                  {(aiAnalysis.action_items || []).slice(0, 2).map((action, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '8px', background: '#f8faf9',
                      borderRadius: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 700, flexShrink: 0,
                        background: action.priority === 'high' ? '#ffebee' : '#fff3e0',
                        color: action.priority === 'high' ? '#c62828' : '#f57c00' }}>
                        {action.priority === 'high' ? 'URGENT' : 'MOYEN'}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, color: '#1a1f1d', fontWeight: 500 }}>{action.action}</div>
                        <div style={{ fontSize: 11, color: '#9eada5' }}>{action.expected_impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ACTIONS RAPIDES ── */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5ebe8', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f1d', marginBottom: 16 }}>⚡ Actions rapides</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { href: '/dashboard/campaigns/create',    label: '🚀 Nouvelle campagne',        color: '#2d7a3e' },
              { href: '/dashboard/campaigns/ab-tests',            label: '🧪 Lancer un A/B test',       color: '#9c27b0' },
              { href: '/dashboard/campaigns/segments',            label: '🎯 Créer un segment',         color: '#1976d2' },
              { href: '/dashboard/campaigns/automations',         label: '⚡ Configurer un workflow',   color: '#f57c00' },
              { href: '/dashboard/campaigns/inbox',               label: '💬 Ouvrir l\'inbox',          color: '#00897b', badge: d.inbox?.total_unread },
              { href: '/dashboard/campaigns/reports',             label: '📊 Générer un rapport PDF',   color: '#c62828' },
              { href: '/dashboard/campaigns/ai',                  label: '⏰ Optimiser les horaires',   color: '#f57c00' },
              { href: '/dashboard/campaigns/ai?tab=multichannel', label: '📡 Envoyer SMS / Email',      color: '#1976d2' },
            ].map(action => (
              <Link key={action.href} href={action.href} className="quick-action" style={{
                padding: '9px 16px', borderRadius: 10, border: `1px solid ${action.color}30`,
                background: `${action.color}08`, color: action.color, textDecoration: 'none',
                fontSize: 13, fontWeight: 500, transition: 'all 0.15s', display: 'flex', gap: 6, alignItems: 'center' }}>
                {action.label}
                {action.badge > 0 && (
                  <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#c62828',
                    color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {action.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
