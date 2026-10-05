'use client';

import { useEffect, useState } from 'react';
import { client as clientAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FiSave, FiUser } from 'react-icons/fi';

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    tax_id: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await clientAPI.getProfile();
      setProfile(response.client);
      setFormData({
        company_name: response.client.company_name || '',
        phone: response.client.phone || '',
        address: response.client.address || '',
        city: response.client.city || '',
        country: response.client.country || '',
        tax_id: response.client.tax_id || '',
      });
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await clientAPI.updateProfile(formData);
      alert('Profil mis à jour avec succès !');
      loadProfile();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Paramètres</h1>
        <p className="text-gray-500 mt-1">Gérez les informations de votre compte</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations du profil */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations du profil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nom de l'entreprise"
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="NEXT LTD"
                />

                <Input
                  label="Téléphone"
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+237600000000"
                />
              </div>

              <Input
                label="Adresse"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Rue Example"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Ville"
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Douala"
                />

                <Input
                  label="Pays"
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Cameroun"
                />
              </div>

              <Input
                label="Numéro fiscal (optionnel)"
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="M123456789"
              />

              <Button
                onClick={handleSave}
                isLoading={isSaving}
                className="w-full md:w-auto"
              >
                <FiSave className="mr-2" />
                Enregistrer les modifications
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Informations du compte */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-dark">{profile?.email}</p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">Type de compte</p>
              <p className="font-medium text-dark capitalize">{profile?.company_type}</p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">Compte créé le</p>
              <p className="font-medium text-dark">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : '-'}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">Dernière connexion</p>
              <p className="font-medium text-dark">
                {profile?.last_login ? new Date(profile.last_login).toLocaleDateString('fr-FR') : '-'}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">Statut</p>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                profile?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {profile?.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
