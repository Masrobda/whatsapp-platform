// app/dashboard/campaigns/segments/page.jsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { campaignFetch } from '@/lib/campaigns/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

async function api(path, opts = {}) {
  const token = localStorage.getItem('token');
  const isDelete = opts.method === 'DELETE';
  const hasBody = !!opts.body;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers
  };
  // Ajouter Content-Type uniquement si body présent et pas DELETE
  if (hasBody && !isDelete) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ============================================================
// STYLES DE BASE
// ============================================================
const inp = { padding:'8px 12px', borderRadius:8, border:'1px solid #e5ebe8', fontSize:13, color:'#1a1f1d', background:'white', outline:'none', width:'100%', boxSizing:'border-box' };
const sel = { ...inp };

// ============================================================
// CONSTANTES
// ============================================================
const FILTER_FIELDS = [
  { id: 'contacts.phone_number', label: 'Numéro de téléphone', type: 'text', operators: ['eq','neq','like','nlike'] },
  { id: 'contacts.name', label: 'Nom du contact', type: 'text', operators: ['eq','like','is_null','is_not_null'] },
  { id: 'contacts.status', label: 'Statut dernier envoi', type: 'enum', values: ['pending','queued','sent','delivered','read','failed','skipped'], operators: ['eq','neq','in'] },
  { id: 'contacts.sent_at', label: 'Date d\'envoi', type: 'date', operators: ['gt','gte','lt','lte','is_null','is_not_null'] },
  { id: 'contacts.delivered_at', label: 'Livré', type: 'date', operators: ['is_null','is_not_null'] },
  { id: 'contacts.read_at', label: 'Lu', type: 'date', operators: ['is_null','is_not_null'] },
  { id: 'opt_out.opted_out', label: 'Désabonné', type: 'boolean', operators: ['eq'] },
];

const OP_LABELS = {
  eq: '= Égal', neq: '≠ Différent', gt: '> Sup.', gte: '≥', lt: '< Inf.', lte: '≤',
  like: 'Contient', nlike: 'Ne contient pas', in: 'Dans liste',
  is_null: 'Est vide', is_not_null: "N'est pas vide"
};

// ============================================================
// COMPOSANTS
// ============================================================
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, padding: '12px 20px', borderRadius: 12,
      background: toast.type === 'error' ? '#c62828' : '#2d7a3e', color: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      {toast.msg}
    </div>
  );
}

