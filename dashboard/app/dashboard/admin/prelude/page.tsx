'use client';

import { useState, useEffect } from 'react';
import { preludeAPI } from '@/lib/api/prelude';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { FiUsers, FiMessageSquare, FiDollarSign, FiActivity, FiRefreshCw } from 'react-icons/fi';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminPreludeDashboard() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await preludeAPI.admin.getDashboard();
      setDashboard(data.data);
    } catch (error) {
      console.error('Erreur chargement dashboard admin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      await preludeAPI.admin.syncTemplates();
      alert('Synchronisation lancée avec succès');
    } catch (error) {
      console.error('Erreur synchronisation:', error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d7a3e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a1a]">Administration Prelude</h1>
          <p className="text-gray-500 mt-1">Gestion centralisée des communications</p>
        </div>
        <Button 
          onClick={handleSyncTemplates}
          disabled={syncing}
          className="bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white flex items-center gap-2"
        >
          <FiRefreshCw className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Synchronisation...' : 'Synchroniser les templates'}
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#2d7a3e] to-[#1e5a2f] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Clients actifs</p>
                <p className="text-3xl font-bold mt-2">{dashboard?.overview?.active_clients || 0}</p>
              </div>
              <FiUsers className="text-4xl opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#8bc34a] to-[#689f38] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Messages 24h</p>
                <p className="text-3xl font-bold mt-2">{dashboard?.overview?.last_24h || 0}</p>
              </div>
              <FiMessageSquare className="text-4xl opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1976d2] to-[#0d47a1] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Coût total</p>
                <p className="text-3xl font-bold mt-2">{dashboard?.overview?.total_cost?.toFixed(2) || 0} €</p>
              </div>
              <FiDollarSign className="text-4xl opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#ff9800] to-[#f57c00] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Fallbacks</p>
                <p className="text-3xl font-bold mt-2">{dashboard?.overview?.fallback_count || 0}</p>
              </div>
              <FiActivity className="text-4xl opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates en attente */}
      <Card>
        <CardHeader>
          <CardTitle>Templates en attente d'approbation</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard?.pending_templates?.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucun template en attente</p>
          ) : (
            <div className="space-y-4">
              {dashboard?.pending_templates?.map((template: any) => (
                <div key={template.id} className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-gray-500">
                      Client: {template.client_name} | Créé le {format(new Date(template.created_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    En attente
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campagnes récentes */}
      <Card>
        <CardHeader>
          <CardTitle>Campagnes récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Nom</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Template</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                  <th className="px-4 py-2 text-right">Envoyés</th>
                  <th className="px-4 py-2 text-right">Échecs</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.recent_campaigns?.map((campaign: any) => (
                  <tr key={campaign.id} className="hover:bg-[#f8fbfa]">
                    <td className="px-4 py-2 font-medium">{campaign.name}</td>
                    <td className="px-4 py-2">{campaign.client_name}</td>
                    <td className="px-4 py-2">{campaign.template_name}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        campaign.status === 'completed' ? 'bg-[#f0f7f3] text-[#2d7a3e]' :
                        campaign.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{campaign.successful}</td>
                    <td className="px-4 py-2 text-right">{campaign.failed}</td>
                    <td className="px-4 py-2">
                      {format(new Date(campaign.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Préférences des canaux */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition des préférences client</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dashboard?.channel_preferences?.map((pref: any) => (
              <div key={pref.preferred_channel} className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg">
                <span className="font-medium capitalize">{pref.preferred_channel}</span>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-[#2d7a3e]">{pref.count}</span>
                  <span className="text-sm text-gray-500">clients</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
