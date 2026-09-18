// /var/www/numericexport/dashboard/app/dashboard/admin/storage/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiHardDrive,
  FiRefreshCw,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiUsers,
  FiCalendar,
  FiDollarSign,
  FiEdit2,
  FiLock,
  FiUnlock,
  FiTrash2,
  FiDownload,
  FiEye,
  FiFolder,
  FiPlus,
  FiSearch,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiZap,
  FiShield,
  FiCopy,
  FiMail,
  FiPhone,
  FiMapPin,
  FiCreditCard,
  FiActivity,
  FiBarChart2,
  FiPieChart,
  FiTrendingUp,
  FiDownloadCloud,
  FiUploadCloud,
  FiSettings,
  FiMoreVertical,
  FiUser,
  FiUserCheck,
  FiUserX,
  FiInfo
} from 'react-icons/fi';
import Cookies from 'js-cookie';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StorageSpace {
  id: string;
  client_id: string;
  company_name?: string;
  client_email?: string;
  client_phone?: string;
  size_limit_bytes: number;
  current_usage_bytes: number;
  usage_percentage: number;
  is_active: boolean;
  is_blocked: boolean;
  is_expired: boolean;
  blocked_reason?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  activated_at?: string;
  deleted_at?: string;
  order_id?: string;
  order_number?: string;
  invoice_number?: string;
  amount_fcfa?: number;
  offer_name?: string;
  storage_gb?: number;
  auto_renew?: boolean;
  file_count?: number;
}

interface Stats {
  total_spaces: number;
  active_spaces: number;
  expired_spaces: number;
  blocked_spaces: number;
  total_storage_gb: number;
  used_storage_gb: number;
  total_revenue: number;
  pending_orders: number;
}

export default function AdminStoragePage() {
  const [spaces, setSpaces] = useState<StorageSpace[]>([]);
  const [filteredSpaces, setFilteredSpaces] = useState<StorageSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const [stats, setStats] = useState<Stats>({
    total_spaces: 0,
    active_spaces: 0,
    expired_spaces: 0,
    blocked_spaces: 0,
    total_storage_gb: 0,
    used_storage_gb: 0,
    total_revenue: 0,
    pending_orders: 0
  });
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at_desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';
  
  const getToken = () => {
    if (typeof window !== 'undefined') {
      return Cookies.get('token') || '';
    }
    return '';
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/admin/storage`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Erreur chargement des espaces');
      }
      
      const data = await response.json();
      
      if (data.success && data.spaces) {
        setSpaces(data.spaces);
        calculateStats(data.spaces);
      } else {
        setSpaces([]);
      }
    } catch (err: any) {
      console.error('Erreur loadSpaces:', err);
      setError(err.message);
      showNotification('error', 'Erreur lors du chargement des espaces');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (spacesList: StorageSpace[]) => {
    const stats: Stats = {
      total_spaces: spacesList.length,
      active_spaces: spacesList.filter(s => s.is_active && !s.is_expired && !s.is_blocked).length,
      expired_spaces: spacesList.filter(s => s.is_expired).length,
      blocked_spaces: spacesList.filter(s => s.is_blocked).length,
      total_storage_gb: spacesList.reduce((acc, s) => acc + (s.size_limit_bytes / (1024**3)), 0),
      used_storage_gb: spacesList.reduce((acc, s) => acc + (s.current_usage_bytes / (1024**3)), 0),
      total_revenue: spacesList.reduce((acc, s) => acc + (s.amount_fcfa || 0), 0),
      pending_orders: 0 // À charger séparément
    };
    setStats(stats);
  };

  // Appliquer les filtres
  useEffect(() => {
    let filtered = [...spaces];

    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(space => 
        space.id?.toLowerCase().includes(term) ||
        space.company_name?.toLowerCase().includes(term) ||
        space.client_email?.toLowerCase().includes(term) ||
        space.order_number?.toLowerCase().includes(term) ||
        space.invoice_number?.toLowerCase().includes(term)
      );
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(space => {
        switch(statusFilter) {
          case 'active':
            return space.is_active && !space.is_expired && !space.is_blocked;
          case 'expired':
            return space.is_expired;
          case 'blocked':
            return space.is_blocked;
          case 'inactive':
            return !space.is_active && !space.is_expired && !space.is_blocked;
          case 'near_expiry':
            const daysLeft = Math.ceil((new Date(space.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 7 && daysLeft > 0 && !space.is_expired;
          default:
            return true;
        }
      });
    }

    // Tri
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'created_at_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'expires_at_asc':
          return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
        case 'expires_at_desc':
          return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
        case 'usage_desc':
          return b.usage_percentage - a.usage_percentage;
        case 'usage_asc':
          return a.usage_percentage - b.usage_percentage;
        case 'company_asc':
          return (a.company_name || '').localeCompare(b.company_name || '');
        case 'company_desc':
          return (b.company_name || '').localeCompare(a.company_name || '');
        default:
          return 0;
      }
    });

    setFilteredSpaces(filtered);
    setCurrentPage(1);
  }, [spaces, searchTerm, statusFilter, sortBy]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

const handleBlockSpace = async (spaceId: string, reason: string = '') => {
  if (!confirm('Bloquer cet espace ?')) return;

  try {
    setLoading(true);
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/storage/admin/storage/${spaceId}/block`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'  // Ici on garde car on envoie un body
      },
      body: JSON.stringify({ reason: reason || 'Bloqué par administrateur' })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors du blocage');
    }

    showNotification('success', data.message || 'Espace bloqué avec succès');
    await loadSpaces();
  } catch (err: any) {
    console.error('Erreur blocage:', err);
    showNotification('error', err.message || 'Erreur lors du blocage');
  } finally {
    setLoading(false);
  }
};

