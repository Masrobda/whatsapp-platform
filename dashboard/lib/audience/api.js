// lib/audience/api.js
// Client API pour le module Audience — à placer dans dashboard/lib/audience/api.js

import Cookies from 'js-cookie';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

async function apiFetch(path, options = {}) {

  const token = Cookies.get('token');   // ← ici aussi
  if (!token) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Non authentifié');
  }
  const headers = { 'Authorization': `Bearer ${token}` };
  if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: { ...headers, ...(options.headers || {}) },
    body: options.body,
  });

  if (res.status === 401) {
    Cookies.remove('token');
    if (typeof window !== 'undefined') window.location.href = '/login?session=expired';
    throw new Error('Session expirée');
  }
  if (res.status === 204) return { success: true };
  const text = await res.text();
  if (!text) return { success: true };
  if (!res.ok) {
    try { const e = JSON.parse(text); throw new Error(e.message || `HTTP ${res.status}`); }
    catch { throw new Error(`HTTP ${res.status}`); }
  }
  return JSON.parse(text);
}

// ──────────────────────────────────────────────
export const AudienceAPI = {

  // Stats globales de l'audience
  stats: () => apiFetch('/audience/stats'),

  // Liste paginée + filtrée
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiFetch(`/audience?${qs}`);
  },

  // Recherche avancée (POST)
  search: (filters) => apiFetch('/audience/search', { method: 'POST', body: JSON.stringify(filters) }),

  // Détail d'un contact + historique campagnes
  detail: (contactId) => apiFetch(`/audience/${contactId}`),

  // Ajouter/mettre à jour des contacts (upsert manuel)
  upsert: (contacts) => apiFetch('/audience/contacts', {
    method: 'POST',
    body: JSON.stringify({ contacts }),
  }),

  // Import fichier CSV ou Excel
  importFile: async (file) => {
    const token = Cookies.get('token');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/audience/import`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `HTTP ${res.status}`); }
    return res.json();
  },

  // Importer les contacts d'une campagne existante dans l'audience
  importFromCampaign: (campaignId) => apiFetch(`/audience/import/from-campaign/${campaignId}`, { method: 'POST' }),

  // Export CSV (retourne un Blob)
  exportCSV: async (params = {}) => {
    const token = Cookies.get('token');
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    const res = await fetch(`${API_BASE}/audience/export/csv?${qs}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Erreur export HTTP ${res.status}`);
    const blob = await res.blob();
    const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `audience_${Date.now()}.csv`;
    return { blob, filename };
  },

  // Archiver des contacts (soft delete)
  delete: (contactIds) => apiFetch('/audience/delete', {
    method: 'POST',
    body: JSON.stringify({ contact_ids: contactIds }),
  }),

  // Archiver des contacts par filtre
  deleteByFilter: (filters) => apiFetch('/audience/delete', {
    method: 'POST',
    body: JSON.stringify({ filters }),
  }),

  // Renvoyer une campagne (même template + nouveau média optionnel)
  resend: (campaignId, options = {}) => apiFetch('/audience/resend', {
    method: 'POST',
    body: JSON.stringify({ campaign_id: campaignId, ...options }),
  }),

  // Récupérer les contacts filtrés prêts pour une NOUVELLE campagne
  getForNewCampaign: (filters = {}) => apiFetch('/audience/for-new-campaign', {
    method: 'POST',
    body: JSON.stringify(filters),
  }),

  // ── Listes statiques ──
  lists: {
    all: () => apiFetch('/audience/lists'),
    create: (name, description, contactIds = []) => apiFetch('/audience/lists', {
      method: 'POST',
      body: JSON.stringify({ name, description, contact_ids: contactIds }),
    }),
  },
};

// ──────────────────────────────────────────────
// Utilitaire : déclencher le téléchargement du CSV exporté
// ──────────────────────────────────────────────
export async function downloadAudienceCSV(filters = {}) {
  const { blob, filename } = await AudienceAPI.exportCSV(filters);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
