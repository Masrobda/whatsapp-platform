// app/dashboard/admin/orders/pending/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  FiClock,
  FiEye,
  FiCheckCircle,
  FiXCircle,
  FiDownload,
  FiMail,
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiHardDrive,
  FiRefreshCw,
  FiSearch,
  FiFilter
} from 'react-icons/fi';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';
import Link from 'next/link';

interface PendingOrder {
  id: string;
  order_number: string;
  client_name: string;
  client_email: string;
  offer_name: string;
  storage_gb: number;
  amount_fcfa: number;
  period_months: number;
  created_at: string;
}

export default function PendingOrdersPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return Cookies.get('token') || '';
    }
    return '';
  };

  const loadPendingOrders = async () => {
    try {
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatFCFA = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(search.toLowerCase()) ||
    order.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    order.client_email?.toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FiClock className="text-yellow-500" />
            Commandes en attente
          </h1>
          <p className="text-gray-600 mt-1">
            {orders.length} commande(s) en attente de validation
          </p>
        </div>
        <Link
          href="/dashboard/admin/orders/validation"
          className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)]"
        >
          Aller à la validation
        </Link>
      </div>

      {/* Recherche */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une commande..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Commande</th>
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
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {order.order_number}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{order.client_name}</div>
                    <div className="text-sm text-gray-500">{order.client_email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{order.offer_name}</div>
                    <div className="text-sm text-gray-500">{order.storage_gb} Go</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[var(--primary-green)]">
                      {formatFCFA(order.amount_fcfa)}
                    </div>
                    <div className="text-sm text-gray-500">{order.period_months} mois</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/admin/orders/validation?order=${order.id}`}
                      className="inline-flex items-center px-3 py-1 bg-[var(--primary-green)]/10 text-[var(--primary-green)] rounded-lg hover:bg-[var(--primary-green)]/20"
                    >
                      <FiEye className="mr-1 h-4 w-4" />
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucune commande trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
