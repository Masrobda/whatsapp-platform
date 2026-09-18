'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/api';

// ──────────────────────────────────────────────
// Helpers Audience (wrappent apiClient)
// ──────────────────────────────────────────────
const audience = {
  stats: () => apiClient.get('/audience/stats').then(r => r.data),
  list: (params) => apiClient.get('/audience', { params }).then(r => r.data),
  detail: (id) => apiClient.get(`/audience/${id}`).then(r => r.data),
  upsert: (contacts) => apiClient.post('/audience/contacts', { contacts }).then(r => r.data),
  importFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/audience/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  exportCSV: (params) =>
    apiClient.get('/audience/export/csv', { params, responseType: 'blob' }).then(r => r.data),
  delete: (contactIds) => apiClient.post('/audience/delete', { contact_ids: contactIds }).then(r => r.data),
  resend: (payload) => apiClient.post('/audience/resend', payload).then(r => r.data),
  campaigns: (params) => apiClient.get('/campaigns', { params }).then(r => r.data),
  lists: {
    all: () => apiClient.get('/audience/lists').then(r => r.data),
    create: (name, description) =>
      apiClient.post('/audience/lists', { name, description }).then(r => r.data),
    // ═══ NOUVEAUX ENDPOINTS ═══
    addContacts: (listId, contactIds) =>
      apiClient.post(`/audience/lists/${listId}/contacts`, { contact_ids: contactIds }).then(r => r.data),
    removeContacts: (listId, contactIds) =>
      apiClient.delete(`/audience/lists/${listId}/contacts`, { data: { contact_ids: contactIds } }).then(r => r.data),
    delete: (listId) =>
      apiClient.delete(`/audience/lists/${listId}`).then(r => r.data),
  },
};

// ──────────────────────────────────────────────
// Design tokens (cohérent)
// ──────────────────────────────────────────────
const C = {
  green: '#2d7a3e', greenLight: '#f0f7f3', greenBorder: '#a5d6a7',
  blue: '#1976d2', blueLight: '#e3f2fd',
  orange: '#f57c00', orangeLight: '#fff3e0',
  red: '#c62828', redLight: '#ffebee',
  gray: '#6b7c74', grayLight: '#f8faf9',
  border: '#e5ebe8', text: '#1a1f1d', muted: '#9eada5',
  white: '#ffffff',
};

const inputStyle = {
  padding: '9px 13px', borderRadius: 10, border: `1px solid ${C.border}`,
  fontSize: 13, color: C.text, background: C.white, width: '100%',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

// ──────────────────────────────────────────────
// MINI COMPOSANTS (Badge, StatusDot, Btn, Stat, Toast, Modal, Tabs)
// ──────────────────────────────────────────────
function Badge({ children, color = C.green, bg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px',
      borderRadius: 20, background: bg || color + '18', color, fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
}

function StatusDot({ status }) {
  const map = {
    delivered: { color: C.green,   label: 'Livré' },
    read:      { color: C.blue,    label: 'Lu' },
    sent:      { color: '#8bc34a', label: 'Envoyé' },
    failed:    { color: C.red,     label: 'Échec' },
    queued:    { color: C.orange,  label: 'En file' },
    pending:   { color: C.muted,   label: 'En attente' },
  };
  const s = map[status] || { color: C.muted, label: status || '—' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>
    </span>
  );
}

function Btn({ children, variant = 'primary', onClick, disabled, size = 'md', style: s = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, border: 'none',
    transition: 'opacity 0.15s', opacity: disabled ? 0.55 : 1, fontFamily: 'inherit', ...s,
  };
  const sm = size === 'sm' ? { padding: '6px 12px', fontSize: 12 } : { padding: '9px 18px', fontSize: 13 };
  const variants = {
    primary: { background: C.green, color: C.white },
    outline: { background: C.white, color: C.green, border: `1px solid ${C.green}` },
    ghost:   { background: 'transparent', color: C.gray, border: `1px solid ${C.border}` },
    danger:  { background: C.white, color: C.red, border: `1px solid ${C.red}` },
    red:     { background: C.red, color: C.white },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...sm, ...variants[variant] }}>
      {children}
    </button>
  );
}

function Stat({ label, value, color = C.green, sub }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 12, color: C.gray, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color }}>{sub}</div>}
    </div>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      background: type === 'error' ? C.red : C.green, color: C.white,
      padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 500,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', animation: 'slideDown 0.3s ease',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {type === 'error' ? '✕' : '✓'} {msg}
    </div>
  );
}

