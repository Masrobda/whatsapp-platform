'use client';

import { useState, useEffect } from 'react';
import { preludeAPI } from '@/lib/api/prelude';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { FiClock, FiCheckCircle, FiXCircle, FiFilter, FiDownload, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { format } from 'date-fns';

export default function PreludeMonitoring() {
  const [logs, setLogs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  const [filters, setFilters] = useState({
    channel: '',
    status: ''
  });

  useEffect(() => {
    loadData();
  }, [pagination.page, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les logs avec pagination
      const logsData = await preludeAPI.admin.getMessageLogs({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      });
      
      // Charger les stats des queues
      const queuesData = await preludeAPI.admin.getQueueMonitoring();
      
      setLogs(logsData.data || []);
      setQueues(queuesData.data || []);
      
      // Mettre à jour les infos de pagination
      if (logsData.pagination) {
        setPagination({
          ...pagination,
          page: logsData.pagination.page,
          total: logsData.pagination.total,
          pages: logsData.pagination.pages
        });
      }
    } catch (error) {
      console.error('Erreur chargement monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination({ ...pagination, page: newPage });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 }); // Reset à la page 1
  };

  const exportCSV = () => {
    if (logs.length === 0) return;
    
    const csv = [
      ['Date', 'Client', 'Destinataire', 'Canal', 'Fallback', 'Statut', 'Coût'].join(','),
      ...logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.company_name,
        log.recipient_phone,
        log.channel,
        log.fallback_used ? 'Oui' : 'Non',
        log.status,
        log.estimated_cost || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prelude_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a1a]">Monitoring Prelude</h1>
          <p className="text-gray-500 mt-1">Suivi en temps réel des envois</p>
        </div>
        <Button
          onClick={exportCSV}
          disabled={logs.length === 0}
          className="bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiDownload />
          Exporter CSV
        </Button>
      </div>

      {/* Statuts des files */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {queues.map(queue => (
          <Card key={queue.channel}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold capitalize mb-4">{queue.channel}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">En attente</span>
                  <span className="font-bold">{queue.waiting}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">En cours</span>
                  <span className="font-bold text-[#2d7a3e]">{queue.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Échoués</span>
                  <span className="font-bold text-red-500">{queue.failed}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-500">Temps moyen</span>
                  <span className="font-bold">{queue.avg_processing_time?.toFixed(2)}s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiFilter />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filters.channel}
              onChange={(e) => handleFilterChange('channel', e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
            >
              <option value="">Tous les canaux</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
            >
              <option value="">Tous les statuts</option>
              <option value="queued">En file</option>
              <option value="sent">Envoyé</option>
              <option value="delivered">Délivré</option>
              <option value="failed">Échoué</option>
            </select>

            <select
              value={pagination.limit}
              onChange={(e) => setPagination({ ...pagination, limit: Number(e.target.value), page: 1 })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
            >
              <option value="10">10 par page</option>
              <option value="20">20 par page</option>
              <option value="50">50 par page</option>
              <option value="100">100 par page</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des logs */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f0f7f3]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#1e5a2f] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#1e5a2f] uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#1e5a2f] uppercase tracking-wider">Destinataire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#1e5a2f] uppercase tracking-wider">Canal</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[#1e5a2f] uppercase tracking-wider">Fallback</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#1e5a2f] uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#1e5a2f] uppercase tracking-wider">Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Aucun log trouvé
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-[#f8fbfa]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {log.company_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.recipient_phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.channel === 'whatsapp'
                            ? 'bg-[#8bc34a] text-[#1e5a2f]'
                            : 'bg-[#1976d2] text-white'
                        }`}>
                          {log.channel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {log.fallback_used ? (
                          <FiCheckCircle className="text-[#2d7a3e] inline" />
                        ) : (
                          <FiXCircle className="text-gray-300 inline" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.status === 'delivered' ? 'bg-[#f0f7f3] text-[#2d7a3e]' :
                          log.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          log.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {log.estimated_cost?.toFixed(3)} €
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Affichage de <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> à{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                sur <span className="font-medium">{pagination.total}</span> résultats
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${
                          pagination.page === pageNum
                            ? 'bg-[#2d7a3e] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <Button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
