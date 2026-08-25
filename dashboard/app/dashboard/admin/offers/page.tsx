'use client';

import { useState, useEffect } from 'react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiStar,
  FiHardDrive,
  FiDollarSign,
  FiCheck,
  FiAlertCircle
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface Offer {
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
  is_active: boolean;
  created_at: string;
}

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState<Partial<Offer>>({
    name: '',
    description: '',
    storage_gb: 10,
    price_per_month: 9.99,
    price_per_year: 99.99,
    discount_percentage: 17,
    features: [],
    popular: false,
    recommended_for: [],
    limitations: {
      max_file_size: '500 Mo',
      concurrent_uploads: 3,
      retention_days: 30
    },
    is_active: true
  });
  const [featureInput, setFeatureInput] = useState('');
  const [recommendedInput, setRecommendedInput] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const getToken = () => Cookies.get('token') || '';

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Charger les offres
  const loadOffers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/offers`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const data = await response.json();
      setOffers(data.offers || []);
    } catch (error) {
      showNotification('error', 'Erreur chargement offres');
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarder offre
  const saveOffer = async () => {
    try {
      const method = editingOffer ? 'PUT' : 'POST';
      const url = editingOffer 
        ? `${API_BASE_URL}/admin/offers/${editingOffer.id}`
        : `${API_BASE_URL}/admin/offers`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Erreur sauvegarde');

      showNotification('success', editingOffer ? 'Offre modifiée' : 'Offre créée');
      setShowModal(false);
      setEditingOffer(null);
      loadOffers();
    } catch (error) {
      showNotification('error', 'Erreur lors de la sauvegarde');
    }
  };

  // Supprimer offre
  const deleteOffer = async (id: string) => {
    if (!confirm('Supprimer cette offre ?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/offers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (!response.ok) throw new Error('Erreur suppression');

      showNotification('success', 'Offre supprimée');
      loadOffers();
    } catch (error) {
      showNotification('error', 'Erreur suppression');
    }
  };

  // Ajouter une fonctionnalité
  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...(formData.features || []), featureInput.trim()]
      });
      setFeatureInput('');
    }
  };

  // Supprimer une fonctionnalité
  const removeFeature = (index: number) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures.splice(index, 1);
    setFormData({ ...formData, features: newFeatures });
  };

  // Ajouter recommandation
  const addRecommended = () => {
    if (recommendedInput.trim()) {
      setFormData({
        ...formData,
        recommended_for: [...(formData.recommended_for || []), recommendedInput.trim()]
      });
      setRecommendedInput('');
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' ? (
            <FiCheck className="h-5 w-5 mr-2" />
          ) : (
            <FiAlertCircle className="h-5 w-5 mr-2" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FiHardDrive className="text-[var(--primary-green)]" />
            Gestion des Offres
          </h1>
          <p className="text-gray-600 mt-1">
            Créez et gérez les offres de stockage
          </p>
        </div>
        <button
          onClick={() => {
            setEditingOffer(null);
            setFormData({
              name: '',
              description: '',
              storage_gb: 10,
              price_per_month: 9.99,
              price_per_year: 99.99,
              discount_percentage: 17,
              features: [],
              popular: false,
              recommended_for: [],
              limitations: {
                max_file_size: '500 Mo',
                concurrent_uploads: 3,
                retention_days: 30
              },
              is_active: true
            });
            setShowModal(true);
          }}
          className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] flex items-center gap-2"
        >
          <FiPlus className="h-5 w-5" />
          Nouvelle offre
        </button>
      </div>

      {/* Liste des offres */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stockage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix mensuel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix annuel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Populaire</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {offers.map((offer) => (
              <tr key={offer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{offer.name}</div>
                  <div className="text-sm text-gray-500">{offer.description}</div>
                </td>
                <td className="px-6 py-4">{offer.storage_gb} Go</td>
                <td className="px-6 py-4">{offer.price_per_month} €</td>
                <td className="px-6 py-4">{offer.price_per_year} €</td>
                <td className="px-6 py-4">
                  {offer.popular && <FiStar className="h-5 w-5 text-yellow-400" />}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    offer.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {offer.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingOffer(offer);
                        setFormData(offer);
                        setShowModal(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteOffer(offer.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  {editingOffer ? 'Modifier' : 'Nouvelle'} offre
                </h2>
                <button onClick={() => setShowModal(false)}>
                  <FiX className="h-6 w-6 text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Infos générales */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de l'offre
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stockage (Go)
                    </label>
                    <input
                      type="number"
                      value={formData.storage_gb}
                      onChange={(e) => setFormData({ ...formData, storage_gb: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prix mensuel (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_per_month}
                        onChange={(e) => setFormData({ ...formData, price_per_month: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prix annuel (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_per_year}
                        onChange={(e) => setFormData({ ...formData, price_per_year: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      % de réduction (annuel)
                    </label>
                    <input
                      type="number"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.popular}
                      onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                      className="h-4 w-4 text-[var(--primary-green)] rounded border-gray-300"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Marquer comme "Populaire"
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 text-[var(--primary-green)] rounded border-gray-300"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Offre active
                    </label>
                  </div>
                </div>

                {/* Fonctionnalités et limitations */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fonctionnalités
                    </label>
                    <div className="space-y-2 mb-2">
                      {formData.features?.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                          <span className="flex-1 text-sm">{feature}</span>
                          <button
                            onClick={() => removeFeature(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <FiX className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        placeholder="Nouvelle fonctionnalité"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                      />
                      <button
                        onClick={addFeature}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <FiPlus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recommandé pour
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.recommended_for?.map((item, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm"
                        >
                          {item}
                          <button
                            onClick={() => {
                              const newRec = [...(formData.recommended_for || [])];
                              newRec.splice(index, 1);
                              setFormData({ ...formData, recommended_for: newRec });
                            }}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <FiX className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={recommendedInput}
                        onChange={(e) => setRecommendedInput(e.target.value)}
                        placeholder="Ex: Freelancers, PME..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        onKeyPress={(e) => e.key === 'Enter' && addRecommended()}
                      />
                      <button
                        onClick={addRecommended}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <FiPlus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-medium text-gray-900 mb-3">Limitations</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Taille max fichier
                        </label>
                        <input
                          type="text"
                          value={formData.limitations?.max_file_size}
                          onChange={(e) => setFormData({
                            ...formData,
                            limitations: { ...formData.limitations!, max_file_size: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Uploads simultanés
                        </label>
                        <input
                          type="number"
                          value={formData.limitations?.concurrent_uploads}
                          onChange={(e) => setFormData({
                            ...formData,
                            limitations: { ...formData.limitations!, concurrent_uploads: parseInt(e.target.value) }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Rétention (jours)
                        </label>
                        <input
                          type="number"
                          value={formData.limitations?.retention_days}
                          onChange={(e) => setFormData({
                            ...formData,
                            limitations: { ...formData.limitations!, retention_days: parseInt(e.target.value) }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={saveOffer}
                  className="px-4 py-2 bg-[var(--primary-green)] text-white rounded-lg hover:bg-[var(--primary-green-dark)] flex items-center gap-2"
                >
                  <FiSave className="h-4 w-4" />
                  {editingOffer ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
