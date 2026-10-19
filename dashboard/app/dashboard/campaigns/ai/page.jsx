'use client';
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';
async function api(path, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts, headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}), ...opts.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ── DEMO DATA ─────────────────────────────────────────────────
const DEMO_SCORES = [
  { phone_number:'+237674855790', engagement_score:87, quality_score:82, churn_risk:12, delivery_rate:96, segment_label:'champion', preferred_hour:19, total_received:24, total_read:19 },
  { phone_number:'+237656939193', engagement_score:71, quality_score:68, churn_risk:25, delivery_rate:93, segment_label:'loyal', preferred_hour:8, total_received:18, total_read:12 },
  { phone_number:'+237693546523', engagement_score:45, quality_score:42, churn_risk:58, delivery_rate:88, segment_label:'at_risk', preferred_hour:14, total_received:12, total_read:4 },
  { phone_number:'+237698303126', engagement_score:92, quality_score:89, churn_risk:8, delivery_rate:98, segment_label:'champion', preferred_hour:20, total_received:31, total_read:28 },
  { phone_number:'+237677760299', engagement_score:18, quality_score:22, churn_risk:82, delivery_rate:72, segment_label:'inactive', preferred_hour:null, total_received:8, total_read:1 },
  { phone_number:'+237690020882', engagement_score:56, quality_score:54, churn_risk:38, delivery_rate:91, segment_label:'promising', preferred_hour:12, total_received:9, total_read:5 },
  { phone_number:'+237699935321', engagement_score:33, quality_score:38, churn_risk:65, delivery_rate:85, segment_label:'at_risk', preferred_hour:18, total_received:15, total_read:5 },
  { phone_number:'+237678025640', engagement_score:0, quality_score:30, churn_risk:40, delivery_rate:95, segment_label:'new', preferred_hour:null, total_received:1, total_read:0 },
];

const DEMO_DISTRIBUTION = [
  { segment_label:'champion',  count:2,  avg_score:85.5, avg_churn:10 },
  { segment_label:'loyal',     count:1,  avg_score:68,   avg_churn:25 },
  { segment_label:'promising', count:1,  avg_score:54,   avg_churn:38 },
  { segment_label:'at_risk',   count:2,  avg_score:40,   avg_churn:61.5 },
  { segment_label:'inactive',  count:1,  avg_score:22,   avg_churn:82 },
  { segment_label:'new',       count:1,  avg_score:30,   avg_churn:40 },
];

const DEMO_TIMING = {
  profile: { best_hour:19, best_day:4, total_analyzed:1240 },
  top_slots: [
    { hour:19, score:95, label:'19h00' }, { hour:20, score:88, label:'20h00' },
    { hour:8,  score:81, label:'08h00' }, { hour:12, score:74, label:'12h00' },
    { hour:18, score:69, label:'18h00' },
  ],
  top_days: [
    { day:4, score:92, label:'Vendredi' }, { day:1, score:85, label:'Mardi' },
    { day:3, score:80, label:'Jeudi' },
  ],
  ai_insights: {
    best_time_summary: 'Envoi optimal le Vendredi à 19h (heure Douala)',
    insights: [
      'Pic de lecture entre 18h-21h (retour maison, temps libre)',
      'Vendredi génère 35% plus de lectures que lundi',
      'Éviter samedi après 15h et dimanche matin',
    ],
    warnings: [],
    predicted_delivery_rate: 93,
    predicted_read_rate: 62,
    alternative_slots: [
      { hour:8, reason:'Réveil — ouverture des notifications au lever' },
      { hour:12, reason:'Pause déjeuner — consultation fréquente du téléphone' },
    ]
  },
  scheduled_at_suggestion: new Date(Date.now() + 2 * 86400000).toISOString()
};

const DEMO_MC_STATS = [
  { channel:'whatsapp', total:28940, delivered:26810, read:15640, failed:740, delivery_rate:92.6, total_cost:144.7 },
  { channel:'sms',      total:4200,  delivered:3990,  read:null,  failed:210, delivery_rate:95.0, total_cost:210.0 },
  { channel:'email',    total:8600,  delivered:8150,  read:3440,  failed:450, delivery_rate:94.8, total_cost:8.6 },
];

