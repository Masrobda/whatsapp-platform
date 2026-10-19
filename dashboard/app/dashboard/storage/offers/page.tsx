'use client';

import { useState, useEffect } from 'react';
import {
  FiHardDrive,
  FiCheck,
  FiShoppingCart,
  FiCreditCard,
  FiCalendar,
  FiShield,
  FiZap,
  FiUsers,
  FiStar,
  FiClock,
  FiTrendingUp
} from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

// Types
interface StorageOffer {
  id: string;
  name: string;
  description: string;
  storage_gb: number;
  price_per_month: number;
  price_per_year: number;
  discount_percentage: number;
  features: string[];
  popular: boolean;
  recommended_for: string[];
  limitations: {
    max_file_size: string;
    concurrent_uploads: number;
    retention_days: number;
  };
}

interface ClientOrder {
  id: string;
  offer_id: string;
  subscription_id?: string;
  status: 'pending' | 'paid' | 'active' | 'expired' | 'cancelled';
  amount: number;
  period_months: number;
  created_at: string;
  expires_at?: string;
}

export default function StorageOffersPage() {
  const [offers, setOffers] = useState<StorageOffer[]>([]);
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<StorageOffer | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('year');
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const getToken = () => {
  if (typeof window !== 'undefined') {
    const token = Cookies.get('token');
    console.log('[StoragePage] Token récupéré depuis cookie :', token ? `OUI (${token.substring(0, 10)}...)` : 'NON');
    return token || '';
  }
  return '';
};

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Charger les offres disponibles
  const loadOffers = async () => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/offers`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur de chargement');

      const result = await response.json();
      setOffers(result.offers || []);
    } catch (error) {
      console.error('Erreur:', error);
      showNotification('error', 'Erreur lors du chargement des offres');
    } finally {
      setLoading(false);
    }
  };

  // Charger les commandes du client
  const loadClientOrders = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/storage/client-orders`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setClientOrders(result.orders || []);
      }
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
    }
  };

  // Calculer le prix selon la période
  const calculatePrice = (offer: StorageOffer) => {
    if (selectedPeriod === 'year') {
      return offer.price_per_year;
    }
    return offer.price_per_month;
  };

  // Formater le prix
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF'
    }).format(price);
  };

  // Obtenir l'économie
  const calculateSavings = (offer: StorageOffer) => {
    if (selectedPeriod === 'year') {
      const monthlyTotal = offer.price_per_month * 12;
      return monthlyTotal - offer.price_per_year;
    }
    return 0;
  };

  // Commencer le processus de commande
  const handleOrder = async (offer: StorageOffer) => {
    setSelectedOffer(offer);
    setShowOrderModal(true);
  };

  // Confirmer la commande
  const confirmOrder = async () => {
    if (!selectedOffer) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Veuillez vous reconnecter');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/storage/order`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offer_id: selectedOffer.id,
          period: selectedPeriod,
          months: selectedPeriod === 'year' ? 12 : 1
        })
      });

      if (!response.ok) throw new Error('Erreur lors de la commande');

      const result = await response.json();

      showNotification('success', 'Commande créée avec succès');
      setShowOrderModal(false);

      // Rediriger vers le paiement ou l'espace
      if (result.payment_url) {
        window.location.href = result.payment_url;
      } else if (result.space_id) {
        router.push(`/dashboard/storage/space/${result.space_id}`);
      }

      loadClientOrders();
    } catch (error) {
      showNotification('error', 'Erreur lors de la commande');
      console.error('Erreur commande:', error);
    }
  };

  // Vérifier si le client a déjà un espace actif
  const hasActiveSpace = () => {
    return clientOrders.some(order => order.status === 'active');
  };

  useEffect(() => {
    loadOffers();
    loadClientOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des offres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
              <FiClock className="h-5 w-5 mr-2" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Stockage Cloud Professionnel
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Stockez, partagez et sécurisez vos documents avec nos solutions adaptées à vos besoins
        </p>
      </div>

      {/* Période de facturation */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-white">
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedPeriod === 'month'
                ? 'bg-[var(--primary-green)] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Facturation mensuelle
          </button>
          <button
            onClick={() => setSelectedPeriod('year')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedPeriod === 'year'
                ? 'bg-[var(--primary-green)] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Facturation annuelle
            <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
              Économisez jusqu'à 20%
            </span>
          </button>
        </div>
      </div>

      {/* Grille des offres */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {offers.map((offer) => {
          const price = calculatePrice(offer);
          const savings = calculateSavings(offer);
          const isActive = clientOrders.some(
            order => order.offer_id === offer.id && order.status === 'active'
          );

          return (
            <div
              key={offer.id}
              className={`relative rounded-2xl border-2 p-8 transition-all hover:shadow-xl ${
                offer.popular
                  ? 'border-[var(--primary-green)] bg-gradient-to-b from-green-50 to-white'
                  : 'border-gray-200 bg-white'
              } ${isActive ? 'ring-2 ring-[var(--primary-green)]' : ''}`}
            >
              {/* Badge populaire */}
              {offer.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="px-4 py-1 bg-[var(--primary-green)] text-white text-sm font-semibold rounded-full flex items-center gap-1">
                    <FiStar className="h-4 w-4" />
                    Le plus populaire
                  </div>
                </div>
              )}

              {/* Badge actif */}
              {isActive && (
                <div className="absolute -top-3 right-4">
                  <div className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                    Actif
                  </div>
                </div>
              )}

              {/* En-tête de l'offre */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{offer.name}</h3>
                <p className="text-gray-600">{offer.description}</p>
              </div>

              {/* Prix */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold text-gray-900">{formatPrice(price)}</span>
                  <span className="text-gray-600">
                    /{selectedPeriod === 'year' ? 'an' : 'mois'}
                  </span>
                </div>

                {savings > 0 && (
                  <div className="mt-2">
                    <span className="text-sm text-green-600">
                      <FiTrendingUp className="inline mr-1" />
                      Économisez {formatPrice(savings)} par an
                    </span>
                  </div>
                )}

                {selectedPeriod === 'year' && offer.discount_percentage > 0 && (
                  <div className="mt-1">
                    <span className="text-sm text-gray-500 line-through">
                      {formatPrice(offer.price_per_month * 12)}
                    </span>
                    <span className="ml-2 text-sm bg-red-100 text-red-800 px-2 py-1 rounded-full">
                      -{offer.discount_percentage}%
                    </span>
                  </div>
                )}
              </div>

              {/* Stockage */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <FiHardDrive className="h-8 w-8 text-[var(--primary-green)]" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{offer.storage_gb} Go</div>
                  <div className="text-sm text-gray-600">Espace de stockage</div>
                </div>
              </div>

              {/* Caractéristiques */}
              <div className="space-y-4 mb-8">
                {offer.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <FiCheck className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Limitations */}
              <div className="border-t border-gray-200 pt-6 mb-8">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Limitations</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <FiShield className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{offer.limitations.max_file_size}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FiZap className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{offer.limitations.concurrent_uploads} uploads simultanés</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <FiCalendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Rétention: {offer.limitations.retention_days} jours</span>
                  </div>
                </div>
              </div>

              {/* Bouton d'action */}
              <button
                onClick={() => handleOrder(offer)}
                disabled={isActive && hasActiveSpace()}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : offer.popular
                    ? 'bg-[var(--primary-green)] text-white hover:bg-[var(--primary-green-dark)]'
                    : 'bg-gray-800 text-white hover:bg-gray-900'
                }`}
              >
                {isActive ? (
                  <>
                    <FiCheck className="h-5 w-5" />
                    Abonnement actif
                  </>
                ) : (
                  <>
                    <FiShoppingCart className="h-5 w-5" />
                    Choisir cette offre
                  </>
                )}
              </button>

              {/* Recommandé pour */}
              {offer.recommended_for.length > 0 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">
                    Recommandé pour {offer.recommended_for.join(', ')}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparatif */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-6xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Comparatif des fonctionnalités
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Fonctionnalité</th>
                {offers.map(offer => (
                  <th key={offer.id} className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                    {offer.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Stockage</td>
                {offers.map(offer => (
                  <td key={offer.id} className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                    {offer.storage_gb} Go
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Sauvegarde automatique</td>
                {offers.map(offer => (
                  <td key={offer.id} className="px-6 py-4 text-center">
                    <FiCheck className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Chiffrement AES-256</td>
                {offers.map(offer => (
                  <td key={offer.id} className="px-6 py-4 text-center">
                    <FiCheck className="h-5 w-5 text-green-500 mx-auto" />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Support technique</td>
                {offers.map(offer => (
                  <td key={offer.id} className="px-6 py-4 text-center text-sm text-gray-700">
                    {offer.name === 'Entreprise' ? '24/7' : '9h-18h'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">API d'intégration</td>
                {offers.map(offer => (
                  <td key={offer.id} className="px-6 py-4 text-center">
                    {offer.name !== 'Basique' ? (
                      <FiCheck className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Questions fréquentes
        </h3>
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Puis-je changer d'offre à tout moment ?
            </h4>
            <p className="text-gray-600">
              Oui, vous pouvez mettre à niveau votre offre à tout moment. La différence de prix sera proratisée.
              Pour les rétrogradations, elles prennent effet à la fin de votre période de facturation en cours.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Que se passe-t-il à l'expiration de mon abonnement ?
            </h4>
            <p className="text-gray-600">
              Vos données sont conservées pendant 30 jours supplémentaires. Vous recevrez des rappels avant l'expiration.
              Après cette période, vos fichiers seront archivés puis supprimés définitivement après 90 jours.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de commande */}
      {showOrderModal && selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Confirmer votre commande
                </h3>
                <p className="text-gray-600">
                  Vous êtes sur le point de souscrire à l'offre
                </p>
                <div className="mt-4 text-3xl font-bold text-[var(--primary-green)]">
                  {selectedOffer.name}
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  Récapitulatif de la commande
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Offre</span>
                    <span className="font-medium">{selectedOffer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stockage</span>
                    <span className="font-medium">{selectedOffer.storage_gb} Go</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Période</span>
                    <span className="font-medium">
                      {selectedPeriod === 'year' ? '12 mois' : '1 mois'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prix</span>
                    <span className="font-medium">{formatPrice(calculatePrice(selectedOffer))}</span>
                  </div>
                  {calculateSavings(selectedOffer) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Économie</span>
                      <span className="font-medium">
                        {formatPrice(calculateSavings(selectedOffer))}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatPrice(calculatePrice(selectedOffer))}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {selectedPeriod === 'year'
                        ? 'Facturé annuellement - Renouvellement automatique'
                        : 'Facturé mensuellement - Renouvellement automatique'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div className="mb-6">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 text-[var(--primary-green)] rounded"
                    required
                  />
                  <span className="text-sm text-gray-600">
                    J'accepte les conditions générales de vente et la politique de confidentialité.
                    Je comprends que cet abonnement se renouvelle automatiquement.
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmOrder}
                  className="flex-1 px-4 py-3 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <FiCreditCard className="h-5 w-5" />
                  Payer maintenant
                </button>
              </div>

              {/* Sécurité */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <FiShield className="h-4 w-4" />
                  <span>Paiement sécurisé • Données chiffrées • Support 24/7</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
