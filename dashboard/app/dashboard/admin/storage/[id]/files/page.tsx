// app/dashboard/admin/storage/[id]/files/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FiHardDrive,
  FiArrowLeft,
  FiDownload,
  FiTrash2,
  FiEye,
  FiRefreshCw,
  FiFile,
  FiImage,
  FiArchive,
  FiVideo,
  FiMusic,
  FiCode,
  FiFileText,
  FiSearch,
  FiFilter,
  FiUpload,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiMoreVertical,
  FiCalendar,
  FiUser
} from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';

interface File {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by: string;
  download_count: number;
  last_downloaded: string | null;
  space_id: string;
  is_deleted: boolean;
}

interface SpaceInfo {
  id: string;
  company_name: string;
  email: string;
  size_limit_bytes: number;
  current_usage_bytes: number;
  usage_percentage: number;
}

export default function SpaceFilesPage() {
  const router = useRouter();
  const params = useParams();
  const spaceId = params.id as string;

  const [files, setFiles] = useState<File[]>([]);
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

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

  const loadData = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      // Charger les infos de l'espace
      const spaceRes = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Charger les fichiers
      const filesRes = await fetch(`${API_BASE_URL}/admin/storage/${spaceId}/files`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!spaceRes.ok || !filesRes.ok) throw new Error('Erreur chargement');

      const spaceData = await spaceRes.json();
      const filesData = await filesRes.json();

      setSpace(spaceData.space);
      setFiles(filesData.files || []);
    } catch (err) {
      showNotification('error', 'Erreur lors du chargement');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const token = getToken();

      const formData = new FormData();
      formData.append('file', file);

      // Route: /api/v1/admin/storage/space/:spaceId/upload
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Erreur upload');

      showNotification('success', 'Fichier uploadé avec succès');
      loadData();
    } catch (err) {
      showNotification('error', 'Erreur lors de l\'upload');
      console.error(err);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const token = getToken();
      // Route: /api/v1/admin/storage/space/:spaceId/files/:filename
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/files/${encodeURIComponent(filename)}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

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
    if (!confirm('Supprimer ce fichier ?')) return;

    try {
      const token = getToken();
      // Route: /api/v1/admin/storage/space/:spaceId/files/:filename
      const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur suppression');

      showNotification('success', 'Fichier supprimé');
      loadData();
    } catch (err) {
      showNotification('error', 'Erreur lors de la suppression');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    if (!confirm(`Supprimer ${selectedFiles.length} fichier(s) ?`)) return;

    for (const filename of selectedFiles) {
      await handleDelete(filename);
    }
    setSelectedFiles([]);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FiImage className="h-8 w-8 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <FiVideo className="h-8 w-8 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <FiMusic className="h-8 w-8 text-pink-500" />;
    if (mimeType.includes('pdf')) return <FiFileText className="h-8 w-8 text-red-500" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) 
      return <FiArchive className="h-8 w-8 text-yellow-600" />;
    if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript'))
      return <FiCode className="h-8 w-8 text-green-600" />;
    return <FiFile className="h-8 w-8 text-gray-500" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(file => 
    file.original_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.filename?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadData();
  }, [spaceId]);

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des fichiers</h1>
          {space && (
            <p className="text-gray-600 text-sm">
              {space.company_name || space.email} • {formatBytes(space.current_usage_bytes)} / {formatBytes(space.size_limit_bytes)} utilisé
            </p>
          )}
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un fichier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
            />
          </div>
          <div className="flex gap-2">
            <label className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] cursor-pointer flex items-center gap-2">
              <FiUpload className="h-4 w-4" />
              Uploader
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {selectedFiles.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
              >
                <FiTrash2 className="h-4 w-4" />
                Supprimer ({selectedFiles.length})
              </button>
            )}
            <button
              onClick={loadData}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiRefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
        {uploading && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            Upload en cours...
          </div>
        )}
      </div>

      {/* Liste des fichiers */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FiFile className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun fichier</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm ? 'Aucun fichier ne correspond à votre recherche' : 'Cet espace ne contient pas encore de fichiers'}
          </p>
          {!searchTerm && (
            <label className="inline-flex items-center px-6 py-3 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] cursor-pointer gap-2">
              <FiUpload className="h-5 w-5" />
              Uploader un fichier
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id || file.filename}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative group"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.filename)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFiles([...selectedFiles, file.filename]);
                    } else {
                      setSelectedFiles(selectedFiles.filter(f => f !== file.filename));
                    }
                  }}
                  className="absolute top-2 left-2 h-4 w-4 text-[var(--primary-green)] rounded"
                />
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3">
                    {getFileIcon(file.mime_type)}
                  </div>
                  <div className="w-full truncate font-medium text-gray-900 mb-1" title={file.original_filename || file.filename}>
                    {file.original_filename || file.filename}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {formatBytes(file.file_size)}
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    {formatDistanceToNow(new Date(file.uploaded_at), { addSuffix: true, locale: fr })}
                  </div>
                  <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => window.open(`${API_BASE_URL}/admin/storage/space/${spaceId}/files/${encodeURIComponent(file.filename)}?token=${getToken()}`, '_blank')}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                      title="Voir"
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(file.filename)}
                      className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                      title="Télécharger"
                    >
                      <FiDownload className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.filename)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                      title="Supprimer"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
