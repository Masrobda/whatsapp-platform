// lib/api/prelude.ts
import apiClient from '../api';

export const preludeAPI = {
  // ============================================
  // CLIENT ENDPOINTS
  // ============================================
  
  // Préférences
  getPreferences: async () => {
    const response = await apiClient.get('/client/preferences');
    return response.data;
  },

  updatePreferences: async (data: any) => {
    const response = await apiClient.put('/client/preferences', data);
    return response.data;
  },

  // Envoi de messages
  sendMessage: async (data: {
    template_id: string;
    to: string;
    from?: string;
    variables?: Record<string, any>;
    preferred_channel?: 'whatsapp' | 'sms';
    schedule_at?: string;
    callback_url?: string;
  }) => {
    const response = await apiClient.post('/prelude/send', data);
    return response.data;
  },

  sendBatch: async (data: {
    template_id: string;
    recipients: Array<{
      to: string;
      variables?: Record<string, any>;
    }>;
    preferred_channel?: 'whatsapp' | 'sms';
    schedule_at?: string;
  }) => {
    const response = await apiClient.post('/prelude/batch', data);
    return response.data;
  },

  // Statistiques
  getStats: async (period: '7days' | '30days' | '90days' = '30days') => {
    const response = await apiClient.get('/client/stats', { params: { period } });
    return response.data;
  },

  // Validation de numéro
  validatePhone: async (phone: string) => {
    const response = await apiClient.post('/client/validate-phone', { phone });
    return response.data;
  },

  // Webhooks
  getWebhooks: async () => {
    const response = await apiClient.get('/client/webhooks');
    return response.data;
  },

  createWebhook: async (data: {
    url: string;
    events: string[];
    secret?: string;
  }) => {
    const response = await apiClient.post('/client/webhooks', data);
    return response.data;
  },

  deleteWebhook: async (id: string) => {
    const response = await apiClient.delete(`/client/webhooks/${id}`);
    return response.data;
  },

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================
  
  admin: {
    getDashboard: async () => {
      const response = await apiClient.get('/admin/prelude/dashboard');
      return response.data;
    },

    getClients: async (params?: any) => {
      const response = await apiClient.get('/admin/prelude/clients', { params });
      return response.data;
    },

    updateClientPreferences: async (clientId: string, data: any) => {
      const response = await apiClient.put(`/admin/prelude/clients/${clientId}/preferences`, data);
      return response.data;
    },

    getQueueMonitoring: async () => {
      const response = await apiClient.get('/admin/prelude/monitoring/queues');
      return response.data;
    },

    getMessageLogs: async (params?: any) => {
      const response = await apiClient.get('/admin/prelude/monitoring/logs', { params });
      return response.data;
    },

    syncTemplates: async () => {
      const response = await apiClient.post('/admin/prelude/templates/sync');
      return response.data;
    },

    createDefaultTemplate: async (data: {
      name: string;
      type: 'text' | 'media' | 'interactive';
      channel?: 'both' | 'whatsapp' | 'sms';
    }) => {
      const response = await apiClient.post('/admin/prelude/templates/default', data);
      return response.data;
    },

    getGlobalConfig: async () => {
      const response = await apiClient.get('/admin/prelude/config');
      return response.data;
    },

    updateGlobalConfig: async (data: any) => {
      const response = await apiClient.post('/admin/prelude/config/channels', data);
      return response.data;
    }
  }
};
