// app/dashboard/admin/storage/[id]/page.tsx (version corrigée)
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FiHardDrive,
  FiArrowLeft,
  FiEdit2,
  FiLock,
  FiUnlock,
  FiRefreshCw,
  FiTrash2,
  FiDownload,
  FiEye,
  FiFolder,
  FiUser,
  FiMail,
  FiCalendar,
  FiDollarSign,
  FiCreditCard,
  FiClock,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiCopy,
  FiMoreVertical,
  FiUsers,
  FiFileText
} from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';

interface SpaceDetail {
  id: string;
  client_id: string;
  company_name?: string;
  email?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  size_limit_bytes: number;
  current_usage_bytes: number;
  usage_percentage: number;
  is_active: boolean;
  is_blocked: boolean;
  is_expired: boolean;
  blocked_reason?: string;
  expires_at: string;
  created_at: string;
  activated_at?: string;
  updated_at: string;
  order_id?: string;
  order_number?: string;
  invoice_number?: string;
  amount_fcfa?: number;
  offer_name?: string;
  storage_gb?: number;
  file_count?: number;
  auto_renew?: boolean;
}

export default function SpaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const spaceId = params.id as string;

  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showActions, setShowActions] = useState(false);

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

  const loadSpaceDetail = async () => {
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

      if (!response.ok) {
        if (response.status === 404) {
          setError('Espace non trouvé');
          return;
        }
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Erreur chargement');
      }

      const data = await response.json();
      setSpace(data.space);
    } catch (err) {
      setError('Erreur lors du chargement');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!space) return;
    const reason = prompt('Raison du blocage (optionnel):');
    
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/block`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason || 'Bloqué par administrateur' })
      });

      if (!response.ok) throw new Error('Erreur blocage');

      showNotification('success', 'Espace bloqué avec succès');
      loadSpaceDetail();
    } catch (err) {
      showNotification('error', 'Erreur lors du blocage');
    }
  };

  const handleActivate = async () => {
    if (!space) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur activation');

      showNotification('success', 'Espace activé avec succès');
      loadSpaceDetail();
    } catch (err) {
      showNotification('error', 'Erreur lors de l\'activation');
    }
  };

  const handleRenew = async () => {
    if (!space) return;
    const months = prompt('Nombre de mois de renouvellement:', '12');
    if (!months) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/renew`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ months: parseInt(months), auto_generate_invoice: true })
      });

      if (!response.ok) throw new Error('Erreur renouvellement');

      const data = await response.json();
      showNotification('success', `Renouvelé jusqu'au ${new Date(data.newExpiryDate).toLocaleDateString('fr-FR')}`);
      loadSpaceDetail();
    } catch (err) {
      showNotification('error', 'Erreur lors du renouvellement');
    }
  };

  const handleReassign = async () => {
    if (!space) return;
    const clientId = prompt('Nouvel ID client:');
    if (!clientId) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/reassign`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) throw new Error('Erreur réassignation');

      showNotification('success', 'Espace réassigné avec succès');
      loadSpaceDetail();
    } catch (err) {
      showNotification('error', 'Erreur lors de la réassignation');
    }
  };

  const handleDelete = async () => {
    if (!space) return;
    if (!confirm('⚠️ SUPPRIMER DÉFINITIVEMENT cet espace et tous ses fichiers ? Cette action est irréversible.')) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur suppression');

      showNotification('success', 'Espace supprimé avec succès');
      setTimeout(() => router.push('/dashboard/admin/storage'), 1500);
    } catch (err) {
      showNotification('error', 'Erreur lors de la suppression');
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatFCFA = (amount?: number) => {
    if (!amount) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('success', 'Copié dans le presse-papier');
  };

  useEffect(() => {
    loadSpaceDetail();
  }, [spaceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des détails...</p>
        </div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <FiAlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{error || 'Espace non trouvé'}</h3>
          <p className="text-gray-600 mb-6">L'espace demandé n'existe pas ou a été supprimé.</p>
          <button
            onClick={() => router.push('/dashboard/admin/storage')}
            className="px-6 py-3 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)]"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  // Calculs sécurisés
  const daysLeft = space.expires_at 
    ? Math.ceil((new Date(space.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
  const usagePercent = space.usage_percentage || 0;
  const currentUsage = space.current_usage_bytes || 0;
  const sizeLimit = space.size_limit_bytes || 0;

  return (
    <div className="space-y-6 p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center justify-between max-w-md animate-slideIn ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border-l-4 border-green-500'
            : 'bg-red-50 text-red-800 border-l-4 border-red-500'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <FiCheck className="h-5 w-5 mr-3" />
            ) : (
              <FiAlertCircle className="h-5 w-5 mr-3" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="ml-4 hover:opacity-75">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FiArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Détail de l'espace de stockage</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <span>ID: {space.id?.substring(0, 8) || ''}...{space.id?.substring(space.id.length - 4) || ''}</span>
            <button
              onClick={() => copyToClipboard(space.id)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Copier l'ID complet"
            >
              <FiCopy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiMoreVertical className="h-5 w-5" />
          </button>
          {showActions && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  setShowActions(false);
                  router.push(`/dashboard/admin/storage/${spaceId}/edit`);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FiEdit2 className="h-4 w-4" />
                Modifier
              </button>
              <button
                onClick={() => {
                  setShowActions(false);
                  router.push(`/dashboard/admin/storage/${spaceId}/files`);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FiFolder className="h-4 w-4" />
                Voir les fichiers
              </button>
              <button
                onClick={() => {
                  setShowActions(false);
                  router.push(`/dashboard/invoices/new?spaceId=${spaceId}`);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FiFileText className="h-4 w-4" />
                Nouvelle facture
              </button>
              <button
                onClick={() => {
                  setShowActions(false);
                  handleReassign();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FiUsers className="h-4 w-4" />
                Réassigner
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={() => {
                  setShowActions(false);
                  handleDelete();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <FiTrash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Statuts */}
      <div className="flex flex-wrap gap-2">
        <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
          space.is_active && !space.is_expired && !space.is_blocked
            ? 'bg-green-100 text-green-800'
            : space.is_blocked
            ? 'bg-red-100 text-red-800'
            : space.is_expired
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {space.is_blocked ? <FiLock className="h-4 w-4" /> : space.is_expired ? <FiClock className="h-4 w-4" /> : <FiCheck className="h-4 w-4" />}
          {space.is_blocked ? 'Bloqué' : space.is_expired ? 'Expiré' : 'Actif'}
        </span>
        {isExpiringSoon && !space.is_expired && (
          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium flex items-center gap-1">
            <FiAlertCircle className="h-4 w-4" />
            Expire dans {daysLeft} jours
          </span>
        )}
        {space.auto_renew && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex items-center gap-1">
            <FiRefreshCw className="h-4 w-4" />
            Auto-renouvellement
          </span>
        )}
      </div>

      {/* Informations client */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FiUser className="text-[var(--primary-green)]" />
          Informations client
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Nom / Société</p>
            <p className="font-medium">{space.company_name || space.email || 'Non renseigné'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Email</p>
            <p className="font-medium flex items-center gap-2">
              <FiMail className="h-4 w-4 text-gray-400" />
              {space.email || space.client_email || 'Non renseigné'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">ID Client</p>
            <p className="font-mono text-sm">{space.client_id}</p>
          </div>
        </div>
      </div>

      {/* Détails de l'espace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiHardDrive className="text-[var(--primary-green)]" />
            Stockage
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Utilisation</span>
                <span className="font-medium">{formatBytes(currentUsage)} / {formatBytes(sizeLimit)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    usagePercent >= 90 ? 'bg-red-500' :
                    usagePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                ></div>
              </div>
              <p className="text-right text-sm text-gray-500 mt-1">
                {usagePercent.toFixed(1)}% utilisé
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Espace total</p>
                <p className="text-xl font-bold text-gray-900">{formatBytes(sizeLimit)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Espace libre</p>
                <p className="text-xl font-bold text-green-600">{formatBytes(sizeLimit - currentUsage)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiCalendar className="text-[var(--primary-green)]" />
            Dates et expiration
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Créé le</span>
              <span className="font-medium">{space.created_at ? format(new Date(space.created_at), 'dd/MM/yyyy à HH:mm') : 'N/A'}</span>
            </div>
            {space.activated_at && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Activé le</span>
                <span className="font-medium">{format(new Date(space.activated_at), 'dd/MM/yyyy à HH:mm')}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Dernière mise à jour</span>
              <span className="font-medium">{space.updated_at ? formatDistanceToNow(new Date(space.updated_at), { addSuffix: true, locale: fr }) : 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Expire le</span>
              <span className={`font-medium ${space.is_expired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : ''}`}>
                {space.expires_at ? format(new Date(space.expires_at), 'dd/MM/yyyy') : 'N/A'}
                {!space.is_expired && space.expires_at && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({daysLeft} jours)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Commande et facturation */}
      {(space.order_number || space.amount_fcfa || space.offer_name) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiCreditCard className="text-[var(--primary-green)]" />
            Commande et facturation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {space.order_number && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Commande</p>
                <p className="font-medium">{space.order_number}</p>
              </div>
            )}
            {space.invoice_number && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Facture</p>
                <p className="font-medium">{space.invoice_number}</p>
              </div>
            )}
            {space.amount_fcfa && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Montant</p>
                <p className="font-medium text-[var(--primary-green)]">{formatFCFA(space.amount_fcfa)}</p>
              </div>
            )}
            {space.offer_name && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Offre</p>
                <p className="font-medium">{space.offer_name}</p>
                {space.storage_gb && <p className="text-xs text-gray-500">{space.storage_gb} Go</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/dashboard/admin/storage/${spaceId}/edit`)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
          >
            <FiEdit2 className="h-4 w-4" />
            Modifier
          </button>

          <button
            onClick={() => router.push(`/dashboard/admin/storage/${spaceId}/files`)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 transition-colors"
          >
            <FiFolder className="h-4 w-4" />
            Voir les fichiers
          </button>

          <button
            onClick={() => router.push(`/dashboard/invoices/new?spaceId=${spaceId}`)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors"
          >
            <FiFileText className="h-4 w-4" />
            Nouvelle facture
          </button>

          <button
            onClick={handleRenew}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center gap-2 transition-colors"
          >
            <FiRefreshCw className="h-4 w-4" />
            Renouveler
          </button>

          {!space.is_blocked ? (
            <button
              onClick={handleBlock}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2 transition-colors"
            >
              <FiLock className="h-4 w-4" />
              Bloquer
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors"
            >
              <FiUnlock className="h-4 w-4" />
              Débloquer
            </button>
          )}

          <button
            onClick={handleReassign}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2 transition-colors"
          >
            <FiUsers className="h-4 w-4" />
            Réassigner
          </button>
        </div>
      </div>
    </div>
  );
}
