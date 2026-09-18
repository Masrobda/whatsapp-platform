// app/dashboard/admin/storage/offers/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  FiHardDrive,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiRefreshCw,
  FiStar,
  FiDollarSign
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface Offer {
  id: string;
  name: string;
  description: string;
  storage_gb: number;
  price_fcfa: number;
  price_year_fcfa: number;
  discount_percentage: number;
  features: string[];
  popular: boolean;
  max_file_size_mb: number;
  concurrent_uploads: number;
  retention_days: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [showModal, setShowModal] = useState(false);
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

  // Charger les offres
  const loadOffers = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/storage/offers`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur chargement');

      const data = await response.json();
      setOffers(data.offers || []);

    } catch (err) {
      showNotification('error', 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarder une offre
  const saveOffer = async (offerData: Partial<Offer>) => {
    try {
      const token = getToken();
      if (!token) return;

      const url = offerData.id
        ? `${API_BASE_URL}/admin/storage/offers/${offerData.id}`
        : `${API_BASE_URL}/admin/storage/offers`;

      const method = offerData.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(offerData)
      });

      if (!response.ok) throw new Error('Erreur sauvegarde');

      showNotification('success', offerData.id ? 'Offre modifiée' : 'Offre créée');
      setShowModal(false);
      setEditingOffer(null);
      loadOffers();

    } catch (err) {
      showNotification('error', 'Erreur lors de la sauvegarde');
    }
  };

  // Supprimer une offre
  const deleteOffer = async (offerId: string) => {
    if (!confirm('Supprimer cette offre définitivement ?')) return;

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/admin/storage/offers/${offerId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur suppression');

      showNotification('success', 'Offre supprimée');
      loadOffers();

    } catch (err) {
      showNotification('error', 'Erreur lors de la suppression');
    }
  };

  // Formater le prix FCFA
  const formatFCFA = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  useEffect(() => {
    loadOffers();
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
    <div className="space-y-6 p-6">
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

      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FiHardDrive className="text-[var(--primary-green)]" />
            Gestion des Offres de Stockage
          </h1>
          <p className="text-gray-600 mt-1">
            Créez et gérez les offres proposées aux clients
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadOffers}
            className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              setEditingOffer(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] flex items-center gap-2"
          >
            <FiPlus className="h-5 w-5" />
            Nouvelle offre
          </button>
        </div>
      </div>

      {/* Liste des offres */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className={`bg-white rounded-xl border-2 p-6 relative ${
              offer.popular ? 'border-[var(--primary-green)] shadow-lg' : 'border-gray-200'
            } ${!offer.is_active ? 'opacity-60' : ''}`}
          >
            {offer.popular && (
              <div className="absolute -top-3 right-4">
                <div className="px-3 py-1 bg-[var(--primary-green)] text-white text-xs font-bold rounded-full flex items-center gap-1">
                  <FiStar className="h-3 w-3" />
                  POPULAIRE
                </div>
              </div>
            )}

            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{offer.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{offer.description}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditingOffer(offer);
                    setShowModal(true);
                  }}
                  className="p-2 text-gray-600 hover:text-blue-500"
                >
                  <FiEdit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteOffer(offer.id)}
                  className="p-2 text-gray-600 hover:text-red-500"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {formatFCFA(offer.price_fcfa)}
                </span>
                <span className="text-gray-600">/mois</span>
              </div>
              <div className="text-sm text-gray-600">
                {formatFCFA(offer.price_year_fcfa)}/an
                {offer.discount_percentage > 0 && (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    -{offer.discount_percentage}%
                  </span>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 text-2xl font-bold text-[var(--primary-green)]">
                <FiHardDrive />
                {offer.storage_gb} Go
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {offer.features?.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <FiCheck className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 text-sm text-gray-600">
              <p>📁 Fichiers max: {offer.max_file_size_mb} Mo</p>
              <p>📤 Uploads simultanés: {offer.concurrent_uploads}</p>
              <p>⏱️ Rétention après expiration: {offer.retention_days} jours</p>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                offer.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {offer.is_active ? 'Active' : 'Inactive'}
              </span>
              <span className="text-xs text-gray-500">
                Créée le {new Date(offer.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal d'édition/création */}
      {showModal && (
        <OfferModal
          offer={editingOffer}
          onClose={() => {
            setShowModal(false);
            setEditingOffer(null);
          }}
          onSave={saveOffer}
        />
      )}
    </div>
  );
}

// Modal pour éditer/créer une offre
function OfferModal({ offer, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    id: offer?.id || '',
    name: offer?.name || '',
    description: offer?.description || '',
    storage_gb: offer?.storage_gb || 50,
    price_fcfa: offer?.price_fcfa || 15000,
    price_year_fcfa: offer?.price_year_fcfa || 150000,
    discount_percentage: offer?.discount_percentage || 0,
    features: offer?.features?.join('\n') || '',
    popular: offer?.popular || false,
    max_file_size_mb: offer?.max_file_size_mb || 500,
    concurrent_uploads: offer?.concurrent_uploads || 3,
    retention_days: offer?.retention_days || 7,
    is_active: offer?.is_active ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      features: formData.features.split('\n').filter((f: string) => f.trim())
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {offer ? 'Modifier l\'offre' : 'Nouvelle offre'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <FiX className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'offre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  placeholder="Ex: Professionnel"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  rows={2}
                  placeholder="Brève description de l'offre"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stockage (Go) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.storage_gb}
                  onChange={(e) => setFormData({...formData, storage_gb: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix mensuel (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price_fcfa}
                  onChange={(e) => setFormData({...formData, price_fcfa: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix annuel (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price_year_fcfa}
                  onChange={(e) => setFormData({...formData, price_year_fcfa: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Réduction annuelle (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({...formData, discount_percentage: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caractéristiques (une par ligne)
                </label>
                <textarea
                  value={formData.features}
                  onChange={(e) => setFormData({...formData, features: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                  rows={5}
                  placeholder="Stockage sécurisé&#10;Sauvegarde automatique&#10;Support prioritaire"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taille max fichier (Mo)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_file_size_mb}
                  onChange={(e) => setFormData({...formData, max_file_size_mb: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uploads simultanés
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.concurrent_uploads}
                  onChange={(e) => setFormData({...formData, concurrent_uploads: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rétention (jours)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.retention_days}
                  onChange={(e) => setFormData({...formData, retention_days: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-green)]"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="popular"
                  checked={formData.popular}
                  onChange={(e) => setFormData({...formData, popular: e.target.checked})}
                  className="h-4 w-4 text-[var(--primary-green)] rounded"
                />
                <label htmlFor="popular" className="ml-2 text-sm text-gray-700">
                  Marquer comme populaire
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="h-4 w-4 text-[var(--primary-green)] rounded"
                />
                <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                  Offre active
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] flex items-center gap-2"
              >
                <FiSave className="h-4 w-4" />
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