const handleActivateSpace = async (spaceId: string) => {
  if (!confirm('Voulez-vous vraiment activer / débloquer cet espace ?')) return;

  try {
    setLoading(true);
    const token = getToken();

    if (!token) {
      showNotification('error', 'Token d\'authentification manquant. Veuillez vous reconnecter.');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/storage/admin/storage/${spaceId}/activate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Pas de 'Content-Type': 'application/json' car PAS DE BODY
      },
      // Pas de body → on laisse vide (correct pour ce type de requête)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de l\'activation de l\'espace');
    }

    showNotification('success', data.message || 'Espace activé/débloqué avec succès');
    await loadSpaces(); // Rafraîchir la liste

  } catch (err: any) {
    console.error('Erreur activation espace:', err);
    showNotification('error', err.message || 'Impossible d\'activer l\'espace');
  } finally {
    setLoading(false);
  }
};


  const handleRenewSpace = async (spaceId: string) => {
    const months = prompt('Nombre de mois de renouvellement:', '12');
    if (!months) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/storage/admin/storage/${spaceId}/renew`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          months: parseInt(months),
          auto_generate_invoice: true 
        })
      });

      if (!response.ok) throw new Error('Erreur lors du renouvellement');

      const data = await response.json();
      showNotification('success', `Espace renouvelé jusqu'au ${new Date(data.newExpiryDate).toLocaleDateString('fr-FR')}`);
      loadSpaces();
    } catch (err) {
      showNotification('error', 'Erreur lors du renouvellement');
    }
  };

