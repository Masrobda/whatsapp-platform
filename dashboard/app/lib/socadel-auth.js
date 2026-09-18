// app/lib/socadel-auth.js
'use client';

/**
 * Base API :
 * - vide → chemins relatifs /api/v1/... (rewrite Next → api.numericexport.com)
 * - si NEXT_PUBLIC_API_URL = https://api.numericexport.com  → on préfixe /api/v1
 * - si déjà .../api/v1 → on ne double PAS
 */
function getApiBase() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!raw) return ''; // relatif au domaine dashboard
  // Enlever un éventuel /api/v1 final pour contrôler le préfixe nous-mêmes
  return raw.replace(/\/api\/v1$/i, '');
}

const API_BASE = getApiBase();

export function apiUrl(path) {
  // path doit commencer par /api/v1/...
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export function getSocadelToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('socadel_token');
}

export function getSocadelUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('socadel_user') || 'null');
  } catch {
    return null;
  }
}

export function setSocadelSession({ token, user }) {
  localStorage.setItem('socadel_token', token);
  localStorage.setItem('socadel_user', JSON.stringify(user));
  if (user?.role) localStorage.setItem('socadel_role', user.role);
  if (user?.role === 'agent_socadel') {
    localStorage.setItem('socadel_agent', JSON.stringify(user));
  }
}

export function clearSocadelSession() {
  localStorage.removeItem('socadel_token');
  localStorage.removeItem('socadel_user');
  localStorage.removeItem('socadel_role');
  localStorage.removeItem('socadel_agent');
}

export async function socadelFetch(path, options = {}) {
  const token = getSocadelToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    err.data = data;
    throw err;
  }
  return data;
}
