'use client';
import { useState, useEffect } from 'react';
import {
  FiBarChart2,
  FiSmartphone,
  FiMessageSquare,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiPause,
  FiPlay,
  FiRefreshCw,
  FiFilter,
  FiDownload,
  FiEye,
  FiUsers,
  FiTrendingUp,
  FiActivity,
  FiPercent,
  FiZap,
  FiSend,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiX,
  FiCalendar,
  FiUser,
  FiList,
  FiFileText,
  FiAlertTriangle,
  FiPieChart
} from 'react-icons/fi';
import { format as dateFormat, formatDistanceToNow as formatRelativeTime, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

// Types
interface QueueStats {
  phone: string;
  waiting: number;
  active: number;
  failed: number;
  total: number;
  isPaused?: boolean;
  clientName?: string;
  lastActivity?: string;
  successRate?: number;
}

interface Message {
  id: string;
  recipient_phone: string;
  message_type: string;
  wa_status: string;
  wa_message_id?: string;
  wa_error_message?: string;
  queued_at?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  created_at: string;
  client_id?: string;
  client_name?: string;
}

interface MessageResponse {
  success: boolean;
  messages: Message[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface QueueResponse {
  success: boolean;
  stats: QueueStats[];
  count: number;
  timestamp: string;
}

interface QueueStatusResponse {
  success: boolean;
  data: {
    phoneNumber: string;
    isPaused: boolean;
    queueName: string;
    counts: {
      waiting: number;
      active: number;
      failed: number;
    };
  };
}

interface StatsResponse {
  success: boolean;
  stats: {
    total_messages: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    queued: number;
  };
  daily_stats: Array<{
    date: string;
    total: number;
    delivered: number;
    failed: number;
  }>;
}

export default function StatsPage() {
  const [queueData, setQueueData] = useState<QueueResponse | null>(null);
  const [messageData, setMessageData] = useState<MessageResponse | null>(null);
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState<'queues' | 'messages' | 'analytics'>('queues');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showQueueStatusModal, setShowQueueStatusModal] = useState(false);
  const [queueStatusData, setQueueStatusData] = useState<QueueStatusResponse['data'] | null>(null);
  const [queueStatusPhone, setQueueStatusPhone] = useState<string>('');

  // Filtres pour les messages
  const [messageFilters, setMessageFilters] = useState({
    status: '',
    recipient_phone: '',
    message_type: '',
    start_date: '',
    end_date: '',
    page: 1,
    limit: 20
  });

  // Configuration de l'API backend
  const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin.replace('dashboard', 'api') : '';

  // Récupérer le token depuis localStorage (votre système existant)
  const getToken = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      return token;
    }
    return null;
  };

  // Fonction pour afficher des notifications
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Charger les données des queues
  const loadQueueData = async () => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/monitoring/queue-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        showNotification('error', 'Session expirée. Veuillez vous reconnecter.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setQueueData(result);

    } catch (error) {
      console.error('Erreur chargement queues:', error);
      showNotification('error', 'Erreur lors du chargement des files d\'attente');
    }
  };

  // Charger les messages
  const loadMessages = async () => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const params = new URLSearchParams();
      if (messageFilters.status) params.append('status', messageFilters.status);
      if (messageFilters.recipient_phone) params.append('recipient_phone', messageFilters.recipient_phone);
      if (messageFilters.message_type) params.append('message_type', messageFilters.message_type);
      if (messageFilters.start_date) params.append('start_date', messageFilters.start_date);
      if (messageFilters.end_date) params.append('end_date', messageFilters.end_date);
      params.append('page', messageFilters.page.toString());
      params.append('limit', messageFilters.limit.toString());

      const response = await fetch(`${API_BASE_URL}/api/v1/messages?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        showNotification('error', 'Session expirée. Veuillez vous reconnecter.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setMessageData(result);

    } catch (error) {
      console.error('Erreur chargement messages:', error);
      showNotification('error', 'Erreur lors du chargement des messages');
    }
  };

  // Charger les statistiques
const loadStats = async () => {
  try {
    const token = getToken();
    if (!token) {
      showNotification('error', 'Veuillez vous reconnecter');
      return;
    }

    // On utilise la bonne URL qui fonctionne dans ton curl
    const url = `${API_BASE_URL}/api/v1/messages/stats/summary?period=30days`;
    console.log('Appel API stats :', url); // ← log pour voir l'URL exacte

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Statut HTTP reçu :', response.status); // ← très utile

    if (response.status === 401) {
      showNotification('error', 'Session expirée. Veuillez vous reconnecter.');
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Erreur HTTP body :', errorText);
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // LE LOG LE PLUS IMPORTANT :
    console.log('Réponse /messages/stats/summary :', result);

    setStatsData(result);

  } catch (error) {
    console.error('Erreur complète chargement stats :', error);
    showNotification('error', 'Erreur lors du chargement des statistiques');
  }
};


  // Fonction pour mettre en pause/reprendre une queue

const handleQueueAction = async (phoneNumber: string, action: 'pause' | 'resume') => {
  try {
    const token = getToken();
    if (!token) {
      showNotification('error', 'Veuillez vous reconnecter');
      return;
    }

    const endpoint =
      action === 'pause'
        ? `/api/v1/messages/whatsapp/${encodeURIComponent(phoneNumber)}/pause`
        : `/api/v1/messages/whatsapp/${encodeURIComponent(phoneNumber)}/resume`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (response.status === 401) {
      showNotification('error', 'Session expirée. Veuillez vous reconnecter.');
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // Rafraîchir TOUTES les queues
    await loadQueueData();

    // Rafraîchir SPÉCIFIQUEMENT le statut de cette queue pour mise à jour immédiate du modal
    if (showQueueStatusModal && queueStatusPhone === phoneNumber) {
      const statusRes = await fetch(
        `${API_BASE_URL}/api/v1/monitoring/whatsapp/${encodeURIComponent(phoneNumber)}/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (statusRes.ok) {
        const newStatus = await statusRes.json();
        if (newStatus.success && newStatus.data) {
          setQueueStatusData(newStatus.data);
          console.log('Statut mis à jour dans le modal:', newStatus.data.isPaused ? 'PAUSE' : 'RESUME');
        }
      }
    }

    showNotification(
      'success',
      result.message || `File ${action === 'pause' ? 'mise en pause' : 'reprise'} avec succès`
    );
  } catch (error) {
    console.error(`Erreur ${action} queue:`, error);
    showNotification('error', 'Impossible d\'exécuter l\'action');
  }
};


  // Fonction pour obtenir le statut détaillé d'une queue

