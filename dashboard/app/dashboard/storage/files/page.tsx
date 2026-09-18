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
  FiFile
} from 'react-icons/fi';
import Cookies from 'js-cookie';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FileInfo {
  name: string;
  size: number;
  sizeFormatted: string;
  modified: string;
  uploadedAt?: string;
  downloadCount: number;
  mimeType?: string;
}

interface SpaceInfo {
  id: string;
  usedFormatted: string;
  limitFormatted: string;
  usagePercentage: number;
}

export default function StorageFilesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [spaceInfo, setSpaceInfo] = useState<SpaceInfo | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';
  
  const getToken = () => Cookies.get('token') || '';

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      // Récupérer l'abonnement pour avoir l'ID de l'espace
      const subResponse = await fetch(`${API_BASE_URL}/storage/subscription`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (subResponse.status === 404) {
        router.push('/dashboard/storage/offers');
        return;
      }

      const subData = await subResponse.json();
      const spaceId = subData.subscription?.id;

      if (!spaceId) {
        throw new Error('Aucun espace trouvé');
      }

      // Charger les fichiers
      const filesResponse = await fetch(`${API_BASE_URL}/storage/client/storage/${spaceId}`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);
      setSpaceInfo(filesData.space);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const token = getToken();
      const spaceId = spaceInfo?.id;
      if (!spaceId) return;

      const response = await fetch(
        `${API_BASE_URL}/storage/client/storage/${spaceId}/files/${encodeURIComponent(filename)}`,
        {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Erreur téléchargement');

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

  const handleDelete = async (filename: string) => {
    if (!confirm('Supprimer ce fichier définitivement ?')) return;

    try {
      const token = getToken();
      const spaceId = spaceInfo?.id;
      if (!spaceId) return;

      const response = await fetch(
        `${API_BASE_URL}/storage/client/storage/${spaceId}/files/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Erreur suppression');

      showNotification('success', 'Fichier supprimé');
      loadFiles();
    } catch (err) {
      showNotification('error', 'Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des fichiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FiHardDrive className="text-[var(--primary-green)]" />
            Gestion des fichiers
          </h1>
          <p className="text-gray-600 mt-1">
            {spaceInfo && `Utilisation: ${spaceInfo.usedFormatted} / ${spaceInfo.limitFormatted} (${Math.round(spaceInfo.usagePercentage)}%)`}
          </p>
        </div>
        <button
          onClick={loadFiles}
          className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Liste des fichiers */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Mes fichiers ({files.length})
          </h3>
        </div>

        {files.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FiFolder className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Aucun fichier</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
              <div key={file.name} className="p-4 flex items-center hover:bg-gray-50">
                <FiFile className="h-5 w-5 text-gray-400 mr-3" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    {file.sizeFormatted} • 
                    Modifié {formatDistanceToNow(new Date(file.modified), { addSuffix: true, locale: fr })}
                    {file.downloadCount > 0 && ` • ${file.downloadCount} téléchargement(s)`}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleDownload(file.name)}
                    className="p-2 text-gray-600 hover:text-[var(--primary-green)]"
                    title="Télécharger"
                  >
                    <FiDownload className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(file.name)}
                    className="p-2 text-gray-600 hover:text-red-500"
                    title="Supprimer"
                  >
                    <FiTrash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
