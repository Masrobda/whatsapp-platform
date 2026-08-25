'use client';
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';
async function api(path, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers
  };
  if (opts.body && opts.method !== 'DELETE') {
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

// ── CONSTANTES ET STYLES ─────────────────────────────────────
const DEMO_WORKFLOWS = [
  { id:'w1', name:'Bienvenue nouveaux clients', status:'active', trigger_type:'campaign_delivered',
    step_count:3, active_enrollments:142, total_enrolled:890, total_completed:748,
    created_at: new Date(Date.now()-7*86400000).toISOString() },
  { id:'w2', name:'Relance non-lus J+3', status:'active', trigger_type:'campaign_sent',
    step_count:2, active_enrollments:67, total_enrolled:420, total_completed:353,
    created_at: new Date(Date.now()-14*86400000).toISOString() },
  { id:'w3', name:'Séquence fidélisation', status:'paused', trigger_type:'campaign_read',
    step_count:5, active_enrollments:0, total_enrolled:220, total_completed:180,
    created_at: new Date(Date.now()-30*86400000).toISOString() },
  { id:'w4', name:'Recouvrement 3 étapes', status:'draft', trigger_type:'manual',
    step_count:0, active_enrollments:0, total_enrolled:0, total_completed:0,
    created_at: new Date().toISOString() },
];

const TRIGGER_CONFIG = {
  campaign_sent:      { label:'Message envoyé', icon:'📤', color:'#0288d1' },
  campaign_delivered: { label:'Message livré', icon:'✓✓', color:'#2d7a3e' },
  campaign_read:      { label:'Message lu', icon:'👁️', color:'#8bc34a' },
  campaign_replied:   { label:'Réponse reçue', icon:'💬', color:'#1976d2' },
  campaign_failed:    { label:'Envoi échoué', icon:'✗', color:'#c62828' },
  date_relative:      { label:'Délai relatif', icon:'⏱️', color:'#f57c00' },
  date_absolute:      { label:'Date précise', icon:'📅', color:'#9c27b0' },
  contact_added:      { label:'Contact ajouté', icon:'➕', color:'#00897b' },
  manual:             { label:'Manuel', icon:'👆', color:'#6b7c74' },
};

const STEP_TYPES = [
  { type:'send_message', label:'Envoyer message', icon:'📨', color:'#2d7a3e', desc:'Envoyer un template WhatsApp' },
  { type:'wait_delay', label:'Attendre', icon:'⏳', color:'#f57c00', desc:'Pause entre les étapes' },
  { type:'condition', label:'Condition', icon:'🔀', color:'#1976d2', desc:'Bifurcation SI/SINON' },
  { type:'webhook', label:'Webhook', icon:'🔗', color:'#9c27b0', desc:'Appel HTTP externe' },
  { type:'add_tag', label:'Ajouter tag', icon:'🏷️', color:'#00897b', desc:'Taguer le contact' },
  { type:'stop', label:'Terminer', icon:'⛔', color:'#c62828', desc:'Fin du workflow' },
];

const STATUS_CFG = {
  active:  { label:'Actif',    color:'#2d7a3e', bg:'#e8f5e9', dot:'#4caf50', pulse:true },
  paused:  { label:'Pausé',    color:'#f57c00', bg:'#fff3e0', dot:'#ff9800', pulse:false },
  draft:   { label:'Brouillon',color:'#6b7c74', bg:'#f0f7f3', dot:'#9eada5', pulse:false },
  archived:{ label:'Archivé',  color:'#9eada5', bg:'#f8faf9', dot:'#cbd5d0', pulse:false },
};

const inp = { padding:'9px 12px', borderRadius:10, border:'1px solid #e5ebe8', fontSize:13, color:'#1a1f1d', background:'white', outline:'none', width:'100%', boxSizing:'border-box' };
const inputStyle = { ...inp, width: 'auto' };

// ── LOGS TAB COMPONENT ───────────────────────────────────────
function LogsTab({ workflowId, showToast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ result: '', phone: '', page: 1 });
  const [pagination, setPagination] = useState({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: filters.page, limit: 20 });
      if (filters.result) params.append('result', filters.result);
      if (filters.phone) params.append('phone', filters.phone);
      const res = await api(`/automations/${workflowId}/logs?${params}`);
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [workflowId, filters, showToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const exportCSV = async () => {
    const params = new URLSearchParams();
    if (filters.result) params.append('result', filters.result);
    if (filters.phone) params.append('phone', filters.phone);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/automations/${workflowId}/logs/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_workflow_${workflowId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Filtrer par téléphone"
          value={filters.phone}
          onChange={e => setFilters(f => ({ ...f, phone: e.target.value, page: 1 }))}
          style={inputStyle}
        />
        <select
          value={filters.result}
          onChange={e => setFilters(f => ({ ...f, result: e.target.value, page: 1 }))}
          style={inputStyle}
        >
          <option value="">Tous résultats</option>
          <option value="success">Succès</option>
          <option value="failed">Échec</option>
          <option value="waiting">En attente</option>
          <option value="skipped">Ignoré</option>
        </select>
        <button
          onClick={exportCSV}
          style={{ background: '#2d7a3e', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
        >
          📥 Exporter CSV
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e5ebe8' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '12px 8px' }}>Téléphone</th>
                <th style={{ textAlign: 'left', padding: '12px 8px' }}>Résultat</th>
                <th style={{ textAlign: 'left', padding: '12px 8px' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 8px' }}>{new Date(log.executed_at).toLocaleString()}</td>
                  <td style={{ padding: '10px 8px' }}>{log.phone_number}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: log.result === 'success' ? '#e8f5e9' : log.result === 'failed' ? '#ffebee' : '#fff3e0',
                      color: log.result === 'success' ? '#2d7a3e' : log.result === 'failed' ? '#c62828' : '#f57c00'
                    }}>
                      {log.result}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', color: '#6b7c74' }}>{log.message}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40 }}>Aucun log trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button
            disabled={pagination.page === 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5ebe8', background: 'white', cursor: 'pointer' }}
          >◀ Précédent</button>
          <span style={{ padding: '6px 12px' }}>Page {pagination.page} / {pagination.totalPages}</span>
          <button
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5ebe8', background: 'white', cursor: 'pointer' }}
          >Suivant ▶</button>
        </div>
      )}
    </div>
  );
}

// ── SOUS-COMPOSANTS ──────────────────────────────────────────
function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:20,
      background:c.bg, color:c.color, fontSize:12, fontWeight:600 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot, flexShrink:0,
        ...(c.pulse?{animation:'pulse-anim 1.5s infinite'}:{}) }} />
      {c.label}
    </span>
  );
}

