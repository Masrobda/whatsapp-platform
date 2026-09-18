'use client';

const QUEUE_KEY = 'socadel_offline_queue_v1';

/** Capture GPS (timeout 12s). Ne jette pas : retourne null si indisponible. */
export function captureGps(timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const opts = {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60_000,
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
          gps_accuracy: pos.coords.accuracy,
          gps_captured_at: new Date(pos.timestamp).toISOString(),
        });
      },
      () => resolve(null),
      opts
    );
  });
}

export function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueOffline(payload) {
  const q = loadQueue();
  const item = {
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    payload,
  };
  q.push(item);
  saveQueue(q);
  return item;
}

export function removeFromQueue(id) {
  saveQueue(loadQueue().filter((x) => x.id !== id));
}

/**
 * Tente d'envoyer toute la file. token = Bearer JWT.
 * Retourne { sent, failed, remaining }
 */
export async function flushOfflineQueue(token) {
  const q = loadQueue();
  if (!q.length) return { sent: 0, failed: 0, remaining: 0 };

  let sent = 0;
  let failed = 0;
  const keep = [];

  for (const item of q) {
    try {
      const res = await fetch('/api/v1/socadel/quick-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...item.payload,
          offline_queued_at: item.created_at,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        sent++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408) {
        // erreur métier définitive → on retire pour ne pas boucler
        failed++;
      } else {
        keep.push(item);
        failed++;
      }
    } catch {
      keep.push(item);
      failed++;
    }
  }

  saveQueue(keep);
  return { sent, failed, remaining: keep.length };
}

export function isProbablyOffline() {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}
