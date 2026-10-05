// /var/www/numericexport/dashboard/components/admin/AdminNotificationCenter.tsx

'use client';

import { useState } from 'react';
import { FiSend, FiTag, FiUsers, FiMail, FiBell, FiAlertCircle, FiInfo, FiCheckCircle, FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import Cookies from 'js-cookie';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface BroadcastForm {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  target_clients: 'all' | 'active' | 'specific';
  client_ids: string[];
  action_url?: string;
  action_label?: string;
}

interface PromotionForm {
  title: string;
  message: string;
  promotion_code: string;
  discount_percentage: number;
  valid_until: string;
  target_segments: 'all' | 'active' | 'inactive' | 'specific';
  segment_ids: string[];
}

export default function AdminNotificationCenter() {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'promotion'>('broadcast');
  const [sending, setSending] = useState(false);
  
  const [broadcastForm, setBroadcastForm] = useState<BroadcastForm>({
    title: '',
    message: '',
    type: 'info',
    target_clients: 'all',
    client_ids: []
  });
  
  const [promotionForm, setPromotionForm] = useState<PromotionForm>({
    title: '',
    message: '',
    promotion_code: '',
    discount_percentage: 0,
    valid_until: '',
    target_segments: 'all',
    segment_ids: []
  });

  const getToken = () => Cookies.get('token') || localStorage.getItem('token');
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const sendBroadcast = async () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      toast.error('Veuillez remplir le titre et le message');
      return;
    }
    
    setSending(true);
    try {
      const token = getToken();
      // CORRECTION: Enlever /api/v1 car API_BASE contient déjà /api/v1
      const response = await fetch(`${API_BASE}/notifications/broadcast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(broadcastForm)
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(`✅ Notification envoyée à ${data.total_sent} clients`);
        setBroadcastForm({
          title: '', message: '', type: 'info', target_clients: 'all', client_ids: []
        });
      } else {
        toast.error(data.message || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

 const sendPromotion = async () => {
  if (!promotionForm.title || !promotionForm.message || !promotionForm.promotion_code) {
    toast.error('Veuillez remplir tous les champs obligatoires');
    return;
  }

  setSending(true);
  try {
    const token = getToken();
    
    // Convertir valid_until en format ISO pour la BDD
    const payload = {
      ...promotionForm,
      valid_until: promotionForm.valid_until 
        ? new Date(promotionForm.valid_until).toISOString() 
        : new Date().toISOString()
    };
    
    const response = await fetch(`${API_BASE}/notifications/promotion`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.success) {
      toast.success(`🎉 Promotion envoyée à ${data.total_sent} clients`);
      setPromotionForm({
        title: '', message: '', promotion_code: '', discount_percentage: 0,
        valid_until: '', target_segments: 'all', segment_ids: []
      });
    } else {
      toast.error(data.message || 'Erreur lors de l\'envoi');
    }
  } catch (error) {
    console.error('Erreur:', error);
    toast.error('Erreur lors de l\'envoi');
  } finally {
    setSending(false);
  }
};

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <FiCheckCircle className="text-green-500" />;
      case 'warning': return <FiAlertCircle className="text-yellow-500" />;
      case 'error': return <FiX className="text-red-500" />;
      default: return <FiInfo className="text-blue-500" />;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FiBell className="text-[#2d7a3e]" />
          Centre de communication
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">Envoyez des notifications à tous vos clients</p>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2 pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'broadcast'
                ? 'border-[#2d7a3e] text-[#2d7a3e]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiSend className="w-4 h-4" />
            Diffusion générale
          </button>
          <button
            onClick={() => setActiveTab('promotion')}
            className={`flex items-center gap-2 pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'promotion'
                ? 'border-[#2d7a3e] text-[#2d7a3e]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiTag className="w-4 h-4" />
            Offre promotionnelle
          </button>
        </div>

        {/* Broadcast Form */}
        {activeTab === 'broadcast' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                placeholder="Ex: Maintenance prévue le 25 mars 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Détail de votre communication..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-2">
                  {(['info', 'success', 'warning', 'error'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setBroadcastForm({ ...broadcastForm, type })}
                      className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                        broadcastForm.type === type
                          ? type === 'info' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                            type === 'success' ? 'border-green-500 bg-green-50 text-green-700' :
                            type === 'warning' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' :
                            'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {getTypeIcon(type)}
                        <span className="capitalize">{type === 'info' ? 'Info' : type === 'success' ? 'Succès' : type === 'warning' ? 'Attention' : 'Erreur'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cible</label>
                <select
                  value={broadcastForm.target_clients}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, target_clients: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
                >
                  <option value="all">📢 Tous les clients</option>
                  <option value="active">✅ Clients actifs uniquement</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL d'action (optionnel)</label>
              <input
                type="url"
                value={broadcastForm.action_url || ''}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, action_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label du bouton (optionnel)</label>
              <input
                type="text"
                value={broadcastForm.action_label || ''}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, action_label: e.target.value })}
                placeholder="En savoir plus"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              />
            </div>
            
            <Button
              onClick={sendBroadcast}
              disabled={sending}
              className="w-full bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <FiSend className="mr-2" />
                  Envoyer la notification à tous les clients
                </>
              )}
            </Button>
          </div>
        )}

        {/* Promotion Form */}
        {activeTab === 'promotion' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={promotionForm.title}
                onChange={(e) => setPromotionForm({ ...promotionForm, title: e.target.value })}
                placeholder="Ex: Offre spéciale -20% sur tous les SMS"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={promotionForm.message}
                onChange={(e) => setPromotionForm({ ...promotionForm, message: e.target.value })}
                placeholder="Détail de votre offre promotionnelle..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code promo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={promotionForm.promotion_code}
                  onChange={(e) => setPromotionForm({ ...promotionForm, promotion_code: e.target.value.toUpperCase() })}
                  placeholder="PROMO2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent font-mono uppercase"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Réduction (%)</label>
                <input
                  type="number"
                  value={promotionForm.discount_percentage}
                  onChange={(e) => setPromotionForm({ ...promotionForm, discount_percentage: parseInt(e.target.value) || 0 })}
                  placeholder="20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de validité <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={promotionForm.valid_until}
                onChange={(e) => setPromotionForm({ ...promotionForm, valid_until: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Segment cible</label>
              <select
                value={promotionForm.target_segments}
                onChange={(e) => setPromotionForm({ ...promotionForm, target_segments: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d7a3e] focus:border-transparent"
              >
                <option value="all">🎯 Tous les clients</option>
                <option value="active">🔥 Clients actifs (30 derniers jours)</option>
                <option value="inactive">💤 Clients inactifs (+90 jours)</option>
              </select>
            </div>
            
            <Button
              onClick={sendPromotion}
              disabled={sending}
              className="w-full bg-[#8bc34a] hover:bg-[#689f38] text-gray-800"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-800 mr-2"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <FiTag className="mr-2" />
                  Créer et envoyer la promotion
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