const handleDeleteSpace = async (spaceId: string) => {
  if (!confirm('⚠️ Voulez-vous VRAIMENT supprimer cet espace ?\nCette action est irréversible !')) return;

  try {
    setLoading(true);
    const token = getToken();

    if (!token) {
      showNotification('error', 'Token d\'authentification manquant. Veuillez vous reconnecter.');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}`, {  // ← ICI : AJOUTE /admin/
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Pas de 'Content-Type' car PAS DE BODY
      },
    });

    // Gestion 204 No Content (DELETE réussi sans réponse)
    let data = {};
    if (response.status !== 204) {
      data = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
      throw new Error((data as any).message || 'Erreur lors de la suppression de l\'espace');
    }

    showNotification('success', (data as any).message || 'Espace supprimé avec succès');
    await loadSpaces(); // Rafraîchir la liste

  } catch (err: any) {
    console.error('Erreur suppression espace:', err);
    showNotification('error', err.message || 'Impossible de supprimer l\'espace');
  } finally {
    setLoading(false);
  }
};

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    showNotification('info', 'ID copié dans le presse-papier');
  };

  const getStatusBadge = (space: StorageSpace) => {
    if (space.is_blocked) {
      return {
        label: 'Bloqué',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <FiLock className="h-3 w-3" />
      };
    }
    if (space.is_expired) {
      return {
        label: 'Expiré',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: <FiClock className="h-3 w-3" />
      };
    }
    if (space.is_active) {
      const daysLeft = Math.ceil((new Date(space.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7) {
        return {
          label: `Expire bientôt (${daysLeft}j)`,
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: <FiAlertCircle className="h-3 w-3" />
        };
      }
      return {
        label: 'Actif',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: <FiCheck className="h-3 w-3" />
      };
    }
    return {
      label: 'Inactif',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: <FiX className="h-3 w-3" />
    };
  };

  useEffect(() => {
    loadSpaces();
    
    // Charger aussi les commandes en attente
    const loadPendingOrders = async () => {
      try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/storage/admin/orders/pending`, {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          setStats(prev => ({ ...prev, pending_orders: data.orders?.length || 0 }));
        }
      } catch (err) {
        console.error('Erreur chargement commandes en attente:', err);
      }
    };
    loadPendingOrders();
  }, []);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSpaces.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSpaces.length / itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--primary-green)] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement des espaces de stockage...</p>
          <p className="text-sm text-gray-400 mt-2">Préparation du tableau de bord</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center justify-between max-w-md animate-slideIn ${
          notification.type === 'success' ? 'bg-green-50 text-green-800 border-l-4 border-green-500' :
          notification.type === 'error' ? 'bg-red-50 text-red-800 border-l-4 border-red-500' :
          'bg-blue-50 text-blue-800 border-l-4 border-blue-500'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <FiCheck className="h-5 w-5 mr-3 flex-shrink-0" />
            ) : notification.type === 'error' ? (
              <FiAlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            ) : (
              <FiInfo className="h-5 w-5 mr-3 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="ml-4 hover:opacity-75">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* En-tête avec statistiques */}
      <div className="bg-gradient-to-r from-[var(--primary-green)] to-green-600 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <FiHardDrive className="h-8 w-8" />
              Administration des espaces de stockage
            </h1>
            <p className="text-green-100 mt-1">
              Gérez tous les espaces de stockage clients
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadSpaces}
              disabled={loading}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={() => router.push('/dashboard/admin/storage/offers')}
              className="px-4 py-2 bg-white text-[var(--primary-green)] rounded-lg hover:bg-green-50 flex items-center gap-2 transition-all font-medium"
            >
              <FiSettings className="h-4 w-4" />
              Gérer les offres
            </button>
          </div>
        </div>

        {/* Cartes de statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <FiHardDrive className="h-5 w-5 text-green-200" />
              <span className="text-xs text-green-200">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_spaces}</p>
            <p className="text-xs text-green-200">Espaces</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <FiCheck className="h-5 w-5 text-green-200" />
              <span className="text-xs text-green-200">Actifs</span>
            </div>
            <p className="text-2xl font-bold">{stats.active_spaces}</p>
            <p className="text-xs text-green-200">{((stats.active_spaces / stats.total_spaces) * 100 || 0).toFixed(1)}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <FiClock className="h-5 w-5 text-green-200" />
              <span className="text-xs text-green-200">Expirés</span>
            </div>
            <p className="text-2xl font-bold">{stats.expired_spaces}</p>
            <p className="text-xs text-green-200">En attente</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <FiLock className="h-5 w-5 text-green-200" />
              <span className="text-xs text-green-200">Bloqués</span>
            </div>
            <p className="text-2xl font-bold">{stats.blocked_spaces}</p>
            <p className="text-xs text-green-200">Par admin</p>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Rechercher par ID, client, email, commande..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent bg-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="expired">Expirés</option>
              <option value="blocked">Bloqués</option>
              <option value="near_expiry">Expire bientôt</option>
              <option value="inactive">Inactifs</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent bg-white"
            >
              <option value="created_at_desc">Plus récents d'abord</option>
              <option value="created_at_asc">Plus anciens d'abord</option>
              <option value="expires_at_asc">Expiration proche</option>
              <option value="expires_at_desc">Expiration lointaine</option>
              <option value="usage_desc">Utilisation max</option>
              <option value="usage_asc">Utilisation min</option>
              <option value="company_asc">Client A-Z</option>
              <option value="company_desc">Client Z-A</option>
            </select>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSortBy('created_at_desc');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              title="Réinitialiser les filtres"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {filteredSpaces.length} espace(s) trouvé(s) sur {spaces.length} total
        </div>
      </div>

      {/* Liste des espaces */}
      <div className="space-y-4">
        {currentItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FiHardDrive className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun espace trouvé</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Aucun espace ne correspond à vos critères de recherche'
                : 'Aucun espace de stockage n\'a encore été créé'}
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setSortBy('created_at_desc');
                }}
                className="px-6 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)]"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          currentItems.map((space) => {
            const status = getStatusBadge(space);
            const daysLeft = space.expires_at 
              ? Math.ceil((new Date(space.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            
            return (
              <div key={space.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                {/* En-tête de la carte */}
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary-green)] to-green-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {space.company_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {space.company_name || 'Client sans nom'}
                          </h3>
                          <button
                            onClick={() => handleCopyId(space.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                            title="Copier l'ID"
                          >
                            <FiCopy className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">
                            <FiMail className="h-3 w-3" />
                            {space.client_email || 'Email inconnu'}
                          </span>
                          {space.client_phone && (
                            <span className="flex items-center gap-1 text-gray-600">
                              <FiPhone className="h-3 w-3" />
                              {space.client_phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                      {space.auto_renew && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium flex items-center gap-1">
                          <FiZap className="h-3 w-3" />
                          Auto-renouvellement
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Corps de la carte avec les métriques */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Utilisation */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <FiHardDrive className="h-3 w-3" />
                        UTILISATION
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatBytes(space.current_usage_bytes)} / {formatBytes(space.size_limit_bytes)}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full ${
                            space.usage_percentage >= 90 ? 'bg-red-500' :
                            space.usage_percentage >= 70 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(space.usage_percentage, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {space.usage_percentage.toFixed(1)}% utilisé
                      </p>
                    </div>

                    {/* Dates */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <FiCalendar className="h-3 w-3" />
                        DATES
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">Création:</span>{' '}
                        <span className="font-medium">{format(new Date(space.created_at), 'dd/MM/yyyy')}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">Expiration:</span>{' '}
                        <span className={`font-medium ${daysLeft <= 7 ? 'text-orange-600' : ''}`}>
                          {format(new Date(space.expires_at), 'dd/MM/yyyy')}
                          {!space.is_expired && daysLeft > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({daysLeft} jours)
                            </span>
                          )}
                        </span>
                      </p>
                      {space.activated_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Activé le {format(new Date(space.activated_at), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>

                    {/* Commande et facture */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <FiCreditCard className="h-3 w-3" />
                        COMMANDE
                      </p>
                      {space.order_number ? (
                        <>
                          <p className="text-sm font-medium">{space.order_number}</p>
                          <p className="text-sm text-gray-600">
                            {formatFCFA(space.amount_fcfa)}
                          </p>
                          {space.invoice_number && (
                            <p className="text-xs text-gray-500">
                              Facture: {space.invoice_number}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Aucune commande</p>
                      )}
                    </div>

                    {/* Offre */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <FiZap className="h-3 w-3" />
                        OFFRE
                      </p>
                      <p className="text-sm font-medium">
                        {space.offer_name || 'Offre standard'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {space.storage_gb ? `${space.storage_gb} Go` : ''}
                      </p>
                      {space.file_count !== undefined && (
                        <p className="text-xs text-gray-500">
                          {space.file_count} fichier(s)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/admin/storage/${space.id}`)}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <FiEye className="h-4 w-4" />
                    Détails
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/admin/storage/${space.id}/files`)}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <FiFolder className="h-4 w-4" />
                    Fichiers
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/admin/storage/${space.id}/edit`)}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    Modifier
                  </button>
                  
                  {!space.is_blocked && (
                    <button
                      onClick={() => {
                        const reason = prompt('Raison du blocage (optionnel):');
                        handleBlockSpace(space.id, reason || undefined);
                      }}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-2 transition-colors"
                    >
                      <FiLock className="h-4 w-4" />
                      Bloquer
                    </button>
                  )}
                  
                  {space.is_blocked && (
                    <button
                      onClick={() => handleActivateSpace(space.id)}
                      className="px-3 py-1.5 text-sm bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 flex items-center gap-2 transition-colors"
                    >
                      <FiUnlock className="h-4 w-4" />
                      Débloquer
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRenewSpace(space.id)}
                    className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-2 transition-colors"
                  >
                    <FiRefreshCw className="h-4 w-4" />
                    Renouveler
                  </button>
                  
                  <button
                    onClick={() => {
                      if (window.confirm('Générer une facture pour cet espace ?')) {
                        router.push(`/dashboard/invoices/new?spaceId=${space.id}`);
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-2 transition-colors"
                  >
                    <FiDollarSign className="h-4 w-4" />
                    Facture
                  </button>
                  
                  <button
                    onClick={() => handleDeleteSpace(space.id)}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-2 transition-colors ml-auto"
                  >
                    <FiTrash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {filteredSpaces.length > itemsPerPage && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600">
            Affichage {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredSpaces.length)} sur {filteredSpaces.length} espaces
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-lg ${
                    currentPage === pageNum
                      ? 'bg-[var(--primary-green)] text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
