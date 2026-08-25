'use client';

import { useEffect, useState } from 'react';
import { bsp as bspAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiCheck,
  FiX,
  FiSearch,
  FiFilter,
  FiDollarSign,
  FiTrendingUp,
  FiActivity
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface BspProvider {
  id: string;
  name: string;
  message_cost: number;
  additional_charges: {
    fixed: number;
    percent: number;
  };
  is_active: boolean;
  created_at: string;
}

export default function BspManagementPage() {
  const [user, setUser] = useState<any>(null);
  const [providers, setProviders] = useState<BspProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    message_cost: 0,
    fixed_charge: 0,
    percent_charge: 0,
    is_active: true
  });

  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) setUser(JSON.parse(userCookie));
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const response = await bspAPI.getAll({ active_only: false });
      setProviders(response.data || []);
    } catch (error) {
      console.error('Erreur chargement BSP:', error);
      alert('Erreur lors du chargement des fournisseurs BSP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.message_cost <= 0) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const data = {
        name: formData.name,
        message_cost: formData.message_cost,
        additional_charges: {
          fixed: formData.fixed_charge,
          percent: formData.percent_charge
        },
        is_active: formData.is_active
      };

      if (editingId) {
        await bspAPI.update(editingId, data);
        alert('Fournisseur BSP mis à jour avec succès');
      } else {
        await bspAPI.create(data);
        alert('Fournisseur BSP créé avec succès');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadProviders();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleEdit = (provider: BspProvider) => {
    setEditingId(provider.id);
    setFormData({
      name: provider.name,
      message_cost: provider.message_cost,
      fixed_charge: provider.additional_charges.fixed,
      percent_charge: provider.additional_charges.percent,
      is_active: provider.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${name}" ?`)) {
      return;
    }

    try {
      await bspAPI.delete(id);
      alert('Fournisseur BSP supprimé avec succès');
      loadProviders();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur lors de la suppression';
      if (error.response?.data?.code === 'BSP_IN_USE') {
        alert(`${message}. Ce fournisseur est utilisé dans ${error.response.data.usage_count} commande(s).`);
      } else {
        alert(message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      message_cost: 0,
      fixed_charge: 0,
      percent_charge: 0,
      is_active: true
    });
  };

  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-2">Gestion des BSP</h1>
            <p className="text-white/80 text-sm">
              Gestion des fournisseurs de services de messages (Bulk SMS Providers)
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowForm(true);
            }}
            className="bg-white text-primary hover:bg-gray-100"
          >
            <FiPlus className="mr-2" /> Nouveau BSP
          </Button>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un fournisseur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {filteredProviders.length} fournisseur(s)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire (modal) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  {editingId ? 'Modifier un BSP' : 'Nouveau fournisseur BSP'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="text-white/80 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label="Nom du fournisseur"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Ex: Orange Money Business"
              />

              <Input
                label="Coût par message (FCFA)"
                type="number"
                step="0.01"
                min="0"
                value={formData.message_cost}
                onChange={(e) => setFormData({ ...formData, message_cost: parseFloat(e.target.value) || 0 })}
                required
                icon={<FiDollarSign />}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Frais fixes (FCFA)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fixed_charge}
                  onChange={(e) => setFormData({ ...formData, fixed_charge: parseFloat(e.target.value) || 0 })}
                  icon={<FiTrendingUp />}
                />

                <Input
                  label="Frais variables (%)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.percent_charge}
                  onChange={(e) => setFormData({ ...formData, percent_charge: parseFloat(e.target.value) || 0 })}
                  icon={<FiActivity />}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Actif
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  {editingId ? (
                    <>
                      <FiEdit className="mr-2" /> Mettre à jour
                    </>
                  ) : (
                    <>
                      <FiPlus className="mr-2" /> Créer
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste des BSP */}
      <Card>
        <CardHeader>
          <CardTitle>Fournisseurs BSP</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProviders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucun fournisseur BSP trouvé
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Nom</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Coût/message</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Frais additionnels</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Statut</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProviders.map((provider) => (
                    <tr key={provider.id} className="hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="font-semibold">{provider.name}</div>
                        <div className="text-xs text-gray-500">
                          Créé le {new Date(provider.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-primary">
                          {formatCurrency(provider.message_cost)}
                        </div>
                        <div className="text-xs text-gray-500">par message</div>
                      </td>
                      <td className="py-4 px-4">
                        {provider.additional_charges.fixed > 0 && (
                          <div className="text-sm">
                            Fixe: {formatCurrency(provider.additional_charges.fixed)}
                          </div>
                        )}
                        {provider.additional_charges.percent > 0 && (
                          <div className="text-sm">
                            Variable: {provider.additional_charges.percent}%
                          </div>
                        )}
                        {provider.additional_charges.fixed === 0 && provider.additional_charges.percent === 0 && (
                          <div className="text-sm text-gray-400">Aucun</div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {provider.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                            <FiCheck className="inline mr-1" /> Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full">
                            <FiX className="inline mr-1" /> Inactif
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(provider)}
                          >
                            <FiEdit />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(provider.id, provider.name)}
                          >
                            <FiTrash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