function Modal({ title, children, onClose, width = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8888, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.white, borderRadius: 18, width: '100%', maxWidth: width,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: C.gray, lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.grayLight,
      padding: 4, borderRadius: 12, border: `1px solid ${C.border}` }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '7px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          background: active === t.id ? C.white : 'transparent',
          color: active === t.id ? C.green : C.gray,
          boxShadow: active === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// MODAL IMPORT (inchangée)
// ──────────────────────────────────────────────
function ImportModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('file');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFile = async (file) => {
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { setError('Fichier vide ou invalide.'); return; }
      const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
      const sample = rows.slice(1, 4).map(row => {
        const obj = {};
        headers.forEach((h, i) => { if (row[i] !== undefined) obj[h] = String(row[i]); });
        return obj;
      });
      setPreview(sample);

      setLoading(true);
      const data = await audience.importFile(file);
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur import');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Importer des contacts" onClose={onClose} width={580}>
      <Tabs
        tabs={[{ id: 'file', label: '📁 Fichier CSV / Excel' }, { id: 'manual', label: '✏️ Saisie manuelle' }]}
        active={mode}
        onChange={setMode}
      />

      {mode === 'file' && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.blueLight, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.blue }}>
            Colonnes attendues : <strong>phone_number</strong> (obligatoire), <em>name</em>, <em>email</em>, puis vos variables.
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: '36px 24px',
              textAlign: 'center', cursor: 'pointer', background: C.grayLight }}>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Glissez votre fichier ici ou cliquez
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>CSV, Excel (.xlsx/.xls) — max 10 Mo</div>
            <div style={{ marginTop: 12 }}>
              <Btn size="sm" disabled={loading}>{loading ? 'Importation…' : 'Choisir un fichier'}</Btn>
            </div>
          </div>

          {preview.length > 0 && (
            <div style={{ background: C.greenLight, borderRadius: 10, padding: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: C.green, marginBottom: 8 }}>✓ Aperçu ({preview.length} lignes) :</div>
              {preview.map((row, i) => (
                <div key={i} style={{ color: C.text, marginBottom: 4 }}>
                  {Object.entries(row).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: 12, fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && <ManualAddForm onSuccess={onSuccess} onClose={onClose} />}
    </Modal>
  );
}

function ManualAddForm({ onSuccess, onClose }) {
  const [rows, setRows] = useState([{ phone: '', name: '', email: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addRow    = () => setRows(r => [...r, { phone: '', name: '', email: '' }]);
  const updateRow = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    const contacts = rows.filter(r => r.phone.trim()).map(r => ({
      phone_number: r.phone.trim(),
      name:  r.name.trim()  || null,
      email: r.email.trim() || null,
    }));
    if (!contacts.length) { setError('Ajoutez au moins un numéro.'); return; }
    setLoading(true);
    try {
      const data = await audience.upsert(contacts);
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 32px', gap: 8,
        fontSize: 11, fontWeight: 600, color: C.gray, padding: '0 0 4px' }}>
        <span>TÉLÉPHONE *</span><span>NOM</span><span>EMAIL</span><span />
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 32px', gap: 8 }}>
          <input value={row.phone}  onChange={e => updateRow(i, 'phone',  e.target.value)} placeholder="+237600000000" style={inputStyle} />
          <input value={row.name}   onChange={e => updateRow(i, 'name',   e.target.value)} placeholder="Nom"           style={inputStyle} />
          <input value={row.email}  onChange={e => updateRow(i, 'email',  e.target.value)} placeholder="email@..."     style={inputStyle} />
          <button onClick={() => removeRow(i)} style={{ background: C.redLight, color: C.red,
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>×</button>
        </div>
      ))}
      <Btn variant="ghost" size="sm" onClick={addRow}>+ Ajouter une ligne</Btn>
      {error && <div style={{ background: C.redLight, color: C.red, borderRadius: 8, padding: 10, fontSize: 12 }}>⚠ {error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn onClick={handleSubmit} disabled={loading}>{loading ? 'Enregistrement…' : 'Enregistrer les contacts'}</Btn>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// MODAL RENVOI CAMPAGNE (avec support listId)
// ──────────────────────────────────────────────
function ResendModal({ onClose, onSuccess, selectedCount, selectedIds, listId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({ campaign_id: '', new_media_url: '', name_suffix: ' (renvoi)' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    audience.campaigns({ limit: 100, status: 'completed' })
      .then(d => setCampaigns(d.campaigns || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.campaign_id) return;
    setLoading(true);
    try {
      const payload = {
        campaign_id: form.campaign_id,
        name_suffix: form.name_suffix,
        ...(form.new_media_url ? { new_media_url: form.new_media_url } : {}),
        contact_filters: {},
      };
      if (listId) {
        payload.contact_filters.list_id = listId;
      } else if (selectedIds && selectedIds.length > 0) {
        payload.contact_filters.contact_ids = selectedIds;
      } else {
        delete payload.contact_filters;
      }
      const data = await audience.resend(payload);
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const count = listId ? 'tous les contacts de la liste' : `${selectedCount || 0} contact${selectedCount > 1 ? 's' : ''}`;

  return (
    <Modal title="Renvoyer une campagne" onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {listId && (
          <div style={{ background: C.blueLight, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.blue }}>
            📋 Cible : tous les contacts de la liste sélectionnée
          </div>
        )}
        {!listId && selectedCount > 0 && (
          <div style={{ background: C.blueLight, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.blue }}>
            📋 {selectedCount} contact{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.gray }}>CAMPAGNE SOURCE *</label>
          <select value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))} style={inputStyle}>
            <option value="">Choisir une campagne complétée…</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.total_contacts} contacts</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.gray }}>NOUVEAU LIEN MÉDIA <span style={{ color: C.muted, fontWeight: 400 }}>(optionnel)</span></label>
          <input
            value={form.new_media_url}
            onChange={e => setForm(f => ({ ...f, new_media_url: e.target.value }))}
            placeholder="https://… (PDF, image, vidéo, document)"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: C.muted }}>
            Remplace automatiquement l'ancien lien média dans les variables de chaque contact.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.gray }}>SUFFIXE DU NOM</label>
          <input value={form.name_suffix} onChange={e => setForm(f => ({ ...f, name_suffix: e.target.value }))} style={inputStyle} />
        </div>

        {error && (
          <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: 12, fontSize: 12 }}>⚠ {error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
          <Btn onClick={handleSubmit} disabled={loading || !form.campaign_id}>
            {loading ? 'Création…' : '🚀 Créer le renvoi'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────
// MODAL DÉTAIL CONTACT (inchangée)
// ──────────────────────────────────────────────
function ContactDetailModal({ contact, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    audience.detail(contact.id)
      .then(d => setDetail(d))
      .catch(() => setDetail({ contact, campaign_history: [] }))
      .finally(() => setLoading(false));
  }, [contact.id]);

  const c       = detail?.contact || contact;
  const history = detail?.campaign_history || [];

  return (
    <Modal title="Fiche contact" onClose={onClose} width={600}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Chargement…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.greenLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: C.green, flexShrink: 0 }}>
              {(c.name || c.phone_number || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{c.name || '—'}</div>
              <div style={{ fontSize: 13, color: C.gray, fontFamily: 'monospace' }}>{c.phone_number}</div>
              {c.email && <div style={{ fontSize: 12, color: C.muted }}>{c.email}</div>}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {c.is_opted_out && <Badge color={C.red}>Désabonné</Badge>}
              <Badge color={C.green}>{c.source || 'manuel'}</Badge>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Campagnes', value: c.campaigns_count || 0,  color: C.green },
              { label: 'Livrés',    value: c.total_delivered || 0,  color: '#8bc34a' },
              { label: 'Lus',       value: c.total_read || 0,       color: C.blue },
              { label: 'Échecs',    value: c.total_failed || 0,     color: c.total_failed > 0 ? C.red : C.gray },
            ].map(s => (
              <div key={s.label} style={{ background: C.grayLight, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.gray }}>{s.label}</div>
              </div>
            ))}
          </div>

          {c.variables && Object.keys(c.variables).length > 0 && (
            <div style={{ background: C.grayLight, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 10 }}>VARIABLES PERSONNALISÉES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(c.variables).map(([k, v]) => (
                  <div key={k} style={{ background: C.white, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
                    <span style={{ color: C.gray }}>{k}: </span>
                    <span style={{ color: C.text, fontWeight: 500 }}>
                      {String(v).length > 40 ? String(v).slice(0, 40) + '…' : v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 10 }}>
              HISTORIQUE DES CAMPAGNES ({history.length})
            </div>
            {history.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 20 }}>
                Aucune campagne pour ce contact
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {history.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                    background: C.grayLight, borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{h.campaign_name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {h.template_name} · {h.sent_at ? new Date(h.sent_at).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    </div>
                    <StatusDot status={h.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ──────────────────────────────────────────────
// PANEL FILTRES AVANCÉS (inchangé)
// ──────────────────────────────────────────────
function FilterPanel({ filters, onChange, onClose }) {
  const [local, setLocal] = useState({ ...filters });
  const update = (k, v) => setLocal(f => ({ ...f, [k]: v }));
  const apply  = () => { onChange(local); onClose(); };
  const reset  = () => {
    const r = { sort: 'recent', min_campaigns: '', max_campaigns: '', status: '', source: '', opted_out: '', take_first_n: '', tags: '' };
    setLocal(r); onChange(r); onClose();
  };

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: 20, minWidth: 320,
      position: 'absolute', top: '100%', right: 0, zIndex: 200, marginTop: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Filtres avancés</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>TRI</label>
          <select value={local.sort || 'recent'} onChange={e => update('sort', e.target.value)} style={inputStyle}>
            <option value="recent">Plus récents en premier</option>
            <option value="oldest">Plus anciens en premier</option>
            <option value="most_campaigns">Plus de campagnes</option>
            <option value="least_campaigns">Moins de campagnes</option>
            <option value="name">Alphabétique (nom)</option>
            <option value="never_contacted">Jamais contactés</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>CAMPAGNES MIN</label>
            <input type="number" value={local.min_campaigns || ''} onChange={e => update('min_campaigns', e.target.value)}
              placeholder="0" style={inputStyle} min="0" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>CAMPAGNES MAX</label>
            <input type="number" value={local.max_campaigns || ''} onChange={e => update('max_campaigns', e.target.value)}
              placeholder="∞" style={inputStyle} min="0" />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>DERNIER STATUT</label>
          <select value={local.status || ''} onChange={e => update('status', e.target.value)} style={inputStyle}>
            <option value="">Tous les statuts</option>
            <option value="delivered">Livré</option>
            <option value="read">Lu</option>
            <option value="sent">Envoyé</option>
            <option value="failed">Échec</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>SOURCE</label>
          <select value={local.source || ''} onChange={e => update('source', e.target.value)} style={inputStyle}>
            <option value="">Toutes les sources</option>
            <option value="manual">Saisie manuelle</option>
            <option value="csv">Import CSV</option>
            <option value="excel">Import Excel</option>
            <option value="campaign_import">Import campagne</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>DÉSABONNEMENT</label>
          <select value={local.opted_out || ''} onChange={e => update('opted_out', e.target.value)} style={inputStyle}>
            <option value="">Tous</option>
            <option value="false">Actifs seulement</option>
            <option value="true">Désabonnés seulement</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>
            PRENDRE LES N PREMIERS
          </label>
          <input type="number" value={local.take_first_n || ''} onChange={e => update('take_first_n', e.target.value)}
            placeholder="ex: 50, 100, 500…" style={inputStyle} min="1" />
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Combiné avec le tri pour cibler un segment précis</div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>TAGS (virgule-séparés)</label>
          <input value={local.tags || ''} onChange={e => update('tags', e.target.value)} placeholder="VIP, Douala, Impayé…" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <Btn variant="ghost" size="sm" onClick={reset} style={{ flex: 1 }}>Réinitialiser</Btn>
        <Btn size="sm" onClick={apply} style={{ flex: 2 }}>Appliquer les filtres</Btn>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// PANEL LISTES (avec ajout du bouton Supprimer)
// ──────────────────────────────────────────────
function ListsPanel({ lists, onRefresh, onToast, onFilterByList, onClearListFilter, listFilter }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendListId, setResendListId] = useState(null);

  const createList = async () => {
    if (!newListName.trim()) return;
    setLoading(true);
    try {
      await audience.lists.create(newListName.trim(), newListDesc.trim() || null);
      onToast('Liste créée');
      setShowCreate(false);
      setNewListName('');
      setNewListDesc('');
      onRefresh();
    } catch (err) {
      onToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportList = async (listId, listName) => {
    try {
      onToast(`Export de la liste "${listName}" en cours...`);
      const blob = await audience.exportCSV({ list_id: listId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liste_${listName}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onToast(`Export de la liste "${listName}" terminé`);
    } catch (err) {
      onToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleViewList = (listId) => {
    onFilterByList(listId);
  };

  const handleClearFilter = () => {
    onClearListFilter();
  };

  // ═══ SUPPRESSION D'UNE LISTE ═══
  const handleDeleteList = async (listId, listName) => {
    if (!confirm(`Supprimer la liste "${listName}" ? Cette action est irréversible.`)) return;
    try {
      await audience.lists.delete(listId);
      onToast(`Liste "${listName}" supprimée`);
      onRefresh();
      // Si le filtre actif était cette liste, on le retire
      if (listFilter === listId) onClearListFilter();
    } catch (err) {
      onToast(err.response?.data?.message || err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {listFilter && (
            <span style={{ background: C.blueLight, color: C.blue, padding: '4px 12px', borderRadius: 20, fontSize: 13 }}>
              🔍 Filtre actif : {lists.find(l => l.id === listFilter)?.name || 'Liste'}
              <button onClick={handleClearFilter} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: C.blue, cursor: 'pointer' }}>✕</button>
            </span>
          )}
        </div>
        <Btn size="sm" onClick={() => setShowCreate(v => !v)}>+ Créer une liste</Btn>
      </div>

      {showCreate && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Nouvelle liste</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Nom de la liste *" style={inputStyle} />
            <input value={newListDesc} onChange={e => setNewListDesc(e.target.value)} placeholder="Description (optionnelle)" style={inputStyle} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annuler</Btn>
              <Btn size="sm" onClick={createList} disabled={loading}>Créer</Btn>
            </div>
          </div>
        </div>
      )}

      {lists.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: 60, textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.gray, marginBottom: 8 }}>Aucune liste créée</div>
          <div style={{ fontSize: 13 }}>Les listes permettent de grouper vos contacts en segments statiques.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {lists.map(list => (
            <div
              key={list.id}
              style={{
                background: C.white,
                border: `1px solid ${listFilter === list.id ? C.green : C.border}`,
                borderRadius: 14,
                padding: '18px 20px',
                transition: 'border 0.15s',
                boxShadow: listFilter === list.id ? `0 0 0 2px ${C.green}30` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{list.name}</div>
                  {list.description && <div style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>{list.description}</div>}
                </div>
                <Badge color={C.green}>{list.contact_count || 0}</Badge>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>
                Créée le {new Date(list.created_at).toLocaleDateString('fr-FR')}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleViewList(list.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: `1px solid ${C.blue}`,
                    background: listFilter === list.id ? C.blue : 'white',
                    color: listFilter === list.id ? 'white' : C.blue,
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {listFilter === list.id ? '✓ Filtré' : '👁 Voir'}
                </button>
                <button
                  onClick={() => handleExportList(list.id, list.name)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: 'white',
                    color: C.gray,
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  📥 Exporter
                </button>
                <button
                  onClick={() => setResendListId(list.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: `1px solid ${C.green}`,
                    background: 'white',
                    color: C.green,
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  🔄 Renvoyer
                </button>
                {/* ═══ BOUTON SUPPRIMER ═══ */}
                <button
                  onClick={() => handleDeleteList(list.id, list.name)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: `1px solid ${C.red}`,
                    background: C.redLight,
                    color: C.red,
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  🗑 Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resendListId && (
        <ResendModal
          onClose={() => setResendListId(null)}
          listId={resendListId}
          onSuccess={data => {
            onToast(`Campagne de renvoi créée (${data.contacts_count} contacts)`);
            setResendListId(null);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// PAGE PRINCIPALE
// ──────────────────────────────────────────────
export default function AudiencePage() {
  const router = useRouter();
  const [contacts, setContacts]       = useState([]);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [pagination, setPagination]   = useState({});
  const [search, setSearch]           = useState('');
  const [filters, setFilters]         = useState({ sort: 'recent', page: 1, limit: 50 });
  const [selected, setSelected]       = useState(new Set());
  const [toast, setToast]             = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal]             = useState(null);
  const [detailContact, setDetailContact] = useState(null);
  const [activeTab, setActiveTab]     = useState('contacts');
  const [lists, setLists]             = useState([]);
  const [listFilter, setListFilter]   = useState(null);

  // ═══ ÉTAT POUR L'AJOUT À UNE LISTE ═══
  const [selectedListId, setSelectedListId] = useState('');

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // ──── Fetch contacts ────
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page:   filters.page  || 1,
        limit:  filters.limit || 50,
        sort:   filters.sort  || 'recent',
      };
      if (search)                   params.search        = search;
      if (filters.status)           params.status        = filters.status;
      if (filters.source)           params.source        = filters.source;
      if (filters.opted_out)        params.opted_out     = filters.opted_out;
      if (filters.min_campaigns !== undefined && filters.min_campaigns !== '') params.min_campaigns = filters.min_campaigns;
      if (filters.max_campaigns !== undefined && filters.max_campaigns !== '') params.max_campaigns = filters.max_campaigns;
      if (filters.take_first_n)     params.take_first_n  = filters.take_first_n;
      if (filters.tags)             params.tags          = filters.tags;
      if (listFilter)               params.list_id       = listFilter;

      const [contactsData, statsData] = await Promise.all([
        audience.list(params),
        audience.stats(),
      ]);
      setContacts(contactsData.contacts || []);
      setPagination(contactsData.pagination || {});
      setStats(statsData.stats || {});
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, search, listFilter]);

  const fetchLists = useCallback(async () => {
    try {
      const data = await audience.lists.all();
      setLists(data.lists || []);
    } catch {}
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { if (activeTab === 'lists') fetchLists(); }, [activeTab, fetchLists]);

  // ──── Gestion du filtre par liste ────
  const handleFilterByList = (listId) => {
    setListFilter(listId);
    setActiveTab('contacts');
    setFilters(prev => ({ ...prev, page: 1 }));
  };

  const handleClearListFilter = () => {
    setListFilter(null);
    setFilters(prev => ({ ...prev, page: 1 }));
  };

  // ──── Export CSV ────
  const handleExport = async () => {
    try {
      const params = {};
      if (search)             params.search       = search;
      if (filters.status)     params.status       = filters.status;
      if (filters.take_first_n) params.take_first_n = filters.take_first_n;
      if (listFilter)         params.list_id      = listFilter;

      const blob = await audience.exportCSV(params);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `audience_${Date.now()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast('Export téléchargé');
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // ──── Suppression de contacts ────
  const handleDelete = async (ids) => {
    if (!ids.length) return;
    if (!confirm(`Archiver ${ids.length} contact${ids.length > 1 ? 's' : ''} ?`)) return;
    try {
      await audience.delete(ids);
      showToast(`${ids.length} contact${ids.length > 1 ? 's' : ''} archivé${ids.length > 1 ? 's' : ''}`);
      setSelected(new Set());
      fetchContacts();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // ═══ AJOUT DES CONTACTS SÉLECTIONNÉS À UNE LISTE ═══
  const handleAddToSelectedList = async () => {
    if (!selectedListId) {
      showToast('Veuillez choisir une liste', 'error');
      return;
    }
    if (selected.size === 0) {
      showToast('Aucun contact sélectionné', 'error');
      return;
    }
    try {
      await audience.lists.addContacts(selectedListId, [...selected]);
      showToast(`Contacts ajoutés à la liste`);
      setSelectedListId('');
      setSelected(new Set());
      fetchLists(); // met à jour les compteurs
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  };

  const activeFiltersCount = [
    filters.status, filters.source, filters.opted_out,
    filters.min_campaigns, filters.max_campaigns, filters.take_first_n, filters.tags,
  ].filter(v => v !== undefined && v !== '' && v !== null).length + (listFilter ? 1 : 0);

  const s = stats || {};

  return (
    <div style={{ minHeight: '100vh', background: C.grayLight, fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes slideDown { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin      { to   { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: ${C.green} !important; box-shadow: 0 0 0 3px ${C.green}22; }
        .contact-row:hover { background: ${C.greenLight} !important; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {modal === 'import' && (
        <ImportModal onClose={() => setModal(null)} onSuccess={data => {
          showToast(`Import : ${data.inserted || 0} ajoutés, ${data.updated || 0} mis à jour`);
          setModal(null); fetchContacts();
        }} />
      )}
      {modal === 'resend' && (
        <ResendModal
          onClose={() => setModal(null)}
          selectedCount={selected.size}
          selectedIds={[...selected]}
          onSuccess={data => {
            showToast(`Campagne de renvoi créée (${data.contacts_count} contacts)`);
            setModal(null);
            router.push('/dashboard/campaigns');
          }}
        />
      )}
      {modal === 'detail' && detailContact && (
        <ContactDetailModal contact={detailContact} onClose={() => { setModal(null); setDetailContact(null); }} />
      )}

      {/* ── Header ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${C.green}, #8bc34a)`,
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: C.white }}>
              👥
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Audience</div>
              <div style={{ fontSize: 12, color: C.muted }}>Carnet de contacts centralisé</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost"   size="sm" onClick={handleExport}>⬇ Exporter CSV</Btn>
            <Btn variant="outline" size="sm" onClick={() => setModal('resend')}>🔄 Renvoyer une campagne</Btn>
            <Btn size="sm" onClick={() => setModal('import')}>+ Importer des contacts</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px' }}>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 28 }}>
          <Stat label="Contacts actifs"  value={(s.total_contacts    || 0).toLocaleString('fr-FR')} color={C.green}
            sub={`${s.opted_out_count || 0} désabonnés`} />
          <Stat label="Jamais contactés" value={(s.never_contacted   || 0).toLocaleString('fr-FR')} color={C.orange} />
          <Stat label="Actifs 30 jours"  value={(s.active_30d        || 0).toLocaleString('fr-FR')} color={C.blue} />
          <Stat label="Moy. campagnes"   value={parseFloat(s.avg_campaigns_per_contact || 0).toFixed(1)} color="#8bc34a" sub="par contact" />
          <Stat label="Total livrés"     value={(s.total_delivered_all || 0).toLocaleString('fr-FR')} color={C.green}
            sub={`${(s.total_read_all || 0).toLocaleString('fr-FR')} lus`} />
        </div>

        {/* ── Onglets ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Tabs tabs={[
            { id: 'contacts', label: `👥 Contacts (${(pagination.total || 0).toLocaleString('fr-FR')})` },
            { id: 'lists',    label: `📋 Listes (${lists.length})` },
          ]} active={activeTab} onChange={setActiveTab} />
          {listFilter && (
            <span style={{ background: C.blueLight, color: C.blue, padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
              🔍 Filtré par liste : {lists.find(l => l.id === listFilter)?.name || '...'}
              <button onClick={handleClearListFilter} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: C.blue, cursor: 'pointer' }}>✕</button>
            </span>
          )}
        </div>

        {activeTab === 'contacts' && (
          <>
            {/* ── Barre recherche + filtres ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, color: C.muted }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par téléphone, nom, email…"
                  style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>

              <select value={filters.sort || 'recent'} onChange={e => setFilters(f => ({ ...f, sort: e.target.value, page: 1 }))}
                style={{ ...inputStyle, width: 'auto' }}>
                <option value="recent">Récents</option>
                <option value="most_campaigns">+ de campagnes</option>
                <option value="never_contacted">Jamais contactés</option>
                <option value="name">Nom A→Z</option>
              </select>

              <select value={filters.take_first_n || ''} onChange={e => setFilters(f => ({ ...f, take_first_n: e.target.value, page: 1 }))}
                style={{ ...inputStyle, width: 'auto' }}>
                <option value="">Tous</option>
                <option value="50">50 premiers</option>
                <option value="100">100 premiers</option>
                <option value="200">200 premiers</option>
                <option value="500">500 premiers</option>
              </select>

              <div style={{ position: 'relative' }}>
                <Btn variant={activeFiltersCount > 0 ? 'outline' : 'ghost'} size="sm"
                  onClick={() => setShowFilters(v => !v)}>
                  ⚙ Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                </Btn>
                {showFilters && (
                  <FilterPanel
                    filters={filters}
                    onChange={f => setFilters(prev => ({ ...prev, ...f, page: 1 }))}
                    onClose={() => setShowFilters(false)}
                  />
                )}
              </div>
            </div>

            {/* ── Barre d'actions sélection (avec AJOUT À UNE LISTE) ── */}
            {selected.size > 0 && (
              <div style={{ background: C.blueLight, border: `1px solid ${C.blue}30`, borderRadius: 12,
                padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>
                  {selected.size} contact{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={selectedListId}
                    onChange={e => setSelectedListId(e.target.value)}
                    style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
                  >
                    <option value="">Ajouter à une liste...</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <Btn size="sm" variant="outline" onClick={handleAddToSelectedList}>
                    ➕ Ajouter
                  </Btn>
                  <Btn size="sm" variant="outline" onClick={() => setModal('resend')}>🔄 Renvoyer à cette sélection</Btn>
                  <Btn size="sm" variant="danger"  onClick={() => handleDelete([...selected])}>🗑 Archiver la sélection</Btn>
                  <Btn size="sm" variant="ghost"   onClick={() => setSelected(new Set())}>✕ Désélectionner</Btn>
                </div>
              </div>
            )}

            {/* ── Table ── */}
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: C.gray }}>
                  <div style={{ width: 22, height: 22, border: `3px solid ${C.border}`, borderTopColor: C.green,
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Chargement…
                </div>
              ) : contacts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 240, gap: 12, color: C.muted }}>
                  <div style={{ fontSize: 40 }}>👥</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.gray }}>Aucun contact trouvé</div>
                  <Btn onClick={() => setModal('import')}>+ Importer des contacts</Btn>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.grayLight, borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ padding: '11px 16px', width: 36 }}>
                        <input type="checkbox"
                          checked={selected.size === contacts.length && contacts.length > 0}
                          onChange={toggleAll} style={{ cursor: 'pointer' }} />
                      </th>
                      {['Contact', 'Campagnes', 'Dernier statut', 'Tags', 'Ajouté le', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 600, color: C.gray,
                          letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id} className="contact-row"
                        style={{ borderBottom: `1px solid ${C.border}`, background: selected.has(c.id) ? C.greenLight : C.white }}>
                        <td style={{ padding: '12px 16px' }}>
                          <input type="checkbox" checked={selected.has(c.id)}
                            onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '12px 14px', minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.greenLight,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                              {(c.name || c.phone_number || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                {c.name || <span style={{ color: C.muted }}>Sans nom</span>}
                              </div>
                              <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{c.phone_number}</div>
                              {c.email && <div style={{ fontSize: 11, color: C.muted }}>{c.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: c.campaigns_count > 0 ? C.green : C.muted }}>
                            {c.campaigns_count}
                          </div>
                          {c.campaigns_count > 0 && (
                            <div style={{ fontSize: 10, color: C.muted }}>
                              {c.total_delivered || 0}✓ {c.total_read || 0}👁 {c.total_failed > 0 ? `${c.total_failed}✗` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <StatusDot status={c.last_status} />
                          {c.last_campaign_at && (
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                              {new Date(c.last_campaign_at).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.is_opted_out && <Badge color={C.red}>Désabonné</Badge>}
                            {(c.tags || []).slice(0, 2).map(tag => (
                              <Badge key={tag} color={C.blue} bg={C.blueLight}>{tag}</Badge>
                            ))}
                            {(c.tags || []).length > 2 && <Badge color={C.gray}>+{c.tags.length - 2}</Badge>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                          <div style={{ fontSize: 10 }}>{c.source || 'manuel'}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setDetailContact(c); setModal('detail'); }} title="Voir le détail"
                              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
                                background: C.white, cursor: 'pointer', fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📋</button>
                            <button onClick={() => { setSelected(new Set([c.id])); setModal('resend'); }} title="Renvoyer à ce contact"
                              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
                                background: C.white, cursor: 'pointer', fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔄</button>
                            <button onClick={() => handleDelete([c.id])} title="Archiver"
                              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.redLight}`,
                                background: C.redLight, cursor: 'pointer', fontSize: 14, color: C.red,
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                <div style={{ fontSize: 13, color: C.gray }}>
                  {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} sur {(pagination.total || 0).toLocaleString('fr-FR')} contacts
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" size="sm" disabled={filters.page <= 1}
                    onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Précédent</Btn>
                  <span style={{ padding: '6px 14px', fontSize: 13, color: C.gray, display: 'flex', alignItems: 'center' }}>
                    {filters.page} / {pagination.totalPages}
                  </span>
                  <Btn variant="ghost" size="sm" disabled={filters.page >= pagination.totalPages}
                    onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Suivant →</Btn>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'lists' && (
          <ListsPanel
            lists={lists}
            onRefresh={fetchLists}
            onToast={showToast}
            onFilterByList={handleFilterByList}
            onClearListFilter={handleClearListFilter}
            listFilter={listFilter}
          />
        )}
      </div>
    </div>
  );
}
