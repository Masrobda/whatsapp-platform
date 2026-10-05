'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Tabs from '@/components/ui/Tabs';
import { 
  formatCurrency, 
  formatDate, 
  formatDateTime,
  calculatePercentage 
} from '@/lib/utils';
import { 
  FiDollarSign, 
  FiCheckCircle, 
  FiClock, 
  FiUpload,
  FiDownload,
  FiSearch,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiPlus
} from 'react-icons/fi';

export default function PaymentsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [payments, setPayments] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 5, totalPages: 0 });
  const [filters, setFilters] = useState({
    status: '',
    payment_method: '',
    start_date: '',
    end_date: '',
    client_id: '',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    loadPayments();
  }, [pagination.page, activeTab, filters]);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      // Simuler l'appel API
      // const response = await paymentsAPI.getAll({ ...filters, page: pagination.page });
      // À remplacer par votre appel API réel
      
      // Données simulées pour la démo
      const mockData = {
        payments: [
          {
            id: '1',
            amount: 50000,
            payment_method: 'virement',
            reference: 'VIR20231215001',
            verified_by: 'Admin User',
            verified_at: '2023-12-15T10:30:00Z',
            created_at: '2023-12-15T09:15:00Z',
            invoice_number: 'INV-202312-001',
            invoice_type: 'final',
            invoice_total: 50000,
            company_name: 'Client Entreprise 1',
            client_email: 'client1@entreprise.com',
            recorded_by_name: 'Secrétaire 1',
            verified_by_name: 'Responsable Financier',
            proof_path: '/media/proofs/payment_1.pdf'
          },
          {
            id: '2',
            amount: 75000,
            payment_method: 'mobile_money',
            reference: 'MOMO237612345678',
            verified_by: null,
            verified_at: null,
            created_at: '2023-12-14T14:20:00Z',
            invoice_number: 'INV-202312-002',
            invoice_type: 'proforma',
            invoice_total: 75000,
            company_name: 'Client Entreprise 2',
            client_email: 'client2@entreprise.com',
            recorded_by_name: 'Commercial 1',
            verified_by_name: null,
            proof_path: null
          },
        ],
        statistics: {
          total_payments: 45,
          verified_payments: 38,
          total_amount: 2450000,
          verified_amount: 2100000,
          pending_amount: 350000
        },
        pagination: {
          total: 45,
          page: 1,
          limit: 5,
          totalPages: 9
        }
      };

      setPayments(mockData.payments);
      setStatistics(mockData.statistics);
      setPagination(mockData.pagination);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    // Implémenter la création de paiement
    alert('Création de paiement à implémenter');
  };

  const handleVerifyPayment = async (paymentId: string) => {
    if (confirm('Voulez-vous valider ce paiement ?')) {
      // Implémenter la validation
      alert(`Validation du paiement ${paymentId} à implémenter`);
    }
  };

  const handleUploadProof = async (paymentId: string) => {
    if (!uploadFile) {
      alert('Veuillez sélectionner un fichier');
      return;
    }

    // Implémenter l'upload
    alert(`Upload de preuve pour ${paymentId} à implémenter`);
    setShowUploadModal(null);
    setUploadFile(null);
  };

  const handleDownloadProof = (proofPath: string) => {
    window.open(proofPath, '_blank');
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      virement: 'Virement',
      cheque: 'Chèque',
      especes: 'Espèces',
      mobile_money: 'Mobile Money'
    };
    return methods[method] || method;
  };

  const tabs = [
    {
      id: 'all',
      label: 'Tous',
      content: renderPaymentsTable(payments)
    },
    {
      id: 'pending',
      label: 'En attente',
      content: renderPaymentsTable(payments.filter(p => !p.verified_by))
    },
    {
      id: 'verified',
      label: 'Validés',
      content: renderPaymentsTable(payments.filter(p => p.verified_by))
    }
  ];

  function renderPaymentsTable(data: any[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Facture</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Méthode</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Référence</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((payment) => (
              <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium">{payment.company_name}</p>
                    <p className="text-xs text-gray-500">{payment.client_email}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 ${payment.invoice_type === 'proforma' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'} text-xs rounded-full`}>
                    {payment.invoice_number}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="font-bold">{formatCurrency(payment.amount)}</div>
                  <div className="text-xs text-gray-500">
                    sur {formatCurrency(payment.invoice_total)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {getPaymentMethodLabel(payment.payment_method)}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-sm">
                  {payment.reference || '-'}
                </td>
                <td className="py-3 px-4">
                  {payment.verified_by ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      <FiCheckCircle size={12} />
                      Validé
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      <FiClock size={12} />
                      En attente
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {formatDate(payment.created_at)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    {!payment.verified_by && user?.role === 'admin' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerifyPayment(payment.id)}
                      >
                        Valider
                      </Button>
                    )}
                    {!payment.proof_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowUploadModal(payment.id)}
                      >
                        <FiUpload size={14} />
                      </Button>
                    )}
                    {payment.proof_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadProof(payment.proof_path)}
                      >
                        <FiEye size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Gestion des paiements</h1>
          <p className="text-gray-500 mt-1">Suivez et validez les paiements clients</p>
        </div>
        {user?.role === 'admin' && (
          <Button onClick={() => setShowCreateModal(true)}>
            <FiPlus className="mr-2" />
            Nouveau paiement
          </Button>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total reçu</p>
                <h3 className="text-2xl font-bold text-dark">
                  {formatCurrency(statistics.total_amount || 0)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                <FiDollarSign className="text-white" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {statistics.total_payments || 0} paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Validés</p>
                <h3 className="text-2xl font-bold text-dark">
                  {formatCurrency(statistics.verified_amount || 0)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <FiCheckCircle className="text-success" size={24} />
              </div>
            </div>
            <p className="text-xs text-success mt-2">
              {calculatePercentage(statistics.verified_payments || 0, statistics.total_payments || 1)}% des paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">En attente</p>
                <h3 className="text-2xl font-bold text-dark">
                  {formatCurrency(statistics.pending_amount || 0)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <FiClock className="text-warning" size={24} />
              </div>
            </div>
            <p className="text-xs text-warning mt-2">
              À vérifier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Taux validation</p>
                <h3 className="text-2xl font-bold text-dark">
                  {calculatePercentage(statistics.verified_amount || 0, statistics.total_amount || 1)}%
                </h3>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FiCheckCircle className="text-accent" size={24} />
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-success h-2 rounded-full"
                style={{ width: `${calculatePercentage(statistics.verified_amount || 0, statistics.total_amount || 1)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-2">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="verified">Validés</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Méthode</label>
              <select
                value={filters.payment_method}
                onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Toutes méthodes</option>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="especes">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Du</label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Au</label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={() => setPagination({ ...pagination, page: 1 })}>
              <FiFilter className="mr-2" />
              Appliquer les filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onglets et tableau */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center justify-between">
              <span>Historique des paiements</span>
              <Tabs tabs={tabs} defaultTab="all" />
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : payments.length > 0 ? (
            <>
              {tabs.find(tab => tab.id === activeTab)?.content}

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.totalPages} ({pagination.total} paiements)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                  >
                    <FiChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    <FiChevronRight />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <FiDollarSign className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500">Aucun paiement trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal création paiement */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-dark mb-4">Nouveau paiement</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Facture N°"
                  type="text"
                  placeholder="INV-202312-001"
                />
                <Input
                  label="Montant (FCFA)"
                  type="number"
                  placeholder="50000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Méthode de paiement</label>
                <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="virement">Virement bancaire</option>
                  <option value="cheque">Chèque</option>
                  <option value="especes">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>
              
              <Input
                label="Référence"
                type="text"
                placeholder="VIR20231215001"
              />
              
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Preuve de paiement</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <FiUpload className="mx-auto text-gray-400 mb-2" size={24} />
                  <p className="text-sm text-gray-500">Glissez-déposez ou cliquez pour uploader</p>
                  <input type="file" className="hidden" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Notes</label>
                <textarea
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Notes additionnelles..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreatePayment}
                className="flex-1"
              >
                Enregistrer le paiement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal upload preuve */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-dark mb-4">Uploader une preuve</h2>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FiUpload className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-sm text-gray-500 mb-2">
                  Formats acceptés: PDF, JPG, PNG (max 5MB)
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block mx-auto"
                />
                {uploadFile && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ {uploadFile.name}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(null);
                  setUploadFile(null);
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={() => handleUploadProof(showUploadModal)}
                disabled={!uploadFile}
                className="flex-1"
              >
                <FiUpload className="mr-2" />
                Uploader
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
