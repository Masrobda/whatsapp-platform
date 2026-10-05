'use client';

import { useEffect, useState } from 'react';
import { messageStock, bsp as bspAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FiPackage,
  FiShoppingCart,
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiDownload,
  FiFilter,
  FiSearch,
  FiPlus,
  FiDollarSign,
  FiActivity,
  FiBarChart2,
  FiCalendar
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface Transaction {
  id: string;
  transaction_number: string;
  type: 'purchase' | 'consumption';
  bsp_id?: string;
  bsp_name?: string;
  order_id?: string;
  order_code?: string;
  company_name?: string;
  messages_count: number;
  unit_cost?: number;
  total_cost?: number;
  reference?: string;
  notes?: string;
  status: 'completed' | 'pending' | 'cancelled';
  created_by_name?: string;
  created_at: string;
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

interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function MessageStockPage() {
  const [user, setUser] = useState<any>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Formulaire d'achat
  const [purchaseForm, setPurchaseForm] = useState({
    bsp_id: '',
    messages_count: 0,
    unit_cost: 0,
    total_cost: 0,
    reference: '',
    notes: ''
  });

  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) setUser(JSON.parse(userCookie));
    loadData();
    loadProviders();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [pagination.page, filterType]);

  const loadData = async () => {
    try {
      const response = await messageStock.getStock();
      // La réponse peut être { data: stockData } ou directement stockData
      setStockData(response.data?.data || response.data);
    } catch (error) {
      console.error('Erreur chargement stock:', error);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await bspAPI.getAll({ active_only: true });
      setProviders(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Erreur chargement BSP:', error);
    }
  };

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (filterType !== 'all') params.type = filterType;
      
      const response = await messageStock.getHistory(params);
      
      // Gestion flexible de la structure de réponse
      const responseData = response.data;
      
      if (responseData?.data && Array.isArray(responseData.data)) {
        // Structure avec { data: [], pagination: {} }
        setTransactions(responseData.data);
        setPagination(prev => ({
          ...prev,
          total: responseData.pagination?.total || 0,
          totalPages: responseData.pagination?.totalPages || 1
        }));
      } else if (Array.isArray(responseData)) {
        // Structure avec tableau direct
        setTransactions(responseData);
        setPagination(prev => ({
          ...prev,
          total: responseData.length,
          totalPages: Math.ceil(responseData.length / prev.limit)
        }));
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!purchaseForm.bsp_id || purchaseForm.messages_count <= 0) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      await messageStock.purchase(purchaseForm);
      alert('Achat effectué avec succès !');
      setShowPurchaseModal(false);
      setPurchaseForm({
        bsp_id: '',
        messages_count: 0,
        unit_cost: 0,
        total_cost: 0,
        reference: '',
        notes: ''
      });
      loadData();
      loadTransactions();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de l\'achat');
    }
  };

  const updateTotalCost = () => {
    setPurchaseForm(prev => ({
      ...prev,
      total_cost: prev.messages_count * prev.unit_cost
    }));
  };

  const filteredTransactions = transactions.filter(t =>
    t.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.bsp_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.order_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return <FiCheckCircle className="text-green-500" />;
      case 'pending': return <FiClock className="text-yellow-500" />;
      case 'cancelled': return <FiXCircle className="text-red-500" />;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === 'purchase') {
      return <span className="px-2 py-1 bg-[var(--lime-green-light)] text-[var(--primary-green-dark)] text-xs font-bold rounded-full flex items-center gap-1">
        <FiShoppingCart /> Achat
      </span>;
    } else {
      return <span className="px-2 py-1 bg-[var(--blue-accent-light)] text-[var(--blue-accent-dark)] text-xs font-bold rounded-full flex items-center gap-1">
        <FiActivity /> Consommation
      </span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec vos couleurs */}
      <div className="bg-gradient-to-r from-[var(--primary-green)] to-[var(--primary-green-dark)] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-2">Gestion des Stocks SMS</h1>
            <p className="text-white/80 text-sm">
              Achats et consommation de messages auprès des BSP
            </p>
          </div>
          <Button
            onClick={() => setShowPurchaseModal(true)}
            className="bg-white text-[var(--primary-green)] hover:bg-gray-100"
          >
            <FiPlus className="mr-2" /> Nouvel achat
          </Button>
        </div>
      </div>

      {/* Cartes de statistiques avec vos couleurs */}
      {stockData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-[var(--lime-green-light)] to-[var(--lime-green)] border-none">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-[var(--primary-green-dark)] font-medium">Stock disponible</p>
                  <p className="text-3xl font-black text-[var(--primary-green-dark)] mt-2">
                    {stockData.stock.available.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--primary-green)] mt-1">messages</p>
                </div>
                <div className="p-3 bg-[var(--lime-green)] rounded-full">
                  <FiPackage className="text-[var(--primary-green-dark)] text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[var(--blue-accent-light)] to-[var(--blue-accent)] border-none">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-white font-medium">Total achetés</p>
                  <p className="text-3xl font-black text-white mt-2">
                    {stockData.stock.purchased.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/80 mt-1">messages</p>
                </div>
                <div className="p-3 bg-[var(--blue-accent-dark)] rounded-full">
                  <FiTrendingUp className="text-white text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-100 to-orange-200 border-none">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-orange-800 font-medium">Total consommés</p>
                  <p className="text-3xl font-black text-orange-800 mt-2">
                    {stockData.stock.consumed.toLocaleString()}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">messages</p>
                </div>
                <div className="p-3 bg-orange-300 rounded-full">
                  <FiTrendingDown className="text-orange-800 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[var(--primary-green-light)] to-[var(--primary-green)] border-none">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-white font-medium">Taux d'utilisation</p>
                  <p className="text-3xl font-black text-white mt-2">
                    {stockData.stock.purchased > 0
                      ? Math.round((stockData.stock.consumed / stockData.stock.purchased) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-white/80 mt-1">du stock total</p>
                </div>
                <div className="p-3 bg-[var(--primary-green-dark)] rounded-full">
                  <FiBarChart2 className="text-white text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtres et recherche avec vos couleurs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro, BSP, commande..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
              >
                <option value="all">Tous les types</option>
                <option value="purchase">Achats</option>
                <option value="consumption">Consommations</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal d'achat avec vos couleurs */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[var(--primary-green)] to-[var(--primary-green-dark)] p-6 text-white rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Nouvel achat de messages</h3>
                <button
                  onClick={() => setShowPurchaseModal(false)}
                  className="text-white/80 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handlePurchase} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur BSP *
                </label>
                <select
                  value={purchaseForm.bsp_id}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, bsp_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  required
                >
                  <option value="">Sélectionner un BSP</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nombre de messages *"
                  type="number"
                  min="1"
                  value={purchaseForm.messages_count}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, messages_count: parseInt(e.target.value) || 0 });
                    setTimeout(updateTotalCost, 0);
                  }}
                  required
                />
                <Input
                  label="Coût unitaire (FCFA) *"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseForm.unit_cost}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, unit_cost: parseFloat(e.target.value) || 0 });
                    setTimeout(updateTotalCost, 0);
                  }}
                  required
                  icon={<FiDollarSign />}
                />
              </div>

              <div className="bg-[var(--neutral-100)] p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--neutral-600)]">Coût total estimé:</span>
                  <span className="text-xl font-bold text-[var(--primary-green)]">
                    {formatCurrency(purchaseForm.messages_count * purchaseForm.unit_cost)}
                  </span>
                </div>
              </div>

              <Input
                label="Référence (facultatif)"
                value={purchaseForm.reference}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, reference: e.target.value })}
                placeholder="N° facture, reçu..."
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  placeholder="Informations complémentaires..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  variant="outline"
                  className="flex-1 border-[var(--primary-green)] text-[var(--primary-green)] hover:bg-[var(--primary-green)] hover:text-white"
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-[var(--primary-green)] hover:bg-[var(--primary-green-dark)]"
                >
                  <FiShoppingCart className="mr-2" /> Effectuer l'achat
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historique des transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[var(--primary-green-dark)]">Historique des transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune transaction trouvée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--neutral-100)]">
                    <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--primary-green-dark)]">N° Transaction</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--primary-green-dark)]">Type</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--primary-green-dark)]">Détails</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--primary-green-dark)]">Messages</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--primary-green-dark)]">Montant</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--primary-green-dark)]">Date</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--primary-green-dark)]">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--neutral-200)]">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-[var(--neutral-50)]">
                      <td className="py-4 px-4">
                        <div className="font-mono text-sm font-bold text-[var(--neutral-800)]">{t.transaction_number}</div>
                      </td>
                      <td className="py-4 px-4">
                        {getTypeBadge(t.type)}
                      </td>
                      <td className="py-4 px-4">
                        {t.type === 'purchase' ? (
                          <div>
                            <div className="font-medium text-[var(--neutral-800)]">{t.bsp_name}</div>
                            {t.reference && (
                              <div className="text-xs text-[var(--neutral-500)]">Réf: {t.reference}</div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-[var(--neutral-800)]">{t.order_code}</div>
                            <div className="text-xs text-[var(--neutral-500)]">{t.company_name}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`font-bold ${
                          t.type === 'purchase' ? 'text-[var(--primary-green)]' : 'text-[var(--blue-accent)]'
                        }`}>
                          {t.type === 'purchase' ? '+' : '-'}{Math.abs(t.messages_count).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[var(--neutral-700)]">
                        {t.total_cost ? formatCurrency(t.total_cost) : '-'}
                      </td>
                      <td className="py-4 px-4 text-sm text-[var(--neutral-600)]">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(t.status)}
                          <span className="text-sm capitalize text-[var(--neutral-700)]">{t.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex justify-between items-center mt-6">
              <Button
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                variant="outline"
                className="border-[var(--primary-green)] text-[var(--primary-green)] hover:bg-[var(--primary-green)] hover:text-white"
              >
                Précédent
              </Button>
              <span className="text-sm text-[var(--neutral-600)]">
                Page {pagination.page} sur {pagination.totalPages}
              </span>
              <Button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                variant="outline"
                className="border-[var(--primary-green)] text-[var(--primary-green)] hover:bg-[var(--primary-green)] hover:text-white"
              >
                Suivant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
