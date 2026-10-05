'use client';
import { useEffect, useState, useCallback } from 'react';
import { messages as messagesAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { getStatusBadge, formatPhone, downloadFile } from '@/lib/utils';
import { FiDownload, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function MessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [filters, setFilters] = useState({
    status: '',
    recipient_phone: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [period, setPeriod] = useState<'24h' | 'yesterday' | '7days' | '15days' | '30days' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = (selectedPeriod: string, customStart = customStartDate, customEnd = customEndDate) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: string | null = null;
    let end: string | null = null;

    switch (selectedPeriod) {
      case '24h': {
        const yesterday24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        start = formatDate(yesterday24);
        end = formatDate(now);
        break;
      }
      case 'yesterday': {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        start = formatDate(yesterday);
        end = formatDate(yesterday);
        break;
      }
      case '7days': {
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        start = formatDate(sevenDaysAgo);
        end = formatDate(now);
        break;
      }
      case '15days': {
        const fifteenDaysAgo = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);
        start = formatDate(fifteenDaysAgo);
        end = formatDate(now);
        break;
      }
      case '30days': {
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        start = formatDate(thirtyDaysAgo);
        end = formatDate(now);
        break;
      }
      case 'custom':
        if (customStart && customEnd) {
          start = customStart;
          end = customEnd;
        }
        break;
      default:
        break;
    }
    return { start, end };
  };

  // ===== FONCTION CENTRALE – accepte des overrides pour éviter le state stale =====
  const fetchMessages = useCallback(async (overrides: {
    page?: number;
    status?: string;
    recipient_phone?: string;
    period?: typeof period;
    customStart?: string;
    customEnd?: string;
  } = {}) => {
    setIsLoading(true);
    try {
      const currentPage = overrides.page ?? 1;
      const status = overrides.status !== undefined ? overrides.status : filters.status;
      const phone = overrides.recipient_phone !== undefined ? overrides.recipient_phone : filters.recipient_phone;
      const currentPeriod = overrides.period ?? period;
      const cStart = overrides.customStart ?? customStartDate;
      const cEnd = overrides.customEnd ?? customEndDate;

      const { start, end } = getDateRange(currentPeriod, cStart, cEnd);

      const response = await messagesAPI.getAll({
        page: currentPage,
        limit: pagination.limit,
        status: status || undefined,
        recipient_phone: phone || undefined,
        start_date: start || undefined,
        end_date: end || undefined,
      });

      setMessages(response.messages || []);
      setPagination(response.pagination || { total: 0, page: currentPage, limit: pagination.limit, totalPages: 0 });
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, period, customStartDate, customEndDate, pagination.limit]);

  // ===== GESTIONNAIRES =====
  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      fetchMessages({ page: newPage });
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setFilters(prev => ({ ...prev, status: newStatus }));
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchMessages({ page: 1, status: newStatus });
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchMessages({ page: 1, recipient_phone: filters.recipient_phone });
  };

  const handlePeriodChange = (newPeriod: typeof period) => {
    setPeriod(newPeriod);
    if (newPeriod !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchMessages({ page: 1, period: newPeriod });
  };

  // Dates personnalisées
  useEffect(() => {
    if (period === 'custom' && customStartDate && customEndDate) {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchMessages({
        page: 1,
        period: 'custom',
        customStart: customStartDate,
        customEnd: customEndDate,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customStartDate, customEndDate]);

  // ===== EXPORT CSV =====
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { start, end } = getDateRange(period);
      const blob = await messagesAPI.exportCSV({
        status: filters.status || undefined,
        recipient_phone: filters.recipient_phone || undefined,
        start_date: start || undefined,
        end_date: end || undefined,
      });
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const fileName = `messages_${day}_${month}_${year}_${hours}_${minutes}_${seconds}.csv`;
      downloadFile(blob, fileName);
    } catch (error) {
      console.error('Erreur export CSV:', error);
      alert('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  const formatDateForDisplay = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // ===== CHARGEMENT INITIAL =====
  useEffect(() => {
    fetchMessages({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Mes messages</h1>
          <p className="text-gray-500 mt-1">Historique de vos messages envoyés</p>
        </div>
        <Button onClick={handleExport} isLoading={isExporting}>
          <FiDownload className="mr-2" />
          Exporter CSV
        </Button>
      </div>

      {/* ===== FILTRES ===== */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-2">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tous les statuts</option>
                <option value="queued">En file</option>
                <option value="sent">Envoyé</option>
                <option value="delivered">Livré</option>
                <option value="read">Lu</option>
                <option value="failed">Échec</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-2">Numéro de téléphone</label>
              <Input
                type="text"
                placeholder="+237600000000"
                value={filters.recipient_phone}
                onChange={(e) => setFilters({ ...filters, recipient_phone: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <FiSearch className="mr-2" />
                Rechercher
              </Button>
            </div>
          </div>

          {/* ===== FILTRES DE PÉRIODE ===== */}
          <div className="mt-4 border-t pt-4">
            <label className="block text-sm font-medium text-dark mb-2">Période</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '24h', label: '24h' },
                { value: 'yesterday', label: 'Hier' },
                { value: '7days', label: '7 jours' },
                { value: '15days', label: '15 jours' },
                { value: '30days', label: '30 jours' },
                { value: 'custom', label: 'Personnalisé' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePeriodChange(opt.value as any)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    period === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-dark border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex flex-wrap gap-4 mt-2">
                <div>
                  <label className="block text-sm font-medium text-dark">Du</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark">Au</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== TABLEAU ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des messages ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : messages.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Destinataire</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date envoi</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Livré le</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Lu le</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Erreur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message) => {
                      const statusBadge = getStatusBadge(message.wa_status);
                      return (
                        <tr key={message.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{formatPhone(message.recipient_phone)}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                              {message.message_type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 ${statusBadge.bgColor} ${statusBadge.color} text-xs rounded-full`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {message.sent_at ? formatDateForDisplay(message.sent_at) : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {message.delivered_at ? formatDateForDisplay(message.delivered_at) : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {message.read_at ? formatDateForDisplay(message.read_at) : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-error">
                            {message.wa_error_message || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.totalPages} ({pagination.total} messages)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <FiChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    <FiChevronRight />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun message trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
