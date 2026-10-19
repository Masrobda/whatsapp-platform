// app/dashboard/admin/orders/validation/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiEye,
  FiDownload,
  FiMail,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiHardDrive,
  FiAlertCircle,
  FiCheck,
  FiX
} from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';

interface Order {
  id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  client_email: string;
  offer_id: string;
  offer_name: string;
  storage_gb: number;
  amount_fcfa: number;
  period_months: number;
  period_type: 'month' | 'year';
  status: 'pending' | 'validated' | 'cancelled' | 'expired';
  created_at: string;
  validation_date?: string;
  validated_by?: string;
  invoice_number?: string;
  space_id?: string;
}

export default function AdminOrdersValidationPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: ''
  });
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

  // Charger les commandes en attente
  const loadPendingOrders = async () => {
    try {
      setRefreshing(true);
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/admin/orders/pending`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur chargement');

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      showNotification('error', 'Erreur lors du chargement des commandes');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Valider une commande
  const validateOrder = async () => {
    if (!selectedOrder) return;

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/admin/orders/${selectedOrder.id}/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) throw new Error('Erreur validation');

      showNotification('success', `Commande ${selectedOrder.order_number} validée avec succès`);
      setShowValidateModal(false);
      setSelectedOrder(null);
      loadPendingOrders();
    } catch (err) {
      showNotification('error', 'Erreur lors de la validation');
    }
  };

  // Rejeter/Annuler une commande
  const rejectOrder = async () => {
    if (!selectedOrder) return;

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/admin/orders/${selectedOrder.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectionReason })
      });

      if (!response.ok) throw new Error('Erreur annulation');

      showNotification('success', `Commande ${selectedOrder.order_number} annulée`);
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedOrder(null);
      loadPendingOrders();
    } catch (err) {
      showNotification('error', 'Erreur lors de l\'annulation');
    }
  };

  // Formater le prix FCFA
  const formatFCFA = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Filtrer les commandes
  const filteredOrders = orders.filter(order => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        order.order_number.toLowerCase().includes(search) ||
        order.client_name?.toLowerCase().includes(search) ||
        order.client_email?.toLowerCase().includes(search) ||
        order.offer_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  useEffect(() => {
    loadPendingOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des commandes en attente...</p>
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FiCheckCircle className="text-[var(--primary-green)]" />
            Validation des commandes de stockage
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez et validez les demandes d'abonnement des clients
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadPendingOrders}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiClock className="mr-2" />
            En attente
          </div>
          <div className="text-3xl font-bold text-gray-900">{orders.length}</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiDollarSign className="mr-2" />
            Montant total
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatFCFA(orders.reduce((sum, o) => sum + o.amount_fcfa, 0))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiHardDrive className="mr-2" />
            Stockage total
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {orders.reduce((sum, o) => sum + o.storage_gb, 0)} Go
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiUser className="mr-2" />
            Clients distincts
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {new Set(orders.map(o => o.client_id)).size}
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro, client, offre..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
            />
          </div>
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FiFilter className="h-4 w-4" />
            Plus de filtres
          </button>
        </div>
      </div>

      {/* Liste des commandes */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FiCheckCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune commande en attente</h3>
          <p className="text-gray-600">Toutes les commandes ont été traitées</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commande</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{order.order_number}</div>
                      <div className="text-sm text-gray-500">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <FiClock className="mr-1 h-3 w-3" />
                          En attente
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{order.client_name}</div>
                      <div className="text-sm text-gray-500">{order.client_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{order.offer_name}</div>
                      <div className="text-sm text-gray-500">{order.storage_gb} Go</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{formatFCFA(order.amount_fcfa)}</div>
                      <div className="text-sm text-gray-500">{order.period_months} mois</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowDetailsModal(true);
                          }}
                          className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Voir détails"
                        >
                          <FiEye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowValidateModal(true);
                          }}
                          className="p-2 text-green-600 hover:text-green-700 transition-colors"
                          title="Valider"
                        >
                          <FiCheckCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowRejectModal(true);
                          }}
                          className="p-2 text-red-600 hover:text-red-700 transition-colors"
                          title="Rejeter"
                        >
                          <FiXCircle className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Détails Commande */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Détails de la commande {selectedOrder.order_number}
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Informations client */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FiUser className="text-[var(--primary-green)]" />
                    Client
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Nom</p>
                      <p className="font-medium">{selectedOrder.client_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{selectedOrder.client_email}</p>
                    </div>
                  </div>
                </div>

                {/* Détails de la commande */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FiHardDrive className="text-[var(--primary-green)]" />
                    Offre souscrite
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Offre</p>
                      <p className="font-medium">{selectedOrder.offer_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Stockage</p>
                      <p className="font-medium">{selectedOrder.storage_gb} Go</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Période</p>
                      <p className="font-medium">{selectedOrder.period_months} mois</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Montant</p>
                      <p className="font-medium text-lg text-[var(--primary-green)]">
                        {formatFCFA(selectedOrder.amount_fcfa)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FiCalendar className="text-[var(--primary-green)]" />
                    Chronologie
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">Commande créée</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">En attente de validation</p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(selectedOrder.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setShowValidateModal(true);
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Valider la commande
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setShowRejectModal(true);
                    }}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Validation */}
      {showValidateModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Valider la commande
                </h3>
                <p className="text-gray-600">
                  Vous êtes sur le point de valider la commande <strong>{selectedOrder.order_number}</strong>
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Client</span>
                    <span className="font-medium">{selectedOrder.client_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Offre</span>
                    <span className="font-medium">{selectedOrder.offer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant</span>
                    <span className="font-medium text-[var(--primary-green)]">
                      {formatFCFA(selectedOrder.amount_fcfa)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Ce qui va se passer :</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Une facture HTML sera générée automatiquement</li>
                  <li>L'espace de stockage sera créé et activé</li>
                  <li>Le client recevra une notification par email</li>
                  <li>La commande sera marquée comme validée</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowValidateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={validateOrder}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Confirmer la validation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejet */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiXCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Rejeter la commande
                </h3>
                <p className="text-gray-600">
                  Commande <strong>{selectedOrder.order_number}</strong>
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif du rejet
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Expliquez la raison du rejet..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={rejectOrder}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Confirmer le rejet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
