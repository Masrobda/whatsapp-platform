// lib/socadel-auth.js  (ou app/socadel/_lib/auth.js)
'use strict';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://dashboard.numericexport.com';

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
}

export function clearSocadelSession() {
  localStorage.removeItem('socadel_token');
  localStorage.removeItem('socadel_user');
}

export async function socadelFetch(path, options = {}) {
  const token = getSocadelToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
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
