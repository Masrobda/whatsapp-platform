// app/dashboard/storage/space/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiHardDrive,
  FiUpload,
  FiDownload,
  FiTrash2,
  FiRefreshCw,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiFolder,
  FiFile,
  FiCalendar,
  FiInfo
} from 'react-icons/fi';
import Cookies from 'js-cookie';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SpaceInfo {
  id: string;
  clientName?: string;
  clientEmail?: string;
  isActive: boolean;
  isExpired: boolean;
  isBlocked: boolean;
  expiresAt?: string;
  limit: number;
  limitFormatted: string;
  used: number;
  usedFormatted: string;
  usagePercentage: number;
  free: number;
  freeFormatted: string;
}

interface FileInfo {
  name: string;
  size: number;
  sizeFormatted: string;
  modified: string;
  uploadedAt?: string;
  downloadCount: number;
  mimeType?: string;
  publicToken?: string;
  publicUrl?: string;
}

export default function StorageSpacePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spaceInfo, setSpaceInfo] = useState<SpaceInfo | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [deletingAll, setDeletingAll] = useState(false);

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const router = useRouter();

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

  // Charger les informations de l'espace
  const loadSpaceInfo = async () => {
    try {
      setRefreshing(true);
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      // D'abord, récupérer l'abonnement pour avoir l'ID de l'espace
      const subResponse = await fetch(`${API_BASE_URL}/storage/subscription`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (subResponse.status === 404) {
        router.push('/dashboard/storage/offers');
        return;
      }

      if (!subResponse.ok) {
        throw new Error('Erreur de chargement');
      }

      const subData = await subResponse.json();
      const spaceId = subData.subscription?.id;

      if (!spaceId) {
        throw new Error('Aucun espace trouvé');
      }

      // Charger les détails de l'espace
      const spaceResponse = await fetch(`${API_BASE_URL}/storage/client/storage/${spaceId}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!spaceResponse.ok) {
        throw new Error('Erreur chargement espace');
      }

      const spaceData = await spaceResponse.json();

      setSpaceInfo(spaceData.space);
      setFiles(spaceData.files || []);
      // Réinitialiser la page lors du rechargement
      setCurrentPage(1);

    } catch (err: any) {
      console.error('Erreur:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Upload de fichier
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !spaceInfo) return;

    // Vérifier les limitations
    if (spaceInfo.usagePercentage >= 100) {
      showNotification('error', 'Espace de stockage saturé');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      showNotification('error', 'Fichier trop volumineux (max 500 Mo)');
      return;
    }

    if (spaceInfo.free < file.size) {
      showNotification('error', 'Espace insuffisant pour ce fichier');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch(`${API_BASE_URL}/storage/client/storage/${spaceInfo.id}/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur upload');
      }

      showNotification('success', 'Fichier uploadé avec succès');
      setTimeout(() => {
        loadSpaceInfo();
        setUploadProgress(0);
      }, 500);

    } catch (err: any) {
      showNotification('error', err.message);
      setUploadProgress(0);
    } finally {
      setTimeout(() => {
        setUploading(false);
      }, 1000);
    }
  };

  // Télécharger fichier
  const handleDownload = async (filename: string) => {
    if (!spaceInfo) return;

    try {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/storage/client/storage/${spaceInfo.id}/files/${encodeURIComponent(filename)}`,
        {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur téléchargement');
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

    } catch (err) {
      showNotification('error', 'Erreur lors du téléchargement');
    }
  };

  // Supprimer fichier
  const handleDelete = async (filename: string) => {
    if (!confirm('Supprimer ce fichier définitivement ?')) return;
    if (!spaceInfo) return;

    try {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/storage/client/storage/${spaceInfo.id}/files/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur suppression');
      }

      showNotification('success', 'Fichier supprimé');
      loadSpaceInfo();

    } catch (err) {
      showNotification('error', 'Erreur lors de la suppression');
    }
  };

  // Supprimer tous les fichiers d'un coup
  const handleDeleteAll = async () => {
    if (!spaceInfo) return;
    if (files.length === 0) return;

    if (!confirm(`Supprimer TOUS les ${files.length} fichiers définitivement ? Cette action est irréversible.`)) {
      return;
    }

    try {
      setDeletingAll(true);
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/storage/client/storage/${spaceInfo.id}/delete-all-files`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la suppression');
      }

      const result = await response.json();
      showNotification('success', result.message || 'Tous les fichiers ont été supprimés');
      setSelectedFiles([]);
      loadSpaceInfo();

    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setDeletingAll(false);
    }
  };

  // Supprimer plusieurs fichiers
  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    if (!confirm(`Supprimer ${selectedFiles.length} fichier(s) ?`)) return;

    for (const filename of selectedFiles) {
      await handleDelete(filename);
    }
    setSelectedFiles([]);
  };

  useEffect(() => {
    loadSpaceInfo();
  }, []);

  // --- Tri et pagination ---
  const sortedFiles = [...files].sort((a, b) => {
    // Trier par uploadedAt si disponible, sinon par modified (du plus récent au plus ancien)
    const dateA = a.uploadedAt ? new Date(a.uploadedAt) : new Date(a.modified);
    const dateB = b.uploadedAt ? new Date(b.uploadedAt) : new Date(b.modified);
    return dateB.getTime() - dateA.getTime();
  });

  const totalPages = Math.ceil(sortedFiles.length / ITEMS_PER_PAGE);
  const paginatedFiles = sortedFiles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (error || !spaceInfo) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <FiAlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur</h3>
          <p className="text-gray-600 mb-6">{error || 'Espace non trouvé'}</p>
          <button
            onClick={() => router.push('/dashboard/storage/offers')}
            className="px-6 py-3 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)]"
          >
            Voir les offres
          </button>
        </div>
      </div>
    );
  }

  const isExpired = spaceInfo.isExpired;
  const isBlocked = spaceInfo.isBlocked;
  const canUpload = spaceInfo.isActive && !isExpired && !isBlocked && spaceInfo.usagePercentage < 100;

  return (
    <div className="space-y-6">
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FiHardDrive className="text-[var(--primary-green)]" />
            Mon Espace de Stockage
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez vos fichiers en toute sécurité
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadSpaceInfo}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => router.push('/dashboard/storage/subscription')}
            className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)]"
          >
            Gérer l'abonnement
          </button>
        </div>
      </div>

      {/* Alertes */}
      {isExpired && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <FiAlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-red-800">
                Votre abonnement a expiré
              </h5>
              <p className="text-sm text-red-700 mt-1">
                Vos données seront conservées jusqu'au {spaceInfo.expiresAt ? format(new Date(spaceInfo.expiresAt), 'dd/MM/yyyy') : 'à déterminer'}.
                Renouvelez votre abonnement pour continuer à accéder à vos fichiers.
              </p>
              <button
                onClick={() => router.push('/dashboard/storage/subscription')}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Renouveler maintenant
              </button>
            </div>
          </div>
        </div>
      )}

      {isBlocked && !isExpired && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <FiAlertCircle className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-yellow-800">
                Espace bloqué
              </h5>
              <p className="text-sm text-yellow-700 mt-1">
                Votre espace a été bloqué par l'administration. Contactez le support pour plus d'informations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiHardDrive className="mr-2" />
            Utilisation
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-2">
            {spaceInfo.usedFormatted} / {spaceInfo.limitFormatted}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                spaceInfo.usagePercentage >= 90 ? 'bg-red-500' :
                spaceInfo.usagePercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(spaceInfo.usagePercentage, 100)}%` }}
            ></div>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            {Math.round(spaceInfo.usagePercentage)}% utilisé
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiFile className="mr-2" />
            Fichiers
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {files.length}
          </div>
          <div className="text-sm text-gray-500">
            {files.length === 1 ? 'fichier' : 'fichiers'} stockés
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiCalendar className="mr-2" />
            Expiration
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {spaceInfo.expiresAt ? format(new Date(spaceInfo.expiresAt), 'dd/MM/yyyy') : 'N/A'}
          </div>
          <div className="text-sm text-gray-500">
            {spaceInfo.expiresAt && !isExpired && (
              <span>
                {Math.ceil((new Date(spaceInfo.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} jours restants
              </span>
            )}
            {isExpired && <span className="text-red-500">Expiré</span>}
          </div>
        </div>
      </div>

      {/* Zone d'upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Uploader un fichier
        </h3>

        {!canUpload ? (
          <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
            {isExpired && "L'upload est désactivé car votre abonnement a expiré"}
            {isBlocked && "L'upload est désactivé car votre espace est bloqué"}
            {!isExpired && !isBlocked && spaceInfo.usagePercentage >= 100 && "Espace saturé. Libérez de l'espace ou augmentez votre quota."}
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-[var(--primary-green)] file:text-white
                  hover:file:bg-[var(--primary-green-dark)]
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </label>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload en cours...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[var(--primary-green)] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Taille maximale par fichier: 500 Mo
            </p>
          </div>
        )}
      </div>

      {/* Liste des fichiers */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Mes fichiers ({files.length})
          </h3>
          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll || !canUpload}
                className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiTrash2 className="h-4 w-4" />
                {deletingAll ? 'Suppression...' : 'Tout supprimer'}
              </button>
            )}
            {selectedFiles.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm flex items-center gap-2"
              >
                <FiTrash2 className="h-4 w-4" />
                Supprimer ({selectedFiles.length})
              </button>
            )}
          </div>
        </div>

        {files.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FiFolder className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Aucun fichier dans cet espace</p>
            <p className="text-sm mt-2">Utilisez la zone d'upload pour ajouter des fichiers</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {paginatedFiles.map((file) => (
                <div key={file.name} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFiles([...selectedFiles, file.name]);
                        } else {
                          setSelectedFiles(selectedFiles.filter(f => f !== file.name));
                        }
                      }}
                      className="mr-4 h-4 w-4 text-[var(--primary-green)] rounded mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <FiFile className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900 truncate">
                            {file.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {file.sizeFormatted} • Modifié{" "}
                            {formatDistanceToNow(new Date(file.modified), {
                              addSuffix: true,
                              locale: fr,
                            })}
                            {file.downloadCount > 0 &&
                              ` • ${file.downloadCount} téléchargement(s)`}
                          </div>
                        </div>
                      </div>
                      {file.publicUrl && (
                        <div className="mt-2 ml-8 flex items-center gap-2 text-sm">
                          <input
                            type="text"
                            readOnly
                            value={file.publicUrl}
                            className="flex-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600"
                          />
                          <button
                            onClick={() => {
                              if (file.publicUrl) {
                                navigator.clipboard.writeText(file.publicUrl);
                                showNotification("success", "Lien copié !");
                              } else {
                                showNotification("error", "Lien public non disponible");
                              }
                            }}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                          >
                            Copier
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleDownload(file.name)}
                        className="p-2 text-gray-600 hover:text-[var(--primary-green)] transition-colors"
                        title="Télécharger"
                      >
                        <FiDownload className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(file.name)}
                        className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <FiTrash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contrôles de pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  {`${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, sortedFiles.length)} sur ${sortedFiles.length}`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Précédent
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Informations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FiInfo className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Bon à savoir</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Vos fichiers sont stockés de manière sécurisée avec chiffrement AES-256</li>
              <li>En cas d'expiration, vous avez 7 jours pour récupérer vos données</li>
              <li>Le renouvellement se fait par virement bancaire (validation manuelle)</li>
              <li>Une facture est générée automatiquement à chaque validation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
