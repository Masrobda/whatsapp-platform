// app/dashboard/invoices-storage/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  FiFileText,
  FiDownload,
  FiEye,
  FiCalendar,
  FiDollarSign,
  FiHardDrive,
  FiUser,
  FiMail,
  FiRefreshCw,
  FiSearch,
  FiFilter,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiAlertCircle,
  FiArrowLeft
} from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Invoice {
  id: string;
  invoice_number: string;
  order_number: string;
  client_id: string;
  client_name: string;
  client_email: string;
  offer_name: string;
  storage_gb: number;
  amount_fcfa: number;
  period_months: number;
  status: 'paid' | 'pending' | 'cancelled' | 'validated';
  created_at: string;
  validation_date?: string;
  invoice_html?: string;
  space_id?: string;
}

export default function ClientStorageInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
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

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      // Route API pour les factures de stockage
      const response = await fetch(`${API_BASE_URL}/storage/invoices`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) throw new Error('Erreur chargement');

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      showNotification('error', 'Erreur lors du chargement des factures');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/storage/invoice/${invoiceId}/download`, {
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
      a.download = `facture-${invoiceId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showNotification('error', 'Erreur lors du téléchargement');
    }
  };

  const previewInvoice = async (invoice: Invoice) => {
    if (invoice.invoice_html) {
      setSelectedInvoice(invoice);
      setShowPreviewModal(true);
    } else {
      try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/storage/invoice/${invoice.id}/download`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          setSelectedInvoice({ ...invoice, invoice_html: html });
          setShowPreviewModal(true);
        }
      } catch (err) {
        showNotification('error', 'Impossible de charger la facture');
      }
    }
  };

  const formatFCFA = (amount?: number) => {
    if (!amount) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'paid':
      case 'validated':
        return {
          label: 'Payée',
          color: 'bg-green-100 text-green-800',
          icon: <FiCheckCircle className="h-3 w-3" />
        };
      case 'pending':
        return {
          label: 'En attente',
          color: 'bg-yellow-100 text-yellow-800',
          icon: <FiClock className="h-3 w-3" />
        };
      case 'cancelled':
        return {
          label: 'Annulée',
          color: 'bg-red-100 text-red-800',
          icon: <FiXCircle className="h-3 w-3" />
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800',
          icon: <FiFileText className="h-3 w-3" />
        };
    }
  };

  const filteredInvoices = (invoices || []).filter(inv => {
    if (!inv) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (inv.invoice_number || '').toLowerCase().includes(term) ||
        (inv.order_number || '').toLowerCase().includes(term) ||
        (inv.offer_name || '').toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all' && inv.status !== statusFilter) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de vos factures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
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
          <button onClick={() => setNotification(null)}>
            <FiXCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <FiArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FiFileText className="text-[var(--primary-green)]" />
            Mes factures de stockage
          </h1>
          <p className="text-gray-600 mt-1">
            Consultez et téléchargez toutes vos factures de stockage cloud
          </p>
        </div>
        <div className="ml-auto">
          <button
            onClick={loadInvoices}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <FiRefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiFileText className="mr-2" />
            Total factures
          </div>
          <div className="text-3xl font-bold text-gray-900">{(invoices || []).length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiCheckCircle className="mr-2 text-green-500" />
            Payées
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {(invoices || []).filter(i => i?.status === 'paid' || i?.status === 'validated').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiClock className="mr-2 text-yellow-500" />
            En attente
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {(invoices || []).filter(i => i?.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center text-gray-500 text-sm font-medium mb-2">
            <FiDollarSign className="mr-2 text-[var(--primary-green)]" />
            Montant total
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatFCFA((invoices || []).reduce((sum, i) => sum + (i?.amount_fcfa || 0), 0))}
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
              placeholder="Rechercher par numéro de facture ou commande..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
          >
            <option value="all">Tous les statuts</option>
            <option value="paid">Payées</option>
            <option value="pending">En attente</option>
            <option value="cancelled">Annulées</option>
          </select>
        </div>
      </div>

      {/* Liste des factures */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FiFileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune facture trouvée</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all'
              ? 'Aucune facture ne correspond à vos critères'
              : 'Vous n\'avez pas encore de facture de stockage'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Facture</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  if (!invoice) return null;
                  const status = getStatusBadge(invoice.status);
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{invoice.invoice_number || 'N/A'}</div>
                        <div className="text-xs text-gray-500">Cmd: {invoice.order_number || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {invoice.created_at ? format(new Date(invoice.created_at), 'dd/MM/yyyy') : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {invoice.created_at ? formatDistanceToNow(new Date(invoice.created_at), { addSuffix: true, locale: fr }) : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{invoice.offer_name || 'Stockage'}</div>
                        <div className="text-xs text-gray-500">{invoice.storage_gb || 0} Go • {invoice.period_months || 1} mois</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-[var(--primary-green)]">
                          {formatFCFA(invoice.amount_fcfa)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => previewInvoice(invoice)}
                            className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                            title="Aperçu"
                          >
                            <FiEye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => downloadInvoice(invoice.id)}
                            className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                            title="Télécharger"
                          >
                            <FiDownload className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation */}
      {showPreviewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">
                Facture {selectedInvoice.invoice_number || ''}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadInvoice(selectedInvoice.id)}
                  className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] flex items-center gap-2"
                >
                  <FiDownload className="h-4 w-4" />
                  Télécharger
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <FiXCircle className="h-6 w-6 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {selectedInvoice.invoice_html ? (
                <iframe
                  srcDoc={selectedInvoice.invoice_html}
                  className="w-full h-full min-h-[600px] border-0 rounded-lg bg-white shadow-inner"
                  title={`Facture ${selectedInvoice.invoice_number || ''}`}
                />
              ) : (
                <div className="text-center py-12">
                  <FiFileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aperçu non disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
