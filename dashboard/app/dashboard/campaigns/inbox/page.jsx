'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import campaignFetch from '@/lib/campaigns/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';
async function api(path, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts, headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}), ...opts.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message||`HTTP ${res.status}`);
  return data;
}

// ── DEMO DATA ─────────────────────────────────────────────────
function demoConv(id, phone, name, status, priority, unread, preview, campaign) {
  return { id, phone_number:phone, contact_name:name, status, priority,
    unread_count:unread, last_message_preview:preview, channel_phone:'+237689588347',
    campaign_id:campaign||null, assigned_to_name:null, tags:[],
    last_message_at: new Date(Date.now()-Math.random()*7200000).toISOString(),
    created_at: new Date(Date.now()-86400000).toISOString() };
}

const DEMO_CONVERSATIONS = [
  demoConv('c1','+237674855790','Patrick Biyong','open','high',3,'Quand est-ce que ma facture arrivera ?','camp-1'),
  demoConv('c2','+237656939193','Marie Ateba','assigned','normal',0,'Merci pour l\'information','camp-1'),
  demoConv('c3','+237693546523','René Essomba','open','urgent',5,'STOP','camp-2'),
  demoConv('c4','+237698303126','Chantal Fouda','open','normal',1,'Bonjour, je n\'ai pas reçu mon relevé','camp-1'),
  demoConv('c5','+237677760299','Guy Manga','resolved','low',0,'Parfait, merci beaucoup !',null),
  demoConv('c6','+237690020882','Hervé Nkodo','open','normal',2,'Mon contrat numéro est le 201547896',null),
];

const DEMO_MESSAGES = [
  { id:'m1', direction:'outbound', message_type:'template', content:'[Template: next_001_facture_en_01]', status:'read', sender_name:'Système', created_at: new Date(Date.now()-3600000).toISOString() },
  { id:'m2', direction:'inbound', message_type:'text', content:'Bonjour, quand est-ce que ma facture arrivera ? J\'ai besoin de l\'avoir avant le 30 mai.', sender_name:'Patrick Biyong', created_at: new Date(Date.now()-3000000).toISOString() },
  { id:'m3', direction:'outbound', message_type:'text', content:'Bonjour Patrick, votre facture est déjà disponible dans le message précédent. Cliquez sur le lien PDF.', status:'delivered', sender_name:'Agent Marie', is_note:false, created_at: new Date(Date.now()-2700000).toISOString() },
  { id:'m4', direction:'inbound', message_type:'text', content:'Ah oui, je la vois maintenant ! Merci beaucoup.', sender_name:'Patrick Biyong', created_at: new Date(Date.now()-2400000).toISOString() },
  { id:'m5', direction:'outbound', message_type:'text', content:'⚡ Note interne: Client satisfait, pas de suivi nécessaire.', status:'sent', sender_name:'Agent Marie', is_note:true, created_at: new Date(Date.now()-2200000).toISOString() },
];

const DEMO_CANNED = [
  { id:'cr1', title:'Bonjour standard', shortcut:'/bonjour', content:'Bonjour {{name}}, comment puis-je vous aider aujourd\'hui ?' },
  { id:'cr2', title:'Facture disponible', shortcut:'/facture', content:'Votre facture est disponible en cliquant sur le lien dans notre message précédent.' },
  { id:'cr3', title:'Délai de traitement', shortcut:'/delai', content:'Votre demande est en cours de traitement. Nous reviendrons vers vous sous 24h.' },
  { id:'cr4', title:'Remercier', shortcut:'/merci', content:'Merci de votre confiance. N\'hésitez pas à nous contacter si vous avez besoin d\'aide.' },
];

const PRIORITY_CFG = {
  low:    { label:'Basse',   color:'#9eada5', bg:'#f8faf9' },
  normal: { label:'Normale', color:'#6b7c74', bg:'#f0f7f3' },
  high:   { label:'Haute',   color:'#f57c00', bg:'#fff3e0' },
  urgent: { label:'Urgente', color:'#c62828', bg:'#ffebee' },
};