// ── STYLES ────────────────────────────────────────────────────
const inp = { padding:'8px 12px', borderRadius:10, border:'1px solid #e5ebe8', fontSize:13, color:'#1a1f1d', background:'white', outline:'none', boxSizing:'border-box' };

const SEGMENT_CFG = {
  champion:  { label:'Champion 🏆',   color:'#2d7a3e', bg:'#e8f5e9' },
  loyal:     { label:'Fidèle 💙',     color:'#1976d2', bg:'#e3f2fd' },
  promising: { label:'Prometteur 🌱', color:'#00897b', bg:'#e0f2f1' },
  at_risk:   { label:'À risque ⚠️',  color:'#f57c00', bg:'#fff3e0' },
  inactive:  { label:'Inactif 😴',   color:'#9eada5', bg:'#f0f7f3' },
  new:       { label:'Nouveau ✨',    color:'#9c27b0', bg:'#f3e5f5' },
  unknown:   { label:'Inconnu',       color:'#6b7c74', bg:'#f8faf9' },
};

const CHANNEL_CFG = {
  whatsapp: { label:'WhatsApp', icon:'💬', color:'#2d7a3e', bg:'#e8f5e9' },
  sms:      { label:'SMS',      icon:'📱', color:'#1976d2', bg:'#e3f2fd' },
  email:    { label:'Email',    icon:'✉️', color:'#f57c00', bg:'#fff3e0' },
};

// ── COMPOSANTS ───────────────────────────────────────────────
function ScoreRing({ value, size=60, color }) {
  const r = size/2-5, circ = 2*Math.PI*r, dash = (Math.min(value,100)/100)*circ;
  const c = color || (value>=70?'#2d7a3e':value>=40?'#f57c00':'#c62828');
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f7f3" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition:'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:size>50?13:11, fontWeight:700, color:c }}>{Math.round(value)}</div>
    </div>
  );
}

