// /var/www/numericexport/dashboard/app/dashboard/notifications/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifications as notificationAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { FiBell, FiCheckCircle, FiXCircle, FiAlertCircle, FiInfo, FiEye, FiArchive, FiChevronRight } from 'react-icons/fi';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';

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
}

const TypeBadge = ({ type }: { type: string }) => {
  const config: Record<string, { icon: any; class: string; label: string }> = {
    info: { icon: FiInfo, class: 'bg-blue-100 text-blue-700', label: 'Information' },
    success: { icon: FiCheckCircle, class: 'bg-green-100 text-green-700', label: 'Succès' },
    warning: { icon: FiAlertCircle, class: 'bg-yellow-100 text-yellow-700', label: 'Attention' },
    error: { icon: FiXCircle, class: 'bg-red-100 text-red-700', label: 'Erreur' },
    promotion: { icon: FiInfo, class: 'bg-purple-100 text-purple-700', label: 'Promotion' }
  };
  
  const { icon: Icon, class: className, label } = config[type] || config.info;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');

  const loadNotifications = async () => {
    try {
      const result = await notificationAPI.getAll({ limit: 50 });
      if (result.success) {
        setNotifications(result.notifications);
        setUnreadCount(result.unread_count);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      toast.error('Erreur lors du chargement des notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
      toast.success('Notification marquée comme lue');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du marquage');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('Toutes les notifications marquées comme lues');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du marquage');
    }
  };

  const archiveNotification = async (id: string) => {
    try {
      await notificationAPI.archive(id);
      setNotifications(notifications.filter(n => n.id !== id));
      toast.success('Notification archivée');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'archivage');
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'archived') return n.is_archived;
    return !n.is_archived;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d7a3e] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes notifications</h1>
          <p className="text-gray-600 mt-1">
            {unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : 'Aucune notification non lue'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 text-sm text-[#2d7a3e] hover:bg-[#f0f7f3] rounded-lg transition-colors"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'unread', label: 'Non lues' },
          { id: 'archived', label: 'Archivées' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f.id
                ? 'bg-[#2d7a3e] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

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
                        {formatDateTime(notification.created_at)}
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
  );
}
