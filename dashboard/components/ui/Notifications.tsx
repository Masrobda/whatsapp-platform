'use client';

import { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiX, FiTrash2, FiAlertCircle, FiInfo, FiCheckCircle } from 'react-icons/fi';
import Button from './Button';
import { formatDateTime } from '@/lib/utils';
import { notifications as notificationAPI } from '@/lib/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
  action_url?: string;
  action_label?: string;
}

interface NotificationsProps {
  userType: 'client' | 'user';
}

export default function Notifications({ userType }: NotificationsProps) {
  if (!userType) return null; 
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
    // Poller les nouvelles notifications toutes les 30 secondes
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const result = await notificationAPI.getAll({ 
        limit: 10, 
        unread_only: false 
      });
      
      if (result.success) {
        setNotifications(result.notifications);
        setUnreadCount(result.unread_count);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationAPI.markAsRead(id);
      loadNotifications(); // Recharger la liste
    } catch (error) {
      console.error('Erreur marquer comme lue:', error);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      await notificationAPI.markAllAsRead();
      loadNotifications();
    } catch (error) {
      console.error('Erreur marquer toutes comme lues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const archiveNotification = async (id: string) => {
    try {
      await notificationAPI.archive(id);
      // Mettre à jour localement sans recharger
      setNotifications(notifications.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erreur archivage notification:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <FiCheckCircle className="text-success" />;
      case 'warning': return <FiAlertCircle className="text-warning" />;
      case 'error': return <FiX className="text-error" />;
      default: return <FiInfo className="text-accent" />;
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'error': return 'bg-red-50 border-red-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="relative">
      {/* Bouton de notification */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-dark hover:bg-gray-100 rounded-lg transition-colors"
      >
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
        )}
      </button>

      {/* Panneau de notifications */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-dark">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-error text-white text-xs rounded-full">
                    {unreadCount} non lues
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={markAllAsRead}
                    isLoading={isLoading}
                    className="text-xs"
                  >
                    <FiCheck className="mr-1" />
                    Tout lire
                  </Button>
                )}
              </div>
            </div>

            {/* Liste des notifications */}
            <div className="overflow-y-auto max-h-[60vh]">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <FiBell className="mx-auto mb-2 opacity-50" size={32} />
                  <p>Aucune notification</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 ${!notification.is_read ? 'bg-gray-50' : ''} ${getTypeBg(notification.type)} border-l-4 ${
                        notification.type === 'success' ? 'border-green-400' :
                        notification.type === 'warning' ? 'border-yellow-400' :
                        notification.type === 'error' ? 'border-red-400' : 'border-blue-400'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className="mt-1">
                            {getTypeIcon(notification.type)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-dark mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                {formatDateTime(notification.created_at)}
                              </span>
                              {!notification.is_read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="text-xs text-primary hover:text-primary-dark"
                                >
                                  Marquer comme lue
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => archiveNotification(notification.id)}
                          className="text-gray-400 hover:text-error"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>

                      {notification.action_url && (
                        <div className="mt-3">
                          <a
                            href={notification.action_url}
                            className="inline-block text-sm px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {notification.action_label || 'Voir les détails'}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 text-center">
              <a
                href="/dashboard/notifications"
                className="text-sm text-primary hover:text-primary-dark"
                onClick={() => setIsOpen(false)}
              >
                Voir toutes les notifications
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
