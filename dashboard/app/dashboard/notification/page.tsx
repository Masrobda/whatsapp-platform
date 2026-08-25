// /var/www/numericexport/dashboard/app/dashboard/notification/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  FiBell,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiInfo,
  FiTag,
  FiSend,
  FiEye,
  FiArchive,
  FiCheck,
  FiUsers,
  FiBarChart2,
  FiSettings,
  FiCalendar,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiRefreshCw
} from 'react-icons/fi';

// Types
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'promotion';
  action_url?: string;
  action_label?: string;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  read_at?: string;
  metadata?: any;
}

interface NotificationStats {
  total: number;
  read_count: number;
  unread_count: number;
  archived_count: number;
  promotion_count: number;
  info_count: number;
  success_count: number;
  warning_count: number;
  error_count: number;
}

interface BroadcastHistory {
  id: string;
  title: string;
  message: string;
  type: string;
  target_clients: string;
  total_sent: number;
  created_at: string;
}

interface PromotionHistory {
  id: string;
  title: string;
  promotion_code: string;
  discount_percentage: number;
  valid_until: string;
  target_segments: string;
  total_sent: number;
  created_at: string;
}

// Composant de badge de type
const TypeBadge = ({ type }: { type: string }) => {
  const config: Record<string, { icon: any; class: string; label: string }> = {
    info: { icon: FiInfo, class: 'bg-blue-100 text-blue-700', label: 'Information' },
    success: { icon: FiCheckCircle, class: 'bg-green-100 text-green-700', label: 'Succès' },
    warning: { icon: FiAlertCircle, class: 'bg-yellow-100 text-yellow-700', label: 'Attention' },
    error: { icon: FiXCircle, class: 'bg-red-100 text-red-700', label: 'Erreur' },
    promotion: { icon: FiTag, class: 'bg-purple-100 text-purple-700', label: 'Promotion' }
  };
  
  const { icon: Icon, class: className, label } = config[type] || config.info;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

// Composant de carte statistique
const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600'
  };
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0, read_count: 0, unread_count: 0, archived_count: 0,
    promotion_count: 0, info_count: 0, success_count: 0, warning_count: 0, error_count: 0
  });
  const [broadcasts, setBroadcasts] = useState<BroadcastHistory[]>([]);
  const [promotions, setPromotions] = useState<PromotionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notifications' | 'broadcasts' | 'promotions' | 'preferences'>('notifications');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [showPromotionForm, setShowPromotionForm] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  
  // Formulaire de notification
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    type: 'info',
    target_clients: 'all',
    client_ids: [] as string[],
    action_url: '',
    action_label: ''
  });
  
  // Formulaire de promotion
  const [promotionForm, setPromotionForm] = useState({
    title: '',
    message: '',
    promotion_code: '',
    discount_percentage: 0,
    valid_until: '',
    target_segments: 'all',
    segment_ids: [] as string[]
  });
  
  // Préférences
  const [preferences, setPreferences] = useState({
    email_enabled: true,
    push_enabled: true,
    promotion_enabled: true,
    system_enabled: true,
    quiet_hours_start: '',
    quiet_hours_end: ''
  });

  // Récupérer le token
  const getToken = () => {
    return Cookies.get('token') || localStorage.getItem('token');
  };

  // Récupérer le rôle utilisateur
  useEffect(() => {
  const userCookie = Cookies.get('user');
  console.log('📦 [NotificationsPage] userCookie:', userCookie);
  
  if (userCookie) {
    try {
      const user = JSON.parse(userCookie);
      console.log('📦 [NotificationsPage] user parsed:', user);
      setUserRole(user.role?.toLowerCase() || user.type?.toLowerCase() || '');
    } catch (e) {
      console.error('Error parsing user', e);
    }
  }
}, []);

  // Charger les notifications
  const loadNotifications = useCallback(async () => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      toast.error('Erreur lors du chargement des notifications');
    }
  }, []);

  // Charger les statistiques
  const loadStats = useCallback(async () => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  }, []);

  // Charger les diffusions (admin)
  const loadBroadcasts = useCallback(async () => {
    if (userRole !== 'admin') return;
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/broadcasts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBroadcasts(data.broadcasts);
      }
    } catch (error) {
      console.error('Erreur broadcasts:', error);
    }
  }, [userRole]);

  // Charger les promotions (admin)
  const loadPromotions = useCallback(async () => {
    if (userRole !== 'admin') return;
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/promotions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setPromotions(data.promotions);
      }
    } catch (error) {
      console.error('Erreur promotions:', error);
    }
  }, [userRole]);

  // Charger les préférences
  const loadPreferences = useCallback(async () => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.preferences) {
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Erreur préférences:', error);
    }
  }, []);

  // Marquer comme lu
  const markAsRead = async (id: string) => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(notifications.map(n => 
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ));
        toast.success('Notification marquée comme lue');
        loadStats();
      }
    } catch (error) {
      toast.error('Erreur lors du marquage');
    }
  };

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(notifications.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
        toast.success('Toutes les notifications ont été marquées comme lues');
        loadStats();
      }
    } catch (error) {
      toast.error('Erreur lors du marquage');
    }
  };

  // Archiver
  const archiveNotification = async (id: string) => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/archive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(notifications.filter(n => n.id !== id));
        toast.success('Notification archivée');
        loadStats();
      }
    } catch (error) {
      toast.error('Erreur lors de l\'archivage');
    }
  };

  // Envoyer une diffusion
  const sendBroadcast = async () => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/broadcast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(broadcastForm)
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Notification envoyée à ${data.total_sent} clients`);
        setShowBroadcastForm(false);
        setBroadcastForm({
          title: '', message: '', type: 'info', target_clients: 'all',
          client_ids: [], action_url: '', action_label: ''
        });
        loadBroadcasts();
      } else {
        toast.error(data.message || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    }
  };

  // Envoyer une promotion
  const sendPromotion = async () => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/promotion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(promotionForm)
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Promotion envoyée à ${data.total_sent} clients`);
        setShowPromotionForm(false);
        setPromotionForm({
          title: '', message: '', promotion_code: '', discount_percentage: 0,
          valid_until: '', target_segments: 'all', segment_ids: []
        });
        loadPromotions();
      } else {
        toast.error(data.message || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    }
  };

  // Sauvegarder les préférences
  const savePreferences = async () => {
    try {
      const token = getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Préférences sauvegardées');
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        loadNotifications(),
        loadStats(),
        loadPreferences()
      ]);
      if (userRole === 'admin') {
        await Promise.all([loadBroadcasts(), loadPromotions()]);
      }
      setLoading(false);
    };
    init();
  }, [userRole, loadNotifications, loadStats, loadPreferences, loadBroadcasts, loadPromotions]);

  // Filtrer les notifications
  const filteredNotifications = notifications.filter(n => {
    if (selectedFilter === 'unread') return !n.is_read;
    if (selectedFilter === 'archived') return n.is_archived;
    return !n.is_archived;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiRefreshCw className="w-8 h-8 animate-spin text-[#2d7a3e] mx-auto mb-4" />
          <p className="text-gray-600">Chargement des notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">Gérez vos notifications et communications</p>
        </div>
        {userRole === 'admin' && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowBroadcastForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white rounded-lg transition-colors"
            >
              <FiSend className="w-4 h-4" />
              Diffusion
            </button>
            <button
              onClick={() => setShowPromotionForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#8bc34a] hover:bg-[#689f38] text-gray-800 rounded-lg transition-colors"
            >
              <FiTag className="w-4 h-4" />
              Promotion
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total" value={stats.total} icon={FiBell} color="green" />
        <StatCard title="Non lues" value={stats.unread_count} icon={FiAlertCircle} color="yellow" />
        <StatCard title="Lues" value={stats.read_count} icon={FiCheckCircle} color="green" />
        <StatCard title="Promotions" value={stats.promotion_count} icon={FiTag} color="purple" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {[
            { id: 'notifications', label: 'Mes notifications', icon: FiBell },
            { id: 'broadcasts', label: 'Diffusions', icon: FiUsers, adminOnly: true },
            { id: 'promotions', label: 'Promotions', icon: FiTag, adminOnly: true },
            { id: 'preferences', label: 'Préférences', icon: FiSettings }
          ].map(tab => {
            if (tab.adminOnly && userRole !== 'admin') return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#2d7a3e] text-[#2d7a3e]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div>
          {/* Filtres */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'Toutes' },
                { id: 'unread', label: 'Non lues' },
                { id: 'archived', label: 'Archivées' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedFilter === filter.id
                      ? 'bg-[#2d7a3e] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#2d7a3e] hover:bg-[#f0f7f3] rounded-lg transition-colors"
            >
              <FiCheck className="w-4 h-4" />
              Tout marquer comme lu
            </button>
          </div>

          {/* Liste des notifications */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FiBell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aucune notification</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map(notification => (
                <Card
                  key={notification.id}
                  className={`transition-all hover:shadow-md ${!notification.is_read ? 'border-l-4 border-l-[#2d7a3e] bg-[#f8fbfa]' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <TypeBadge type={notification.type} />
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-[#2d7a3e] rounded-full"></span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(notification.created_at).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{notification.title}</h3>
                        <p className="text-gray-600 text-sm mb-3">{notification.message}</p>
                        {notification.action_url && (
                          <a
                            href={notification.action_url}
                            className="inline-flex items-center gap-1 text-sm text-[#2d7a3e] hover:underline"
                          >
                            {notification.action_label || 'En savoir plus'}
                            <FiChevronRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1.5 text-gray-400 hover:text-[#2d7a3e] transition-colors"
                            title="Marquer comme lu"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => archiveNotification(notification.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Archiver"
                        >
                          <FiArchive className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Broadcasts Tab */}
      {activeTab === 'broadcasts' && userRole === 'admin' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cible</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Envoyées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {broadcasts.map(broadcast => (
                  <tr key={broadcast.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(broadcast.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{broadcast.title}</td>
                    <td className="px-6 py-4">
                      <TypeBadge type={broadcast.type} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {broadcast.target_clients === 'all' ? 'Tous' : broadcast.target_clients === 'active' ? 'Actifs' : 'Spécifiques'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{broadcast.total_sent}</td>
                  </tr>
                ))}
                {broadcasts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Aucune diffusion effectuée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Promotions Tab */}
      {activeTab === 'promotions' && userRole === 'admin' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réduction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Segment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Envoyées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promotions.map(promotion => (
                  <tr key={promotion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(promotion.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-mono">
                        {promotion.promotion_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{promotion.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">-{promotion.discount_percentage}%</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(promotion.valid_until).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {promotion.target_segments === 'all' ? 'Tous' : promotion.target_segments === 'active' ? 'Actifs' : 'Inactifs'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{promotion.total_sent}</td>
                  </tr>
                ))}
                {promotions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Aucune promotion créée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Préférences de notification</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">Notifications par email</p>
                  <p className="text-sm text-gray-500">Recevoir les notifications par email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.email_enabled}
                    onChange={(e) => setPreferences({ ...preferences, email_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d7a3e]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">Notifications push</p>
                  <p className="text-sm text-gray-500">Notifications instantanées dans l'application</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.push_enabled}
                    onChange={(e) => setPreferences({ ...preferences, push_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d7a3e]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">Notifications promotionnelles</p>
                  <p className="text-sm text-gray-500">Recevoir les offres et promotions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.promotion_enabled}
                    onChange={(e) => setPreferences({ ...preferences, promotion_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d7a3e]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">Notifications système</p>
                  <p className="text-sm text-gray-500">Alertes techniques et mises à jour</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.system_enabled}
                    onChange={(e) => setPreferences({ ...preferences, system_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d7a3e]"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4 py-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heures calmes (début)</label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_start}
                    onChange={(e) => setPreferences({ ...preferences, quiet_hours_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heures calmes (fin)</label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_end}
                    onChange={(e) => setPreferences({ ...preferences, quiet_hours_end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={savePreferences}
                  className="px-4 py-2 bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white rounded-lg transition-colors"
                >
                  Sauvegarder les préférences
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Diffusion */}
      {showBroadcastForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Diffuser une notification</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Titre"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                placeholder="Message"
                rows={3}
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <select
                value={broadcastForm.type}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="info">Information</option>
                <option value="success">Succès</option>
                <option value="warning">Attention</option>
                <option value="error">Erreur</option>
              </select>
              <select
                value={broadcastForm.target_clients}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, target_clients: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Tous les clients</option>
                <option value="active">Clients actifs uniquement</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBroadcastForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={sendBroadcast}
                className="px-4 py-2 bg-[#2d7a3e] text-white rounded-lg hover:bg-[#1e5a2f]"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Promotion */}
      {showPromotionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Créer une promotion</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Titre"
                value={promotionForm.title}
                onChange={(e) => setPromotionForm({ ...promotionForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                placeholder="Message"
                rows={3}
                value={promotionForm.message}
                onChange={(e) => setPromotionForm({ ...promotionForm, message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Code promo"
                value={promotionForm.promotion_code}
                onChange={(e) => setPromotionForm({ ...promotionForm, promotion_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Pourcentage de réduction"
                value={promotionForm.discount_percentage}
                onChange={(e) => setPromotionForm({ ...promotionForm, discount_percentage: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="datetime-local"
                value={promotionForm.valid_until}
                onChange={(e) => setPromotionForm({ ...promotionForm, valid_until: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPromotionForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={sendPromotion}
                className="px-4 py-2 bg-[#8bc34a] text-gray-800 rounded-lg hover:bg-[#689f38]"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
