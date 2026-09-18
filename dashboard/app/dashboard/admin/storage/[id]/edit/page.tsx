// app/dashboard/admin/storage/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FiHardDrive,
  FiArrowLeft,
  FiSave,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiCalendar,
  FiRefreshCw,
  FiUser
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface SpaceDetail {
  id: string;
  client_id: string;
  company_name: string;
  email: string;
  size_limit_bytes: number;
  current_usage_bytes: number;
  is_active: boolean;
  is_blocked: boolean;
  expires_at: string;
  created_at: string;
  offer_name?: string;
  storage_gb?: number;
}

export default function EditSpacePage() {
  const router = useRouter();
  const params = useParams();
  const spaceId = params.id as string;

  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const [formData, setFormData] = useState({
    size_gb: 0,
    expires_at: '',
    is_active: true,
    is_blocked: false
  });

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return Cookies.get('token') || '';
    }
    return '';
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadSpace = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur chargement');

      const data = await response.json();
      setSpace(data.space);

      // Initialiser le formulaire
      setFormData({
        size_gb: Math.round(data.space.size_limit_bytes / (1024 * 1024 * 1024)),
        expires_at: data.space.expires_at ? data.space.expires_at.split('T')[0] : '',
        is_active: data.space.is_active,
        is_blocked: data.space.is_blocked
      });
    } catch (err) {
      showNotification('error', 'Erreur lors du chargement');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = getToken();
      if (!token) return;

      // Mettre à jour la taille
      if (formData.size_gb !== Math.round((space?.size_limit_bytes || 0) / (1024 * 1024 * 1024))) {
        await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/size`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ size_gb: formData.size_gb })
        });
      }

      // Mettre à jour l'expiration
      if (formData.expires_at && formData.expires_at !== space?.expires_at?.split('T')[0]) {
        await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/expiration`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expires_at: formData.expires_at })
        });
      }

      // Gérer le statut actif/bloqué si nécessaire
      if (formData.is_blocked !== space?.is_blocked) {
        if (formData.is_blocked) {
          await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/block`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reason: 'Modifié via édition' })
          });
        } else if (space?.is_blocked && !formData.is_blocked) {
          await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/activate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      }

      showNotification('success', 'Espace mis à jour avec succès');
      setTimeout(() => router.push(`/dashboard/admin/storage/${spaceId}`), 1500);
    } catch (err) {
      showNotification('error', 'Erreur lors de la mise à jour');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSpace();
  }, [spaceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <FiAlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Espace non trouvé</h3>
          <button
            onClick={() => router.push('/dashboard/admin/storage')}
            className="px-6 py-3 bg-[var(--primary-green)] text-white rounded-lg"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <FiCheck className="h-5 w-5 mr-2" />
            ) : (
              <FiAlertCircle className="h-5 w-5 mr-2" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <FiArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modifier l'espace</h1>
          <p className="text-gray-600 text-sm">ID: {space.id}</p>
        </div>
      </div>

      {/* Informations client */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiUser className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">{space.company_name || 'Client sans nom'}</p>
            <p className="text-sm text-blue-700">{space.email}</p>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Taille (Go)
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            required
            value={formData.size_gb}
            onChange={(e) => setFormData({...formData, size_gb: parseInt(e.target.value) || 1})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
          />
          <p className="text-xs text-gray-500 mt-1">
            Actuellement: {Math.round(space.size_limit_bytes / (1024 * 1024 * 1024))} Go
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date d'expiration
          </label>
          <input
            type="date"
            required
            value={formData.expires_at}
            onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="h-4 w-4 text-[var(--primary-green)] rounded"
            />
            <span className="text-sm text-gray-700">Espace actif</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.is_blocked}
              onChange={(e) => setFormData({...formData, is_blocked: e.target.checked})}
              className="h-4 w-4 text-red-500 rounded"
            />
            <span className="text-sm text-gray-700">Espace bloqué</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <FiRefreshCw className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <FiSave className="h-4 w-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