function StepNode({ step, index, totalSteps, selected, onSelect, onDelete }) {
  const cfg = STEP_TYPES.find(t=>t.type===step.step_type)||STEP_TYPES[0];
  const config = step.config||{};
  const isLast = index === totalSteps - 1;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div onClick={()=>onSelect(step)} style={{
        width:280, background:'white', borderRadius:14, border:`2px solid ${selected?cfg.color:'#e5ebe8'}`,
        padding:'14px 16px', cursor:'pointer', transition:'all 0.2s',
        boxShadow: selected?`0 4px 16px ${cfg.color}30`:'0 1px 4px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:`${cfg.color}15`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{cfg.icon}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#1a1f1d' }}>{step.name||cfg.label}</div>
            <div style={{ fontSize:11, color:cfg.color, fontWeight:500 }}>{cfg.label}</div>
          </div>
          <button onClick={e=>{e.stopPropagation();onDelete(step.id)}} style={{
            marginLeft:'auto', width:24, height:24, borderRadius:6, border:'none',
            background:'#ffebee', color:'#c62828', cursor:'pointer', fontSize:14 }}>×</button>
        </div>
        <div style={{ fontSize:11, color:'#9eada5', background:'#f8faf9', borderRadius:8, padding:'6px 8px' }}>
          {step.step_type==='send_message' && (config.template_name ? `📝 ${config.template_name}` : 'Aucun template configuré')}
          {step.step_type==='wait_delay' && `⏱️ Attente: ${config.delay_value||1} ${config.delay_unit||'jours'}`}
          {step.step_type==='condition' && (config.field ? `SI ${config.field} ${config.operator} ${config.value}` : 'Condition à configurer')}
          {step.step_type==='webhook' && (config.url ? `🔗 ${config.url.substring(0,40)}...` : 'URL non configurée')}
          {step.step_type==='add_tag' && (config.tag ? `🏷️ ${config.tag}` : 'Tag à configurer')}
          {step.step_type==='stop' && '⛔ Fin du workflow'}
        </div>
      </div>
      {!isLast && (
        <div style={{ width:2, height:28, background:'linear-gradient(to bottom, #e5ebe8, #2d7a3e)', position:'relative' }}>
          <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)',
            width:10, height:10, background:'#2d7a3e', borderRadius:'50%' }} />
        </div>
      )}
    </div>
  );
}