const STATUS_CFG_CONV = {
  open:     { label:'Ouverte',   color:'#2d7a3e', bg:'#e8f5e9' },
  assigned: { label:'Assignée',  color:'#1976d2', bg:'#e3f2fd' },
  resolved: { label:'Résolue',   color:'#9eada5', bg:'#f0f7f3' },
  waiting:  { label:'En attente',color:'#f57c00', bg:'#fff3e0' },
  spam:     { label:'Spam',      color:'#c62828', bg:'#ffebee' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff/60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h/24)}j`;
}

// ── COMPOSANTS ───────────────────────────────────────────────
function Avatar({ name, phone, size = 36 }) {
  const initials = name ? name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() : phone?.slice(-2)||'?';
  const colors = ['#2d7a3e','#1976d2','#f57c00','#9c27b0','#00897b','#c62828'];
  const colorIdx = (phone||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0) % colors.length;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:colors[colorIdx],
      display:'flex', alignItems:'center', justifyContent:'center', color:'white',
      fontSize:size>40?14:11, fontWeight:700, flexShrink:0, letterSpacing:'0.02em' }}>
      {initials}
    </div>
  );
}

function ConvItem({ conv, selected, onClick }) {
  const pCfg = PRIORITY_CFG[conv.priority]||PRIORITY_CFG.normal;
  return (
    <div onClick={onClick} style={{
      padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid #f0f7f3',
      background: selected?'#f0f7f3':'white', transition:'background 0.15s',
      display:'flex', gap:10, alignItems:'flex-start', position:'relative'
    }}>
      {conv.unread_count > 0 && (
        <div style={{ position:'absolute', top:12, right:12, width:18, height:18, borderRadius:'50%',
          background:'#2d7a3e', color:'white', fontSize:10, fontWeight:700,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {conv.unread_count > 9 ? '9+' : conv.unread_count}
        </div>
      )}
      <Avatar name={conv.contact_name} phone={conv.phone_number} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
          <span style={{ fontSize:13, fontWeight: conv.unread_count>0?700:600, color:'#1a1f1d',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>
            {conv.contact_name || conv.phone_number}
          </span>
          <span style={{ fontSize:10, color:'#9eada5', flexShrink:0, marginLeft:4 }}>{timeAgo(conv.last_message_at)}</span>
        </div>
        <div style={{ fontSize:12, color:'#6b7c74', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
          {conv.last_message_preview || '—'}
        </div>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, fontWeight:500,
            background:pCfg.bg, color:pCfg.color }}>{pCfg.label}</span>
          {conv.status !== 'open' && (
            <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, fontWeight:500,
              background:STATUS_CFG_CONV[conv.status]?.bg||'#f8faf9',
              color:STATUS_CFG_CONV[conv.status]?.color||'#6b7c74' }}>
              {STATUS_CFG_CONV[conv.status]?.label||conv.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isOut = msg.direction === 'outbound';
  const isNote = msg.is_note;

  if (isNote) return (
    <div style={{ display:'flex', justifyContent:'center', margin:'6px 0' }}>
      <div style={{ background:'#fff3e0', border:'1px dashed #f57c00', borderRadius:10, padding:'6px 12px',
        fontSize:11, color:'#f57c00', maxWidth:'80%', fontStyle:'italic' }}>
        📝 <strong>{msg.sender_name}:</strong> {msg.content}
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', justifyContent: isOut?'flex-end':'flex-start', marginBottom:8, padding:'0 16px' }}>
      {!isOut && <div style={{ marginRight:8, marginTop:'auto' }}><Avatar name={msg.sender_name} phone={msg.sender_name} size={28} /></div>}
      <div style={{ maxWidth:'70%' }}>
        {!isOut && <div style={{ fontSize:10, color:'#9eada5', marginBottom:2, paddingLeft:2 }}>{msg.sender_name}</div>}
        <div style={{
          padding:'9px 14px', borderRadius: isOut?'16px 16px 4px 16px':'16px 16px 16px 4px',
          background: isOut?'#2d7a3e':'white',
          color: isOut?'white':'#1a1f1d',
          fontSize:13, lineHeight:1.5,
          boxShadow: isOut?'0 2px 8px rgba(45,122,62,0.2)':'0 1px 4px rgba(0,0,0,0.08)',
          border: isOut?'none':'1px solid #f0f7f3'
        }}>
          {msg.content}
        </div>
        <div style={{ fontSize:10, color:'#9eada5', marginTop:2, textAlign: isOut?'right':'left', paddingRight: isOut?2:0 }}>
          {new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
          {isOut && msg.status && (
            <span style={{ marginLeft:4 }}>
              {msg.status==='read'?'✓✓':msg.status==='delivered'?'✓✓':msg.status==='sent'?'✓':'⏳'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MODAL D'EXPORT ──────────────────────────────────────────
function ExportModal({ isOpen, onClose, onExport, isExporting }) {
  const [selectedDays, setSelectedDays] = useState(7);
  const PERIODS = [
    { label: '24 heures', days: 1, icon: '🕐' },
    { label: '7 jours', days: 7, icon: '📅' },
    { label: '15 jours', days: 15, icon: '📆' },
    { label: '30 jours', days: 30, icon: '📊' },
  ];

  if (!isOpen) return null;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:450, margin:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #e5ebe8' }}>
          <h3 style={{ fontSize:18, fontWeight:600, color:'#1a1f1d' }}>Exporter les conversations</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9eada5' }}>✕</button>
        </div>
        <div style={{ padding:20 }}>
          <p style={{ color:'#6b7c74', marginBottom:16 }}>Choisissez la période à exporter :</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {PERIODS.map((period) => (
              <label key={period.days} style={{
                display:'flex', alignItems:'center', padding:12, border:`1px solid ${selectedDays === period.days ? '#2d7a3e' : '#e5ebe8'}`,
                borderRadius:10, cursor:'pointer', background: selectedDays === period.days ? '#e8f5e9' : 'white'
              }}>
                <input type="radio" name="period" value={period.days} checked={selectedDays === period.days}
                  onChange={() => setSelectedDays(period.days)} style={{ marginRight:12 }} />
                <span style={{ fontSize:20, marginRight:8 }}>{period.icon}</span>
                <span style={{ flex:1, fontWeight:500 }}>{period.label}</span>
                <span style={{ fontSize:12, color:'#9eada5' }}>{period.days === 1 ? 'Dernières 24h' : `Derniers ${period.days} jours`}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:12, padding:'16px 20px', borderTop:'1px solid #e5ebe8', background:'#f8faf9', borderBottomLeftRadius:16, borderBottomRightRadius:16 }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e5ebe8', background:'white', cursor:'pointer' }}>Annuler</button>
          <button onClick={() => onExport(selectedDays)} disabled={isExporting} style={{
            padding:'8px 20px', borderRadius:8, border:'none', background:'#2d7a3e', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:8
          }}>
            {isExporting ? '⏳ Export...' : '📥 Exporter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ──────────────────────────────────────────
export default function InboxPage() {
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCanned, setShowCanned] = useState(false);
  const [cannedSearch, setCannedSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeDays, setActiveDays] = useState(1);
  const [satisfactionStats, setSatisfactionStats] = useState(null);
  const messagesEndRef = useRef(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const handleExportConversation = async (convId, phoneNumber) => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/inbox/${convId}/export`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!response.ok) throw new Error('Erreur export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation_${phoneNumber}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Conversation exportée avec succès', 'success');
    } catch (error) {
      console.error('Erreur export conversation:', error);
      showToast('Erreur lors de l\'export', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPeriod = async (days) => {
    setIsExporting(true);
    setShowExportModal(false);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/inbox/export/period/${days}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!response.ok) throw new Error('Erreur export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversations_${days}days_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Export des ${days} derniers jours réussi`, 'success');
    } catch (error) {
      console.error('Erreur export période:', error);
      showToast('Erreur lors de l\'export', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: 30,
        ...(statusFilter && { status: statusFilter }),
        ...(search && { search })
      }).toString();

      const convRes = await api(`/inbox/recent/${activeDays}?${qs}`);
      const statsRes = await api('/inbox/stats');

      // Récupération des stats de satisfaction
    let satStats = null;
    try {
      satStats = await api('/inbox/satisfaction-stats');
    } catch {
      // Fallback démo
      satStats = {
        total_replied: 42,
        stop_count: 8,
        start_count: 5,
      };
    }
    setSatisfactionStats(satStats);

      setConversations(convRes.conversations || []);
      setStats(statsRes.stats || null);
    } catch (error) {
      console.error('Erreur fetch conversations:', error);
      const filtered = DEMO_CONVERSATIONS.filter(conv => {
        const lastMsgDate = new Date(conv.last_message_at);
        const hoursDiff = (Date.now() - lastMsgDate) / (1000 * 60 * 60);
        return hoursDiff <= (activeDays * 24);
      });
      setConversations(filtered);
      setStats({ total: filtered.length, open: filtered.filter(c => c.status === 'open').length,
                 assigned: filtered.filter(c => c.status === 'assigned').length,
                 resolved: filtered.filter(c => c.status === 'resolved').length,
                 total_unread: filtered.reduce((acc, c) => acc + (c.unread_count || 0), 0),
                 urgent: filtered.filter(c => c.priority === 'urgent').length });
                 setSatisfactionStats({ total_replied: 42, stop_count: 8, start_count: 5 });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, activeDays]);

  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    setMsgLoading(true);
    try {
      const res = await api(`/inbox/${convId}/messages`);
      setMessages(res.messages||[]);
    } catch { setMessages(DEMO_MESSAGES); }
    finally { setMsgLoading(false); }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversationId, message, conversation }) => {
      console.log('📨 Nouveau message reçu:', { conversationId, message });

      if (selectedConv?.id === conversationId) {
        setMessages(prev => [...prev, message]);
        if (message.direction === 'inbound' && selectedConv?.id === conversationId) {
        api(`/inbox/${conversationId}/read`, { method: 'POST', body: JSON.stringify({}) }).catch(err => console.error('Mark read failed:', err));
        }
      }

      setConversations(prev => {
        const existingConv = prev.find(c => c.id === conversationId);
        if (!existingConv) return prev;
        return prev.map(c =>
          c.id === conversationId
            ? {
                ...c,
                ...conversation,
                last_message_preview: message.content?.substring(0, 100),
                last_message_at: message.created_at,
                unread_count: selectedConv?.id === conversationId ? 0 : (c.unread_count || 0) + 1
              }
            : c
        );
      });

      if (message.direction === 'inbound' && selectedConv?.id !== conversationId) {
        showToast(`📩 Nouveau message de ${message.sender_name || conversation.phone_number}`, 'info');
      }
    };

    const handleReplySent = ({ conversationId, message }) => {
      console.log('✅ Réponse envoyée:', { conversationId, message });
      if (selectedConv?.id === conversationId) {
        setMessages(prev => [...prev, message]);
      }
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId
            ? {
                ...c,
                last_message_preview: message.content?.substring(0, 100),
                last_message_at: message.created_at
              }
            : c
        )
      );
    };

    socket.on('new-inbox-message', handleNewMessage);
    socket.on('reply-sent', handleReplySent);

    return () => {
      socket.off('new-inbox-message', handleNewMessage);
      socket.off('reply-sent', handleReplySent);
    };
  }, [socket, selectedConv]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);
    } else {
      setMessages([]);
    }
  }, [selectedConv, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConv = (conv) => {
    setSelectedConv(conv);
    setReply('');
    if (conv.unread_count > 0) {
      setConversations(cs => cs.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    api(`/inbox/${conv.id}/read`, { method: 'POST', body: JSON.stringify({}) }).catch(err => console.error(`❌ Erreur /read:`, err));
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedConv) return;
    setSending(true);
    try {
      await api(`/inbox/${selectedConv.id}/reply`, {
        method:'POST', body:JSON.stringify({ content:reply, message_type:'text' })
      });
      setReply('');
    } catch {
      const newMsg = { id:`m${Date.now()}`, direction:'outbound', message_type:'text', content:reply,
        status:'sent', sender_name:'Agent', created_at:new Date().toISOString() };
      setMessages(m=>[...m, newMsg]);
      setReply('');
      showToast('Message envoyé (mode démo)', 'success');
    } finally { setSending(false); }
  };

  const handleAddNote = async () => {
    const noteText = window.prompt('Note interne (visible uniquement par les agents) :');
    if (!noteText?.trim() || !selectedConv) return;
    try {
      await api(`/inbox/${selectedConv.id}/note`, { method:'POST', body:JSON.stringify({content:noteText}) });
      const newNote = { id:`note-${Date.now()}`, direction:'outbound', message_type:'text',
        content:noteText, is_note:true, sender_name:'Moi', created_at:new Date().toISOString() };
      setMessages(m=>[...m, newNote]);
      showToast('Note ajoutée', 'success');
    } catch { showToast('Erreur note','error'); }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedConv) return;
    try {
      await api(`/inbox/${selectedConv.id}`, { method:'PUT', body:JSON.stringify({status:newStatus}) });
      setSelectedConv(c=>({...c, status:newStatus}));
      setConversations(cs=>cs.map(c=>c.id===selectedConv.id?{...c,status:newStatus}:c));
      showToast(`Conversation: ${STATUS_CFG_CONV[newStatus]?.label||newStatus}`);
    } catch { showToast('Erreur','error'); }
  };

  const filteredCanned = DEMO_CANNED.filter(c =>
    !cannedSearch || c.title.toLowerCase().includes(cannedSearch.toLowerCase()) || c.shortcut.includes(cannedSearch)
  );

  const s = stats || {};

  return (
    <div style={{ minHeight:'100vh', background:'#f8faf9', fontFamily:"'Inter',sans-serif", display:'flex', flexDirection:'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .conv-item:hover{background:#f8faf9!important}
        .send-btn:hover{opacity:0.85}
        .canned-item:hover{background:#f0f7f3;cursor:pointer}
        textarea:focus{outline:none;border-color:#2d7a3e!important}
      `}</style>

      {toast && (
        <div style={{ position:'fixed', top:24, right:24, zIndex:9999, padding:'12px 20px', borderRadius:12,
          background:toast.type==='error'?'#c62828':toast.type==='info'?'#1976d2':'#2d7a3e', color:'white', fontSize:14, fontWeight:500,
          boxShadow:'0 8px 24px rgba(0,0,0,0.2)', animation:'slideDown 0.3s ease' }}>
          {toast.type==='error'?'❌ ':toast.type==='info'?'ℹ️ ':'✅ '}{toast.msg}
        </div>
      )}

      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={handleExportPeriod} isExporting={isExporting} />

      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #e5ebe8', padding:'0 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:64, padding:'0 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#00897b,#4db6ac)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>💬</div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'#1a1f1d' }}>Inbox WhatsApp</div>
              <div style={{ fontSize:12, color:'#9eada5' }}>Conversations centralisées {socket ? '🔴 Temps réel' : '⚪ Hors ligne'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, border: '1px solid #e5ebe8', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setActiveDays(1)} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: activeDays === 1 ? '#2d7a3e' : 'white', color: activeDays === 1 ? 'white' : '#6b7c74', border: 'none' }}>24h</button>
              <button onClick={() => setActiveDays(7)} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: activeDays === 7 ? '#2d7a3e' : 'white', color: activeDays === 7 ? 'white' : '#6b7c74', border: 'none' }}>7j</button>
              <button onClick={() => setActiveDays(15)} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: activeDays === 15 ? '#2d7a3e' : 'white', color: activeDays === 15 ? 'white' : '#6b7c74', border: 'none' }}>15j</button>
              <button onClick={() => setActiveDays(30)} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: activeDays === 30 ? '#2d7a3e' : 'white', color: activeDays === 30 ? 'white' : '#6b7c74', border: 'none' }}>30j</button>
            </div>
            <button onClick={() => setShowExportModal(true)} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid #2d7a3e', background:'white', color:'#2d7a3e', cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:8 }}>
              📥 Exporter période
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {[
              { l:'Non lus', v:s.total_unread||0, c:'#2d7a3e' },
              { l:'Ouvertes', v:s.open||0, c:'#1976d2' },
              { l:'Urgentes', v:s.urgent||0, c:'#c62828' },
            ].map(k=>(
              <div key={k.l} style={{ textAlign:'center', padding:'6px 14px', background:'#f8faf9', borderRadius:10, border:'1px solid #e5ebe8' }}>
                <div style={{ fontSize:16, fontWeight:700, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:10, color:'#9eada5' }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Indicateurs de satisfaction */}
{satisfactionStats && (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderLeft: '2px solid #e5ebe8', paddingLeft: 12 }}>
    <div style={{ textAlign: 'center', padding: '4px 8px', background: '#e8f5e9', borderRadius: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#2d7a3e' }}>
        {satisfactionStats.total_replied > 0
          ? (( (satisfactionStats.total_replied - satisfactionStats.stop_count) / satisfactionStats.total_replied) * 100).toFixed(1)
          : 0}%
      </div>
      <div style={{ fontSize: 9, color: '#6b7c74' }}>Satisfaction</div>
    </div>
    <div style={{ textAlign: 'center', padding: '4px 8px', background: '#ffebee', borderRadius: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#c62828' }}>
        {satisfactionStats.total_replied > 0
          ? ((satisfactionStats.stop_count / satisfactionStats.total_replied) * 100).toFixed(1)
          : 0}%
      </div>
      <div style={{ fontSize: 9, color: '#6b7c74' }}>STOP</div>
    </div>
    <div style={{ textAlign: 'center', padding: '4px 8px', background: '#e3f2fd', borderRadius: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1976d2' }}>
        {satisfactionStats.total_replied > 0
          ? ((satisfactionStats.start_count / (satisfactionStats.total_replied - satisfactionStats.stop_count)) * 100).toFixed(1)
          : 0}%
      </div>
      <div style={{ fontSize: 9, color: '#6b7c74' }}>START</div>
    </div>
  </div>
)}
      </div>

      {/* Corps — 3 colonnes */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', height:'calc(100vh - 64px)' }}>

        {/* ── LISTE CONVERSATIONS ── */}
        <div style={{ width:300, borderRight:'1px solid #e5ebe8', background:'white', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'12px', borderBottom:'1px solid #f0f7f3', display:'flex', flexDirection:'column', gap:8 }}>
            <input placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5ebe8', fontSize:12, color:'#1a1f1d', outline:'none' }} />
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {['','open','assigned','resolved'].map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} style={{ padding:'3px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor:'pointer', border:'1px solid #e5ebe8', background: statusFilter===s?'#2d7a3e':'white', color: statusFilter===s?'white':'#6b7c74' }}>
                  {s===''?'Tous':STATUS_CFG_CONV[s]?.label||s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div style={{ width:24, height:24, border:'3px solid #e5ebe8', borderTopColor:'#00897b', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /></div>
            ) : conversations.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#9eada5', fontSize:13 }}><div style={{ fontSize:32, marginBottom:8 }}>💬</div>Aucune conversation</div>
            ) : conversations.map(conv => (
              <div key={conv.id} style={{ position:'relative' }}>
                <ConvItem conv={conv} selected={selectedConv?.id===conv.id} onClick={()=>handleSelectConv(conv)} />
                <button onClick={(e)=>{ e.stopPropagation(); handleExportConversation(conv.id, conv.phone_number); }} style={{ position:'absolute', right:8, bottom:8, background:'none', border:'none', fontSize:14, cursor:'pointer', opacity:0.6, zIndex:10 }} title="Exporter cette conversation">📎</button>
              </div>
            ))}
          </div>
        </div>

        {/* ── ZONE MESSAGES ── */}
        {selectedConv ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #e5ebe8', background:'white', display:'flex', alignItems:'center', gap:12 }}>
              <Avatar name={selectedConv.contact_name} phone={selectedConv.phone_number} size={40} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:600, color:'#1a1f1d' }}>{selectedConv.contact_name || selectedConv.phone_number}</div>
                <div style={{ fontSize:12, color:'#9eada5' }}>{selectedConv.phone_number}{selectedConv.channel_phone && ` · Via ${selectedConv.channel_phone}`}</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => handleExportConversation(selectedConv.id, selectedConv.phone_number)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #2d7a3e', background:'white', color:'#2d7a3e', cursor:'pointer', fontSize:11, fontWeight:500, display:'flex', alignItems:'center', gap:4 }}>📎 Exporter</button>
                {['open','assigned','resolved'].map(st=>(
                  <button key={st} onClick={()=>handleStatusChange(st)} disabled={selectedConv.status===st} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e5ebe8', background: selectedConv.status===st?STATUS_CFG_CONV[st]?.bg||'#f0f7f3':'white', color: selectedConv.status===st?STATUS_CFG_CONV[st]?.color||'#6b7c74':'#6b7c74', cursor: selectedConv.status===st?'default':'pointer', fontSize:11, fontWeight:500 }}>{STATUS_CFG_CONV[st]?.label||st}</button>
                ))}
                <button onClick={handleAddNote} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #f57c00', background:'#fff3e0', color:'#f57c00', cursor:'pointer', fontSize:11, fontWeight:500 }}>📝 Note</button>
              </div>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'16px 0', background:'#f8faf9' }}>
              {msgLoading ? (
                <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div style={{ width:24, height:24, border:'3px solid #e5ebe8', borderTopColor:'#00897b', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /></div>
              ) : messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ borderTop:'1px solid #e5ebe8', background:'white' }}>
              {showCanned && (
                <div style={{ borderBottom:'1px solid #f0f7f3', padding:'12px', maxHeight:180, overflowY:'auto' }}>
                  <input placeholder="Chercher une réponse..." value={cannedSearch} onChange={e=>setCannedSearch(e.target.value)} style={{ width:'100%', padding:'6px 10px', borderRadius:8, border:'1px solid #e5ebe8', fontSize:12, outline:'none', boxSizing:'border-box', marginBottom:8 }} />
                  {filteredCanned.map(cr=>(
                    <div key={cr.id} className="canned-item" onClick={()=>{ setReply(cr.content); setShowCanned(false); }} style={{ padding:'7px 10px', borderRadius:8, fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div><span style={{ fontWeight:600, color:'#1a1f1d' }}>{cr.title}</span><span style={{ color:'#9eada5', marginLeft:8 }}>{cr.shortcut}</span></div>
                      <span style={{ fontSize:11, color:'#6b7c74', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cr.content.substring(0,50)}...</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding:'12px 16px', display:'flex', gap:10, alignItems:'flex-end' }}>
                <button onClick={()=>setShowCanned(s=>!s)} title="Réponses rapides" style={{ flexShrink:0, width:32, height:32, borderRadius:8, border:'1px solid #e5ebe8', background: showCanned?'#e8f5e9':'white', color: showCanned?'#2d7a3e':'#9eada5', cursor:'pointer', fontSize:16 }}>⚡</button>
                <textarea value={reply} onChange={e => { setReply(e.target.value); if (e.target.value.startsWith('/')) setShowCanned(true); }} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendReply();} }} placeholder="Tapez votre message... (Entrée pour envoyer, / pour réponses rapides)" rows={2} style={{ flex:1, padding:'10px 14px', borderRadius:12, border:'1px solid #e5ebe8', fontSize:13, color:'#1a1f1d', resize:'none', fontFamily:'inherit', lineHeight:1.5, transition:'border-color 0.2s' }} />
                <button onClick={handleSendReply} disabled={!reply.trim()||sending} className="send-btn" style={{ flexShrink:0, width:40, height:40, borderRadius:12, border:'none', background: reply.trim()?'#2d7a3e':'#e5ebe8', color:'white', cursor: reply.trim()?'pointer':'not-allowed', fontSize:18, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center' }}>{sending ? '⏳' : '↑'}</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f8faf9' }}>
            <div style={{ textAlign:'center', color:'#9eada5' }}><div style={{ fontSize:60, marginBottom:16 }}>💬</div><div style={{ fontSize:18, fontWeight:600, color:'#6b7c74', marginBottom:6 }}>Sélectionnez une conversation</div><div style={{ fontSize:14 }}>Cliquez sur une conversation pour voir les messages</div></div>
          </div>
        )}

        {/* ── PANNEAU INFOS CONTACT ── */}
        {selectedConv && (
          <div style={{ width:260, borderLeft:'1px solid #e5ebe8', background:'white', overflowY:'auto', flexShrink:0, padding:'20px 16px' }}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <Avatar name={selectedConv.contact_name} phone={selectedConv.phone_number} size={56} />
              <div style={{ fontSize:15, fontWeight:700, color:'#1a1f1d', marginTop:10 }}>{selectedConv.contact_name||'Inconnu'}</div>
              <div style={{ fontSize:12, color:'#9eada5', fontFamily:'monospace' }}>{selectedConv.phone_number}</div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { l:'Statut', v:<span style={{ padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:500, background:STATUS_CFG_CONV[selectedConv.status]?.bg||'#f8faf9', color:STATUS_CFG_CONV[selectedConv.status]?.color||'#6b7c74' }}>{STATUS_CFG_CONV[selectedConv.status]?.label||selectedConv.status}</span> },
                { l:'Priorité', v:<span style={{ padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:500, background:PRIORITY_CFG[selectedConv.priority]?.bg||'#f8faf9', color:PRIORITY_CFG[selectedConv.priority]?.color||'#6b7c74' }}>{PRIORITY_CFG[selectedConv.priority]?.label||selectedConv.priority}</span> },
                { l:'Canal', v:<span style={{ fontSize:12, color:'#1a1f1d' }}>{selectedConv.channel_phone||'—'}</span> },
                { l:'Depuis', v:<span style={{ fontSize:12, color:'#1a1f1d' }}>{selectedConv.created_at?new Date(selectedConv.created_at).toLocaleDateString('fr-FR'):'—'}</span> },
              ].map(item=>(
                <div key={item.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#f8faf9', borderRadius:8 }}>
                  <span style={{ fontSize:11, color:'#9eada5', fontWeight:500 }}>{item.l}</span>
                  {item.v}
                </div>
              ))}
            </div>

            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7c74', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Priorité</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {['low','normal','high','urgent'].map(p=>(
                  <button key={p} onClick={async()=>{ try { await api(`/inbox/${selectedConv.id}`,{method:'PUT',body:JSON.stringify({priority:p})}); setSelectedConv(c=>({...c,priority:p})); } catch {} }} style={{ padding:'5px', borderRadius:8, border:`1px solid ${PRIORITY_CFG[p].color}40`, background: selectedConv.priority===p?PRIORITY_CFG[p].bg:'white', color:PRIORITY_CFG[p].color, cursor:'pointer', fontSize:11, fontWeight:500 }}>
                    {PRIORITY_CFG[p].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