function FilterRow({ filter, index, onUpdate, onRemove }) {
  const field = FILTER_FIELDS.find(f => f.id === filter.field) || FILTER_FIELDS[0];
  const noValue = ['is_null', 'is_not_null'].includes(filter.operator);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8faf9', borderRadius: 10, padding: '10px 12px', border: '1px solid #e5ebe8' }}>
      <select value={filter.field} onChange={e => onUpdate(index, 'field', e.target.value)} style={{ flex: 1.5, ...sel }}>
        {FILTER_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>

      <select value={filter.operator} onChange={e => onUpdate(index, 'operator', e.target.value)} style={{ flex: 1, ...sel }}>
        {(field.operators || ['eq']).map(op => <option key={op} value={op}>{OP_LABELS[op] || op}</option>)}
      </select>

      {!noValue && (
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={filter.value || ''}
          onChange={e => onUpdate(index, 'value', e.target.value)}
          style={{ flex: 1, ...inp }}
        />
      )}

      <button onClick={() => onRemove(index)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#ffebee', color: '#c62828', cursor:'pointer' }}>×</button>
    </div>
  );
}

function SegmentCard({ segment, onRefresh, onDelete, onExport }) {
  const isStale = segment.last_computed_at && (Date.now() - new Date(segment.last_computed_at)) > 24*3600*1000;
  const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';

  return (
    <div style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'20px',
      boxShadow:'0 1px 4px rgba(0,0,0,0.04)', display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1f1d', marginBottom:3 }}>{segment.name}</div>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:500,
            background: segment.type==='dynamic'?'#e3f2fd':'#f0f7f3',
            color: segment.type==='dynamic'?'#1976d2':'#2d7a3e' }}>
            {segment.type==='dynamic'?'⚡ Dynamique':'📌 Statique'}
          </span>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:24, fontWeight:700, color:'#2d7a3e' }}>{(segment.contact_count||0).toLocaleString('fr-FR')}</div>
          <div style={{ fontSize:11, color:'#9eada5' }}>contacts</div>
        </div>
      </div>

      <div style={{ fontSize:11, color: isStale?'#f57c00':'#9eada5', display:'flex', alignItems:'center', gap:4 }}>
        {isStale ? '⚠️' : '🕐'} Calculé {fmtDate(segment.last_computed_at)}
      </div>

      {segment.filters?.filters?.length > 0 && (
        <div style={{ background:'#f8faf9', borderRadius:8, padding:'8px 10px', fontSize:11, color:'#6b7c74', fontFamily:'monospace' }}>
          {segment.filters.filters.map((f,i) => (
            <div key={i}>{i>0?`${segment.filters.logic} `:''}{f.field} {OP_LABELS[f.operator]} {f.value||''}</div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
        {segment.type==='dynamic' && (
          <button onClick={() => onRefresh(segment.id)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e5ebe8',
            background:'white', color:'#6b7c74', cursor:'pointer', fontSize:12 }}>↺ Recalculer</button>
        )}
        <button onClick={() => onExport(segment)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #2d7a3e',
          background:'white', color:'#2d7a3e', cursor:'pointer', fontSize:12 }}>📥 Exporter</button>
        <button onClick={() => onDelete(segment.id)} style={{ padding:'5px 10px', borderRadius:8, border:'none',
          background:'#ffebee', color:'#c62828', cursor:'pointer', fontSize:12 }}>🗑</button>
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================
export default function SegmentsPage() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'dynamic',
    logic: 'AND',
    filters: []
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/segments');
      setSegments(res.segments || []);
    } catch (err) {
      console.error(err);
      showToast("Impossible de charger les segments", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  const addFilter = () => {
    setForm(f => ({
      ...f,
      filters: [...f.filters, { field: 'contacts.status', operator: 'eq', value: 'delivered' }]
    }));
  };

  const updateFilter = (idx, key, val) => {
    setForm(f => {
      const filters = [...f.filters];
      filters[idx] = { ...filters[idx], [key]: val };
      if (key === 'field') {
        const newField = FILTER_FIELDS.find(ff => ff.id === val);
        filters[idx].operator = newField?.operators[0] || 'eq';
        filters[idx].value = '';
      }
      return { ...f, filters };
    });
  };

  const removeFilter = (idx) => {
    setForm(f => ({ ...f, filters: f.filters.filter((_, i) => i !== idx) }));
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await api('/segments/preview', {
        method: 'POST',
        body: JSON.stringify({ filters: form.filters, logic: form.logic, limit: 5 })
      });
      setPreview(res);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return showToast('Nom du segment requis', 'error');
    setSaving(true);
    try {
      await api('/segments', { method: 'POST', body: JSON.stringify(form) });
      showToast('Segment créé avec succès !');
      setShowCreate(false);
      setForm({ name: '', description: '', type: 'dynamic', logic: 'AND', filters: [] });
      setPreview(null);
      fetchSegments();
    } catch (e) {
      showToast(e.message || 'Erreur lors de la création', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async (id) => {
    try {
      await campaignFetch(`/segments/${id}/refresh`, { method: 'POST' });
      showToast('Segment recalculé !');
      fetchSegments();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce segment ?')) return;
    try {
      await api(`/segments/${id}`, { method: 'DELETE' });
      showToast('Segment supprimé');
      fetchSegments();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleExport = async (segment) => {
  try {
    showToast(`Export de ${segment.contact_count} contacts en cours...`);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/segments/${segment.id}/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment_${segment.name}_contacts.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showToast(`Export terminé (${segment.contact_count} contacts)`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

  return (
    <div style={{ minHeight: '100vh', background: '#f8faf9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Toast toast={toast} />

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5ebe8', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎯</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Segments de contacts</div>
              <div style={{ fontSize: 12, color: '#9eada5' }}>Ciblage intelligent</div>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 18px', background: '#2d7a3e', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
            ＋ Nouveau segment
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px' }}>

        {/* Formulaire de création */}
        {showCreate && (
          <div style={{ background:'white', borderRadius:16, border:'2px solid #2d7a3e', padding:'28px', marginBottom:24, boxShadow:'0 4px 20px rgba(45,122,62,0.1)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#1a1f1d' }}>✨ Nouveau segment</div>
                <div style={{ fontSize:12, color:'#9eada5', marginTop:2 }}>Définissez votre audience cible</div>
              </div>
              <button onClick={() => { setShowCreate(false); setPreview(null); }} style={{ border:'none', background:'#f8faf9', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:18, color:'#9eada5' }}>×</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>Nom du segment *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Clients livrés ce mois" style={inp} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>Type</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[['dynamic','⚡ Dynamique','Calculé automatiquement'],['static','📌 Statique','Liste manuelle']].map(([v,l,d])=>(
                    <div key={v} onClick={()=>setForm(f=>({...f,type:v}))} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer',
                      border:`2px solid ${form.type===v?'#2d7a3e':'#e5ebe8'}`,
                      background: form.type===v?'#f0f7f3':'white' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>{l}</div>
                      <div style={{ fontSize:11, color:'#9eada5', marginTop:2 }}>{d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {form.type === 'dynamic' && (
              <>
                {/* Logique AND/OR */}
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>Logique :</span>
                  {['AND','OR'].map(l => (
                    <button key={l} onClick={()=>setForm(f=>({...f,logic:l}))} style={{
                      padding:'5px 16px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                      background: form.logic===l?'#2d7a3e':'#f0f7f3',
                      color: form.logic===l?'white':'#2d7a3e' }}>
                      {l==='AND'?'Tous les critères (ET)':'Un des critères (OU)'}
                    </button>
                  ))}
                </div>

                {/* Filtres */}
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {form.filters.map((filter, idx) => (
                    <FilterRow key={idx} filter={filter} index={idx}
                      onUpdate={updateFilter} onRemove={removeFilter} />
                  ))}
                  <button onClick={addFilter} style={{ padding:'8px', borderRadius:10, border:'2px dashed #e5ebe8',
                    background:'transparent', color:'#6b7c74', cursor:'pointer', fontSize:13, fontWeight:500,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    ＋ Ajouter un filtre
                  </button>
                </div>

                {/* Prévisualisation */}
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom: preview ? 16 : 0 }}>
                  <button onClick={handlePreview} disabled={previewLoading} style={{ padding:'8px 16px', borderRadius:10,
                    border:'1px solid #1976d2', background:'white', color:'#1976d2', cursor:'pointer', fontSize:13, fontWeight:500 }}>
                    {previewLoading ? '⏳ Calcul...' : '👁 Prévisualiser'}
                  </button>
                  {preview && (
                    <div style={{ background:'#e3f2fd', borderRadius:10, padding:'8px 16px', fontSize:13 }}>
                      <span style={{ fontWeight:700, color:'#1976d2' }}>{(preview.count||0).toLocaleString('fr-FR')} contacts</span>
                      <span style={{ color:'#6b7c74' }}> correspondent à ces critères</span>
                      {preview.error && <span style={{ color:'#c62828', marginLeft:8 }}>⚠️ {preview.error}</span>}
                    </div>
                  )}
                </div>

                {preview?.preview?.length > 0 && (
                  <div style={{ background:'#f8faf9', borderRadius:10, padding:'12px', marginBottom:16, border:'1px solid #e5ebe8' }}>
                    <div style={{ fontSize:11, color:'#9eada5', marginBottom:8 }}>Aperçu (5 premiers) :</div>
                    {preview.preview.map((c,i)=>(
                      <div key={i} style={{ display:'flex', gap:12, fontSize:12, padding:'4px 0', borderBottom:'1px solid #f0f7f3' }}>
                        <span style={{ fontFamily:'monospace', color:'#1a1f1d' }}>{c.phone_number}</span>
                        <span style={{ color:'#6b7c74' }}>{c.name||'—'}</span>
                        <span style={{ color:'#9eada5', marginLeft:'auto' }}>{c.campaign_count} campagnes</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setPreview(null); }} style={{ padding:'9px 18px', borderRadius:10,
                border:'1px solid #e5ebe8', background:'white', color:'#6b7c74', cursor:'pointer', fontSize:13 }}>
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving} style={{ padding:'9px 20px', borderRadius:10, border:'none',
                background:'linear-gradient(135deg,#2d7a3e,#3a9950)', color:'white', cursor:'pointer', fontSize:13,
                fontWeight:600, opacity:saving?0.7:1 }}>
                {saving ? '⏳ Création...' : '✅ Créer le segment'}
              </button>
            </div>
          </div>
        )}

        {/* STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:'Total segments', value:segments.length, color:'#2d7a3e', icon:'🎯' },
            { label:'Dynamiques', value:segments.filter(s=>s.type==='dynamic').length, color:'#1976d2', icon:'⚡' },
            { label:'Statiques', value:segments.filter(s=>s.type==='static').length, color:'#f57c00', icon:'📌' },
            { label:'Contacts total', value:segments.reduce((a,s)=>a+(s.contact_count||0),0).toLocaleString('fr-FR'), color:'#8bc34a', icon:'👥' },
          ].map(k => (
            <div key={k.label} style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'16px 20px',
              display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`${k.color}15`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{k.icon}</div>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:k.color }}>{k.value}</div>
                <div style={{ fontSize:12, color:'#9eada5' }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* GRILLE SEGMENTS */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60, color:'#6b7c74' }}>
            <div style={{ width:32, height:32, border:'3px solid #e5ebe8', borderTopColor:'#2d7a3e', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : segments.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#9eada5' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#6b7c74' }}>Aucun segment créé</div>
            <button onClick={()=>setShowCreate(true)} style={{ marginTop:16, padding:'10px 20px', background:'#2d7a3e',
              color:'white', border:'none', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:600 }}>
              Créer mon premier segment
            </button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {segments.map(seg => (
              <SegmentCard key={seg.id} segment={seg}
                onRefresh={handleRefresh} onDelete={handleDelete} onExport={handleExport} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