const getQueueStatus = async (phoneNumber: string) => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/monitoring/whatsapp/${encodeURIComponent(phoneNumber)}/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 401) {
        showNotification('error', 'Session expirée. Veuillez vous reconnecter.');
        return;
      }

      if (!response.ok) throw new Error('Erreur lors de la récupération du statut');

      const result = await response.json();

      // Afficher les détails dans une alerte
      alert(`📊 Statut détaillé pour ${phoneNumber}:\n\n` +
            `📱 File d'attente: ${result.data?.queueName || 'N/A'}\n` +
            `⏸️  En pause: ${result.data?.isPaused ? 'Oui' : 'Non'}\n\n` +
            `📊 Statistiques:\n` +
            `⏳ En attente: ${result.data?.counts?.waiting || 0}\n` +
            `🔄 Actifs: ${result.data?.counts?.active || 0}\n` +
            `❌ Échoués: ${result.data?.counts?.failed || 0}\n` +
            `📈 Total: ${(result.data?.counts?.waiting || 0) + (result.data?.counts?.active || 0) + (result.data?.counts?.failed || 0)}`);

    } catch (error) {
      showNotification('error', 'Impossible de récupérer le statut');
      console.error('Erreur statut:', error);
    }
  };

// Ajoute ce useEffect pour debug le state du modal (en haut du composant, après les useState)
useEffect(() => {
  if (showQueueStatusModal) {
    console.log('Modal devrait s\'ouvrir avec data:', queueStatusData);
  }
}, [showQueueStatusModal, queueStatusData]);

  // Fonction pour exporter les données
  const exportData = (format: 'csv' | 'json', type: 'queues' | 'messages') => {
    let content = '';
    let filename = '';

    if (type === 'queues' && queueData?.stats) {
      if (format === 'csv') {
        const headers = ['Numéro', 'Client', 'En attente', 'Actifs', 'Échoués', 'Total', 'Taux de succès', 'Dernière activité', 'Statut'];
        const rows = queueData.stats.map(q => [
          q.phone,
          q.clientName || 'N/A',
          q.waiting,
          q.active,
          q.failed,
          q.total,
          `${q.successRate || 0}%`,
          q.lastActivity ? dateFormat(new Date(q.lastActivity), 'dd/MM/yyyy HH:mm:ss') : 'N/A',
          q.isPaused ? 'Pause' : 'Actif'
        ]);

        content = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        filename = `queues_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        content = JSON.stringify(queueData, null, 2);
        filename = `queues_${new Date().toISOString().split('T')[0]}.json`;
      }
    } else if (type === 'messages' && messageData?.messages) {
      if (format === 'csv') {
        const headers = ['ID', 'Destinataire', 'Type', 'Statut', 'ID Message', 'Erreur', 'Créé le', 'Envoyé le', 'Livré le', 'Lu le', 'Échoué le'];
        const rows = messageData.messages.map(m => [
          m.id.substring(0, 8) + '...',
          m.recipient_phone,
          m.message_type,
          m.wa_status,
          m.wa_message_id || '',
          m.wa_error_message || '',
          dateFormat(new Date(m.created_at), 'dd/MM/yyyy HH:mm:ss'),
          m.sent_at ? dateFormat(new Date(m.sent_at), 'dd/MM/yyyy HH:mm:ss') : '',
          m.delivered_at ? dateFormat(new Date(m.delivered_at), 'dd/MM/yyyy HH:mm:ss') : '',
          m.read_at ? dateFormat(new Date(m.read_at), 'dd/MM/yyyy HH:mm:ss') : '',
          m.failed_at ? dateFormat(new Date(m.failed_at), 'dd/MM/yyyy HH:mm:ss') : ''
        ]);

        content = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        filename = `messages_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        content = JSON.stringify(messageData, null, 2);
        filename = `messages_${new Date().toISOString().split('T')[0]}.json`;
      }
    } else {
      showNotification('error', 'Aucune donnée à exporter');
      return;
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('success', `${type === 'queues' ? 'Files d\'attente' : 'Messages'} exportés en ${format.toUpperCase()}`);
  };

  // Gestionnaire pour les filtres de messages
  const handleFilterChange = (key: string, value: string) => {
    setMessageFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? parseInt(value) : 1 // Reset à la page 1 si autre filtre change
    }));
  };

  const applyFilters = () => {
    loadMessages();
  };

  const resetFilters = () => {
    setMessageFilters({
      status: '',
      recipient_phone: '',
      message_type: '',
      start_date: '',
      end_date: '',
      page: 1,
      limit: 20
    });
    loadMessages();
  };

  // Charger toutes les données
  const loadAllData = async () => {
    try {
      setRefreshing(true);
      setLoading(true);

      await Promise.all([
        loadQueueData(),
        loadMessages(),
        loadStats()
      ]);

      showNotification('success', 'Données chargées avec succès');
    } catch (error) {
      console.error('Erreur chargement données:', error);
      showNotification('error', 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadAllData, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

 // 3. NOUVEAU : Recharge quand la période globale ou le numéro change
useEffect(() => {
  loadAllData();  // recharge queues + messages + stats
}, [timeRange, selectedPhone]);

// 4. NOUVEAU (optionnel) : Recharge les messages quand les filtres spécifiques changent
//    → utile si tu veux que le changement de statut/date/etc. soit immédiat
//    → retire ce useEffect si tu préfères garder le bouton "Appliquer"
useEffect(() => {
  loadMessages();
}, [
  messageFilters.status,
  messageFilters.recipient_phone,
  messageFilters.message_type,
  messageFilters.start_date,
  messageFilters.end_date,
  messageFilters.page,
  messageFilters.limit
]);

useEffect(() => {
  console.log('queueData mis à jour :', queueData?.stats?.map(q => `${q.phone} - paused: ${q.isPaused}`));
}, [queueData]);


  // Calculer les stats globales
    // Calculer les stats globales
  const globalStats = queueData?.stats ? ({
  totalNumbers: queueData.stats.length,
  totalMessages: queueData.stats.reduce((sum, q) => sum + q.total, 0),
  waitingMessages: queueData.stats.reduce((sum, q) => sum + q.waiting, 0),
  activeMessages: queueData.stats.reduce((sum, q) => sum + q.active, 0),
  failedMessages: queueData.stats.reduce((sum, q) => sum + q.failed, 0),
  pausedQueues: queueData.stats.filter(q => q.isPaused).length,
  activeQueues: queueData.stats.filter(q => !q.isPaused).length,
  avgSuccessRate: queueData.stats.length > 0
    ? queueData.stats.reduce((sum, q) => sum + (q.successRate || 0), 0) / queueData.stats.length
    : 0
}) : null;

  // Données pour le graphique des statuts
  const statusChartData = statsData?.stats ? [
    { name: 'Envoyés', value: statsData.stats.sent || 0, color: '#3b82f6' },
    { name: 'Livrés', value: statsData.stats.delivered || 0, color: '#10b981' },
    { name: 'Lus', value: statsData.stats.read || 0, color: '#8b5cf6' },
    { name: 'Échoués', value: statsData.stats.failed || 0, color: '#ef4444' },
    { name: 'En attente', value: statsData.stats.queued || 0, color: '#f59e0b' }
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des données de monitoring...</p>
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
              <FiCheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <FiAlertCircle className="h-5 w-5 mr-2" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* En-tête avec filtres */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FiBarChart2 className="text-[var(--primary-green)]" />
            Monitoring WhatsApp
          </h1>
          <p className="text-gray-600 mt-1">
            Statistiques en temps réel des files d'attente et messages
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[var(--primary-green)] focus:ring-[var(--primary-green)]"
            />
            <label htmlFor="auto-refresh" className="text-sm text-gray-700">
              Auto-rafraîchissement (30s)
            </label>
          </div>

          <button
            onClick={loadAllData}
            disabled={refreshing}
            className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm">
              {refreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
            </span>
          </button>
        </div>
      </div>

      {/* Filtres généraux */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
          >
            <option value="1h">Dernière heure</option>
            <option value="24h">24 dernières heures</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
          <select
            value={selectedPhone}
            onChange={(e) => setSelectedPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
          >
            <option value="all">Tous les numéros</option>
            {queueData?.stats.map(q => (
              <option key={q.phone} value={q.phone}>
                {q.phone} {q.clientName ? `(${q.clientName})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cartes de statistiques globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiSmartphone className="mr-2" />
            Numéros actifs
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {globalStats?.totalNumbers || 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {globalStats?.pausedQueues || 0} en pause
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiMessageSquare className="mr-2" />
            Total messages
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {statsData?.stats?.total_messages?.toLocaleString() || 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {globalStats?.waitingMessages || 0} en attente
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiPercent className="mr-2" />
            Taux de succès
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {statsData?.stats && statsData.stats.total_messages > 0
              ? Math.round((statsData.stats.delivered + statsData.stats.read) / statsData.stats.total_messages * 100) + '%'
              : '0%'}
          </div>
          <div className="mt-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[var(--primary-green)] h-2 rounded-full"
                style={{
                  width: `${statsData?.stats && statsData.stats.total_messages > 0
                    ? Math.round((statsData.stats.delivered + statsData.stats.read) / statsData.stats.total_messages * 100)
                    : 0}%`
                }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiActivity className="mr-2" />
            Files actives
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {globalStats?.activeQueues || 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            sur {globalStats?.totalNumbers || 0} total
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('queues')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'queues'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiActivity />
            Files d'attente ({queueData?.count || 0})
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'messages'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiMessageSquare />
            Messages ({messageData?.pagination?.total || 0})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiPieChart />
            Analytics
          </button>
        </nav>
      </div>

      {/* Onglet Files d'attente */}
      {activeTab === 'queues' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Statut des files d'attente par numéro</h3>
            <div className="flex gap-2">
              <button
                onClick={() => exportData('csv', 'queues')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <FiDownload className="h-4 w-4" />
                <span className="text-sm">CSV</span>
              </button>
              <button
                onClick={() => exportData('json', 'queues')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <FiDownload className="h-4 w-4" />
                <span className="text-sm">JSON</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      En attente
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actifs
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Échoués
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taux succès
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dernière activité
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {queueData?.stats.map((queue) => (
                    <tr key={queue.phone} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{queue.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                        {queue.clientName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          queue.waiting > 10 ? 'bg-red-100 text-red-800' :
                          queue.waiting > 0 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {queue.waiting}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {queue.active}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          queue.failed > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {queue.failed}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 mr-2">{queue.total}</span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[var(--primary-green)] h-2 rounded-full"
                              style={{ width: `${(queue.active / Math.max(queue.total, 1)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`font-medium mr-2 ${
                            (queue.successRate || 0) >= 90 ? 'text-green-600' :
                            (queue.successRate || 0) >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {queue.successRate?.toFixed(1) || '0.0'}%
                          </span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                (queue.successRate || 0) >= 90 ? 'bg-green-500' :
                                (queue.successRate || 0) >= 70 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(queue.successRate || 0, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {queue.lastActivity ? (
                          <div className="text-sm text-gray-500">
                            {formatRelativeTime(new Date(queue.lastActivity), {
                              addSuffix: true,
                              locale: fr
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => getQueueStatus(queue.phone)}
                            className="p-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Voir statut détaillé"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>

                          {queue.isPaused ? (
                            <button
                              onClick={() => handleQueueAction(queue.phone, 'resume')}
                              className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                              title="Reprendre la file"
                            >
                              <FiPlay className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQueueAction(queue.phone, 'pause')}
                              className="p-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
                              title="Mettre en pause"
                            >
                              <FiPause className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Onglet Messages */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Messages envoyés</h3>
              <p className="text-gray-600 text-sm mt-1">
                Filtrez et consultez l'historique des messages
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <FiFilter className="h-4 w-4" />
                <span className="text-sm">Filtres</span>
                {showFilters ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
              </button>
              <button
                onClick={() => exportData('csv', 'messages')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <FiDownload className="h-4 w-4" />
                <span className="text-sm">CSV</span>
              </button>
              <button
                onClick={() => exportData('json', 'messages')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <FiDownload className="h-4 w-4" />
                <span className="text-sm">JSON</span>
              </button>
            </div>
          </div>

          {/* Filtres messages */}
          {showFilters && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select
                    value={messageFilters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  >
                    <option value="">Tous les statuts</option>
                    <option value="queued">En attente</option>
                    <option value="sent">Envoyé</option>
                    <option value="delivered">Livré</option>
                    <option value="read">Lu</option>
                    <option value="failed">Échoué</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de message</label>
                  <select
                    value={messageFilters.message_type}
                    onChange={(e) => handleFilterChange('message_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  >
                    <option value="">Tous les types</option>
                    <option value="text">Texte</option>
                    <option value="template">Template</option>
                    <option value="media">Média</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                  <input
                    type="date"
                    value={messageFilters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={messageFilters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro destinataire</label>
                  <input
                    type="text"
                    placeholder="+237..."
                    value={messageFilters.recipient_phone}
                    onChange={(e) => handleFilterChange('recipient_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Résultats par page</label>
                    <select
                      value={messageFilters.limit}
                      onChange={(e) => handleFilterChange('limit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  <button
                    onClick={resetFilters}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <FiX className="h-4 w-4" />
                    Réinitialiser
                  </button>
                  <button
                    onClick={applyFilters}
                    className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tableau des messages */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destinataire
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Message
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Erreur
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {messageData?.messages.map((message) => (
                    <tr key={message.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{message.recipient_phone}</div>
                        <div className="text-xs text-gray-500">{message.client_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {message.message_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          message.wa_status === 'failed' ? 'bg-red-100 text-red-800' :
                          message.wa_status === 'delivered' ? 'bg-green-100 text-green-800' :
                          message.wa_status === 'read' ? 'bg-purple-100 text-purple-800' :
                          message.wa_status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {message.wa_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono text-xs text-gray-500">
                          {message.wa_message_id ? message.wa_message_id.substring(0, 20) + '...' : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate text-sm text-gray-600">
                          {message.wa_error_message || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs space-y-1">
                          <div className="text-gray-500">
                            Créé: {dateFormat(new Date(message.created_at), 'dd/MM HH:mm')}
                          </div>
                          {message.sent_at && (
                            <div className="text-blue-600">
                              Envoyé: {dateFormat(new Date(message.sent_at), 'dd/MM HH:mm')}
                            </div>
                          )}
                          {message.failed_at && (
                            <div className="text-red-600">
                              Échoué: {dateFormat(new Date(message.failed_at), 'dd/MM HH:mm')}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {messageData?.pagination && messageData.pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {messageData.pagination.page} sur {messageData.pagination.totalPages}
                    • {messageData.pagination.total} messages
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFilterChange('page', (messageFilters.page - 1).toString())}
                      disabled={messageFilters.page <= 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => handleFilterChange('page', (messageFilters.page + 1).toString())}
                      disabled={messageFilters.page >= messageData.pagination.totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onglet Analytics */}
      {activeTab === 'analytics' && statsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique des statuts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Répartition des statuts</h4>
              <div className="space-y-4">
                {statusChartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-gray-700">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-900">{item.value}</span>
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${statsData.stats.total_messages > 0 ? (item.value / statsData.stats.total_messages * 100) : 0}%`,
                            backgroundColor: item.color
                          }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right">
                        {statsData.stats.total_messages > 0
                          ? Math.round(item.value / statsData.stats.total_messages * 100) + '%'
                          : '0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Statistiques détaillées */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Statistiques globales</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{statsData.stats.sent || 0}</div>
                  <div className="text-sm text-blue-600">Envoyés</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{statsData.stats.delivered || 0}</div>
                  <div className="text-sm text-green-600">Livrés</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">{statsData.stats.read || 0}</div>
                  <div className="text-sm text-purple-600">Lus</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">{statsData.stats.failed || 0}</div>
                  <div className="text-sm text-red-600">Échoués</div>
                </div>
              </div>

              <div className="mt-6">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Performances journalières (7 derniers jours)</h5>
                <div className="space-y-2">
                  {statsData.daily_stats?.map((day) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {dateFormat(new Date(day.date), 'EEEE dd/MM', { locale: fr })}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-900">{day.total} messages</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${day.total > 0 ? (day.delivered / day.total * 100) : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 w-10">
                          {day.total > 0 ? Math.round(day.delivered / day.total * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Performances des numéros */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Performances par numéro</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Messages
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taux de succès
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {queueData?.stats.map((queue) => (
                    <tr key={queue.phone} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{queue.phone}</div>
                        <div className="text-xs text-gray-500">{queue.clientName || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">{queue.total} messages</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`font-medium mr-2 ${
                            (queue.successRate || 0) >= 90 ? 'text-green-600' :
                            (queue.successRate || 0) >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {queue.successRate?.toFixed(1) || '0.0'}%
                          </span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                (queue.successRate || 0) >= 90 ? 'bg-green-500' :
                                (queue.successRate || 0) >= 70 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(queue.successRate || 0, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (queue.successRate || 0) >= 90 ? 'bg-green-100 text-green-800' :
                          (queue.successRate || 0) >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {queue.successRate && queue.successRate >= 90 ? 'Excellent' :
                           queue.successRate && queue.successRate >= 70 ? 'Bon' : 'À améliorer'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
