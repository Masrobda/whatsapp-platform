'use client';
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';
async function api(path, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ── DEMO DATA ─────────────────────────────────────────────────
const DEMO_TESTS = [
  {
    id: 't1', name: 'Template facture vs relance', status: 'completed',
    test_type: 'template', winner_criteria: 'read_rate',
    winner_variant: 'B', winner_confidence: 97.3, statistical_significance: true,
    test_duration_hours: 24, min_sample_size: 200,
    started_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    completed_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    variants: [
      { variant_name: 'A', label: 'Template standard', template_name: 'next_001_facture_en_01',
        contacts_assigned: 420, sent_count: 420, delivered_count: 391, read_count: 198,
        failed_count: 18, delivery_rate: 93.1, read_rate: 50.6, reply_rate: 3.2, is_winner: false },
      { variant_name: 'B', label: 'Template relance urgente', template_name: 'relance_impaye_v1',
        contacts_assigned: 420, sent_count: 420, delivered_count: 401, read_count: 247,
        failed_count: 12, delivery_rate: 95.5, read_rate: 61.6, reply_rate: 5.1, is_winner: true },
    ]
  },
  {
    id: 't2', name: 'Horaire matin vs soir', status: 'running',
    test_type: 'send_time', winner_criteria: 'read_rate',
    winner_variant: null, winner_confidence: 72.4, statistical_significance: false,
    test_duration_hours: 48, min_sample_size: 100,
    started_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    completed_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    variants: [
      { variant_name: 'A', label: 'Envoi à 8h du matin', template_name: 'next_new_chat_v1', send_hour: 8,
        contacts_assigned: 150, sent_count: 150, delivered_count: 138, read_count: 62,
        failed_count: 8, delivery_rate: 92.0, read_rate: 44.9, reply_rate: 2.1, is_winner: false },
      { variant_name: 'B', label: 'Envoi à 19h le soir', template_name: 'next_new_chat_v1', send_hour: 19,
        contacts_assigned: 150, sent_count: 150, delivered_count: 141, read_count: 84,
        failed_count: 5, delivery_rate: 94.0, read_rate: 59.6, reply_rate: 4.2, is_winner: false },
    ]
  },
  {
    id: 't3', name: 'A/B Test bienvenue clients', status: 'draft',
    test_type: 'template', winner_criteria: 'delivery_rate',
    winner_variant: null, winner_confidence: null, statistical_significance: false,
    test_duration_hours: 24, min_sample_size: 100,
    started_at: null, completed_at: null,
    created_at: new Date().toISOString(),
    variants: [
      { variant_name: 'A', label: 'Message court', template_name: 'next_new_chat_v1',
        contacts_assigned: 0, sent_count: 0, delivered_count: 0, read_count: 0,
        failed_count: 0, delivery_rate: 0, read_rate: 0, reply_rate: 0, is_winner: false },
      { variant_name: 'B', label: 'Message long avec CTA', template_name: 'next_new_chat_v2',
        contacts_assigned: 0, sent_count: 0, delivered_count: 0, read_count: 0,
        failed_count: 0, delivery_rate: 0, read_rate: 0, reply_rate: 0, is_winner: false },
    ]
  }
];

// ── COULEURS & CONFIG ─────────────────────────────────────────
const VARIANT_COLORS = { A: '#1976d2', B: '#2d7a3e', C: '#f57c00', D: '#9c27b0' };
const STATUS_CFG = {
  draft:     { label:'Brouillon', color:'#6b7c74', bg:'#f0f7f3' },
  running:   { label:'En cours',  color:'#f57c00', bg:'#fff3e0', pulse:true },
  completed: { label:'Terminé',   color:'#2d7a3e', bg:'#e8f5e9' },
  cancelled: { label:'Annulé',    color:'#c62828', bg:'#ffebee' },
};

const inp = { padding:'9px 12px', borderRadius:10, border:'1px solid #e5ebe8', fontSize:13, color:'#1a1f1d', background:'white', outline:'none', width:'100%', boxSizing:'border-box' };

// ── COMPOSANTS ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:20,
      background:c.bg, color:c.color, fontSize:12, fontWeight:600 }}>
      {c.pulse && <span style={{ width:6, height:6, borderRadius:'50%', background:c.color, flexShrink:0, animation:'pulse-anim 1.5s infinite' }} />}
      {c.label}
    </span>
  );
}