// StepConfigPanel corrigé (affichage des variables {{param}})
function StepConfigPanel({ step, onChange, onClose, templates, templatesLoading }) {
  const cfg = STEP_TYPES.find(t => t.type === step.step_type) || STEP_TYPES[0];
  const [config, setConfig] = useState(step.config || {});
  const [name, setName] = useState(step.name || cfg.label);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    if (config.template_name && templates.length) {
      const tmpl = templates.find(t => t.name === config.template_name);
      setSelectedTemplate(tmpl || null);
    }
  }, [config.template_name, templates]);

  const handleTemplateChange = (templateName) => {
    const tmpl = templates.find(t => t.name === templateName);
    setSelectedTemplate(tmpl || null);
    setConfig(prev => ({
      ...prev,
      template_name: templateName,
      template_language: tmpl?.language || 'fr',
      template_params: {}
    }));
  };

  const save = () => {
    onChange({ ...step, name, config });
    onClose();
  };

  if (step.step_type === 'send_message') {
    return (
      <div style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'20px', width:380 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <span style={{ fontSize:14, fontWeight:700 }}>✉️ Envoyer un message</span>
          <button onClick={onClose} style={{ border:'none', background:'#f8faf9', borderRadius:8, padding:'4px 8px', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600 }}>Nom de l'étape</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600 }}>Template WhatsApp *</label>
            <select
              value={config.template_name || ''}
              onChange={e => handleTemplateChange(e.target.value)}
              style={inp}
              disabled={templatesLoading}
            >
              <option value="">Sélectionner un template</option>
              {templates.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          {selectedTemplate && (
            <div style={{ background:'#f8faf9', borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Variables du template</div>
              {selectedTemplate.params?.map(param => (
                <div key={param} style={{ display:'flex', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:11, color:'#6b7c74', minWidth:80 }}>
                    {'{{'}{param}{'}}'}
                  </span>
                  <input
                    placeholder={`Valeur par défaut pour ${param}`}
                    value={config.template_params?.[param] || ''}
                    onChange={e => setConfig(c => ({
                      ...c,
                      template_params: { ...c.template_params, [param]: e.target.value }
                    }))}
                    style={{ ...inp, padding:'4px 8px', fontSize:12 }}
                  />
                </div>
              ))}
              <div style={{ fontSize:11, color:'#9eada5', marginTop:8 }}>
                💡 Ces valeurs peuvent être surchargées par les variables du contact.
              </div>
            </div>
          )}
          <div>
            <label style={{ fontSize:12, fontWeight:600 }}>Numéro émetteur</label>
            <input
              value={config.phone_number || ''}
              onChange={e => setConfig(c => ({ ...c, phone_number: e.target.value }))}
              placeholder="+237689588347"
              style={inp}
            />
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e5ebe8', background:'white', cursor:'pointer' }}>Annuler</button>
          <button onClick={save} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#2d7a3e', color:'white', cursor:'pointer' }}>Sauvegarder</button>
        </div>
      </div>
    );
  }

  // Autres types d'étapes
  return (
    <div style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'20px', width:320 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:20 }}>{cfg.icon}</span>
          <span style={{ fontSize:14, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
        </div>
        <button onClick={onClose} style={{ border:'none', background:'#f8faf9', borderRadius:8, padding:'4px 8px', cursor:'pointer', color:'#9eada5', fontSize:16 }}>×</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Nom de l'étape</label>
          <input value={name} onChange={e=>setName(e.target.value)} style={inp} />
        </div>
        {step.step_type === 'wait_delay' && (
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Durée</label>
              <input type="number" min="1" value={config.delay_value||1}
                onChange={e=>setConfig(c=>({...c,delay_value:parseInt(e.target.value)}))} style={inp} />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Unité</label>
              <select value={config.delay_unit||'days'} onChange={e=>setConfig(c=>({...c,delay_unit:e.target.value}))} style={inp}>
                <option value="minutes">Minutes</option>
                <option value="hours">Heures</option>
                <option value="days">Jours</option>
                <option value="weeks">Semaines</option>
              </select>
            </div>
          </div>
        )}
        {step.step_type === 'condition' && (
          <>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Condition</label>
              <select value={config.field||'last_message_status'} onChange={e=>setConfig(c=>({...c,field:e.target.value}))} style={inp}>
                <option value="last_message_status">Statut dernier message</option>
                <option value="replied">A répondu</option>
              </select>
            </div>
            {config.field === 'last_message_status' && (
              <div style={{ display:'flex', gap:8 }}>
                <select value={config.operator||'eq'} onChange={e=>setConfig(c=>({...c,operator:e.target.value}))} style={{...inp,flex:1}}>
                  <option value="eq">= Égal</option><option value="in">Dans</option>
                </select>
                <select value={config.value||'delivered'} onChange={e=>setConfig(c=>({...c,value:e.target.value}))} style={{...inp,flex:1}}>
                  {['sent','delivered','read','failed'].map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        {step.step_type === 'webhook' && (
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>URL du webhook</label>
            <input value={config.url||''} onChange={e=>setConfig(c=>({...c,url:e.target.value}))}
              placeholder="https://mon-serveur.com/webhook" style={inp} />
          </div>
        )}
        {step.step_type === 'add_tag' && (
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#6b7c74', display:'block', marginBottom:4 }}>Nom du tag</label>
            <input value={config.tag||''} onChange={e=>setConfig(c=>({...c,tag:e.target.value}))}
              placeholder="client_fidele" style={inp} />
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
        <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #e5ebe8', background:'white', color:'#6b7c74', cursor:'pointer', fontSize:12 }}>Annuler</button>
        <button onClick={save} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:cfg.color, color:'white', cursor:'pointer', fontSize:12, fontWeight:600 }}>Sauvegarder</button>
      </div>
    </div>
  );
}

function WorkflowCard({ wf, onToggle, onView, onLogs }) {
  const trig = TRIGGER_CONFIG[wf.trigger_type]||TRIGGER_CONFIG.manual;
  const rate = wf.total_enrolled > 0 ? Math.round((wf.total_completed/wf.total_enrolled)*100) : 0;

  return (
    <div style={{ background:'white', borderRadius:14, border:'1px solid #e5ebe8', padding:'20px',
      boxShadow:'0 1px 4px rgba(0,0,0,0.04)', display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1f1d', marginBottom:4 }}>{wf.name}</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <StatusBadge status={wf.status} />
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:trig.color,
              background:`${trig.color}15`, padding:'2px 8px', borderRadius:12, fontWeight:500 }}>
              {trig.icon} {trig.label}
            </span>
          </div>
        </div>
        <span style={{ fontSize:24, marginLeft:8 }}>{trig.icon}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[
          { v:(wf.step_count||0), l:'Étapes' },
          { v:(wf.active_enrollments||0), l:'En cours' },
          { v:`${rate}%`, l:'Complétés' },
        ].map(k=>(
          <div key={k.l} style={{ textAlign:'center', padding:'8px', background:'#f8faf9', borderRadius:8 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#2d7a3e' }}>{k.v}</div>
            <div style={{ fontSize:10, color:'#9eada5', marginTop:1 }}>{k.l}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9eada5', marginBottom:4 }}>
          <span>Progression</span>
          <span>{wf.total_completed||0} / {wf.total_enrolled||0}</span>
        </div>
        <div style={{ height:5, background:'#f0f7f3', borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${rate}%`, background:'#2d7a3e', borderRadius:99, transition:'width 0.6s' }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>onView(wf)} style={{ flex:1, padding:'7px', borderRadius:8, border:'1px solid #e5ebe8',
          background:'white', color:'#6b7c74', cursor:'pointer', fontSize:12, fontWeight:500 }}>
          ✏️ Éditer
        </button>
        <button onClick={()=>onLogs(wf)} style={{ flex:1, padding:'7px', borderRadius:8, border:'1px solid #e5ebe8',
          background:'white', color:'#1976d2', cursor:'pointer', fontSize:12, fontWeight:500 }}>
          📋 Logs
        </button>
        {wf.status !== 'draft' && (
          <button onClick={()=>onToggle(wf)} style={{ flex:1, padding:'7px', borderRadius:8, border:'none',
            background: wf.status==='active'?'#fff3e0':'#e8f5e9',
            color: wf.status==='active'?'#f57c00':'#2d7a3e', cursor:'pointer', fontSize:12, fontWeight:500 }}>
            {wf.status==='active'?'⏸ Pause':'▶ Activer'}
          </button>
        )}
        {wf.status === 'draft' && (
          <button onClick={()=>onToggle(wf)} style={{ flex:1, padding:'7px', borderRadius:8, border:'none',
            background:'#e8f5e9', color:'#2d7a3e', cursor:'pointer', fontSize:12, fontWeight:500 }}>
            ▶ Activer
          </button>
        )}
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ──────────────────────────────────────────
export default function AutomationPage() {
  const [view, setView] = useState('list');
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWf, setSelectedWf] = useState(null);
  const [steps, setSteps] = useState([]);
  const [selectedStep, setSelectedStep] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newWf, setNewWf] = useState({ name:'', trigger_type:'campaign_delivered', description:'', trigger_config:{} });
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/automations');
      setWorkflows(res.workflows||[]);
    } catch { setWorkflows(DEMO_WORKFLOWS); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const loadClientTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await api('/templates/client');
      setTemplates(res.templates || []);
    } catch (err) {
      console.error('Erreur chargement templates:', err);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClientTemplates();
  }, [loadClientTemplates]);

  const handleCreate = async () => {
    if (!newWf.name.trim()) return showToast('Nom requis','error');
    setSaving(true);
    try {
      const body = {
        name: newWf.name,
        trigger_type: newWf.trigger_type,
        description: newWf.description,
        trigger_config: newWf.trigger_config || {}
      };
      const res = await api('/automations', { method:'POST', body: JSON.stringify(body) });
      const created = res.workflow;
      setSelectedWf(created);
      setSteps(created.steps||[]);
      setView('builder');
      showToast('Workflow créé — configurez les étapes');
      fetchWorkflows();
    } catch (e) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (wf) => {
    try {
      const action = wf.status==='active' ? 'pause' : 'activate';
      await api(`/automations/${wf.id}/${action}`, { method:'POST' });
      showToast(action==='activate'?'Workflow activé !':'Workflow mis en pause');
      fetchWorkflows();
    } catch (e) { showToast(e.message,'error'); }
  };

  const handleViewBuilder = async (wf) => {
    setSelectedWf(wf);
    try {
      const fullWf = await api(`/automations/${wf.id}`);
      setSteps(fullWf.workflow.steps || []);
      setView('builder');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleViewLogs = (wf) => {
    setSelectedWf(wf);
    setView('logs');
  };

  const addStep = async (stepType) => {
    if (!selectedWf) return;
    const cfg = STEP_TYPES.find(t => t.type === stepType) || STEP_TYPES[0];
    setSaving(true);
    try {
      const res = await api(`/automations/${selectedWf.id}/steps`, {
        method: 'POST',
        body: JSON.stringify({
          step_type: stepType,
          name: cfg.label,
          config: {},
          position: steps.length + 1
        })
      });
      setSteps(prev => [...prev, res.step]);
      showToast(`Étape "${cfg.label}" ajoutée`);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeStep = async (id) => {
    if (!selectedWf) return;
    if (!confirm('Supprimer cette étape ?')) return;
    setSaving(true);
    try {
      await api(`/automations/${selectedWf.id}/steps/${id}`, { method: 'DELETE' });
      setSteps(prev => prev.filter(st => st.id !== id));
      showToast('Étape supprimée');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateStep = async (updatedStep) => {
    if (!selectedWf) return;
    setSaving(true);
    try {
      const res = await api(`/automations/${selectedWf.id}/steps/${updatedStep.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updatedStep.name,
          config: updatedStep.config,
          step_order: updatedStep.step_order
        })
      });
      setSteps(prev => prev.map(st => st.id === updatedStep.id ? res.step : st));
      setSelectedStep(null);
      showToast('Étape mise à jour');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveBuilder = async () => {
    if (!selectedWf) return;
    setSaving(true);
    try {
      showToast('Configuration sauvegardée !');
    } catch (e) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const getHeader = () => {
    if (view === 'list') {
      return {
        title: 'Automatisation & Drip',
        subtitle: 'Séquences automatisées et workflows conditionnels',
        action: (
          <button onClick={()=>{ setNewWf({name:'',trigger_type:'campaign_delivered',description:'',trigger_config:{}}); setView('create'); }}
            style={{ padding:'8px 18px', background:'linear-gradient(135deg,#9c27b0,#ba68c8)', color:'white', border:'none',
              borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600, boxShadow:'0 2px 8px rgba(156,39,176,0.3)' }}>
            ＋ Nouveau workflow
          </button>
        )
      };
    } else if (view === 'logs') {
      return {
        title: selectedWf?.name || 'Logs du workflow',
        subtitle: 'Historique des exécutions et messages',
        backButton: true,
        action: null
      };
    } else if (view === 'builder') {
      return {
        title: selectedWf?.name || 'Éditeur de workflow',
        subtitle: 'Configurez les étapes du workflow',
        backButton: true,
        action: (
          <button onClick={saveBuilder} disabled={saving} style={{ padding:'8px 18px', background:'#2d7a3e', color:'white',
            border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600, opacity:saving?0.7:1 }}>
            {saving?'Sauvegarde...':'💾 Sauvegarder'}
          </button>
        )
      };
    } else {
      return {
        title: 'Nouveau workflow',
        subtitle: 'Définissez le déclencheur et le nom',
        backButton: true,
        action: null
      };
    }
  };

  const header = getHeader();

  return (
    <div style={{ minHeight:'100vh', background:'#f8faf9', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-anim{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
      `}</style>

      {toast && (
        <div style={{ position:'fixed', top:24, right:24, zIndex:9999, padding:'12px 20px', borderRadius:12,
          background:toast.type==='error'?'#c62828':'#2d7a3e', color:'white', fontSize:14, fontWeight:500,
          boxShadow:'0 8px 24px rgba(0,0,0,0.2)', animation:'slideDown 0.3s ease' }}>
          {toast.type==='error'?'❌ ':'✅ '}{toast.msg}
        </div>
      )}

      <div style={{ background:'white', borderBottom:'1px solid #e5ebe8', padding:'0 32px' }}>
        <div style={{ maxWidth:1300, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {header.backButton && (
              <button onClick={()=>{ setView('list'); setSelectedWf(null); setSelectedStep(null); }} style={{
                width:36, height:36, borderRadius:10, border:'1px solid #e5ebe8', background:'white',
                cursor:'pointer', fontSize:16, color:'#6b7c74' }}>←</button>
            )}
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#9c27b0,#ce93d8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>⚡</div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'#1a1f1d' }}>{header.title}</div>
              <div style={{ fontSize:12, color:'#9eada5' }}>{header.subtitle}</div>
            </div>
          </div>
          {header.action}
        </div>
      </div>

      {view === 'list' && (
        <div style={{ maxWidth:1300, margin:'0 auto', padding:'32px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
            {[
              { l:'Workflows actifs', v:workflows.filter(w=>w.status==='active').length, c:'#2d7a3e', i:'⚡' },
              { l:'En cours', v:workflows.reduce((a,w)=>a+(w.active_enrollments||0),0), c:'#1976d2', i:'👤' },
              { l:'Total inscrits', v:workflows.reduce((a,w)=>a+(w.total_enrolled||0),0).toLocaleString('fr-FR'), c:'#f57c00', i:'📋' },
              { l:'Taux complétion', v:(() => { const e=workflows.reduce((a,w)=>a+(w.total_enrolled||0),0); const c=workflows.reduce((a,w)=>a+(w.total_completed||0),0); return e>0?`${Math.round(c/e*100)}%`:'—'; })(), c:'#8bc34a', i:'✅' },
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
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
              <div style={{ width:32, height:32, border:'3px solid #e5ebe8', borderTopColor:'#9c27b0', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
              {workflows.map(wf => (
                <WorkflowCard key={wf.id} wf={wf} onToggle={handleToggle} onView={handleViewBuilder} onLogs={handleViewLogs} />
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'create' && (
        <div style={{ maxWidth:600, margin:'40px auto', padding:'0 24px' }}>
          <div style={{ background:'white', borderRadius:16, border:'1px solid #e5ebe8', padding:'32px', boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#1a1f1d', marginBottom:24 }}>✨ Nouveau workflow</div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Nom *</label>
                <input value={newWf.name} onChange={e=>setNewWf(f=>({...f,name:e.target.value}))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Déclencheur</label>
                <select value={newWf.trigger_type} onChange={e => setNewWf(f => ({ ...f, trigger_type: e.target.value, trigger_config: {} }))} style={inp}>
                  <option value="campaign_sent">Message envoyé</option>
                  <option value="campaign_delivered">Message livré</option>
                  <option value="campaign_read">Message lu</option>
                  <option value="campaign_replied">Réponse reçue</option>
                  <option value="date_absolute">Date précise</option>
                  <option value="date_relative">Délai relatif</option>
                  <option value="manual">Manuel</option>
                </select>
              </div>
              {newWf.trigger_type === 'date_absolute' && (
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Date et heure de déclenchement</label>
                  <input type="datetime-local" value={newWf.trigger_config.scheduled_at || ''}
                    onChange={e => setNewWf(f => ({ ...f, trigger_config: { scheduled_at: e.target.value } }))} style={inp} />
                </div>
              )}
              {newWf.trigger_type === 'date_relative' && (
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Durée</label>
                    <input type="number" min="1" value={newWf.trigger_config.delay_value || 1}
                      onChange={e => setNewWf(f => ({ ...f, trigger_config: { ...f.trigger_config, delay_value: parseInt(e.target.value) } }))} style={inp} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Unité</label>
                    <select value={newWf.trigger_config.delay_unit || 'days'}
                      onChange={e => setNewWf(f => ({ ...f, trigger_config: { ...f.trigger_config, delay_unit: e.target.value } }))} style={inp}>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Heures</option>
                      <option value="days">Jours</option>
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#1a1f1d', display:'block', marginBottom:6 }}>Description</label>
                <textarea value={newWf.description} onChange={e=>setNewWf(f=>({...f,description:e.target.value}))} rows={2} style={{...inp, resize:'vertical'}} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24 }}>
              <button onClick={()=>setView('list')} style={{ padding:'9px 18px', borderRadius:10, border:'1px solid #e5ebe8', background:'white', color:'#6b7c74', cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={handleCreate} disabled={saving} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#9c27b0,#ba68c8)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600, opacity:saving?0.7:1 }}>
                {saving?'Création...':'Créer et configurer →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'builder' && (
        <div style={{ display:'flex', height:'calc(100vh - 64px)', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'32px', gap:0 }}>
            <div style={{ width:280, background:'linear-gradient(135deg,#9c27b0,#ba68c8)', borderRadius:14, padding:'16px', color:'white', textAlign:'center', marginBottom:0 }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{TRIGGER_CONFIG[selectedWf?.trigger_type||'manual']?.icon}</div>
              <div style={{ fontSize:13, fontWeight:600 }}>Déclencheur</div>
              <div style={{ fontSize:11, opacity:0.85, marginTop:2 }}>{TRIGGER_CONFIG[selectedWf?.trigger_type||'manual']?.label}</div>
            </div>
            {steps.length > 0 && <div style={{ width:2, height:24, background:'linear-gradient(to bottom,#ba68c8,#e5ebe8)' }} />}
            {steps.map((step, i) => (
              <StepNode key={step.id} step={step} index={i} totalSteps={steps.length}
                selected={selectedStep?.id===step.id}
                onSelect={s=>setSelectedStep(selectedStep?.id===s.id?null:s)}
                onDelete={removeStep} />
            ))}
            <div style={{ marginTop: steps.length>0?0:20, width:2, height:steps.length>0?0:0 }} />
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginTop:16, maxWidth:500 }}>
              {STEP_TYPES.map(st => (
                <button key={st.type} onClick={()=>addStep(st.type)} style={{
                  padding:'7px 12px', borderRadius:10, border:`1px dashed ${st.color}`,
                  background:`${st.color}08`, color:st.color, cursor:'pointer', fontSize:12, fontWeight:500,
                  display:'flex', alignItems:'center', gap:5 }}>
                  {st.icon} {st.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width:360, borderLeft:'1px solid #e5ebe8', background:'#f8faf9', padding:'20px', overflowY:'auto', flexShrink:0 }}>
            {selectedStep ? (
              <StepConfigPanel step={selectedStep} onChange={updateStep} onClose={()=>setSelectedStep(null)} templates={templates} templatesLoading={templatesLoading} />
            ) : (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'#9eada5' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>👆</div>
                <div style={{ fontSize:14, fontWeight:600, color:'#6b7c74', marginBottom:6 }}>Cliquez sur une étape</div>
                <div style={{ fontSize:12 }}>pour configurer ses paramètres</div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'logs' && selectedWf && (
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '32px' }}>
          <LogsTab workflowId={selectedWf.id} showToast={showToast} />
        </div>
      )}
    </div>
  );
}
