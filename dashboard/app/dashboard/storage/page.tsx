'use client';

import { useState, useEffect } from 'react';
import {
  FiHardDrive,
  FiUpload,
  FiDownload,
  FiTrash2,
  FiEye,
  FiRefreshCw,
  FiPlus,
  FiUser,
  FiCalendar,
  FiFile,
  FiLock,
  FiUnlock,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiSearch,
  FiFilter
} from 'react-icons/fi';
import { format, formatDistanceToNow, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';

// Types
interface StorageSpace {
  id: string;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  size_limit_bytes: number;
  current_usage_bytes: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface StorageFile {
  name: string;
  size: number;
  modified: string;
}

interface Client {
  id: string;
  company_name: string;
  email: string;
}

export default function StorageManagementPage() {
  const [spaces, setSpaces] = useState<StorageSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<StorageSpace | null>(null);
  const [spaceFiles, setSpaceFiles] = useState<StorageFile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({
    client_id: '',
    is_active: '',
    is_expired: '',
    search: ''
  });

  const [editData, setEditData] = useState({
    size_gb: 5,
    expires_at: ''
  });

  const [renewData, setRenewData] = useState({
    months: 12
  });

  const [reassignData, setReassignData] = useState({
    client_id: ''
  });

  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Configuration
  const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin.replace('dashboard', 'api') : '';

  const getToken = () => {
  if (typeof window !== 'undefined') {
    const token = Cookies.get('token');
    console.log('[StoragePage] Token récupéré depuis cookie :', token ? `OUI (${token.substring(0, 10)}...)` : 'NON');
    return token || '';
  }
  return '';
};

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Charger les espaces de stockage
  const loadSpaces = async () => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/client/admin/storage`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        showNotification('error', 'Session expirée');
        return;
      }

      if (!response.ok) {
        throw new Error('Erreur de chargement');
      }

      const result = await response.json();
      setSpaces(result.spaces || result.data || []);
    } catch (error) {
      console.error('Erreur:', error);
      showNotification('error', 'Erreur lors du chargement des espaces');
    } finally {
      setLoading(false);
    }
  };

  // Charger les clients
  const loadClients = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/v1/clients`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setClients(result);
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  // Charger les fichiers d'un espace
  const loadSpaceFiles = async (spaceId: string) => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/v1/client/storage/${spaceId}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSpaceFiles(result.files || []);
      }
    } catch (error) {
      console.error('Erreur chargement fichiers:', error);
      setSpaceFiles([]);
    }
  };

  // Mettre à jour la taille
  const handleUpdateSize = async () => {
    if (!selectedSpace) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/client/admin/storage/${selectedSpace.id}/size`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          size_gb: editData.size_gb
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour');
      }

      showNotification('success', 'Taille mise à jour avec succès');
      setShowEditModal(false);
      loadSpaces();
    } catch (error) {
      showNotification('error', 'Erreur lors de la mise à jour');
      console.error('Erreur mise à jour:', error);
    }
  };

  // Mettre à jour l'expiration
  const handleUpdateExpiration = async () => {
    if (!selectedSpace) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/client/admin/storage/${selectedSpace.id}/expiration`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expires_at: editData.expires_at
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour');
      }

      showNotification('success', 'Date d\'expiration mise à jour');
      setShowEditModal(false);
      loadSpaces();
    } catch (error) {
      showNotification('error', 'Erreur lors de la mise à jour');
      console.error('Erreur mise à jour:', error);
    }
  };

  // Renouveler l'abonnement
  const handleRenew = async () => {
    if (!selectedSpace) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/client/admin/storage/${selectedSpace.id}/renew`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          months: renewData.months
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors du renouvellement');
      }

      showNotification('success', `Abonnement renouvelé de ${renewData.months} mois`);
      setShowRenewModal(false);
      loadSpaces();
    } catch (error) {
      showNotification('error', 'Erreur lors du renouvellement');
      console.error('Erreur renouvellement:', error);
    }
  };

  // Réassigner l'espace
  const handleReassign = async () => {
    if (!selectedSpace) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/client/admin/storage/${selectedSpace.id}/reassign`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: reassignData.client_id
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la réassignation');
      }

      showNotification('success', 'Espace réassigné avec succès');
      setShowReassignModal(false);
      loadSpaces();
    } catch (error) {
      showNotification('error', 'Erreur lors de la réassignation');
      console.error('Erreur réassignation:', error);
    }
  };

  // Bloquer/Activer l'espace
  const handleToggleActive = async (spaceId: string, activate: boolean) => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const endpoint = activate ? 'activate' : 'block';
      const response = await fetch(`${API_BASE_URL}/api/v1/client/admin/storage/${spaceId}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'opération');
      }

      showNotification('success', `Espace ${activate ? 'activé' : 'bloqué'} avec succès`);
      loadSpaces();
    } catch (error) {
      showNotification('error', 'Erreur lors de l\'opération');
      console.error('Erreur toggle:', error);
    }
  };

  // Uploader un fichier
  const handleFileUpload = async (file: File) => {
    if (!selectedSpace) return;

    try {
      setUploading(true);
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/v1/client/storage/${selectedSpace.id}/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'upload');
      }

      showNotification('success', 'Fichier uploadé avec succès');
      loadSpaceFiles(selectedSpace.id);
    } catch (error) {
      showNotification('error', 'Erreur lors de l\'upload');
      console.error('Erreur upload:', error);
    } finally {
      setUploading(false);
    }
  };

  // Télécharger un fichier
  const handleDownload = async (filename: string) => {
    if (!selectedSpace) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/client/storage/${selectedSpace.id}/files/${filename}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showNotification('error', 'Erreur lors du téléchargement');
      console.error('Erreur download:', error);
    }
  };

  // Supprimer un fichier
  const handleDeleteFile = async (filename: string) => {
    if (!selectedSpace || !confirm('Supprimer ce fichier ?')) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/client/storage/${selectedSpace.id}/files/${filename}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      showNotification('success', 'Fichier supprimé avec succès');
      loadSpaceFiles(selectedSpace.id);
    } catch (error) {
      showNotification('error', 'Erreur lors de la suppression');
      console.error('Erreur suppression:', error);
    }
  };

  // Formater la taille
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calculer le pourcentage d'utilisation
  const calculateUsagePercentage = (space: StorageSpace) => {
    return (space.current_usage_bytes / space.size_limit_bytes) * 100;
  };

  // Vérifier si expiré
  const isExpired = (space: StorageSpace) => {
    if (!space.expires_at) return false;
    return new Date(space.expires_at) < new Date();
  };

  // Filtrer les espaces
  const filteredSpaces = spaces.filter(space => {
    if (filters.client_id && space.client_id !== filters.client_id) return false;
    if (filters.is_active && space.is_active !== (filters.is_active === 'true')) return false;
    if (filters.is_expired === 'true' && !isExpired(space)) return false;
    if (filters.is_expired === 'false' && isExpired(space)) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        space.client_name?.toLowerCase().includes(search) ||
        space.client_email?.toLowerCase().includes(search) ||
        space.id.toLowerCase().includes(search)
      );
    }
    return true;
  });

  useEffect(() => {
    loadSpaces();
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedSpace && showDetailModal) {
      loadSpaceFiles(selectedSpace.id);
    }
  }, [selectedSpace, showDetailModal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des espaces de stockage...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg ${
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
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FiHardDrive className="text-[var(--primary-green)]" />
            Gestion du Stockage
          </h1>
          <p className="text-gray-600 mt-1">
            Gestion des espaces de stockage et des fichiers clients
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { loadSpaces(); loadClients(); }}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={filters.client_id}
              onChange={(e) => setFilters({...filters, client_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
            >
              <option value="">Tous les clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filters.is_active}
              onChange={(e) => setFilters({...filters, is_active: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
            >
              <option value="">Tous les statuts</option>
              <option value="true">Actif</option>
              <option value="false">Bloqué</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiration</label>
            <select
              value={filters.is_expired}
              onChange={(e) => setFilters({...filters, is_expired: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
            >
              <option value="">Tous</option>
              <option value="true">Expirés</option>
              <option value="false">Non expirés</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Client, email, ID..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiHardDrive className="mr-2" />
            Espaces de stockage
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {spaces.length}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {spaces.filter(s => s.is_active && !isExpired(s)).length} actifs
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiUser className="mr-2" />
            Capacité totale
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatBytes(spaces.reduce((sum, s) => sum + s.size_limit_bytes, 0))}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Total alloué
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiFile className="mr-2" />
            Espace utilisé
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatBytes(spaces.reduce((sum, s) => sum + s.current_usage_bytes, 0))}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {Math.round((spaces.reduce((sum, s) => sum + s.current_usage_bytes, 0) / spaces.reduce((sum, s) => sum + s.size_limit_bytes, 0)) * 100) || 0}% d'utilisation
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiCalendar className="mr-2" />
            Expirations
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {spaces.filter(isExpired).length}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Espaces expirés
          </div>
        </div>
      </div>

      {/* Tableau des espaces */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Liste des espaces ({filteredSpaces.length})
          </h3>
          <div className="text-sm text-gray-500">
            {spaces.length} espaces au total
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisation
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiration
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé le
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSpaces.map((space) => {
                const expired = isExpired(space);
                const usagePercent = calculateUsagePercentage(space);
                return (
                  <tr key={space.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {space.client_name ? (
                        <div className="flex flex-col">
                          <div className="font-medium text-gray-900">{space.client_name}</div>
                          <div className="text-sm text-gray-500">{space.client_email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Non assigné</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{formatBytes(space.current_usage_bytes)}</span>
                          <span className="text-gray-500"> / {formatBytes(space.size_limit_bytes)}</span>
                        </div>
                        <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${
                              usagePercent >= 90 ? 'bg-red-500' :
                              usagePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {Math.round(usagePercent)}% utilisé
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {space.expires_at ? (
                        <div className="flex flex-col">
                          <div className={`text-sm font-medium ${
                            expired ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {format(new Date(space.expires_at), 'dd/MM/yyyy')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {expired ? 'Expiré' : formatDistanceToNow(new Date(space.expires_at), { addSuffix: true, locale: fr })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Illimité</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          space.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {space.is_active ? 'Actif' : 'Bloqué'}
                        </span>
                        {expired && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Expiré
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(space.created_at), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedSpace(space);
                            setShowDetailModal(true);
                          }}
                          className="p-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Voir détails"
                        >
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSpace(space);
                            setEditData({
                              size_gb: Math.round(space.size_limit_bytes / (1024 * 1024 * 1024)),
                              expires_at: space.expires_at ? format(new Date(space.expires_at), 'yyyy-MM-dd') : ''
                            });
                            setShowEditModal(true);
                          }}
                          className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                          title="Modifier"
                        >
                          <FiCalendar className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(space.id, !space.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            space.is_active
                              ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                          title={space.is_active ? 'Bloquer' : 'Activer'}
                        >
                          {space.is_active ? <FiLock className="h-4 w-4" /> : <FiUnlock className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Détails */}
      {showDetailModal && selectedSpace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Détails de l'espace de stockage</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Informations */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Informations</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Client:</span>
                        <span className="font-medium">{selectedSpace.client_name || 'Non assigné'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{selectedSpace.client_email || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID Espace:</span>
                        <span className="font-mono text-sm">{selectedSpace.id}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Stockage</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Utilisé:</span>
                        <span className="font-medium">{formatBytes(selectedSpace.current_usage_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Limite:</span>
                        <span className="font-medium">{formatBytes(selectedSpace.size_limit_bytes)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                        <div
                          className={`h-4 rounded-full ${
                            calculateUsagePercentage(selectedSpace) >= 90 ? 'bg-red-500' :
                            calculateUsagePercentage(selectedSpace) >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(calculateUsagePercentage(selectedSpace), 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-center text-sm text-gray-500">
                        {Math.round(calculateUsagePercentage(selectedSpace))}% utilisé
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Actions Rapides</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setShowEditModal(true);
                          setShowDetailModal(false);
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => {
                          setShowRenewModal(true);
                          setShowDetailModal(false);
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Renouveler
                      </button>
                      <button
                        onClick={() => {
                          setShowReassignModal(true);
                          setShowDetailModal(false);
                        }}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        Réassigner
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fichiers */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Fichiers ({spaceFiles.length})</h4>

                  {/* Upload */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Uploader un fichier
                    </label>
                    <input
                      type="file"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                      disabled={uploading || isExpired(selectedSpace) || !selectedSpace.is_active}
                      className="w-full"
                    />
                    {uploading && (
                      <div className="mt-2 text-sm text-blue-600">Upload en cours...</div>
                    )}
                  </div>

                  {/* Liste des fichiers */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {spaceFiles.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Aucun fichier
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {spaceFiles.map((file) => (
                          <div key={file.name} className="p-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{file.name}</div>
                              <div className="text-sm text-gray-500">
                                {formatBytes(file.size)} • modifié {formatDistanceToNow(new Date(file.modified), { addSuffix: true, locale: fr })}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handleDownload(file.name)}
                                className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                                title="Télécharger"
                              >
                                <FiDownload className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFile(file.name)}
                                className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                                title="Supprimer"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Édition */}
      {showEditModal && selectedSpace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Modifier l'espace</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Taille (Go)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={editData.size_gb}
                    onChange={(e) => setEditData({...editData, size_gb: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'expiration
                  </label>
                  <input
                    type="date"
                    value={editData.expires_at}
                    onChange={(e) => setEditData({...editData, expires_at: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      handleUpdateSize();
                      if (editData.expires_at) {
                        handleUpdateExpiration();
                      }
                    }}
                    className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Renouvellement */}
      {showRenewModal && selectedSpace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Renouveler l'abonnement</h3>
                <button
                  onClick={() => setShowRenewModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Renouveler l'espace pour le client: <span className="font-bold">{selectedSpace.client_name || 'Non assigné'}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de mois
                  </label>
                  <select
                    value={renewData.months}
                    onChange={(e) => setRenewData({ months: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  >
                    <option value="1">1 mois</option>
                    <option value="3">3 mois</option>
                    <option value="6">6 mois</option>
                    <option value="12">12 mois</option>
                    <option value="24">24 mois</option>
                  </select>
                </div>

                <div className="text-sm text-gray-600">
                  <p>Nouvelle date d'expiration:</p>
                  <p className="font-bold">
                    {selectedSpace.expires_at
                      ? format(addMonths(new Date(selectedSpace.expires_at), renewData.months), 'dd/MM/yyyy')
                      : format(addMonths(new Date(), renewData.months), 'dd/MM/yyyy')}
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowRenewModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleRenew}
                    className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors"
                  >
                    Renouveler
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réassignation */}
      {showReassignModal && selectedSpace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Réassigner l'espace</h3>
                <button
                  onClick={() => setShowReassignModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Réassigner l'espace actuellement assigné à: <span className="font-bold">{selectedSpace.client_name || 'Non assigné'}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nouveau client
                  </label>
                  <select
                    value={reassignData.client_id}
                    onChange={(e) => setReassignData({ client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  >
                    <option value="">Non assigné (libérer l'espace)</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowReassignModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReassign}
                    className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors"
                  >
                    Réassigner
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
