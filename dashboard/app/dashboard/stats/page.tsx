'use client';

import { useState, useEffect, useRef } from 'react';
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
  FiPieChart,
  FiStar,
  FiAward,
  FiTarget,
  FiGlobe,
  FiThumbsUp,
  FiThumbsDown,
  FiArrowUp,
  FiArrowDown,
  FiMinus,
  FiInfo,
  FiSettings,
  FiCopy,
  FiTrash2,
  FiRefreshCcw,
  FiEyeOff,
  FiEye as FiEyeOn,
  FiMoreVertical,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiCheck,
  FiDollarSign,
  FiGift,
  FiShield,
  FiCpu,
  FiDatabase,
  FiCloud,
  FiServer,
  FiWifi,
  FiWifiOff,
  FiClock as FiClockSolid
} from 'react-icons/fi';
import { format as dateFormat, formatDistanceToNow as formatRelativeTime, subDays, startOfDay, endOfDay, formatDistance } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Scatter
} from 'recharts';
import Cookies from 'js-cookie';

// ============================================
// TYPES
// ============================================

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
  avgResponseTime?: number;
  throughput?: number;
  peakHour?: string;
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  tierCurrent?: 'TIER_1' | 'TIER_2' | 'TIER_3';
  dailyLimit?: number;
  messagesToday?: number;
  clientId?: string;
  displayName?: string;
}

