'use client';

import { useEffect, useState } from 'react';
import { invoices as invoicesAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import { FiDownload, FiEye, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 5, totalPages: 0 });
  const [filters, setFilters] = useState({
    status: '',
    type: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, [pagination.page, filters.status, filters.type]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const response = await invoicesAPI.getAll({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status || undefined,
        type: filters.type || undefined,
      });
      setInvoices(response.invoices);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/download`);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement du PDF');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Mes factures</h1>
          <p className="text-gray-500 mt-1">Consultez et téléchargez vos factures</p>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-2">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tous les types</option>
                <option value="proforma">Proforma</option>
                <option value="final">Finale</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tous les statuts</option>
                <option value="proforma_generated">Proforma générée</option>
                <option value="proforma_validated">Proforma validée</option>
                <option value="final_generated">Facture finale</option>
                <option value="invoice_sent">Envoyée</option>
                <option value="paid">Payée</option>
                <option value="archived">Archivée</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => {
                  setPagination({ ...pagination, page: 1 });
                  loadInvoices();
                }}
                className="w-full"
              >
                Filtrer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des factures */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des factures ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : invoices.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">N° Facture</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const statusBadge = getStatusBadge(invoice.status);
                      return (
                        <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">#{invoice.invoice_number}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              invoice.invoice_type === 'proforma'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {invoice.invoice_type === 'proforma' ? 'Proforma' : 'Finale'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {formatDate(invoice.issue_date)}
                          </td>
                          <td className="py-3 px-4 font-bold">
                            {formatCurrency(invoice.total_amount)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusBadge.bgColor} ${statusBadge.color}`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(invoice.id, invoice.invoice_number)}
                                className="flex items-center gap-1"
                              >
                                <FiDownload size={14} />
                                PDF
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.totalPages} ({pagination.total} factures)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="flex items-center gap-1"
                  >
                    <FiChevronLeft size={16} />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                    className="flex items-center gap-1"
                  >
                    Suivant
                    <FiChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucune facture trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