function HeatmapHour({ scores }) {
  const maxScore = Math.max(...Object.values(scores||{}), 1);
  const hours = Array.from({length:24}, (_,i)=>i);
  return (
    <div style={{ display:'flex', gap:2, alignItems:'flex-end' }}>
      {hours.map(h => {
        const score = scores?.[h] || 0;
        const pct = (score/maxScore)*100;
        const color = pct>=80?'#2d7a3e':pct>=50?'#8bc34a':pct>=25?'#f57c00':'#e5ebe8';
        return (
          <div key={h} title={`${h}h: score ${Math.round(pct)}%`}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <div style={{ width:'100%', height: Math.max(pct*0.8, 3), background:color,
              borderRadius:'3px 3px 0 0', transition:'height 0.4s ease', minHeight:3 }} />
            {[0,6,12,18].includes(h) && (
              <div style={{ fontSize:9, color:'#9eada5', writingMode:'horizontal-tb' }}>{h}h</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChannelCard({ stat, onConfigure }) {
  const cfg = CHANNEL_CFG[stat.channel] || CHANNEL_CFG.whatsapp;
  return (
    <div style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:cfg.bg,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{cfg.icon}</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d' }}>{cfg.label}</div>
            <div style={{ fontSize:11, color:'#9eada5' }}>Canal de communication</div>
          </div>
        </div>
        <button onClick={onConfigure} style={{ padding:'5px 10px', borderRadius:8, border:`1px solid ${cfg.color}`,
          background:'white', color:cfg.color, cursor:'pointer', fontSize:11, fontWeight:600 }}>
          ⚙️ Config
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:12 }}>
        {[
          { l:'Envoyés', v:(stat.total||0).toLocaleString('fr-FR'), c:'#1a1f1d' },
          { l:'Livrés', v:`${stat.delivery_rate||0}%`, c:cfg.color },
          { l:'Échecs', v:(stat.failed||0).toLocaleString('fr-FR'), c:'#c62828' },
          { l:'Coût', v:`$${(stat.total_cost||0).toFixed(2)}`, c:'#f57c00' },
        ].map(item=>(
          <div key={item.l} style={{ padding:'8px', background:'#f8faf9', borderRadius:8, textAlign:'center' }}>
            <div style={{ fontSize:15, fontWeight:700, color:item.c }}>{item.v}</div>
            <div style={{ fontSize:10, color:'#9eada5' }}>{item.l}</div>
          </div>
        ))}
      </div>

      <div style={{ height:6, background:'#f0f7f3', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${stat.delivery_rate||0}%`, background:cfg.color, borderRadius:99, transition:'width 0.8s' }} />
      </div>
      <div style={{ fontSize:11, color:'#9eada5', marginTop:4, textAlign:'right' }}>{stat.delivery_rate||0}% livraison</div>
    </div>
  );
}

// ── PAGE PRINCIPALE ──────────────────────────────────────────
export default function AIPage() {
  const [tab, setTab] = useState('scoring');
  const [scores, setScores] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [timing, setTiming] = useState(null);
  const [mcStats, setMcStats] = useState([]);
  const [providers, setProviders] = useState({ sms:[], email:[] });
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [toast, setToast] = useState(null);
  const [segmentFilter, setSegmentFilter] = useState('');
  const [showProviderModal, setShowProviderModal] = useState(null); // 'sms' | 'email'
  const [providerForm, setProviderForm] = useState({});
  const [sendTestForm, setSendTestForm] = useState({ phone:'', email:'', message:'', subject:'', channels:['whatsapp'] });

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [scoresRes, timingRes, mcRes, provRes] = await Promise.allSettled([
        api('/ai/scores?limit=50'),
        api('/ai/timing'),
        api('/multichannel/stats'),
        api('/multichannel/providers'),
      ]);
      if (scoresRes.status==='fulfilled') { setScores(scoresRes.value.scores||[]); setDistribution(scoresRes.value.distribution||[]); }
      else { setScores(DEMO_SCORES); setDistribution(DEMO_DISTRIBUTION); }
      if (timingRes.status==='fulfilled') setTiming(timingRes.value);
      else setTiming(DEMO_TIMING);
      if (mcRes.status==='fulfilled') setMcStats(mcRes.value.stats||[]);
      else setMcStats(DEMO_MC_STATS);
      if (provRes.status==='fulfilled') setProviders(provRes.value);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleComputeScores = async () => {
    setComputing(true);
    try {
      const phone = prompt('Numéro à scorer (ou laisser vide pour un batch via campaign_id):');
      if (phone) {
        const res = await api('/ai/scores/compute', { method:'POST', body:JSON.stringify({ phone_number:phone, use_ai:true }) });
        showToast(`Score calculé: ${res.score?.quality_score?.toFixed(0)||0}/100 — Segment: ${res.score?.segment_label}`);
        fetchAll();
      }
    } catch {
      // Démo
      showToast('Score calculé (mode démo)');
    } finally { setComputing(false); }
  };

  const handleBuildProfile = async () => {
    try {
      await api('/ai/timing/build-profile', { method:'POST' });
      showToast('Profil horaire recalculé !');
      fetchAll();
    } catch { showToast('Profil horaire mis à jour (démo)'); }
  };

  const handleConfigureProvider = async () => {
    try {
      if (showProviderModal === 'sms') {
        await api('/multichannel/providers/sms', { method:'POST', body:JSON.stringify(providerForm) });
        showToast(`Provider SMS ${providerForm.provider_name} configuré !`);
      } else {
        await api('/multichannel/providers/email', { method:'POST', body:JSON.stringify(providerForm) });
        showToast(`Provider Email ${providerForm.provider_name} configuré !`);
      }
      setShowProviderModal(null);
      setProviderForm({});
      fetchAll();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleSendTest = async () => {
    const { phone, email, message, subject, channels } = sendTestForm;
    try {
      const res = await api('/multichannel/send', {
        method:'POST',
        body: JSON.stringify({
          recipient: { phone, email, name: 'Test' },
          content: { text: message, sms: message, html: `<p>${message}</p>`, subject: subject || 'Test NumericExport' },
          channels
        })
      });
      showToast(`Envoyé via ${res.channel_used} ✅`);
    } catch { showToast('Envoi test simulé (mode démo)'); }
  };

  const filteredScores = segmentFilter ? scores.filter(s=>s.segment_label===segmentFilter) : scores;
  const t = timing || DEMO_TIMING;

  const TABS = [
    { id:'scoring', label:'🎯 Scoring IA', icon:'🎯' },
    { id:'timing',  label:'⏰ Timing IA', icon:'⏰' },
    { id:'multichannel', label:'📡 Multi-canal', icon:'📡' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f8faf9', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
        .score-row:hover{background:#fafcfb!important}
        .tab-btn2{padding:10px 18px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:500;color:#6b7c74;border-bottom:2px solid transparent;transition:all 0.2s;font-family:inherit}
        .tab-btn2.active{color:#2d7a3e;border-bottom-color:#2d7a3e;font-weight:600}
        .tab-btn2:hover{color:#2d7a3e}
      `}</style>

      {toast && (
        <div style={{ position:'fixed', top:24, right:24, zIndex:9999, padding:'12px 20px', borderRadius:12,
          background:toast.type==='error'?'#c62828':'#2d7a3e', color:'white', fontSize:14, fontWeight:500,
          boxShadow:'0 8px 24px rgba(0,0,0,0.2)', animation:'slideDown 0.3s ease' }}>
          {toast.type==='error'?'❌ ':'✅ '}{toast.msg}
        </div>
      )}

      {/* Provider Modal */}
      {showProviderModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:480, padding:'28px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#1a1f1d' }}>
                {showProviderModal==='sms'?'📱 Configurer provider SMS':'✉️ Configurer provider Email'}
              </div>
              <button onClick={()=>{setShowProviderModal(null);setProviderForm({});}} style={{ border:'none', background:'#f8faf9', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Provider *</label>
                <select value={providerForm.provider_name||''} onChange={e=>setProviderForm(f=>({...f,provider_name:e.target.value}))} style={inp}>
                  <option value="">Choisir...</option>
                  {showProviderModal==='sms' ? (
                    <>{['africas_talking','nexah','twilio','vonage'].map(p=><option key={p} value={p}>{p}</option>)}</>
                  ) : (
                    <>{['brevo','sendgrid','mailgun','amazon_ses','smtp'].map(p=><option key={p} value={p}>{p}</option>)}</>
                  )}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>API Key *</label>
                <input type="password" value={providerForm.api_key||''} onChange={e=>setProviderForm(f=>({...f,api_key:e.target.value}))} placeholder="••••••••••••" style={inp} />
              </div>
              {showProviderModal==='sms' && (
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Sender ID</label>
                  <input value={providerForm.sender_id||''} onChange={e=>setProviderForm(f=>({...f,sender_id:e.target.value}))} placeholder="NumExp" style={inp} />
                </div>
              )}
              {showProviderModal==='email' && (
                <>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Email expéditeur *</label>
                    <input type="email" value={providerForm.from_email||''} onChange={e=>setProviderForm(f=>({...f,from_email:e.target.value}))} placeholder="noreply@numericexport.com" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Nom expéditeur</label>
                    <input value={providerForm.from_name||''} onChange={e=>setProviderForm(f=>({...f,from_name:e.target.value}))} placeholder="NumericExport" style={inp} />
                  </div>
                </>
              )}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
              <button onClick={()=>{setShowProviderModal(null);setProviderForm({});}} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid #e5ebe8', background:'white', color:'#6b7c74', cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={handleConfigureProvider} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'#2d7a3e', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>✅ Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #e5ebe8', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:1300, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:64, padding:'0 32px' }}>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#f57c00,#ffb74d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🤖</div>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:'#1a1f1d' }}>IA & Multi-canal</div>
                <div style={{ fontSize:12, color:'#9eada5' }}>Scoring contacts · Optimisation horaire · SMS + Email</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', borderTop:'1px solid #f0f7f3', padding:'0 32px' }}>
            {TABS.map(t2=>(
              <button key={t2.id} className={`tab-btn2 ${tab===t2.id?'active':''}`} onClick={()=>setTab(t2.id)}>
                {t2.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1300, margin:'0 auto', padding:'32px' }}>

        {/* ── SCORING IA ── */}
        {tab === 'scoring' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {/* Distribution */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d' }}>🎯 Distribution des segments</div>
                  <button onClick={handleComputeScores} disabled={computing} style={{ padding:'7px 14px', borderRadius:10, border:'none',
                    background:'linear-gradient(135deg,#f57c00,#ffb74d)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600, opacity:computing?0.7:1 }}>
                    {computing?'⏳ Calcul...':'🤖 Scorer un contact'}
                  </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {DEMO_DISTRIBUTION.map(d => {
                    const cfg = SEGMENT_CFG[d.segment_label] || SEGMENT_CFG.unknown;
                    const total = DEMO_DISTRIBUTION.reduce((a,x)=>a+parseInt(x.count),0);
                    return (
                      <div key={d.segment_label} onClick={()=>setSegmentFilter(segmentFilter===d.segment_label?'':d.segment_label)}
                        style={{ padding:'14px', borderRadius:12, cursor:'pointer', border:`2px solid ${segmentFilter===d.segment_label?cfg.color:'#e5ebe8'}`,
                          background:segmentFilter===d.segment_label?cfg.bg:'white', transition:'all 0.2s' }}>
                        <div style={{ fontSize:18, fontWeight:700, color:cfg.color }}>{d.count}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:cfg.color, marginBottom:4 }}>{cfg.label}</div>
                        <div style={{ height:4, background:'#f0f7f3', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${(d.count/total)*100}%`, background:cfg.color, borderRadius:99 }} />
                        </div>
                        <div style={{ fontSize:10, color:'#9eada5', marginTop:4 }}>Score moy: {d.avg_score}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d', marginBottom:16 }}>📖 Légende RFM</div>
                {Object.entries(SEGMENT_CFG).filter(([k])=>k!=='unknown').map(([key,cfg])=>(
                  <div key={key} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:14 }}>{cfg.label.split(' ')[1]||'·'}</span>
                    <div style={{ flex:1, fontSize:12, color:'#6b7c74' }}>{cfg.label.split(' ')[0]}</div>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:12, background:cfg.bg, color:cfg.color, fontWeight:600 }}>
                      {key === 'champion' ? '>70%' : key === 'loyal' ? '50-70%' : key === 'promising' ? '30-50%' : key === 'at_risk' ? 'Risque 50%+' : key === 'inactive' ? '60j sans activité' : 'Premier contact'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Table scores */}
            <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', overflow:'hidden' }}>
              <div style={{ padding:'16px 24px', borderBottom:'1px solid #f0f7f3', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d' }}>
                  Scores contacts {segmentFilter && <span style={{ fontSize:12, color:SEGMENT_CFG[segmentFilter]?.color }}>(filtré: {SEGMENT_CFG[segmentFilter]?.label})</span>}
                </div>
                {segmentFilter && <button onClick={()=>setSegmentFilter('')} style={{ fontSize:12, color:'#9eada5', border:'none', background:'none', cursor:'pointer' }}>× Effacer filtre</button>}
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8faf9', borderBottom:'1px solid #e5ebe8' }}>
                    {['Numéro','Segment','Qualité','Engagement','Risque churn','Heure préférée','Messages'].map(h=>(
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7c74', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredScores.map(s => {
                    const seg = SEGMENT_CFG[s.segment_label] || SEGMENT_CFG.unknown;
                    return (
                      <tr key={s.phone_number} className="score-row" style={{ borderBottom:'1px solid #f8faf9' }}>
                        <td style={{ padding:'12px 16px', fontFamily:"'DM Mono',monospace", fontSize:12, color:'#1a1f1d' }}>{s.phone_number}</td>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, background:seg.bg, color:seg.color }}>{seg.label}</span>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <ScoreRing value={s.quality_score} size={48} />
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <ScoreRing value={s.engagement_score} size={40} color="#1976d2" />
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <div style={{ width:60, height:6, background:'#f0f7f3', borderRadius:99, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${s.churn_risk}%`, background: s.churn_risk>=60?'#c62828':s.churn_risk>=30?'#f57c00':'#2d7a3e', borderRadius:99 }} />
                            </div>
                            <span style={{ fontSize:11, fontWeight:600, color: s.churn_risk>=60?'#c62828':s.churn_risk>=30?'#f57c00':'#2d7a3e' }}>{s.churn_risk}%</span>
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:13, color:'#1a1f1d' }}>
                          {s.preferred_hour !== null && s.preferred_hour !== undefined ? `${s.preferred_hour}h00` : '—'}
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:12, color:'#6b7c74' }}>
                          {s.total_received} reçus · {s.total_read} lus
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TIMING IA ── */}
        {tab === 'timing' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              {/* Profil horaire */}
              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d' }}>📊 Heatmap des lectures (24h)</div>
                  <button onClick={handleBuildProfile} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #f57c00',
                    background:'white', color:'#f57c00', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                    🔄 Recalculer
                  </button>
                </div>
                <HeatmapHour scores={t.top_slots?.reduce((a,s)=>({...a,[s.hour]:s.score}),{}) || {}} />
                <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                  {[[0,'#e5ebe8','Faible'],[25,'#f57c00','Moyen'],[50,'#8bc34a','Bon'],[80,'#2d7a3e','Excellent']].map(([thr,c,l])=>(
                    <div key={l} style={{ display:'flex', gap:4, alignItems:'center', fontSize:11, color:'#6b7c74' }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:c }} />{l}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommandations IA */}
              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d', marginBottom:4 }}>🤖 Recommandations IA</div>
                <div style={{ fontSize:12, color:'#9eada5', marginBottom:16 }}>
                  Basé sur {(t.profile?.total_analyzed||0).toLocaleString('fr-FR')} messages analysés
                </div>

                {/* Meilleur créneau */}
                <div style={{ background:'linear-gradient(135deg,#e8f5e9,#f0f7f3)', borderRadius:12, padding:'16px', marginBottom:16, border:'1px solid #a5d6a7' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>⏰</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1e5a2f' }}>
                    {t.ai_insights?.best_time_summary || `Envoi optimal à ${t.profile?.best_hour}h`}
                  </div>
                  <div style={{ display:'flex', gap:12, marginTop:8 }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:18, fontWeight:700, color:'#2d7a3e' }}>{t.ai_insights?.predicted_delivery_rate||88}%</div>
                      <div style={{ fontSize:10, color:'#6b7c74' }}>Livraison prévue</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:18, fontWeight:700, color:'#8bc34a' }}>{t.ai_insights?.predicted_read_rate||52}%</div>
                      <div style={{ fontSize:10, color:'#6b7c74' }}>Lecture prévue</div>
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(t.ai_insights?.insights||[]).map((ins,i) => (
                    <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:'#4a5852',
                      padding:'8px 10px', background:'#f8faf9', borderRadius:8 }}>
                      <span>💡</span><span>{ins}</span>
                    </div>
                  ))}
                  {(t.ai_insights?.warnings||[]).map((w,i) => (
                    <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:'#f57c00',
                      padding:'8px 10px', background:'#fff3e0', borderRadius:8 }}>
                      <span>⚠️</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top créneaux + Suggestion planification */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d', marginBottom:16 }}>🏅 Top 5 créneaux</div>
                {(t.top_slots||[]).map((slot,i) => (
                  <div key={slot.hour} style={{ display:'flex', gap:12, alignItems:'center', marginBottom:10 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'#f0f7f3',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:i<3?'white':'#9eada5', flexShrink:0 }}>
                      {i+1}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                        <span style={{ fontWeight:600, color:'#1a1f1d' }}>{slot.label}</span>
                        <span style={{ color:'#2d7a3e', fontWeight:600 }}>{slot.score}%</span>
                      </div>
                      <div style={{ height:5, background:'#f0f7f3', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${slot.score}%`, background:'#2d7a3e', borderRadius:99 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d', marginBottom:16 }}>📅 Planification suggérée</div>
                <div style={{ background:'#f0f7f3', borderRadius:12, padding:'16px', marginBottom:16 }}>
                  <div style={{ fontSize:12, color:'#6b7c74', marginBottom:4 }}>Prochain créneau optimal :</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#2d7a3e' }}>
                    {t.scheduled_at_suggestion ? new Date(t.scheduled_at_suggestion).toLocaleString('fr-FR', { weekday:'long', day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit' }) : '—'}
                  </div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', marginBottom:10 }}>Créneaux alternatifs IA :</div>
                {(t.ai_insights?.alternative_slots||[]).map((slot,i) => (
                  <div key={i} style={{ padding:'10px', background:'#f8faf9', borderRadius:8, marginBottom:8 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>🕐 {slot.hour}h00</div>
                    <div style={{ fontSize:11, color:'#6b7c74', marginTop:2 }}>{slot.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MULTI-CANAL ── */}
        {tab === 'multichannel' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {/* Stats canaux */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
              {(mcStats.length > 0 ? mcStats : DEMO_MC_STATS).map(stat => (
                <ChannelCard key={stat.channel} stat={stat}
                  onConfigure={()=>{ setShowProviderModal(stat.channel==='email'?'email':'sms'); setProviderForm({}); }} />
              ))}
            </div>

            {/* Envoi test multi-canal */}
            <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d', marginBottom:20 }}>🚀 Envoi test multi-canal</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Numéro WhatsApp / SMS</label>
                  <input value={sendTestForm.phone} onChange={e=>setSendTestForm(f=>({...f,phone:e.target.value}))}
                    placeholder="+237674855790" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Email</label>
                  <input type="email" value={sendTestForm.email} onChange={e=>setSendTestForm(f=>({...f,email:e.target.value}))}
                    placeholder="client@example.com" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Sujet email</label>
                  <input value={sendTestForm.subject} onChange={e=>setSendTestForm(f=>({...f,subject:e.target.value}))}
                    placeholder="Votre facture NumericExport" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Canaux (ordre de priorité)</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {['whatsapp','sms','email'].map(ch => {
                      const active = sendTestForm.channels.includes(ch);
                      const cfg = CHANNEL_CFG[ch];
                      return (
                        <button key={ch} onClick={()=>setSendTestForm(f=>({...f, channels: active?f.channels.filter(c=>c!==ch):[...f.channels,ch]}))}
                          style={{ padding:'6px 10px', borderRadius:8, border:`1.5px solid ${active?cfg.color:'#e5ebe8'}`,
                            background:active?cfg.bg:'white', color:active?cfg.color:'#9eada5', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                          {cfg.icon} {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Message</label>
                <textarea value={sendTestForm.message} onChange={e=>setSendTestForm(f=>({...f,message:e.target.value}))}
                  placeholder="Bonjour {{name}}, votre facture est disponible..." rows={3}
                  style={{...inp, resize:'vertical', fontFamily:'inherit', lineHeight:1.5, width:'100%'}} />
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <button onClick={handleSendTest} style={{ padding:'9px 20px', borderRadius:10, border:'none',
                  background:'linear-gradient(135deg,#2d7a3e,#3a9950)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600,
                  boxShadow:'0 2px 8px rgba(45,122,62,0.3)' }}>
                  📤 Envoyer via {sendTestForm.channels[0]||'WhatsApp'} → fallback auto
                </button>
                <div style={{ fontSize:12, color:'#9eada5' }}>
                  Si échec: {sendTestForm.channels.slice(1).join(' → ') || 'aucun fallback'}
                </div>
              </div>
            </div>

            {/* Configuration providers */}
            <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'24px' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d', marginBottom:16 }}>⚙️ Providers configurés</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1976d2', marginBottom:10 }}>📱 SMS</div>
                  {providers.sms?.length > 0 ? providers.sms.map(p=>(
                    <div key={p.id} style={{ padding:'10px', background:'#f8faf9', borderRadius:8, marginBottom:6, display:'flex', justifyContent:'space-between', fontSize:12 }}>
                      <span style={{ fontWeight:500 }}>{p.provider_name}</span>
                      <span style={{ color:'#9eada5' }}>{p.messages_sent} envois</span>
                    </div>
                  )) : (
                    <button onClick={()=>{setShowProviderModal('sms');setProviderForm({});}} style={{
                      width:'100%', padding:'10px', borderRadius:10, border:'2px dashed #e5ebe8',
                      background:'transparent', color:'#9eada5', cursor:'pointer', fontSize:13 }}>
                      ＋ Configurer un provider SMS
                    </button>
                  )}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#f57c00', marginBottom:10 }}>✉️ Email</div>
                  {providers.email?.length > 0 ? providers.email.map(p=>(
                    <div key={p.id} style={{ padding:'10px', background:'#f8faf9', borderRadius:8, marginBottom:6, display:'flex', justifyContent:'space-between', fontSize:12 }}>
                      <span style={{ fontWeight:500 }}>{p.provider_name}</span>
                      <span style={{ color:'#9eada5' }}>{p.from_email}</span>
                    </div>
                  )) : (
                    <button onClick={()=>{setShowProviderModal('email');setProviderForm({});}} style={{
                      width:'100%', padding:'10px', borderRadius:10, border:'2px dashed #e5ebe8',
                      background:'transparent', color:'#9eada5', cursor:'pointer', fontSize:13 }}>
                      ＋ Configurer un provider Email
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
