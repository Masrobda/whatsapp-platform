'use client';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import {
  FiPackage,
  FiTrendingUp,
  FiTrendingDown,
  FiBarChart2,
  FiClock,
  FiAlertCircle,
  FiInfo
} from 'react-icons/fi';
import Cookies from 'js-cookie';
import { apiClient } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

// Types
interface Transaction {
  id: string;
  transaction_number: string;
  type: 'purchase' | 'consumption';
  bsp_name?: string;
  order_code?: string;
  company_name?: string;
  messages_count: number;
  created_at: string;
  created_by_name?: string;
}

interface StockData {
  stock: {
    total: number;
    purchased: number;
    consumed: number;
    available: number;
  };
  recent: Transaction[];
}

export default function StockViewerPage() {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterType, setFilterType] = useState<'all' | 'purchase' | 'consumption'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) {
      try {
        setCurrentUser(JSON.parse(userCookie));
      } catch (e) {
        console.error('Erreur parsing user:', e);
      }
    }
    loadData();
  }, []);

  // Recharger les transactions quand un des filtres change
  useEffect(() => {
    loadTransactions();
  }, [filterType, selectedYear, selectedMonth]);

  const loadData = async () => {
    try {
      const stockResponse = await apiClient.get('/message-stock');
      setStockData(stockResponse.data.data || stockResponse.data);
    } catch (error) {
      console.error('Erreur chargement stock:', error);
    }
  };

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 100 };

      if (filterType !== 'all') params.type = filterType;
      if (selectedYear) params.year = selectedYear;
      if (selectedMonth) params.month = selectedMonth;

      const response = await apiClient.get('/message-stock/history', { params });
      setTransactions(response.data?.data || []);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Années disponibles (de 2024 à l'année en cours + 1)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear + 1; y >= 2024; y--) {
      years.push(y.toString());
    }
    return years;
  };

  // Mois avec noms en français
  const monthOptions = [
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ];

  const getStockLevel = (available: number) => {
    if (available > 10000) return { text: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (available > 5000) return { text: 'Bon', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (available > 1000) return { text: 'Moyen', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'Critique', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const avgConsumption = transactions
    .filter(t => t.type === 'consumption')
    .slice(0, 30)
    .reduce((acc, t) => acc + Math.abs(t.messages_count), 0) / 30 || 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-[var(--primary-green)] to-[var(--primary-green-dark)] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FiPackage className="text-3xl" />
              <h1 className="text-2xl md:text-3xl font-black">Suivi du Stock SMS</h1>
            </div>
            <p className="text-white/80 text-sm">Visualisation détaillée des achats et consommations</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-2.5">
            <div className="text-xs text-white/70">Dernière mise à jour</div>
            <div className="text-sm font-semibold">{new Date().toLocaleString('fr-FR')}</div>
          </div>
        </div>
      </div>

      {stockData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cartes statistiques (inchangées) */}
          <Card className="border-l-4 border-[var(--primary-green)]">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Stock disponible</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{stockData.stock.available.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">messages</p>
                </div>
                <div className={`p-3 rounded-xl ${getStockLevel(stockData.stock.available).bg}`}>
                  <FiPackage className={`text-2xl ${getStockLevel(stockData.stock.available).color}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-blue-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total achetés</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{stockData.stock.purchased.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">messages</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FiTrendingUp className="text-2xl text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-orange-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total consommés</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{stockData.stock.consumed.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">messages</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <FiTrendingDown className="text-2xl text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-purple-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Autonomie estimée</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">
                    {avgConsumption > 0 ? Math.floor(stockData.stock.available / avgConsumption) : '∞'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">jours</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <FiBarChart2 className="text-2xl text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historique des transactions - Version professionnelle */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <CardTitle className="text-[var(--primary-green-dark)]">Historique des transactions</CardTitle>

            {/* Filtres avancés */}
            <div className="flex flex-wrap gap-3">
              {/* Filtre par type */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${filterType === 'all' ? 'bg-white shadow text-[var(--primary-green)]' : 'text-gray-600 hover:bg-white/70'}`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setFilterType('purchase')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${filterType === 'purchase' ? 'bg-white shadow text-[var(--primary-green)]' : 'text-gray-600 hover:bg-white/70'}`}
                >
                  Achats
                </button>
                <button
                  onClick={() => setFilterType('consumption')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${filterType === 'consumption' ? 'bg-white shadow text-[var(--primary-green)]' : 'text-gray-600 hover:bg-white/70'}`}
                >
                  Consommations
                </button>
              </div>

              {/* Filtre Année */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] text-sm"
              >
                <option value="">Toutes les années</option>
                {getYearOptions().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              {/* Filtre Mois */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] text-sm"
              >
                <option value="">Tous les mois</option>
                {monthOptions.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[var(--primary-green)] border-t-transparent"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead className="bg-[var(--neutral-100)]">
                  <tr>
                    <th className="py-4 px-4 text-left text-xs font-semibold text-[var(--primary-green-dark)] uppercase tracking-wider">Date</th>
                    <th className="py-4 px-4 text-left text-xs font-semibold text-[var(--primary-green-dark)] uppercase tracking-wider">Type</th>
                    <th className="py-4 px-4 text-left text-xs font-semibold text-[var(--primary-green-dark)] uppercase tracking-wider">Détails</th>
                    <th className="py-4 px-4 text-right text-xs font-semibold text-[var(--primary-green-dark)] uppercase tracking-wider">Messages</th>
                    <th className="py-4 px-4 text-left text-xs font-semibold text-[var(--primary-green-dark)] uppercase tracking-wider">Référence</th>
                    <th className="py-4 px-4 text-left text-xs font-semibold text-[var(--primary-green-dark)] uppercase tracking-wider">Opérateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--neutral-200)]">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-gray-500">
                        Aucune transaction trouvée avec les filtres sélectionnés
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[var(--neutral-50)] transition-colors">
                        <td className="py-4 px-4 text-sm text-[var(--neutral-600)] whitespace-nowrap">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          {tx.type === 'purchase' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <FiTrendingUp className="mr-1.5" /> Achat
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              <FiTrendingDown className="mr-1.5" /> Consommation
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-[var(--neutral-700)]">
                          {tx.type === 'purchase' 
                            ? tx.bsp_name || 'Fournisseur inconnu'
                            : (tx.company_name || tx.order_code || 'Commande inconnue')}
                        </td>
                        <td className="py-4 px-4 text-sm text-right font-semibold whitespace-nowrap">
                          <span className={tx.type === 'purchase' ? 'text-[var(--primary-green)]' : 'text-orange-600'}>
                            {tx.type === 'purchase' ? '+' : '-'}{Math.abs(tx.messages_count).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-[var(--neutral-500)] font-mono">
                          {tx.transaction_number}
                        </td>
                        <td className="py-4 px-4 text-sm text-[var(--neutral-600)]">
                          {tx.created_by_name || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-[var(--neutral-200)] text-xs text-[var(--neutral-500)] flex justify-between">
            <span>
              {transactions.length} transaction{transactions.length > 1 ? 's' : ''} affichée{transactions.length > 1 ? 's' : ''}
              {selectedYear && ` • ${selectedYear}`} 
              {selectedMonth && ` • ${monthOptions.find(m => m.value === selectedMonth)?.label}`}
            </span>
            {currentUser && (
              <span>{currentUser.full_name || currentUser.email}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