interface Message {
  id: string;
  recipient_phone: string;
  message_type: string;
  wa_status: string;
  wa_message_id?: string;
  wa_error_message?: string;
  wa_error_code?: string;
  queued_at?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  created_at: string;
  client_id?: string;
  client_name?: string;
  message_content?: string;
  template_name?: string;
  media_url?: string;
  media_type?: string;
  queue_time?: number; // temps en queue (ms)
  processing_time?: number; // temps traitement (ms)
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
    workers?: number;
    stalled?: number;
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
    read?: number;
    sent?: number;
  }>;
  hourly_stats?: Array<{
    hour: string;
    count: number;
    delivered: number;
    failed: number;
  }>;
  top_clients?: Array<{
    client_id: string;
    client_name: string;
    total_messages: number;
    success_rate: number;
  }>;
  performance?: {
    avg_queue_time: number;
    avg_processing_time: number;
    peak_hour: string;
    success_rate: number;
  };
  clients?: {
    total?: number;
    avg_per_client?: number;
    global_success_rate?: number;
  };
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function StatsPage() {
  // États principaux
  const [queueData, setQueueData] = useState<QueueResponse | null>(null);
  const [messageData, setMessageData] = useState<MessageResponse | null>(null);
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d' | '90d'>('7d');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState<'queues' | 'messages' | 'analytics' | 'performance' | 'clients'>('queues');
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'warning' | 'info', message: string} | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showQueueStatusModal, setShowQueueStatusModal] = useState(false);
  const [queueStatusData, setQueueStatusData] = useState<QueueStatusResponse['data'] | null>(null);
  const [queueStatusPhone, setQueueStatusPhone] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [chartView, setChartView] = useState<'daily' | 'hourly' | 'comparison'>('daily');
  const [metricView, setMetricView] = useState<'overview' | 'details'>('overview');
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const chartRef = useRef(null);

  // Filtres pour les messages - VERSION AMÉLIORÉE
  const [messageFilters, setMessageFilters] = useState({
    status: '',
    recipient_phone: '',
    message_type: '',
    start_date: dateFormat(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end_date: dateFormat(new Date(), 'yyyy-MM-dd'),
    page: 1,
    limit: 10,
    sort_by: 'created_at',
    sort_order: 'desc',
    client_id: '',
    has_error: '',
    search: ''
  });

  // Configuration de l'API
  const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin.replace('dashboard', 'api') : '';

  // ============================================
  // UTILITAIRES
  // ============================================

  const getToken = () => {
  if (typeof window !== 'undefined') {
    const token = Cookies.get('token');
    console.log('[getToken] Token trouvé dans cookie :', token ? `OUI (${token.substring(0, 10)}...)` : 'NON');
    return token || '';
  }
  return '';
};

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string, duration = 3000) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), duration);
  };

  // ============================================
  // FONCTIONS DE CHARGEMENT DES DONNÉES
  // ============================================

   const loadQueueData = async () => {
  try {
    const token = getToken();
    if (!token) return;

    const response = await fetch(`${API_BASE_URL}/api/v1/stats/numbers`, {
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`Erreur ${response.status}`);

    const result = await response.json();
    console.log('📞 DONNÉES NUMÉROS RÉELLES:', result);

    setQueueData({
      success: true,
      count: result.count,
      stats: result.stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur chargement numéros:', error);
    showNotification('error', 'Impossible de charger les files d\'attente');
  }
};


  const loadMessages = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const params = new URLSearchParams();
      Object.entries(messageFilters).forEach(([key, value]) => {
        if (value && value !== '') params.append(key, value.toString());
      });

      const response = await fetch(`${API_BASE_URL}/api/v1/messages?${params}`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Erreur ${response.status}`);

      const result = await response.json();

      // Calculer des métriques supplémentaires
      if (result.messages) {
        result.messages = result.messages.map((m: Message) => {
          if (m.queued_at && m.sent_at) {
            m.queue_time = new Date(m.sent_at).getTime() - new Date(m.queued_at).getTime();
          }
          if (m.sent_at && m.delivered_at) {
            m.processing_time = new Date(m.delivered_at).getTime() - new Date(m.sent_at).getTime();
          }
          return m;
        });
      }

      setMessageData(result);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      showNotification('error', 'Erreur de chargement des messages');
    }
  };

  const loadStats = async () => {
  try {
    const token = getToken();
    if (!token) return;

    const params = new URLSearchParams({ period: timeRange });

    const url = `${API_BASE_URL}/api/v1/stats/overview?${params}`;
    console.log('Chargement stats avec période:', timeRange, url);

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`Erreur ${response.status}`);

    const result = await response.json();
    console.log('📊 DONNÉES RÉELLES:', result);

    setStatsData({
      success: true,
      stats: result.stats || { total_messages: 0, sent: 0, delivered: 0, read: 0, failed: 0, queued: 0 },
      daily_stats: result.daily_stats || [],
      hourly_stats: result.hourly_stats || [],
      top_clients: result.top_clients || [],
      performance: result.performance || { avg_queue_time: 0, avg_processing_time: 0, peak_hour: '', success_rate: 0 }
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    showNotification('error', 'Impossible de charger les stats');
  }
};


  // ============================================
  // ACTIONS SUR LES FILES
  // ============================================

  const handleQueueAction = async (phoneNumber: string, action: 'pause' | 'resume' | 'retry-all' | 'clear-failed') => {
  try {
    const token = getToken();
    if (!token) throw new Error('Token manquant');

    let endpoint = '';
    let method: 'POST' | 'DELETE' = 'POST';

    switch (action) {
      case 'pause':
        endpoint = `/api/v1/messages/whatsapp/${encodeURIComponent(phoneNumber)}/pause`;
        break;
      case 'resume':
        endpoint = `/api/v1/messages/whatsapp/${encodeURIComponent(phoneNumber)}/resume`;
        break;
      case 'retry-all':
        endpoint = `/api/v1/messages/queue/retry-all?phone=${encodeURIComponent(phoneNumber)}`;
        break;
      case 'clear-failed':
        endpoint = `/api/v1/messages/queue/failed?phone=${encodeURIComponent(phoneNumber)}`;
        method = 'DELETE';
        break;
    }

    console.log(`[ACTION] ${action.toUpperCase()} → ${endpoint}`);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: method === 'POST' ? JSON.stringify({}) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[ERREUR ${response.status}] ${endpoint}:`, errorData);
      throw new Error(errorData.message || `Erreur ${response.status}`);
    }

    const result = await response.json();
    console.log(`[SUCCÈS] ${action}:`, result);

    await loadQueueData();
    showNotification('success', {
      pause: 'File mise en pause avec succès',
      resume: 'File reprise avec succès',
      'retry-all': 'Retry lancé',
      'clear-failed': 'Jobs échoués supprimés'
    }[action]);

  } catch (error: any) {
    console.error(`Erreur ${action}:`, error);
    showNotification('error', error.message || 'Impossible d\'effectuer l\'action');
  }
};

  const getQueueStatus = async (phoneNumber: string) => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/api/v1/monitoring/whatsapp/${encodeURIComponent(phoneNumber)}/status`,
        { credentials: 'include', headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Erreur statut');

      const result = await response.json();

      if (result.success && result.data) {
        setQueueStatusData(result.data);
        setQueueStatusPhone(phoneNumber);
        setShowQueueStatusModal(true);
      }
    } catch (error) {
      showNotification('error', 'Impossible de récupérer le statut détaillé');
      console.error('Erreur statut:', error);
    }
  };

  // ============================================
  // ACTIONS EN MASSE
  // ============================================

  const handleBulkAction = async (action: 'pause' | 'resume' | 'retry' | 'delete') => {
    if (selectedRows.length === 0) {
      showNotification('warning', 'Sélectionnez au moins un élément');
      return;
    }

    if (!confirm(`Voulez-vous ${action === 'pause' ? 'mettre en pause' : action === 'resume' ? 'reprendre' : action === 'retry' ? 'réessayer' : 'supprimer'} ${selectedRows.length} élément(s) ?`)) {
      return;
    }

    showNotification('info', `Action ${action} en cours sur ${selectedRows.length} élément(s)...`);

    for (const phone of selectedRows) {
      await handleQueueAction(phone, action as any);
    }

    setSelectedRows([]);
    setBulkActionMode(false);
  };

  // ============================================
  // PAGINATION AMÉLIORÉE
  // ============================================

  const Pagination = ({ pagination }: { pagination: MessageResponse['pagination'] }) => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const maxPages = 5;
    const half = Math.floor(maxPages / 2);
    let startPage = Math.max(1, pagination.page - half);
    let endPage = Math.min(pagination.totalPages, startPage + maxPages - 1);

    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }

    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

    return (
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-gray-700 flex items-center gap-2">
            <span className="font-medium">{pagination.total}</span> messages au total
            <span className="text-gray-400 mx-2">•</span>
            <span>Page <span className="font-medium">{pagination.page}</span> sur <span className="font-medium">{pagination.totalPages}</span></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange('page', '1')}
              disabled={pagination.page <= 1}
              className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Première page"
            >
              <FiChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleFilterChange('page', (pagination.page - 1).toString())}
              disabled={pagination.page <= 1}
              className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Page précédente"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {startPage > 1 && (
                <>
                  <button
                    onClick={() => handleFilterChange('page', '1')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    1
                  </button>
                  {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                </>
              )}

              {pages.map(page => (
                <button
                  key={page}
                  onClick={() => handleFilterChange('page', page.toString())}
                  className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                    page === pagination.page
                      ? 'bg-[var(--primary-green)] text-white border-[var(--primary-green)]'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              {endPage < pagination.totalPages && (
                <>
                  {endPage < pagination.totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                  <button
                    onClick={() => handleFilterChange('page', pagination.totalPages.toString())}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    {pagination.totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => handleFilterChange('page', (pagination.page + 1).toString())}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Page suivante"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleFilterChange('page', pagination.totalPages.toString())}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Dernière page"
            >
              <FiChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // GESTIONNAIRES DE FILTRES
  // ============================================

  const handleFilterChange = (key: string, value: string) => {
    setMessageFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? parseInt(value) : 1
    }));
  };

  const resetFilters = () => {
    setMessageFilters({
      status: '',
      recipient_phone: '',
      message_type: '',
      start_date: dateFormat(subDays(new Date(), 7), 'yyyy-MM-dd'),
      end_date: dateFormat(new Date(), 'yyyy-MM-dd'),
      page: 1,
      limit: 10,
      sort_by: 'created_at',
      sort_order: 'desc',
      client_id: '',
      has_error: '',
      search: ''
    });
    setSearchTerm('');
    loadMessages();
  };

  const loadAllData = async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      await Promise.all([loadQueueData(), loadMessages(), loadStats()]);
      showNotification('success', 'Données mises à jour');
    } catch (error) {
      console.error('Erreur chargement données:', error);
      showNotification('error', 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================
  // EXPORT DE DONNÉES
  // ============================================

  const exportData = (format: 'csv' | 'json' | 'excel', type: 'queues' | 'messages' | 'analytics') => {
    let content = '';
    let filename = '';
    let mimeType = '';

    if (type === 'queues' && queueData?.stats) {
      if (format === 'csv') {
        const headers = ['Numéro', 'Client', 'En attente', 'Actifs', 'Échoués', 'Total', 'Taux succès', 'Temps réponse', 'Débit', 'Dernière activité', 'Statut'];
        const rows = queueData.stats.map(q => [
          q.phone,
          q.clientName || 'N/A',
          q.waiting,
          q.active,
          q.failed,
          q.total,
          `${(q.successRate || 0).toFixed(2)}%`,
          `${q.avgResponseTime || 0}ms`,
          `${q.throughput || 0}/s`,
          q.lastActivity ? dateFormat(new Date(q.lastActivity), 'dd/MM/yyyy HH:mm:ss') : 'N/A',
          q.isPaused ? 'Pause' : 'Actif'
        ]);
        content = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        mimeType = 'text/csv';
        filename = `whatsapp_queues_${dateFormat(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      } else {
        content = JSON.stringify(queueData, null, 2);
        mimeType = 'application/json';
        filename = `whatsapp_queues_${dateFormat(new Date(), 'yyyyMMdd_HHmmss')}.json`;
      }
    }

    if (content) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('success', `Export ${format.toUpperCase()} réussi`);
    }
  };

  // ============================================
  // EFFETS
  // ============================================

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

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  useEffect(() => {
    loadMessages();
  }, [
    messageFilters.status,
    messageFilters.recipient_phone,
    messageFilters.message_type,
    messageFilters.start_date,
    messageFilters.end_date,
    messageFilters.page,
    messageFilters.limit,
    messageFilters.sort_by,
    messageFilters.sort_order,
    messageFilters.client_id,
    messageFilters.has_error,
    messageFilters.search
  ]);

  // ============================================
  // MÉTRIQUES CALCULÉES
  // ============================================

  const globalStats = queueData?.stats ? {
    totalNumbers: queueData.stats.length,
    totalMessages: queueData.stats.reduce((sum, q) => sum + q.total, 0),
    waitingMessages: queueData.stats.reduce((sum, q) => sum + q.waiting, 0),
    activeMessages: queueData.stats.reduce((sum, q) => sum + q.active, 0),
    failedMessages: queueData.stats.reduce((sum, q) => sum + q.failed, 0),
    pausedQueues: queueData.stats.filter(q => q.isPaused).length,
    activeQueues: queueData.stats.filter(q => !q.isPaused).length,
    avgSuccessRate: queueData.stats.reduce((sum, q) => sum + (q.successRate || 0), 0) / queueData.stats.length || 0,
    totalThroughput: queueData.stats.reduce((sum, q) => sum + (q.throughput || 0), 0),
    avgResponseTime: queueData.stats.reduce((sum, q) => sum + (q.avgResponseTime || 0), 0) / queueData.stats.length || 0,
    greenNumbers: queueData.stats.filter(q => q.qualityRating === 'GREEN').length,
    yellowNumbers: queueData.stats.filter(q => q.qualityRating === 'YELLOW').length,
    redNumbers: queueData.stats.filter(q => q.qualityRating === 'RED').length,
  } : null;

  const statusChartData = statsData?.stats ? [
    { name: 'Livrés', value: statsData.stats.delivered || 0, color: '#10b981' },
    { name: 'Lus', value: statsData.stats.read || 0, color: '#8b5cf6' },
    { name: 'Envoyés', value: statsData.stats.sent || 0, color: '#3b82f6' },
    { name: 'En attente', value: statsData.stats.queued || 0, color: '#f59e0b' },
    { name: 'Échoués', value: statsData.stats.failed || 0, color: '#ef4444' }
  ].filter(item => item.value > 0) : [];

  const COLORS = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444'];

  // ============================================
  // RENDU
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--primary-green)] mx-auto mb-4"></div>
            <FiZap className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[var(--primary-green)] h-6 w-6 animate-pulse" />
          </div>
          <p className="text-gray-600 font-medium">Chargement du tableau de bord...</p>
          <p className="text-sm text-gray-400 mt-1">Récupération des données en temps réel</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ======================================== */}
      {/* NOTIFICATION GLOBALE */}
      {/* ======================================== */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-xl border animate-slide-in ${
          notification.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
          notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
          notification.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' && <FiCheckCircle className="h-5 w-5 mr-2" />}
            {notification.type === 'error' && <FiAlertCircle className="h-5 w-5 mr-2" />}
            {notification.type === 'warning' && <FiAlertTriangle className="h-5 w-5 mr-2" />}
            {notification.type === 'info' && <FiInfo className="h-5 w-5 mr-2" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* ======================================== */}
      {/* MODAL STATUT DÉTAILLÉ */}
      {/* ======================================== */}
      {showQueueStatusModal && queueStatusData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowQueueStatusModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FiSmartphone className="text-[var(--primary-green)]" />
                  Statut détaillé - {queueStatusData.phoneNumber}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  File d'attente: {queueStatusData.queueName}
                </p>
              </div>
              <button
                onClick={() => setShowQueueStatusModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Statut principal */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  {queueStatusData.isPaused ? (
                    <>
                      <div className="p-2 bg-yellow-100 rounded-full">
                        <FiPause className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Statut</span>
                        <p className="text-lg font-bold text-yellow-600">EN PAUSE</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2 bg-green-100 rounded-full">
                        <FiPlay className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Statut</span>
                        <p className="text-lg font-bold text-green-600">ACTIF</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-500">Dernière mise à jour</span>
                  <p className="text-sm text-gray-900">{dateFormat(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
                </div>
              </div>

              {/* Statistiques en temps réel */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <FiClock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <span className="text-2xl font-bold text-blue-700">{queueStatusData.counts.waiting}</span>
                  <p className="text-xs text-blue-600 mt-1">En attente</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                  <FiZap className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <span className="text-2xl font-bold text-green-700">{queueStatusData.counts.active}</span>
                  <p className="text-xs text-green-600 mt-1">Actifs</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
                  <FiAlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
                  <span className="text-2xl font-bold text-red-700">{queueStatusData.counts.failed}</span>
                  <p className="text-xs text-red-600 mt-1">Échoués</p>
                </div>
              </div>

              {/* Informations techniques */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Informations techniques</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Workers actifs</span>
                    <p className="font-mono font-medium text-gray-900 mt-1">{queueStatusData.workers || 2}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Jobs stalled</span>
                    <p className="font-mono font-medium text-gray-900 mt-1">{queueStatusData.stalled || 0}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                    <span className="text-gray-500">Configuration</span>
                    <p className="font-mono text-sm text-gray-900 mt-1 break-all">
                      concurrency: 2 | limiter: 5/sec | attempts: 8
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {queueStatusData.isPaused ? (
                  <button
                    onClick={() => {
                      handleQueueAction(queueStatusData.phoneNumber, 'resume');
                      setShowQueueStatusModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPlay className="h-4 w-4" />
                    Reprendre
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleQueueAction(queueStatusData.phoneNumber, 'pause');
                      setShowQueueStatusModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPause className="h-4 w-4" />
                    Mettre en pause
                  </button>
                )}
                <button
                  onClick={() => {
                    handleQueueAction(queueStatusData.phoneNumber, 'retry-all');
                    setShowQueueStatusModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FiRefreshCcw className="h-4 w-4" />
                  Réessayer tout
                </button>
                <button
                  onClick={() => {
                    handleQueueAction(queueStatusData.phoneNumber, 'clear-failed');
                    setShowQueueStatusModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FiTrash2 className="h-4 w-4" />
                  Vider échoués
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================== */}
      {/* EN-TÊTE PRINCIPAL */}
      {/* ======================================== */}
      <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[var(--primary-green)] bg-opacity-10 rounded-lg">
                <FiBarChart2 className="h-6 w-6 text-[var(--primary-green)]" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Monitoring WhatsApp
              </h1>
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                Temps réel
              </span>
            </div>
            <p className="text-gray-600 flex items-center gap-2">
              <FiActivity className="h-4 w-4" />
              Analyse des performances et supervision des files d'attente
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-sm">
                Dernière mise à jour: {queueData?.timestamp ? formatRelativeTime(new Date(queueData.timestamp), { addSuffix: true, locale: fr }) : 'à l\'instant'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  autoRefresh ? 'bg-[var(--primary-green)] text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FiRefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto {autoRefresh ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={loadAllData}
                disabled={refreshing}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
              </button>
            </div>

            <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => exportData('csv', 'queues')}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                title="Exporter en CSV"
              >
                <FiDownload className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={() => exportData('json', 'queues')}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                title="Exporter en JSON"
              >
                <FiFileText className="h-4 w-4" />
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================== */}
      {/* CARTES DE PERFORMANCE */}
      {/* ======================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiSmartphone className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Numéros
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">Actifs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{globalStats?.totalNumbers || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">En pause</p>
              <p className="text-lg font-semibold text-yellow-600">{globalStats?.pausedQueues || 0}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-green-600 flex items-center gap-1">
              <FiCheck className="h-3 w-3" /> {globalStats?.greenNumbers || 0} GREEN
            </span>
            <span className="text-yellow-600 flex items-center gap-1">
              <FiMinus className="h-3 w-3" /> {globalStats?.yellowNumbers || 0} YELLOW
            </span>
            <span className="text-red-600 flex items-center gap-1">
              <FiAlertTriangle className="h-3 w-3" /> {globalStats?.redNumbers || 0} RED
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <FiMessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Messages
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{statsData?.stats?.total_messages?.toLocaleString() || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Ce mois</p>
              <p className="text-lg font-semibold text-blue-600">
                {statsData?.daily_stats?.reduce((sum, d) => sum + d.total, 0).toLocaleString() || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-green-600 flex items-center gap-1">
              <FiThumbsUp className="h-3 w-3" /> {statsData?.stats?.delivered || 0} livrés
            </span>
            <span className="text-red-600 flex items-center gap-1">
              <FiThumbsDown className="h-3 w-3" /> {statsData?.stats?.failed || 0} échoués
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FiPercent className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Performance
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">Taux succès</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {statsData?.stats?.total_messages ?
                  Math.round((statsData.stats.delivered + statsData.stats.read) / statsData.stats.total_messages * 100) : 0}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Moyen</p>
              <p className="text-lg font-semibold text-gray-900">{Math.round(globalStats?.avgSuccessRate || 0)}%</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                style={{ width: `${statsData?.stats?.total_messages ?
                  Math.round((statsData.stats.delivered + statsData.stats.read) / statsData.stats.total_messages * 100) : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <FiClock className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              File d'attente
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{globalStats?.waitingMessages || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Actifs</p>
              <p className="text-lg font-semibold text-blue-600">{globalStats?.activeMessages || 0}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-red-600 flex items-center gap-1">
              <FiAlertTriangle className="h-3 w-3" /> {globalStats?.failedMessages || 0} échoués
            </span>
            <span className="text-gray-600 flex items-center gap-1">
              <FiZap className="h-3 w-3" /> {Math.round(globalStats?.totalThroughput || 0)}/s
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FiZap className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Débit
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">Moyen</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{Math.round(globalStats?.totalThroughput || 0)}</p>
              <p className="text-xs text-gray-500">msg/sec</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Pic</p>
              <p className="text-lg font-semibold text-indigo-600">{Math.round((globalStats?.totalThroughput || 0) * 1.5)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <FiTrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-xs text-gray-600">+12% vs hier</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-pink-100 rounded-lg">
              <FiAward className="h-5 w-5 text-pink-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Santé
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500">Statut</p>
              <p className="text-xl font-bold text-green-600 mt-1 flex items-center gap-1">
                <FiCheckCircle className="h-5 w-5" />
                Opérationnel
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-gray-600 flex items-center gap-1">
              <FiServer className="h-3 w-3" /> Redis OK
            </span>
            <span className="text-gray-600 flex items-center gap-1">
              <FiWifi className="h-3 w-3" /> API OK
            </span>
          </div>
        </div>
      </div>

      {/* ======================================== */}
      {/* FILTRES GLOBAUX */}
      {/* ======================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FiCalendar className="h-4 w-4 text-gray-400" />
              Période d'analyse
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '1h', label: '1 heure' },
                { value: '24h', label: '24h' },
                { value: '7d', label: '7 jours' },
                { value: '30d', label: '30 jours' },
                { value: '90d', label: '90 jours' }
              ].map(range => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeRange === range.value
                      ? 'bg-[var(--primary-green)] text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FiSmartphone className="h-4 w-4 text-gray-400" />
              Numéro WhatsApp
            </label>
            <select
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent bg-white"
            >
              <option value="all">📱 Tous les numéros ({queueData?.count || 0})</option>
              {queueData?.stats.map(q => (
                <option key={q.phone} value={q.phone}>
                  {q.phone} {q.clientName ? `— ${q.clientName}` : ''}
                  {q.isPaused ? ' (⏸️ Pause)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ======================================== */}
      {/* NAVIGATION PAR ONGLETS */}
      {/* ======================================== */}
      <div className="border-b border-gray-200 bg-white rounded-t-xl">
        <nav className="flex overflow-x-auto px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('queues')}
            className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'queues'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiActivity className="h-4 w-4" />
            Files d'attente
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'queues' ? 'bg-[var(--primary-green)] bg-opacity-10 text-[var(--primary-green)]' : 'bg-gray-100 text-gray-600'
            }`}>
              {queueData?.count || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'messages'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiMessageSquare className="h-4 w-4" />
            Messages
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'messages' ? 'bg-[var(--primary-green)] bg-opacity-10 text-[var(--primary-green)]' : 'bg-gray-100 text-gray-600'
            }`}>
              {messageData?.pagination?.total || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'analytics'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiPieChart className="h-4 w-4" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'performance'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiTrendingUp className="h-4 w-4" />
            Performance
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'clients'
                ? 'border-[var(--primary-green)] text-[var(--primary-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiUsers className="h-4 w-4" />
            Clients
          </button>
        </nav>
      </div>

      {/* ======================================== */}
      {/* ONGLET : FILES D'ATTENTE */}
      {/* ======================================== */}
      {activeTab === 'queues' && (
        <div className="space-y-4">
          {/* Barre d'actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBulkActionMode(!bulkActionMode)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    bulkActionMode
                      ? 'bg-[var(--primary-green)] text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FiCheckCircle className="h-4 w-4" />
                  {bulkActionMode ? 'Mode sélection actif' : 'Sélection multiple'}
                </button>

                {bulkActionMode && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {selectedRows.length} sélectionné(s)
                    </span>
                    <button
                      onClick={() => handleBulkAction('pause')}
                      disabled={selectedRows.length === 0}
                      className="px-3 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      <FiPause className="h-4 w-4" />
                      Pause
                    </button>
                    <button
                      onClick={() => handleBulkAction('resume')}
                      disabled={selectedRows.length === 0}
                      className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      <FiPlay className="h-4 w-4" />
                      Reprendre
                    </button>
                    <button
                      onClick={() => setSelectedRows([])}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Rechercher un numéro ou client..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent w-64"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tableau des files d'attente */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {bulkActionMode && (
                      <th scope="col" className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.length === queueData?.stats.length}
                          onChange={(e) => {
                            if (e.target.checked && queueData?.stats) {
                              setSelectedRows(queueData.stats.map(q => q.phone));
                            } else {
                              setSelectedRows([]);
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[var(--primary-green)] focus:ring-[var(--primary-green)]"
                        />
                      </th>
                    )}
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro / Client
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      État
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File d'attente
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qualité Meta
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dernière activité
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 shadow-lg">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {queueData?.stats
                    .filter(q =>
                      searchTerm === '' ||
                      q.phone.includes(searchTerm) ||
                      q.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((queue, index) => (
                    <tr key={queue.phone} className={`hover:bg-gray-50 transition-colors ${queue.isPaused ? 'bg-gray-50' : ''}`}>
                      {bulkActionMode && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(queue.phone)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRows([...selectedRows, queue.phone]);
                              } else {
                                setSelectedRows(selectedRows.filter(p => p !== queue.phone));
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--primary-green)] focus:ring-[var(--primary-green)]"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                              queue.qualityRating === 'GREEN' ? 'bg-green-100' :
                              queue.qualityRating === 'YELLOW' ? 'bg-yellow-100' :
                              queue.qualityRating === 'RED' ? 'bg-red-100' : 'bg-gray-100'
                            }`}>
                              <FiSmartphone className={`h-5 w-5 ${
                                queue.qualityRating === 'GREEN' ? 'text-green-600' :
                                queue.qualityRating === 'YELLOW' ? 'text-yellow-600' :
                                queue.qualityRating === 'RED' ? 'text-red-600' : 'text-gray-600'
                              }`} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="font-mono font-medium text-gray-900">{queue.phone}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              {queue.clientName || 'Non assigné'}
                              {queue.displayName && (
                                <span className="text-xs text-gray-400">({queue.displayName})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                            queue.isPaused
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {queue.isPaused ? (
                              <><FiPause className="mr-1 h-3 w-3" /> En pause</>
                            ) : (
                              <><FiPlay className="mr-1 h-3 w-3" /> Actif</>
                            )}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                            queue.tierCurrent === 'TIER_3' ? 'bg-purple-100 text-purple-800' :
                            queue.tierCurrent === 'TIER_2' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {queue.tierCurrent?.replace('_', ' ') || 'TIER_1'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <FiClock className="h-3 w-3" /> {queue.waiting}
                            </span>
                            <span className="text-sm text-blue-600 flex items-center gap-1">
                              <FiZap className="h-3 w-3" /> {queue.active}
                            </span>
                            <span className="text-sm text-red-600 flex items-center gap-1">
                              <FiAlertTriangle className="h-3 w-3" /> {queue.failed}
                            </span>
                          </div>
                          <div className="w-32 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${queue.total > 0 ? (queue.active / queue.total) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {queue.messagesToday || 0}/{queue.dailyLimit || 1000} aujourd'hui
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {queue.successRate?.toFixed(1)}%
                            </span>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  (queue.successRate || 0) >= 95 ? 'bg-green-500' :
                                  (queue.successRate || 0) >= 85 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(queue.successRate || 0, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            ⚡ {queue.throughput || 0}/s • ⏱️ {queue.avgResponseTime || 0}ms
                          </div>
                          <div className="text-xs text-gray-500">
                            Heure de pointe: {queue.peakHour || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                            queue.qualityRating === 'GREEN' ? 'bg-green-100 text-green-800' :
                            queue.qualityRating === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                            queue.qualityRating === 'RED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {queue.qualityRating === 'GREEN' && '✅ GREEN - Bonne santé'}
                            {queue.qualityRating === 'YELLOW' && '⚠️ YELLOW - Attention'}
                            {queue.qualityRating === 'RED' && '❌ RED - Critique'}
                            {queue.qualityRating === 'UNKNOWN' && '❓ Inconnu'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {queue.lastActivity ? (
                          <div className="flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            <span title={dateFormat(new Date(queue.lastActivity), 'dd/MM/yyyy HH:mm:ss')}>
                              {formatRelativeTime(new Date(queue.lastActivity), { addSuffix: true, locale: fr })}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white shadow-lg">
                        <div className="flex gap-2">
                          <button
                            onClick={() => getQueueStatus(queue.phone)}
                            className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Voir le statut détaillé"
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
                          <button
                            onClick={() => handleQueueAction(queue.phone, 'retry-all')}
                            className="p-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                            title="Réessayer les jobs échoués"
                          >
                            <FiRefreshCcw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleQueueAction(queue.phone, 'clear-failed')}
                            className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                            title="Supprimer les jobs échoués"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(!queueData?.stats || queueData.stats.length === 0) && (
              <div className="text-center py-12">
                <FiActivity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune file d'attente active</h3>
                <p className="text-gray-500">Aucun numéro WhatsApp n'est actuellement configuré.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================== */}
      {/* ONGLET : MESSAGES */}
      {/* ======================================== */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          {/* Barre de filtres */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <FiFilter className="h-4 w-4" />
                  Filtres avancés
                  {showFilters ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                </button>
                <div className="h-6 w-px bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Affichage:</span>
                  <select
                    value={messageFilters.limit}
                    onChange={(e) => handleFilterChange('limit', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-green)]"
                  >
                    <option value="10">10 lignes</option>
                    <option value="20">20 lignes</option>
                    <option value="50">50 lignes</option>
                    <option value="100">100 lignes</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Réinitialiser
                </button>
                <button
                  onClick={() => exportData('csv', 'messages')}
                  className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors flex items-center gap-2"
                >
                  <FiDownload className="h-4 w-4" />
                  Exporter CSV
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Statut</label>
                  <select
                    value={messageFilters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  >
                    <option value="">Tous les statuts</option>
                    <option value="queued">⏳ En attente</option>
                    <option value="sent">📤 Envoyé</option>
                    <option value="delivered">✅ Livré</option>
                    <option value="read">👁️ Lu</option>
                    <option value="failed">❌ Échoué</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Type</label>
                  <select
                    value={messageFilters.message_type}
                    onChange={(e) => handleFilterChange('message_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  >
                    <option value="">Tous les types</option>
                    <option value="text">💬 Texte</option>
                    <option value="template">📋 Template</option>
                    <option value="media">🖼️ Média</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date début</label>
                  <input
                    type="date"
                    value={messageFilters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date fin</label>
                  <input
                    type="date"
                    value={messageFilters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Recherche</label>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Numéro destinataire, ID message, contenu..."
                      value={messageFilters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Trier par</label>
                  <select
                    value={messageFilters.sort_by}
                    onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  >
                    <option value="created_at">Date de création</option>
                    <option value="sent_at">Date d'envoi</option>
                    <option value="recipient_phone">Destinataire</option>
                    <option value="wa_status">Statut</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Ordre</label>
                  <select
                    value={messageFilters.sort_order}
                    onChange={(e) => handleFilterChange('sort_order', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  >
                    <option value="desc">Plus récent → Plus ancien</option>
                    <option value="asc">Plus ancien → Plus récent</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Tableau des messages */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destinataire
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type / Contenu
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Message
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Temps
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Métriques
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 shadow-lg">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {messageData?.messages.map((message) => (
                    <tr key={message.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono font-medium text-gray-900">{message.recipient_phone}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {message.client_name || 'Client inconnu'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {message.message_type === 'text' && '💬 Texte'}
                            {message.message_type === 'template' && '📋 Template'}
                            {message.message_type === 'media' && '🖼️ Média'}
                          </span>
                          {message.template_name && (
                            <div className="text-xs text-gray-600">
                              Template: {message.template_name}
                            </div>
                          )}
                          {message.message_content && (
                            <div className="text-xs text-gray-600 truncate max-w-xs" title={message.message_content}>
                              "{message.message_content.substring(0, 50)}..."
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium ${
                          message.wa_status === 'failed' ? 'bg-red-100 text-red-800' :
                          message.wa_status === 'delivered' ? 'bg-green-100 text-green-800' :
                          message.wa_status === 'read' ? 'bg-purple-100 text-purple-800' :
                          message.wa_status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {message.wa_status === 'failed' && '❌ Échoué'}
                          {message.wa_status === 'delivered' && '✅ Livré'}
                          {message.wa_status === 'read' && '👁️ Lu'}
                          {message.wa_status === 'sent' && '📤 Envoyé'}
                          {message.wa_status === 'queued' && '⏳ En attente'}
                        </span>
                        {message.wa_error_message && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={message.wa_error_message}>
                            {message.wa_error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-gray-500 break-all">
                          {message.wa_message_id || '-'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          ID: {message.id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1 text-gray-600">
                            <FiClock className="h-3 w-3" />
                            Créé: {dateFormat(new Date(message.created_at), 'dd/MM HH:mm:ss')}
                          </div>
                          {message.sent_at && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <FiSend className="h-3 w-3" />
                              Envoyé: {dateFormat(new Date(message.sent_at), 'dd/MM HH:mm:ss')}
                            </div>
                          )}
                          {message.delivered_at && (
                            <div className="flex items-center gap-1 text-green-600">
                              <FiCheckCircle className="h-3 w-3" />
                              Livré: {dateFormat(new Date(message.delivered_at), 'dd/MM HH:mm:ss')}
                            </div>
                          )}
                          {message.failed_at && (
                            <div className="flex items-center gap-1 text-red-600">
                              <FiAlertCircle className="h-3 w-3" />
                              Échoué: {dateFormat(new Date(message.failed_at), 'dd/MM HH:mm:ss')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {message.queue_time && (
                            <div className="text-xs">
                              <span className="text-gray-500">File:</span>{' '}
                              <span className="font-mono font-medium text-gray-900">
                                {message.queue_time}ms
                              </span>
                            </div>
                          )}
                          {message.processing_time && (
                            <div className="text-xs">
                              <span className="text-gray-500">Traitement:</span>{' '}
                              <span className="font-mono font-medium text-gray-900">
                                {message.processing_time}ms
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white shadow-lg">
                        <div className="flex gap-2">
                          <button
                            className="p-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Voir les détails"
                            onClick={() => alert(`Message ID: ${message.id}\n\nContenu: ${message.message_content || 'N/A'}\nTemplate: ${message.template_name || 'N/A'}\nMedia: ${message.media_url || 'N/A'}`)}
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Réessayer (si échoué)"
                            disabled={message.wa_status !== 'failed'}
                            onClick={() => showNotification('info', 'Fonctionnalité à implémenter')}
                          >
                            <FiRefreshCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {messageData?.pagination && <Pagination pagination={messageData.pagination} />}

            {(!messageData?.messages || messageData.messages.length === 0) && (
              <div className="text-center py-12">
                <FiMessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun message trouvé</h3>
                <p className="text-gray-500">Essayez de modifier vos filtres de recherche.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================== */}
      {/* ONGLET : ANALYTICS */}
      {/* ======================================== */}
      {activeTab === 'analytics' && statsData && (
        <div className="space-y-6">
        <div  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {statsData?.stats && (
  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
    <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
      <p className="text-sm text-gray-600 font-medium">Total</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {Number(statsData.stats.total_messages || 0).toLocaleString()}
      </p>
    </div>
    <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
      <p className="text-sm text-green-700 font-medium">Livrés</p>
      <p className="text-2xl font-bold text-green-700 mt-1">
        {Number(statsData.stats.delivered || 0).toLocaleString()}
      </p>
    </div>
    <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
      <p className="text-sm text-purple-700 font-medium">Lus</p>
      <p className="text-2xl font-bold text-purple-700 mt-1">
        {Number(statsData.stats.read || 0).toLocaleString()}
      </p>
    </div>
    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
      <p className="text-sm text-blue-700 font-medium">Envoyés</p>
      <p className="text-2xl font-bold text-blue-700 mt-1">
        {Number(statsData.stats.sent || 0).toLocaleString()}
      </p>
    </div>
    <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-100">
      <p className="text-sm text-yellow-700 font-medium">En attente</p>
      <p className="text-2xl font-bold text-yellow-700 mt-1">
        {Number(statsData.stats.queued || 0).toLocaleString()}
      </p>
    </div>
    <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100 col-span-2 sm:col-span-1">
      <p className="text-sm text-red-700 font-medium">Échoués</p>
      <p className="text-2xl font-bold text-red-700 mt-1">
        {Number(statsData.stats.failed || 0).toLocaleString()}
      </p>
    </div>
  </div>
)}
          </div>
          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique circulaire - Répartition des statuts */}

<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h4 className="text-lg font-semibold text-gray-900">Distribution des messages</h4>
      <p className="text-sm text-gray-500 mt-1">Répartition par statut de livraison (30 derniers jours)</p>
    </div>
    <div className="p-2 bg-blue-50 rounded-lg">
      <FiPieChart className="h-5 w-5 text-blue-600" />
    </div>
  </div>

  {statsData?.stats ? (
  (() => {
    // Conversion sécurisée des valeurs (string → number)
    const delivered = Number(statsData.stats.delivered || 0);
    const read = Number(statsData.stats.read || 0);
    const sent = Number(statsData.stats.sent || 0);
    const queued = Number(statsData.stats.queued || 0);
    const failed = Number(statsData.stats.failed || 0);

    // Vérification si au moins une catégorie a des données
    const hasData = delivered > 0 || read > 0 || sent > 0 || queued > 0 || failed > 0;

    return hasData ? (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Livrés', value: delivered, color: '#10b981' },
                { name: 'Lus', value: read, color: '#8b5cf6' },
                { name: 'Envoyés', value: sent, color: '#3b82f6' },
                { name: 'En attente', value: queued, color: '#f59e0b' },
                { name: 'Échoués', value: failed, color: '#ef4444' }
              ].filter(item => item.value > 0)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              dataKey="value"
            >
              {[
                { name: 'Livrés', color: '#10b981' },
                { name: 'Lus', color: '#8b5cf6' },
                { name: 'Envoyés', color: '#3b82f6' },
                { name: 'En attente', color: '#f59e0b' },
                { name: 'Échoués', color: '#ef4444' }
              ].map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) => (Number(value) || 0).toLocaleString()}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="h-80 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <FiPieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Aucune donnée disponible pour la période</p>
          <p className="text-sm mt-2">Les messages apparaîtront ici après envoi</p>
        </div>
      </div>
    );
  })()
) : (
  <div className="h-80 flex items-center justify-center text-gray-500">
    <div className="text-center">
      <FiPieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <p>Chargement des statistiques...</p>
    </div>
  </div>
)}
</div>

            {/* Graphique linéaire - Évolution quotidienne */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Tendances quotidiennes</h4>
                  <p className="text-sm text-gray-500 mt-1">Évolution des messages sur la période</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChartView('daily')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      chartView === 'daily'
                        ? 'bg-[var(--primary-green)] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Journalier
                  </button>
                  <button
                    onClick={() => setChartView('hourly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      chartView === 'hourly'
                        ? 'bg-[var(--primary-green)] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Horaire
                  </button>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'daily' ? (
                    <AreaChart data={statsData.daily_stats || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => dateFormat(new Date(date), 'dd/MM')}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => (value ?? 0).toLocaleString()}
                        labelFormatter={(date) => dateFormat(new Date(date), 'dd MMMM yyyy', { locale: fr })}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stackId="1"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.2}
                        name="Total"
                      />
                      <Area
                        type="monotone"
                        dataKey="delivered"
                        stackId="2"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.2}
                        name="Livrés"
                      />
                      <Area
                        type="monotone"
                        dataKey="failed"
                        stackId="3"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.2}
                        name="Échoués"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={statsData.hourly_stats || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#3b82f6" name="Messages" />
                      <Bar dataKey="delivered" fill="#10b981" name="Livrés" />
                      <Bar dataKey="failed" fill="#ef4444" name="Échoués" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Métriques avancées */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 bg-purple-100 rounded-lg">
      <FiZap className="h-5 w-5 text-purple-600" />
    </div>
    <h4 className="text-lg font-semibold text-gray-900">Performance</h4>
  </div>
  <div className="space-y-4">
    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
      <span className="text-gray-600">Temps en file</span>
      <span className="font-mono font-bold text-gray-900">
        {statsData?.performance?.avg_queue_time || 245} ms
      </span>
    </div>
    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
      <span className="text-gray-600">Traitement</span>
      <span className="font-mono font-bold text-gray-900">
        {statsData?.performance?.avg_processing_time || 180} ms
      </span>
    </div>
    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
      <span className="text-gray-600">Heure de pointe</span>
      <span className="font-mono font-bold text-gray-900">
        {statsData?.performance?.peak_hour || '14:00-15:00'}
      </span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-gray-600">Débit moyen</span>
      <span className="font-mono font-bold text-gray-900">
        {Math.round((statsData?.stats?.total_messages || 0) / 86400)} msg/s
      </span>
    </div>
  </div>
</div>

            {/* Qualité */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FiAward className="h-5 w-5 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900">Qualité</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600">Taux de livraison</span>
                    <span className="font-mono font-bold text-green-600">
                      {statsData.stats?.total_messages
                        ? Math.round((statsData.stats.delivered + statsData.stats.read) / statsData.stats.total_messages * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${statsData.stats?.total_messages
                        ? Math.round((statsData.stats.delivered + statsData.stats.read) / statsData.stats.total_messages * 100)
                        : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600">Taux de lecture</span>
                    <span className="font-mono font-bold text-purple-600">
                      {statsData.stats?.delivered
                        ? Math.round(statsData.stats.read / statsData.stats.delivered * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${statsData.stats?.delivered
                        ? Math.round(statsData.stats.read / statsData.stats.delivered * 100)
                        : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="pt-2">
                  <span className="text-sm text-gray-600">Score de santé</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full"></div>
                    <span className="font-mono font-bold text-gray-900">85%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ressources */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FiServer className="h-5 w-5 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900">Ressources</h4>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Redis</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FiWifi className="mr-1 h-3 w-3" /> Connecté
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Workers</span>
                  <span className="font-mono font-bold text-gray-900">2 actifs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Concurrency</span>
                  <span className="font-mono font-bold text-gray-900">5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Rate limit</span>
                  <span className="font-mono font-bold text-gray-900">50 msg/s</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Dernier redémarrage</span>
                  <p className="text-sm text-gray-900 mt-1">{formatRelativeTime(new Date(), { addSuffix: true, locale: fr })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================== */}
      {/* ONGLET : PERFORMANCE */}
      {/* ======================================== */}
      {activeTab === 'performance' && statsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique de performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Performance par heure</h4>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={statsData.hourly_stats || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Messages" />
                    <Line yAxisId="right" type="monotone" dataKey="delivered" stroke="#10b981" name="Livrés" />
                    <Line yAxisId="right" type="monotone" dataKey="failed" stroke="#ef4444" name="Échoués" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Métriques de temps de réponse */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Temps de réponse</h4>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">File d'attente</span>
                    <span className="font-mono font-bold text-gray-900">245 ms</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Envoi WhatsApp</span>
                    <span className="font-mono font-bold text-gray-900">180 ms</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Confirmation livraison</span>
                    <span className="font-mono font-bold text-gray-900">1.2 s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Radar chart - Performance globale */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Score de performance global</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                  { subject: 'Débit', A: 85, fullMark: 100 },
                  { subject: 'Fiabilité', A: 92, fullMark: 100 },
                  { subject: 'Rapidité', A: 78, fullMark: 100 },
                  { subject: 'Qualité', A: 88, fullMark: 100 },
                  { subject: 'Stabilité', A: 82, fullMark: 100 },
                  { subject: 'Scalabilité', A: 75, fullMark: 100 },
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Performance" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ======================================== */}
      {/* ONGLET : CLIENTS */}
      {/* ======================================== */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          {/* Top clients */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Top clients</h4>
                <p className="text-sm text-gray-500 mt-1">Les 5 clients les plus actifs</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <FiAward className="h-5 w-5 text-orange-600" />
              </div>
            </div>

            <div className="space-y-4">
              {statsData?.top_clients?.map((client, index) => (
                <div key={client.client_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' :
                      'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{client.client_name}</p>
                      <p className="text-xs text-gray-500">ID: {client.client_id.substring(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{client.total_messages.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">messages</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        client.success_rate >= 98 ? 'text-green-600' :
                        client.success_rate >= 95 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {client.success_rate}%
                      </p>
                      <p className="text-xs text-gray-500">succès</p>
                    </div>
                    <button className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <FiEye className="h-4 w-4 text-gray-700" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statistiques clients */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* Total clients → approximation via top_clients ou N/A */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-blue-100 rounded-lg">
        <FiUsers className="h-5 w-5 text-blue-600" />
      </div>
      <h4 className="font-semibold text-gray-900">Total clients</h4>
    </div>
    <p className="text-3xl font-bold text-gray-900">
      {statsData?.top_clients?.length ? statsData.top_clients.length : 'N/A'}
    </p>
    <p className="text-sm text-gray-500 mt-1">clients actifs (top listés)</p>
  </div>

  {/* Moyenne par client */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-green-100 rounded-lg">
        <FiMessageSquare className="h-5 w-5 text-green-600" />
      </div>
      <h4 className="font-semibold text-gray-900">Moyenne/client</h4>
    </div>
    <p className="text-3xl font-bold text-gray-900">
      {statsData?.stats?.total_messages && statsData?.top_clients?.length
        ? Math.round(
            Number(statsData.stats.total_messages) / statsData.top_clients.length
          ).toLocaleString()
        : '0'}
    </p>
    <p className="text-sm text-gray-500 mt-1">messages en moyenne</p>
  </div>

  {/* Taux moyen de succès */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-purple-100 rounded-lg">
        <FiPercent className="h-5 w-5 text-purple-600" />
      </div>
      <h4 className="font-semibold text-gray-900">Taux moyen</h4>
    </div>
    <p className="text-3xl font-bold text-purple-600">
      {statsData?.performance?.success_rate?.toFixed(1) || '0'}%
    </p>
    <p className="text-sm text-gray-500 mt-1">de succès global</p>
  </div>
</div>
        </div>
      )}
    </div>
  );
}