function VariantBar({ variant, maxRate, criteria, isWinner }) {
  const color = VARIANT_COLORS[variant.variant_name] || '#6b7c74';
  const rate = criteria === 'read_rate' ? variant.read_rate : criteria === 'reply_rate' ? variant.reply_rate : variant.delivery_rate;
  const barW = maxRate > 0 ? `${(rate / maxRate) * 100}%` : '0%';

  return (
    <div style={{ padding:'14px 16px', background: isWinner ? `${color}08` : 'white',
      border:`1.5px solid ${isWinner ? color : '#e5ebe8'}`, borderRadius:12, position:'relative', overflow:'hidden' }}>
      {isWinner && (
        <div style={{ position:'absolute', top:8, right:12, fontSize:11, fontWeight:700, color,
          background:`${color}15`, padding:'2px 8px', borderRadius:20 }}>🏆 GAGNANT</div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ width:28, height:28, borderRadius:8, background:color,
            display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:13, fontWeight:700 }}>
            {variant.variant_name}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>{variant.label || `Variante ${variant.variant_name}`}</div>
            <div style={{ fontSize:11, color:'#9eada5' }}>{variant.template_name}{variant.send_hour !== null && variant.send_hour !== undefined ? ` · Envoi à ${variant.send_hour}h` : ''}</div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:20, fontWeight:700, color }}>{rate.toFixed(1)}%</div>
          <div style={{ fontSize:11, color:'#9eada5' }}>{criteria === 'read_rate' ? 'lu' : criteria === 'reply_rate' ? 'réponses' : 'livré'}</div>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ height:8, background:'#f0f7f3', borderRadius:99, overflow:'hidden', marginBottom:10 }}>
        <div style={{ height:'100%', width:barW, background:color, borderRadius:99, transition:'width 0.8s ease' }} />
      </div>

      {/* Stats détaillées */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {[
          { l:'Assignés', v:(variant.contacts_assigned||0).toLocaleString('fr-FR') },
          { l:'Livrés', v:`${variant.delivery_rate?.toFixed(1)||0}%` },
          { l:'Lus', v:`${variant.read_rate?.toFixed(1)||0}%` },
          { l:'Échecs', v:variant.failed_count||0 },
        ].map(item => (
          <div key={item.l} style={{ textAlign:'center', padding:'6px', background:'#f8faf9', borderRadius:8 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>{item.v}</div>
            <div style={{ fontSize:10, color:'#9eada5' }}>{item.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceMeter({ confidence, threshold = 95 }) {
  const pct = Math.min(confidence || 0, 100);
  const color = pct >= threshold ? '#2d7a3e' : pct >= 80 ? '#f57c00' : '#c62828';
  const r = 54, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <div style={{ position:'relative', width:130, height:130 }}>
        <svg width={130} height={130} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={65} cy={65} r={r} fill="none" stroke="#f0f7f3" strokeWidth={10} />
          <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition:'stroke-dasharray 1s ease, stroke 0.5s' }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:22, fontWeight:800, color, lineHeight:1 }}>{pct.toFixed(1)}%</span>
          <span style={{ fontSize:10, color:'#9eada5', marginTop:2 }}>confiance</span>
        </div>
      </div>
      <div style={{ fontSize:12, color, fontWeight:600, textAlign:'center' }}>
        {pct >= threshold ? '✅ Statistiquement significatif' : pct >= 80 ? '⏳ En cours d\'accumulation' : '📊 Données insuffisantes'}
      </div>
      <div style={{ fontSize:11, color:'#9eada5' }}>Seuil requis: {threshold}%</div>
    </div>
  );
}

function CreateABTestModal({ onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', test_type: 'template', winner_criteria: 'read_rate',
    winner_threshold: 95, min_sample_size: 100, auto_select_winner: true,
    test_duration_hours: 24, traffic_split: { A: 50, B: 50 },
    variants: [
      { variant_name: 'A', label: 'Variante A', template_name: '', phone_number: '+237689588347', template_params: {} },
      { variant_name: 'B', label: 'Variante B', template_name: '', phone_number: '+237689588347', template_params: {} },
    ]
  });
  const [saving, setSaving] = useState(false);

  const updateVariant = (idx, key, val) => {
    setForm(f => { const v = [...f.variants]; v[idx] = { ...v[idx], [key]: val }; return { ...f, variants: v }; });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return alert('Nom requis');
    if (form.variants.some(v => !v.template_name)) return alert('Template requis pour chaque variante');
    setSaving(true);
    try { await onCreate(form); onClose(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:700, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding:'24px 28px', borderBottom:'1px solid #f0f7f3', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'white', zIndex:1 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1f1d' }}>🧪 Nouveau test A/B</div>
            <div style={{ fontSize:12, color:'#9eada5' }}>Étape {step}/2</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'#f8faf9', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:18 }}>×</button>
        </div>

        <div style={{ padding:'24px 28px' }}>
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Nom du test *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Template facture A vs B" style={inp} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Type de test</label>
                  <select value={form.test_type} onChange={e=>setForm(f=>({...f,test_type:e.target.value}))} style={inp}>
                    <option value="template">📝 Templates différents</option>
                    <option value="send_time">⏰ Horaires d'envoi</option>
                    <option value="content">✍️ Contenu du message</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Critère gagnant</label>
                  <select value={form.winner_criteria} onChange={e=>setForm(f=>({...f,winner_criteria:e.target.value}))} style={inp}>
                    <option value="read_rate">👁️ Taux de lecture</option>
                    <option value="delivery_rate">✓✓ Taux de livraison</option>
                    <option value="reply_rate">💬 Taux de réponse</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Confiance requise (%)</label>
                  <input type="number" min="80" max="99" value={form.winner_threshold}
                    onChange={e=>setForm(f=>({...f,winner_threshold:parseInt(e.target.value)}))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Durée (heures)</label>
                  <input type="number" min="1" max="168" value={form.test_duration_hours}
                    onChange={e=>setForm(f=>({...f,test_duration_hours:parseInt(e.target.value)}))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Échantillon min.</label>
                  <input type="number" min="10" value={form.min_sample_size}
                    onChange={e=>setForm(f=>({...f,min_sample_size:parseInt(e.target.value)}))} style={inp} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center', padding:'12px 16px', background:'#f0f7f3', borderRadius:10 }}>
                <input type="checkbox" id="auto_winner" checked={form.auto_select_winner}
                  onChange={e=>setForm(f=>({...f,auto_select_winner:e.target.checked}))}
                  style={{ width:16, height:16, accentColor:'#2d7a3e' }} />
                <label htmlFor="auto_winner" style={{ fontSize:13, color:'#1a1f1d', cursor:'pointer', fontWeight:500 }}>
                  🤖 Sélectionner automatiquement le gagnant après {form.test_duration_hours}h
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ background:'#e3f2fd', borderRadius:10, padding:'10px 16px', fontSize:12, color:'#1976d2' }}>
                💡 Trafic réparti : {form.variants.map(v=>`${v.variant_name}: ${form.traffic_split[v.variant_name]||50}%`).join(' · ')}
              </div>
              {form.variants.map((variant, idx) => (
                <div key={idx} style={{ border:`2px solid ${VARIANT_COLORS[variant.variant_name]||'#e5ebe8'}`,
                  borderRadius:14, padding:'20px', background:`${VARIANT_COLORS[variant.variant_name]||'#e5ebe8'}06` }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14 }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:VARIANT_COLORS[variant.variant_name]||'#6b7c74',
                      display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:700 }}>
                      {variant.variant_name}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1a1f1d' }}>Variante {variant.variant_name}</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Label</label>
                      <input value={variant.label} onChange={e=>updateVariant(idx,'label',e.target.value)} style={{...inp, fontSize:12}} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Trafic (%)</label>
                      <input type="number" min="5" max="95" value={form.traffic_split[variant.variant_name]||50}
                        onChange={e=>setForm(f=>({...f,traffic_split:{...f.traffic_split,[variant.variant_name]:parseInt(e.target.value)}}))}
                        style={{...inp, fontSize:12}} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Template *</label>
                      <input value={variant.template_name} onChange={e=>updateVariant(idx,'template_name',e.target.value)}
                        placeholder="next_001_facture_en_01" style={{...inp, fontSize:12}} />
                    </div>
                    {form.test_type === 'send_time' && (
                      <div>
                        <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Heure d'envoi</label>
                        <input type="number" min="0" max="23" value={variant.send_hour||8}
                          onChange={e=>updateVariant(idx,'send_hour',parseInt(e.target.value))} style={{...inp, fontSize:12}} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:'16px 28px', borderTop:'1px solid #f0f7f3', display:'flex', justifyContent:'space-between', background:'#fafcfb' }}>
          <button onClick={() => step > 1 ? setStep(s=>s-1) : onClose()} style={{
            padding:'9px 18px', borderRadius:10, border:'1px solid #e5ebe8', background:'white',
            color:'#6b7c74', cursor:'pointer', fontSize:13 }}>
            {step > 1 ? '← Retour' : 'Annuler'}
          </button>
          {step < 2 ? (
            <button onClick={() => setStep(2)} style={{
              padding:'9px 20px', borderRadius:10, border:'none',
              background:'linear-gradient(135deg,#9c27b0,#ba68c8)', color:'white',
              cursor:'pointer', fontSize:13, fontWeight:600 }}>Configurer les variantes →</button>
          ) : (
            <button onClick={handleCreate} disabled={saving} style={{
              padding:'9px 20px', borderRadius:10, border:'none',
              background:'linear-gradient(135deg,#9c27b0,#ba68c8)', color:'white',
              cursor:saving?'not-allowed':'pointer', fontSize:13, fontWeight:600, opacity:saving?0.7:1 }}>
              {saving ? '⏳ Création...' : '🧪 Créer le test'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ──────────────────────────────────────────
export default function ABTestPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/ab-tests');
      setTests(res.tests || []);
    } catch { setTests(DEMO_TESTS); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const handleCreate = async (form) => {
    try {
      const res = await api('/ab-tests', { method:'POST', body:JSON.stringify(form) });
      showToast('Test A/B créé !');
      fetchTests();
    } catch (e) {
      // Mode démo
      const newTest = { id:`t-${Date.now()}`, ...form, status:'draft', created_at:new Date().toISOString(),
        winner_variant:null, winner_confidence:null, statistical_significance:false, started_at:null, completed_at:null };
      setTests(t=>[newTest,...t]);
      showToast('Test A/B créé (mode démo)');
    }
  };

  const handleEvaluate = async (testId) => {
    try {
      const res = await api(`/ab-tests/${testId}/evaluate`, { method:'POST' });
      showToast(res.winner ? `🏆 Gagnant: Variante ${res.winner} !` : 'Pas encore significatif');
      fetchTests();
    } catch { showToast('Évaluation (mode démo)', 'info'); }
  };

  const selectedTest = selected ? (tests.find(t=>t.id===selected) || DEMO_TESTS.find(t=>t.id===selected)) : null;

  if (selected && selectedTest) {
    const variants = selectedTest.variants || [];
    const criteriaKey = { read_rate:'read_rate', reply_rate:'reply_rate', delivery_rate:'delivery_rate' }[selectedTest.winner_criteria] || 'read_rate';
    const maxRate = Math.max(...variants.map(v=>v[criteriaKey]||0), 1);

    return (
      <div style={{ minHeight:'100vh', background:'#f8faf9', fontFamily:"'Inter',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          @keyframes pulse-anim{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>

        {toast && (
          <div style={{ position:'fixed', top:24, right:24, zIndex:9999, padding:'12px 20px', borderRadius:12,
            background:toast.type==='error'?'#c62828':'#2d7a3e', color:'white', fontSize:14, fontWeight:500,
            boxShadow:'0 8px 24px rgba(0,0,0,0.2)' }}>{toast.msg}</div>
        )}

        {/* Header */}
        <div style={{ background:'white', borderBottom:'1px solid #e5ebe8', padding:'0 32px' }}>
          <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:64, gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <button onClick={()=>setSelected(null)} style={{ width:36, height:36, borderRadius:10,
                border:'1px solid #e5ebe8', background:'white', cursor:'pointer', fontSize:16, color:'#6b7c74' }}>←</button>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#1a1f1d' }}>{selectedTest.name}</div>
                <div style={{ fontSize:12, color:'#9eada5' }}>{selectedTest.test_type} · Critère: {selectedTest.winner_criteria}</div>
              </div>
              <StatusBadge status={selectedTest.status} />
            </div>
            {selectedTest.status === 'running' && (
              <button onClick={()=>handleEvaluate(selectedTest.id)} style={{ padding:'8px 16px', borderRadius:10,
                border:'none', background:'#9c27b0', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                🔍 Évaluer maintenant
              </button>
            )}
          </div>
        </div>

        <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px', display:'grid', gridTemplateColumns:'2fr 1fr', gap:24 }}>
          {/* Variantes */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a1f1d' }}>📊 Comparaison des variantes</div>
            {variants.map(v => (
              <VariantBar key={v.variant_name} variant={v} maxRate={maxRate}
                criteria={selectedTest.winner_criteria} isWinner={v.is_winner} />
            ))}

            {/* Résultat */}
            {selectedTest.status === 'completed' && selectedTest.winner_variant && (
              <div style={{ background:'linear-gradient(135deg,#e8f5e9,#f0f7f3)', borderRadius:14,
                border:'2px solid #2d7a3e', padding:'20px', display:'flex', gap:16, alignItems:'center' }}>
                <span style={{ fontSize:40 }}>🏆</span>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#1e5a2f' }}>
                    Variante {selectedTest.winner_variant} gagnante !
                  </div>
                  <div style={{ fontSize:13, color:'#2d7a3e', marginTop:4 }}>
                    Confiance statistique: <strong>{selectedTest.winner_confidence?.toFixed(1)}%</strong> —
                    Significativité: <strong>{selectedTest.statistical_significance ? 'Oui ✅' : 'Non ⚠️'}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panel droit */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Confiance */}
            <div style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'24px', textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1f1d', marginBottom:16 }}>Niveau de confiance</div>
              <ConfidenceMeter confidence={selectedTest.winner_confidence||0} threshold={selectedTest.winner_threshold||95} />
            </div>

            {/* Infos test */}
            <div style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'20px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1f1d', marginBottom:14 }}>⚙️ Configuration</div>
              {[
                { l:'Type', v: selectedTest.test_type },
                { l:'Critère', v: selectedTest.winner_criteria },
                { l:'Seuil confiance', v: `${selectedTest.winner_threshold||95}%` },
                { l:'Échantillon min.', v: (selectedTest.min_sample_size||100).toLocaleString('fr-FR') },
                { l:'Durée', v: `${selectedTest.test_duration_hours}h` },
                { l:'Auto-sélection', v: selectedTest.auto_select_winner ? 'Oui ✅' : 'Non' },
              ].map(item => (
                <div key={item.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0',
                  borderBottom:'1px solid #f8faf9', fontSize:12 }}>
                  <span style={{ color:'#9eada5' }}>{item.l}</span>
                  <span style={{ color:'#1a1f1d', fontWeight:500 }}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VUE LISTE ──
  return (
    <div style={{ minHeight:'100vh', background:'#f8faf9', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes pulse-anim{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      {toast && (
        <div style={{ position:'fixed', top:24, right:24, zIndex:9999, padding:'12px 20px', borderRadius:12,
          background:toast.type==='error'?'#c62828':'#2d7a3e', color:'white', fontSize:14, fontWeight:500,
          boxShadow:'0 8px 24px rgba(0,0,0,0.2)', animation:'slideDown 0.3s ease' }}>{toast.msg}</div>
      )}

      {showCreate && <CreateABTestModal onClose={()=>setShowCreate(false)} onCreate={handleCreate} />}

      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #e5ebe8', padding:'0 32px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#9c27b0,#ce93d8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🧪</div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'#1a1f1d' }}>Tests A/B</div>
              <div style={{ fontSize:12, color:'#9eada5' }}>Sélection automatique du gagnant par significativité statistique</div>
            </div>
          </div>
          <button onClick={()=>setShowCreate(true)} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#9c27b0,#ba68c8)',
            color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600,
            boxShadow:'0 2px 8px rgba(156,39,176,0.3)' }}>
            ＋ Nouveau test
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px' }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          {[
            { l:'Tests totaux', v:tests.length, c:'#9c27b0', i:'🧪' },
            { l:'En cours', v:tests.filter(t=>t.status==='running').length, c:'#f57c00', i:'⏳' },
            { l:'Terminés', v:tests.filter(t=>t.status==='completed').length, c:'#2d7a3e', i:'✅' },
            { l:'Taux de succès', v:(() => { const c=tests.filter(t=>t.status==='completed'); return c.length>0?`${Math.round(c.filter(t=>t.statistical_significance).length/c.length*100)}%`:'—'; })(), c:'#1976d2', i:'📊' },
          ].map(k=>(
            <div key={k.l} style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'16px 20px',
              display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`${k.c}15`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{k.i}</div>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:12, color:'#9eada5' }}>{k.l}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Liste tests */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <div style={{ width:32, height:32, border:'3px solid #e5ebe8', borderTopColor:'#9c27b0', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
            {tests.map(test => {
              const variants = test.variants || [];
              const winner = variants.find(v=>v.is_winner);
              const criteriaKey = test.winner_criteria || 'read_rate';
              const totalSent = variants.reduce((a,v)=>a+(v.sent_count||0),0);

              return (
                <div key={test.id} onClick={()=>setSelected(test.id)} style={{
                  background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'20px',
                  cursor:'pointer', transition:'all 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'
                }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor='#9c27b0';}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor='#e5ebe8';}}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#1a1f1d', marginBottom:4 }}>{test.name}</div>
                      <StatusBadge status={test.status} />
                    </div>
                    {test.status === 'completed' && test.winner_variant && (
                      <div style={{ textAlign:'center', padding:'6px 12px', background:'#e8f5e9', borderRadius:10 }}>
                        <div style={{ fontSize:16, fontWeight:700, color:'#2d7a3e' }}>🏆 {test.winner_variant}</div>
                        <div style={{ fontSize:10, color:'#9eada5' }}>{test.winner_confidence?.toFixed(0)}% confiance</div>
                      </div>
                    )}
                  </div>

                  {/* Mini comparaison variantes */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                    {variants.map(v => {
                      const rate = v[criteriaKey] || 0;
                      const maxRate = Math.max(...variants.map(x=>x[criteriaKey]||0), 1);
                      const color = VARIANT_COLORS[v.variant_name] || '#6b7c74';
                      return (
                        <div key={v.variant_name} style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <div style={{ width:20, height:20, borderRadius:6, background:color,
                            display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:10, fontWeight:700 }}>
                            {v.variant_name}
                          </div>
                          <div style={{ flex:1, height:6, background:'#f0f7f3', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${maxRate>0?(rate/maxRate)*100:0}%`, background:color, borderRadius:99 }} />
                          </div>
                          <span style={{ fontSize:12, fontWeight:600, color, minWidth:40, textAlign:'right' }}>{rate.toFixed(1)}%</span>
                          {v.is_winner && <span style={{ fontSize:12 }}>🏆</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9eada5', paddingTop:8, borderTop:'1px solid #f0f7f3' }}>
                    <span>📨 {totalSent.toLocaleString('fr-FR')} messages</span>
                    <span>🎯 {test.winner_criteria}</span>
                    <span>⏱️ {test.test_duration_hours}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
