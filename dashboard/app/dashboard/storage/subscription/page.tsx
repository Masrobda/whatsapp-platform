// app/dashboard/storage/subscription/page.tsx (version corrigée)
'use client';

import { useState, useEffect } from 'react';
import {
  FiHardDrive,
  FiCalendar,
  FiCreditCard,
  FiRefreshCw,
  FiEdit2,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiDownload,
  FiShield,
  FiArrowLeft
} from 'react-icons/fi';
import { format, differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

// Types avec toutes les propriétés optionnelles
interface Subscription {
  id?: string;
  offer_id?: string;
  offer_name?: string;
  storage_gb?: number;
  status?: 'active' | 'pending' | 'expired' | 'cancelled' | 'suspended';
  current_period_start?: string;
  current_period_end?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  next_payment_date?: string;
  auto_renew?: boolean;
  usage_percentage?: number;
  used_gb?: number;
  total_gb?: number;
  payment_history?: Array<{
    id: string;
    date: string;
    amount: number;
    status: string;
    invoice_url?: string;
    offer_name?: string;
    period_months?: number;
  }>;
}

interface UpgradeOption {
  id: string;
  name: string;
  storage_gb: number;
  price_per_month: number;
  price_difference: number;
  features: string[];
  additional_gb?: number;
}

export default function SubscriptionManagementPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [selectedUpgrade, setSelectedUpgrade] = useState<string>('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const getToken = () => {
    if (typeof window !== 'undefined') {
      const token = Cookies.get('token');
      return token || '';
    }
    return '';
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadSubscription = async () => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/subscription`, {
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

      if (response.status === 404) {
        // Pas d'abonnement, rediriger vers les offres
        router.push('/dashboard/storage/offers');
        return;
      }

      if (!response.ok) throw new Error('Erreur de chargement');

      const result = await response.json();
      // La réponse peut être { subscription: {...} } ou directement l'objet
      setSubscription(result.subscription || result);
    } catch (error) {
      console.error('Erreur:', error);
      showNotification('error', 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadUpgradeOptions = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/storage/upgrade-options`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setUpgradeOptions(result.options || []);
      }
    } catch (error) {
      console.error('Erreur options:', error);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedUpgrade || !subscription) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/subscription/upgrade`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_offer_id: selectedUpgrade
        })
      });

      if (!response.ok) throw new Error('Erreur lors de la mise à niveau');

      showNotification('success', 'Abonnement mis à niveau avec succès');
      setShowUpgradeModal(false);
      setSelectedUpgrade('');
      loadSubscription();
    } catch (error) {
      showNotification('error', 'Erreur lors de la mise à niveau');
      console.error('Erreur upgrade:', error);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/subscription/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur lors de l\'annulation');

      showNotification('success', 'Abonnement annulé avec succès');
      setShowCancelModal(false);
      loadSubscription();
    } catch (error) {
      showNotification('error', 'Erreur lors de l\'annulation');
      console.error('Erreur cancel:', error);
    }
  };

  const handleRenew = async () => {
    if (!subscription) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/subscription/renew`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur lors du renouvellement');

      showNotification('success', 'Abonnement renouvelé avec succès');
      loadSubscription();
    } catch (error) {
      showNotification('error', 'Erreur lors du renouvellement');
      console.error('Erreur renew:', error);
    }
  };

  const toggleAutoRenew = async () => {
    if (!subscription) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/subscription/auto-renew`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auto_renew: !subscription.auto_renew
        })
      });

      if (!response.ok) throw new Error('Erreur lors de la modification');

      showNotification(
        'success',
        `Renouvellement automatique ${!subscription.auto_renew ? 'activé' : 'désactivé'}`
      );
      loadSubscription();
    } catch (error) {
      showNotification('error', 'Erreur lors de la modification');
      console.error('Erreur toggle renew:', error);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
  const token = getToken();
  if (!token) {
    showNotification('error', 'Veuillez vous reconnecter');
    return;
  }

  try {
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
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    showNotification('error', 'Impossible de télécharger la facture');
    console.error(err);
  }
};

  const getRemainingDays = () => {
    if (!subscription?.current_period_end) return 0;
    try {
      const endDate = new Date(subscription.current_period_end);
      const today = new Date();
      return Math.max(0, differenceInDays(endDate, today));
    } catch {
      return 0;
    }
  };

  const formatPrice = (amount?: number, currency?: string) => {
    if (!amount) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'expired': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  useEffect(() => {
    loadSubscription();
    loadUpgradeOptions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de votre abonnement...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center py-12">
        <FiHardDrive className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">Aucun abonnement actif</h3>
        <p className="text-gray-600 mt-2">Vous n'avez pas encore souscrit à une offre de stockage.</p>
        <button
          onClick={() => router.push('/dashboard/storage/offers')}
          className="mt-4 px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors"
        >
          Voir les offres disponibles
        </button>
      </div>
    );
  }

  // Valeurs sécurisées avec fallback
  const safeSubscription = {
    offer_name: subscription.offer_name || 'Abonnement',
    status: subscription.status || 'pending',
    amount: subscription.amount || 0,
    currency: subscription.currency || 'XOF',
    current_period_start: subscription.current_period_start || new Date().toISOString(),
    current_period_end: subscription.current_period_end || new Date().toISOString(),
    next_payment_date: subscription.next_payment_date,
    payment_method: subscription.payment_method,
    auto_renew: subscription.auto_renew || false,
    used_gb: subscription.used_gb || 0,
    total_gb: subscription.total_gb || 0,
    usage_percentage: subscription.usage_percentage || 0,
    payment_history: subscription.payment_history || []
  };

  const remainingDays = getRemainingDays();
  const isExpiringSoon = remainingDays <= 7 && remainingDays > 0;
  const isExpired = safeSubscription.status === 'expired';

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Bouton retour */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
      >
        <FiArrowLeft className="h-4 w-4" />
        Retour
      </button>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg ${
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
        </div>
      )}

      {/* En-tête avec statut */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiHardDrive className="text-[var(--primary-green)]" />
              {safeSubscription.offer_name}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(safeSubscription.status)}`}>
                {safeSubscription.status === 'active' ? 'Actif' :
                 safeSubscription.status === 'expired' ? 'Expiré' :
                 safeSubscription.status === 'cancelled' ? 'Annulé' :
                 safeSubscription.status}
              </span>
              <span className="text-sm text-gray-600">
                {formatPrice(safeSubscription.amount, safeSubscription.currency)} / mois
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowUpgradeModal(true);
                loadUpgradeOptions();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <FiEdit2 className="h-4 w-4" />
              Modifier
            </button>
            <button
              onClick={handleRenew}
              disabled={!isExpired}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiRefreshCw className="h-4 w-4" />
              Renouveler
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={safeSubscription.status === 'cancelled' || safeSubscription.status === 'expired'}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiX className="h-4 w-4" />
              Annuler
            </button>
          </div>
        </div>

        {/* Alertes */}
        {isExpiringSoon && !isExpired && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <FiAlertCircle className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
              <div>
                <h5 className="text-sm font-medium text-yellow-800">
                  Votre abonnement expire dans {remainingDays} jour{remainingDays > 1 ? 's' : ''}
                </h5>
                <p className="text-sm text-yellow-700 mt-1">
                  Pensez à renouveler pour continuer à bénéficier de votre espace de stockage.
                </p>
              </div>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <FiAlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
              <div>
                <h5 className="text-sm font-medium text-red-800">
                  Votre abonnement a expiré
                </h5>
                <p className="text-sm text-red-700 mt-1">
                  Vos données seront conservées pendant 30 jours supplémentaires.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistiques et informations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Utilisation du stockage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilisation du stockage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Utilisé: {(safeSubscription.used_gb || 0).toFixed(2)} Go</span>
                <span>Disponible: {((safeSubscription.total_gb || 0) - (safeSubscription.used_gb || 0)).toFixed(2)} Go</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full ${
                    (safeSubscription.usage_percentage || 0) >= 90 ? 'bg-red-500' :
                    (safeSubscription.usage_percentage || 0) >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(safeSubscription.usage_percentage || 0, 100)}%` }}
                ></div>
              </div>
              <div className="text-center text-sm text-gray-500 mt-2">
                {Math.round(safeSubscription.usage_percentage || 0)}% utilisé
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{safeSubscription.total_gb || 0} Go</div>
                <div className="text-sm text-blue-600">Espace total</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{(safeSubscription.used_gb || 0).toFixed(1)} Go</div>
                <div className="text-sm text-green-600">Espace utilisé</div>
              </div>
            </div>
          </div>
        </div>

        {/* Informations de facturation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de facturation</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Période actuelle</span>
              <span className="font-medium">
                {safeSubscription.current_period_start ? format(new Date(safeSubscription.current_period_start), 'dd/MM/yyyy') : 'N/A'} -{' '}
                {safeSubscription.current_period_end ? format(new Date(safeSubscription.current_period_end), 'dd/MM/yyyy') : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Prochain paiement</span>
              <span className="font-medium">
                {safeSubscription.next_payment_date
                  ? format(new Date(safeSubscription.next_payment_date), 'dd/MM/yyyy')
                  : 'Non programmé'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Moyen de paiement</span>
              <span className="font-medium flex items-center gap-2">
                <FiCreditCard className="h-4 w-4" />
                {safeSubscription.payment_method || 'Non défini'}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Renouvellement automatique</span>
                <button
                  onClick={toggleAutoRenew}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                    safeSubscription.auto_renew ? 'bg-[var(--primary-green)]' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    safeSubscription.auto_renew ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historique des abonnements */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Historique des abonnements</h3>
        {safeSubscription.payment_history.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aucun historique de paiement</p>
        ) : (
          <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
  <thead>
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date validation</th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offre</th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durée</th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facture</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-gray-200">
    {safeSubscription.payment_history.length === 0 ? (
      <tr>
        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
          Aucun historique d'abonnement
        </td>
      </tr>
    ) : (
      safeSubscription.payment_history.map((item) => (
        <tr key={item.id}>
          <td className="px-6 py-4 whitespace-nowrap">
            {item.date ? format(new Date(item.date), 'dd/MM/yyyy') : 'N/A'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {/* À remplir quand tu renvoies offer_name depuis le serveur */}
            {item.offer_name || 'Offre inconnue'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {item.period_months || 1} mois
          </td>
          <td className="px-6 py-4 whitespace-nowrap font-medium">
            {formatPrice(item.amount, safeSubscription.currency)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              item.status === 'validated' || item.status === 'paid' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {item.status === 'validated' ? 'Validé' : item.status}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {item.invoice_url && (
              <button
                onClick={() => downloadInvoice(item.id)}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <FiDownload className="h-4 w-4 mr-2" />
                Télécharger
              </button>
            )}
          </td>
        </tr>
      ))
    )}
  </tbody>
</table>

          </div>
        )}
      </div>
       {/* Modal Mise à niveau (Modifier) */}
{showUpgradeModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b flex justify-between items-center">
        <h3 className="text-xl font-bold">Modifier l'abonnement</h3>
        <button onClick={() => setShowUpgradeModal(false)}>
          <FiX className="h-6 w-6 text-gray-500 hover:text-gray-800" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-gray-600">Choisissez une nouvelle offre :</p>
        {upgradeOptions.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucune offre supérieure disponible</p>
        ) : (
          <div className="space-y-3">
            {upgradeOptions.map(option => (
              <div
                key={option.id}
                onClick={() => setSelectedUpgrade(option.id)}
                className={`p-4 border rounded-lg cursor-pointer transition ${
                  selectedUpgrade === option.id 
                    ? 'border-[var(--primary-green)] bg-green-50' 
                    : 'border-gray-200 hover:border-[var(--primary-green)]'
                }`}
              >
                <div className="font-semibold">{option.name} – {option.storage_gb} Go</div>
                <div className="text-sm text-gray-600">
                  +{option.additional_gb || option.storage_gb} Go supplémentaires
                </div>
                <div className="text-lg font-bold text-[var(--primary-green)] mt-1">
                  {formatPrice(option.price_per_month)} / mois
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-6 border-t flex justify-end gap-3">
        <button
          onClick={() => setShowUpgradeModal(false)}
          className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          onClick={handleUpgrade}
          disabled={!selectedUpgrade}
          className="px-5 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmer la mise à niveau
        </button>
      </div>
    </div>
  </div>
)}

{/* Modal Annulation */}
{showCancelModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <div className="p-6 border-b">
        <h3 className="text-xl font-bold text-red-600">Annuler l'abonnement ?</h3>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-gray-700">
          Êtes-vous sûr de vouloir annuler votre abonnement ? Vos données seront conservées pendant 7 jours, puis supprimées définitivement.
        </p>
        <p className="text-sm text-red-600 font-medium">
          Cette action est irréversible après la période de grâce.
        </p>
      </div>
      <div className="p-6 border-t flex justify-end gap-3">
        <button
          onClick={() => setShowCancelModal(false)}
          className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Non, garder l'abonnement
        </button>
        <button
          onClick={handleCancel}
          className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Oui, annuler
        </button>
      </div>
    </div>
  </div>
)}


    </div>
  );
}
