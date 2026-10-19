'use client';

import { useState, useEffect } from 'react';
import { preludeAPI } from '@/lib/api/prelude';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import { FiSend, FiSettings, FiBarChart2, FiGlobe, FiCheckCircle, FiXCircle, FiClock, FiDollarSign, FiSmartphone, FiMessageSquare } from 'react-icons/fi';

export default function PreludeDashboard() {
  const [preferences, setPreferences] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prefs, statsData] = await Promise.all([
        preludeAPI.getPreferences(),
        preludeAPI.getStats('30days')
      ]);
      setPreferences(prefs.data);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur chargement données Prelude:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Aperçu',
      icon: <FiBarChart2 />,
      content: (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-[#2d7a3e] to-[#1e5a2f] text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Messages envoyés</p>
                    <p className="text-3xl font-bold mt-2">{stats?.summary?.total || 0}</p>
                  </div>
                  <FiSend className="text-4xl opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#8bc34a] to-[#689f38] text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">WhatsApp</p>
                    <p className="text-3xl font-bold mt-2">{stats?.summary?.whatsapp || 0}</p>
                  </div>
                  <FiSmartphone className="text-4xl opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1976d2] to-[#0d47a1] text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">SMS</p>
                    <p className="text-3xl font-bold mt-2">{stats?.summary?.sms || 0}</p>
                  </div>
                  <FiMessageSquare className="text-4xl opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#ff9800] to-[#f57c00] text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Coût total</p>
                    <p className="text-3xl font-bold mt-2">{stats?.summary?.total_cost?.toFixed(2) || 0} €</p>
                  </div>
                  <FiDollarSign className="text-4xl opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graphique quotidien */}
          <Card>
            <CardHeader>
              <CardTitle>Activité des 7 derniers jours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {stats?.daily_stats?.slice(0, 7).map((day: any) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-[#f0f7f3] rounded-t-lg overflow-hidden">
                      <div 
                        className="bg-[#2d7a3e] transition-all duration-500"
                        style={{ 
                          height: `${Math.min(200, (parseInt(day.total) / 100) * 200)}px`,
                          maxHeight: '200px'
                        }}
                      />
                    </div>
                    <span className="text-xs mt-2 text-gray-600">
                      {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Répartition par canal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par canal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.channel_stats?.map((channel: any) => (
                    <div key={channel.channel}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{channel.channel}</span>
                        <span className="font-medium">{channel.count} messages</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            channel.channel === 'whatsapp' ? 'bg-[#8bc34a]' : 'bg-[#1976d2]'
                          }`}
                          style={{ 
                            width: `${(channel.count / stats.summary.total) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Préférences actuelles */}
            {preferences && (
              <Card>
                <CardHeader>
                  <CardTitle>Vos préférences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-[#f0f7f3] rounded-lg">
                      <span className="text-sm font-medium">Canal préféré</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        preferences.preferred_channel === 'whatsapp' 
                          ? 'bg-[#8bc34a] text-[#1e5a2f]' 
                          : 'bg-[#1976d2] text-white'
                      }`}>
                        {preferences.preferred_channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-[#f0f7f3] rounded-lg">
                      <span className="text-sm font-medium">Fallback automatique</span>
                      {preferences.allow_fallback ? (
                        <span className="flex items-center gap-1 text-[#2d7a3e]">
                          <FiCheckCircle /> Activé
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-500">
                          <FiXCircle /> Désactivé
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-[#f0f7f3] rounded-lg">
                      <span className="text-sm font-medium">Limite quotidienne</span>
                      <span className="font-bold">{preferences.daily_message_limit} messages</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'send',
      label: 'Envoyer',
      icon: <FiSend />,
      content: <SendMessageTab />
    },
    {
      id: 'preferences',
      label: 'Préférences',
      icon: <FiSettings />,
      content: <PreferencesTab preferences={preferences} onUpdate={loadData} />
    },
    {
      id: 'webhooks',
      label: 'Webhooks',
      icon: <FiGlobe />,
      content: <WebhooksTab />
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d7a3e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Communication Prelude</h1>
        <p className="text-gray-500 mt-1">Gérez vos envois WhatsApp et SMS avec fallback automatique</p>
      </div>

      <Tabs tabs={tabs} defaultTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

// Onglet d'envoi
function SendMessageTab() {
  const [formData, setFormData] = useState({
    template_id: '',
    to: '',
    preferred_channel: 'whatsapp',
    variables: '{}',
    schedule_at: ''
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const variables = JSON.parse(formData.variables);
      const response = await preludeAPI.sendMessage({
        template_id: formData.template_id,
        to: formData.to,
        preferred_channel: formData.preferred_channel as any,
        variables,
        ...(formData.schedule_at && { schedule_at: formData.schedule_at })
      });
      setResult({ success: true, data: response.data });
    } catch (error: any) {
      setResult({ success: false, error: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Envoyer un message</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Template ID *
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              value={formData.template_id}
              onChange={(e) => setFormData({...formData, template_id: e.target.value})}
              placeholder="template_01k8ap1btqf5r9fq2c8ax5fhc9"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Destinataire *
            </label>
            <input
              type="tel"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              value={formData.to}
              onChange={(e) => setFormData({...formData, to: e.target.value})}
              placeholder="+237600000000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Canal préféré
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              value={formData.preferred_channel}
              onChange={(e) => setFormData({...formData, preferred_channel: e.target.value})}
            >
              <option value="whatsapp">WhatsApp (avec fallback SMS)</option>
              <option value="sms">SMS uniquement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Variables (JSON)
            </label>
            <textarea
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent font-mono text-sm"
              value={formData.variables}
              onChange={(e) => setFormData({...formData, variables: e.target.value})}
              placeholder='{"name": "Jean", "order_id": "CMD-001"}'
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Planification (optionnel)
            </label>
            <input
              type="datetime-local"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              value={formData.schedule_at}
              onChange={(e) => setFormData({...formData, schedule_at: e.target.value})}
            />
          </div>

          <Button
            type="submit"
            disabled={sending}
            className="w-full bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white py-3"
          >
            {sending ? 'Envoi en cours...' : 'Envoyer le message'}
          </Button>

          {result && (
            <div className={`mt-4 p-4 rounded-lg ${
              result.success ? 'bg-[#f0f7f3] border-l-4 border-[#2d7a3e]' : 'bg-red-50 border-l-4 border-red-500'
            }`}>
              <p className="font-medium mb-2">
                {result.success ? '✅ Message envoyé avec succès' : '❌ Erreur'}
              </p>
              <pre className="text-sm overflow-x-auto bg-white p-2 rounded">
                {JSON.stringify(result.data || result.error, null, 2)}
              </pre>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// Onglet Préférences
function PreferencesTab({ preferences, onUpdate }: any) {
  const [formData, setFormData] = useState(preferences || {
    preferred_channel: 'whatsapp',
    allow_fallback: true,
    opt_out_sms: false,
    opt_out_whatsapp: false,
    marketing_opt_in: true,
    transactional_opt_in: true,
    daily_message_limit: 1000
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await preludeAPI.updatePreferences(formData);
      onUpdate();
      alert('Préférences mises à jour avec succès');
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences de communication</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Canal préféré
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({...formData, preferred_channel: 'whatsapp'})}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.preferred_channel === 'whatsapp'
                    ? 'border-[#2d7a3e] bg-[#f0f7f3]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FiSmartphone className={`text-2xl mx-auto mb-2 ${
                  formData.preferred_channel === 'whatsapp' ? 'text-[#2d7a3e]' : 'text-gray-400'
                }`} />
                <span className="block text-sm font-medium">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({...formData, preferred_channel: 'sms'})}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.preferred_channel === 'sms'
                    ? 'border-[#1976d2] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FiMessageSquare className={`text-2xl mx-auto mb-2 ${
                  formData.preferred_channel === 'sms' ? 'text-[#1976d2]' : 'text-gray-400'
                }`} />
                <span className="block text-sm font-medium">SMS</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg cursor-pointer">
              <div>
                <span className="font-medium">Fallback automatique</span>
                <p className="text-sm text-gray-500">Passer en SMS si WhatsApp indisponible</p>
              </div>
              <input
                type="checkbox"
                checked={formData.allow_fallback}
                onChange={(e) => setFormData({...formData, allow_fallback: e.target.checked})}
                className="w-5 h-5 text-[#2d7a3e] rounded focus:ring-[#2d7a3e]"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg cursor-pointer">
              <div>
                <span className="font-medium">Opt-out SMS</span>
                <p className="text-sm text-gray-500">Refuser tous les messages SMS</p>
              </div>
              <input
                type="checkbox"
                checked={formData.opt_out_sms}
                onChange={(e) => setFormData({...formData, opt_out_sms: e.target.checked})}
                className="w-5 h-5 text-[#2d7a3e] rounded focus:ring-[#2d7a3e]"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg cursor-pointer">
              <div>
                <span className="font-medium">Opt-out WhatsApp</span>
                <p className="text-sm text-gray-500">Refuser tous les messages WhatsApp</p>
              </div>
              <input
                type="checkbox"
                checked={formData.opt_out_whatsapp}
                onChange={(e) => setFormData({...formData, opt_out_whatsapp: e.target.checked})}
                className="w-5 h-5 text-[#2d7a3e] rounded focus:ring-[#2d7a3e]"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg cursor-pointer">
              <div>
                <span className="font-medium">Marketing opt-in</span>
                <p className="text-sm text-gray-500">Recevoir des messages marketing</p>
              </div>
              <input
                type="checkbox"
                checked={formData.marketing_opt_in}
                onChange={(e) => setFormData({...formData, marketing_opt_in: e.target.checked})}
                className="w-5 h-5 text-[#2d7a3e] rounded focus:ring-[#2d7a3e]"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg cursor-pointer">
              <div>
                <span className="font-medium">Transactional opt-in</span>
                <p className="text-sm text-gray-500">Recevoir des messages transactionnels</p>
              </div>
              <input
                type="checkbox"
                checked={formData.transactional_opt_in}
                onChange={(e) => setFormData({...formData, transactional_opt_in: e.target.checked})}
                className="w-5 h-5 text-[#2d7a3e] rounded focus:ring-[#2d7a3e]"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Limite quotidienne de messages
            </label>
            <input
              type="number"
              value={formData.daily_message_limit}
              onChange={(e) => setFormData({...formData, daily_message_limit: parseInt(e.target.value)})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              min="1"
              max="10000"
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white py-3"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les préférences'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Onglet Webhooks
function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    secret: '',
    events: ['message.sent', 'message.delivered']
  });

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const data = await preludeAPI.getWebhooks();
      setWebhooks(data.data || []);
    } catch (error) {
      console.error('Erreur chargement webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await preludeAPI.createWebhook(formData);
      setShowForm(false);
      loadWebhooks();
      setFormData({ url: '', secret: '', events: ['message.sent', 'message.delivered'] });
    } catch (error) {
      console.error('Erreur création webhook:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer ce webhook ?')) {
      try {
        await preludeAPI.deleteWebhook(id);
        loadWebhooks();
      } catch (error) {
        console.error('Erreur suppression:', error);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Webhooks de notification</CardTitle>
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white">
          {showForm ? 'Annuler' : '+ Nouveau webhook'}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-[#f0f7f3] rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                URL du webhook *
              </label>
              <input
                type="url"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://votre-app.com/webhook/prelude"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                Secret (optionnel)
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
                value={formData.secret}
                onChange={(e) => setFormData({...formData, secret: e.target.value})}
                placeholder="secret-pour-signature"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                Événements à écouter
              </label>
              <div className="space-y-2">
                {['message.sent', 'message.delivered', 'message.read', 'message.failed'].map(event => (
                  <label key={event} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({...formData, events: [...formData.events, event]});
                        } else {
                          setFormData({...formData, events: formData.events.filter(e => e !== event)});
                        }
                      }}
                      className="w-4 h-4 text-[#2d7a3e] rounded focus:ring-[#2d7a3e]"
                    />
                    <span className="text-sm">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white">
              Créer le webhook
            </Button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d7a3e]" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiGlobe className="text-5xl mx-auto mb-4 opacity-30" />
            <p>Aucun webhook configuré</p>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="flex items-center justify-between p-4 bg-[#f0f7f3] rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${webhook.is_active ? 'bg-[#2d7a3e]' : 'bg-gray-400'}`} />
                    <span className="font-medium">{webhook.url}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Événements: {webhook.events.join(', ')}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleDelete(webhook.id)}
                  className="border-red-500 text-red-500 hover:bg-red-50"
                >
                  Supprimer
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
