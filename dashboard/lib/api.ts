import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

// Instance Axios
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Intercepteur pour ajouter le token JWT avec logs détaillés
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`🔐 [Axios Request] Token présent: ${token.substring(0, 20)}...`);
    } else {
      console.warn('⚠️ [Axios Request] Aucun token JWT trouvé');
    }

    const fullUrl = `${config.baseURL}${config.url}`;
    
    // 🔥 FILTRE : Ne pas loguer les requêtes vers /notifications
    if (!config.url?.includes('/notifications')) {
      console.log(`🚀 [Axios Request] ${config.method?.toUpperCase()} ${fullUrl}`, {
        params: config.params,
        data: config.data,
        headers: config.headers,
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ [Axios Request Error]', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses avec logs détaillés
apiClient.interceptors.response.use(
  (response) => {
    // 🔥 FILTRE : Ne pas loguer les réponses de /notifications
    if (!response.config.url?.includes('/notifications')) {
      console.log(`✅ [Axios Response] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);

      // Log pour les réponses de grande taille
      if (response.data?.data?.length > 0) {
        console.log(`📊 [Axios Response] Données: ${response.data.data.length} éléments`);
      }
    }

    return response;
  },
  (error) => {
    // Garder les erreurs (toujours utiles)
    const requestUrl = error.config?.url;
    const fullUrl = `${error.config?.baseURL}${requestUrl}`;

    console.error('❌ [Axios Error] =============================================');
    console.error('❌ [Axios Error] URL complète:', fullUrl);
    console.error('❌ [Axios Error] URL relative:', requestUrl);
    console.error('❌ [Axios Error] Base URL:', error.config?.baseURL);
    console.error('❌ [Axios Error] Status:', error.response?.status);
    console.error('❌ [Axios Error] Status Text:', error.response?.statusText);
    console.error('❌ [Axios Error] Headers:', error.config?.headers);

    if (error.response?.data) {
      console.error('❌ [Axios Error] Response Data:', error.response.data);
    }

    console.error('❌ [Axios Error] Message:', error.message);
    console.error('❌ [Axios Error] Config:', {
      method: error.config?.method,
      params: error.config?.params,
      data: error.config?.data
    });

    // Détection spécifique des 404
    if (error.response?.status === 404) {
      console.error('❌ [Axios Error] ERREUR 404 DÉTECTÉE');
      console.error('❌ [Axios Error] Vérifiez que la route existe côté serveur');
      console.error('❌ [Axios Error] Route testée:', requestUrl);
    }

    if (error.response?.status === 401) {
      console.warn('⚠️ [Axios Error] Token expiré ou invalide – REDIRECTION DÉSACTIVÉE POUR DEBUG ');
      Cookies.remove('token');
      Cookies.remove('user');
    //  if (typeof window !== 'undefined') {
     //   window.location.href = '/login';
    //  }
    }

    return Promise.reject(error);
  }
);

// ============================================
// INVOICE DISBURSEMENTS - CORRECTIONS APPLIQUÉES
// ============================================
export const invoiceDisbursements = {
  // ✅ CORRIGÉ : Toutes les URLs commencent par /invoice-disbursements (sans /api/v1)
  getAll: async (params?: {
    page?: number;
    limit?: number;
    filter?: string;
    order_id?: string;
    client_id?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    console.log('📤 [API InvoiceDisbursements] getAll appelé avec params:', params);

    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.filter) queryParams.append('filter', params.filter);
    if (params?.order_id) queryParams.append('order_id', params.order_id);
    if (params?.client_id) queryParams.append('client_id', params.client_id);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const queryString = queryParams.toString();

    const url = `/invoice-disbursements${queryString ? `?${queryString}` : ''}`;

    console.log('🔗 [API InvoiceDisbursements] URL construite:', url);
    console.log('🔗 [API InvoiceDisbursements] URL complète:', `${API_URL}${url}`);

    try {
      const response = await apiClient.get(url);
      console.log('✅ [API InvoiceDisbursements] Réponse reçue:', {
        status: response.status,
        dataCount: response.data?.data?.length || 0,
        pagination: response.data?.pagination
      });
      return response;
    } catch (error: any) {
      console.error('❌ [API InvoiceDisbursements] Erreur dans getAll:', error);
      throw error;
    }
  },

  getDisbursementDetails: async (disbursementId: string) => {
    console.log('📤 [API InvoiceDisbursements] getDisbursementDetails appelé:', disbursementId);
    const url = `/invoice-disbursements/disbursement/${disbursementId}`;
    console.log('🔗 URL:', url);
    return apiClient.get(url);
  },

  generateDisbursementSlip: async (orderId: string, data: {
    bsp_id: string;
    messages_to_purchase: number;
    purpose: string;
    purchase_cost: number;
    notes?: string;
  }) => {
    console.log('📤 [API InvoiceDisbursements] generateDisbursementSlip appelé:', { orderId, data });
    const url = `/invoice-disbursements/order/${orderId}/generate-slip`;
    console.log('🔗 URL:', url);
    return apiClient.post(url, data);
  },

  uploadReceipt: async (disbursementId: string, file: File) => {
    console.log('📤 [API InvoiceDisbursements] uploadReceipt appelé:', disbursementId);
    const formData = new FormData();
    formData.append('receipt', file);

    const url = `/invoice-disbursements/${disbursementId}/upload-receipt`;
    console.log('🔗 URL:', url);

    return apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  validateSupply: async (disbursementId: string, data: {
    with_receipt?: boolean;
    notes?: string;
  }) => {
    console.log('📤 [API InvoiceDisbursements] validateSupply appelé:', { disbursementId, data });
    const url = `/invoice-disbursements/${disbursementId}/validate-supply`;
    console.log('🔗 URL:', url);
    return apiClient.post(url, data);
  },

  completeSupply: async (disbursementId: string, notes?: string) => {
    console.log('📤 [API InvoiceDisbursements] completeSupply appelé:', disbursementId);
    const url = `/invoice-disbursements/${disbursementId}/complete-supply`;
    console.log('🔗 URL:', url);
    return apiClient.post(url, { notes });
  },

  verifyInvoice: async (invoiceId: string, token: string) => {
    console.log('📤 [API InvoiceDisbursements] verifyInvoice appelé:', { invoiceId });
    const url = `/invoice-disbursements/verify/${invoiceId}?token=${token}`;
    console.log('🔗 URL:', url);
    return apiClient.get(url);
  },

  downloadReceipt: async (disbursementId: string) => {
    console.log('📤 [API InvoiceDisbursements] downloadReceipt appelé:', disbursementId);
    const url = `/invoice-disbursements/download/receipt/${disbursementId}`;
    console.log('🔗 URL:', url);
    return apiClient.get(url, {
      responseType: 'blob'
    });
  },

  getStats: async (params: any = {}) => {
    console.log('📤 [API InvoiceDisbursements] getStats appelé');
    const url = `/invoice-disbursements/stats`;
    console.log('🔗 URL:', url);
    return apiClient.get(url, { params });
  },

  viewPDFInModal: async (disbursementId: string, type: 'disbursement' | 'receipt') => {
    console.log('📤 [API InvoiceDisbursements] viewPDFInModal appelé:', { disbursementId, type });
    const url = `/invoice-disbursements/${disbursementId}/view`;
    console.log('🔗 URL:', url);
    return apiClient.get(url, {
      params: { type },
    });
  },

  downloadPDF: async (disbursementId: string, type: 'disbursement' | 'receipt') => {
    console.log('📤 [API InvoiceDisbursements] downloadPDF appelé:', { disbursementId, type });
    const url = type === 'receipt'
      ? `/invoice-disbursements/receipt/${disbursementId}/download`
      : `/invoice-disbursements/${disbursementId}/download`;
    console.log('🔗 URL:', url);
    return apiClient.get(url, { responseType: 'blob' });
  },

  validatePurchase: async (disbursementId: string, data: { with_receipt?: boolean } = {}) => {
    console.log('📤 [API InvoiceDisbursements] validatePurchase appelé:', disbursementId);
    const url = `/invoice-disbursements/${disbursementId}/validate-purchase`;
    console.log('🔗 URL:', url);
    return apiClient.post(url, data);
  },
};

// ============================================
// AUTH
// ============================================
export const auth = {
//  register: async (data: any) => {
  //  const url = `/auth/register/client`;
    //console.log('🔗 URL:', url);
   // const response = await apiClient.post(url, data);
   // return response.data;
 // },

register: async (data: any, path = '/auth/register/client') => {
  const url = path;
  console.log('🔗 URL register:', url);
  console.log('Payload envoyé:', data);

  try {
    const response = await apiClient.post(url, data);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as AxiosError;  // ← maintenant ça compile
      console.error('Erreur complète register:', axiosError.response?.data || axiosError.message);
    } else {
      console.error('Erreur inconnue dans register:', error);
    }
    throw error;
  }
},


  login: async (email: string, password: string, userType: 'client' | 'user' = 'client') => {
    const url = `/auth/login`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, { email, password, user_type: userType });
    return response.data;
  },

  forgotPassword: async (email: string, userType: 'client' | 'user' = 'client') => {
    const url = `/auth/forgot-password`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, { email, user_type: userType });
    return response.data;
  },

  resetPassword: async (token: string, password: string, confirmPassword: string) => {
    const url = `/auth/reset-password`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, {
      token,
      password,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  getMe: async () => {
    const url = `/auth/me`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url);
    return response.data;
  },
};

// ============================================
// CLIENT
// ============================================
export const client = {
  getProfile: async () => {
    const url = `/client/profile`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url);
    return response.data;
  },

  updateProfile: async (data: any) => {
    const url = `/client/profile`;
    console.log('🔗 URL:', url);
    const response = await apiClient.put(url, data);
    return response.data;
  },

  getCredentials: async () => {
    const url = `/client/credentials`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url);
    return response.data;
  },

  getDashboard: async () => {
    const url = `/client/dashboard`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url);
    return response.data;
  },
};

// ============================================
// ORDERS
// ============================================
export const orders = {
  create: async (quantity: number) => {
    const url = `/orders`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, { quantity });
    return response.data;
  },

  getAll: async (params?: any) => {
    const url = `/orders`;
    console.log('📤 [API Orders] getAll appelé, URL:', url);
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  getById: async (id: string) => {
    const url = `/orders/${id}`;
    console.log('📤 [API Orders] getById appelé, URL:', url);
    const response = await apiClient.get(url);
    return response.data;
  },

  validateBySecretary: async (id: string, notes?: string) => {
    const url = `/orders/${id}/validate/secretary`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, { notes });
    return response.data;
  },

  validateByAuditor: async (id: string) => {
    const url = `/orders/${id}/validate/auditor`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, {});
    return response.data;
  },

  validateByFinancial: async (id: string) => {
    const url = `/orders/${id}/validate/financial`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, {});
    return response.data;
  },

  generateProforma: async (id: string) => {
    const url = `/orders/${id}/proforma`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url);
    return response.data;
  },

  createDisbursement: async (id: string, data: any) => {
    const url = `/orders/${id}/disbursement`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, data);
    return response.data;
  },

  getDisbursement: async (orderId: string) => {
    try {
      const url = `/orders/${orderId}`;
      console.log('🔗 URL:', url);
      const response = await apiClient.get(url);
      return response.data.order?.disbursement;
    } catch (error) {
      console.error('Erreur récupération décaissement:', error);
      throw error;
    }
  },

  downloadDisbursementPDF: async (orderId: string) => {
    try {
      const url = `/orders/invoices/${orderId}/download`;
      console.log('🔗 URL:', url);
      const response = await apiClient.get(url, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
      throw error;
    }
  },

  confirmPurchase: async (id: string) => {
    const url = `/orders/${id}/confirm-purchase`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url);
    return response.data;
  },
};

// ============================================
// BSP
// ============================================
export const bsp = {
  getAll: async (params?: any) => {
    const url = `/bsp`;
    console.log('📤 [API BSP] getAll appelé, URL:', url);
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  calculateCost: async (data: any) => {
    const url = `/bsp/calculate`;
    console.log('📤 [API BSP] calculateCost appelé, URL:', url);
    const response = await apiClient.post(url, data);
    return response.data;
  },

  create: async (data: any) => {
    const url = `/bsp`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const url = `/bsp/${id}`;
    console.log('🔗 URL:', url);
    const response = await apiClient.put(url, data);
    return response.data;
  },

  delete: async (id: string) => {
    const url = `/bsp/${id}`;
    console.log('🔗 URL:', url);
    const response = await apiClient.delete(url);
    return response.data;
  },
};

// ============================================
// MESSAGES
// ============================================
export const messages = {
//  send: async (data: any) => {
  //  const url = `/messages/send`;
  //  console.log('🔗 URL:', url);
  //  const response = await apiClient.post(url, data);
  //  return response.data;
 // },

   // Dans le bloc messages
send: async (data: any, overrideToken?: string) => {
  const url = `/messages/send`;
  console.log('🔗 URL:', url);

  // Si overrideToken fourni, utilise un appel manuel sans l'intercepteur JWT
  if (overrideToken) {
    return axios.post(`${API_URL}${url}`, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${overrideToken}`,
      },
    }).then(res => res.data);
  }

  // Sinon, utilise apiClient normal (avec JWT)
  const response = await apiClient.post(url, data);
  return response.data;
},




  getAll: async (params?: any) => {
    const url = `/messages`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  getById: async (id: string) => {
    const url = `/messages/${id}`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url);
    return response.data;
  },

getStats: async (period: '7days' | '30days' | '90days' = '30days') => {
  const url = `/messages/stats/summary`;
  console.log('🔗 [messages.getStats] Appel avec period:', period);

  // Récupère le user depuis le cookie pour envoyer clientId
  const userCookie = Cookies.get('user');
  let clientId = null;
  if (userCookie) {
    try {
      const user = JSON.parse(userCookie);
      clientId = user.type === 'client' ? user.id : null;
    } catch (e) {
      console.warn('Erreur parse user cookie:', e);
    }
  }

  // Typage explicite pour éviter l’erreur TS
  const params: { period: string; clientId?: string } = { period };
  if (clientId) {
    params.clientId = clientId; // ← maintenant TS sait que c’est autorisé
  }

  const response = await apiClient.get(url, { params });
  return response.data;
},

  exportCSV: async (params?: any) => {
    const url = `/messages/export/csv`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url, { params, responseType: 'blob' });
    return response.data;
  },

  getQueueStats: async () => {
    const url = `/messages/queue/stats`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url);
    return response.data;
  },
};

// ============================================
// INVOICES
// ============================================
export const invoices = {
  getAll: async (params?: any) => {
    const url = `/orders/invoices/list`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url, { params });
    return response.data;
  },
};

// ============================================
// ADMIN
// ============================================
export const admin = {
  getClients: async (params?: any) => {
    const url = `/client/all`;
    console.log('🔗 URL:', url);
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  updatePricing: async (clientId: string, messageCost: number) => {
    const url = `/client/${clientId}/pricing`;
    console.log('🔗 URL:', url);
    const response = await apiClient.put(url, { message_cost: messageCost });
    return response.data;
  },

  rechargeQuota: async (clientId: string, quantity: number, notes?: string) => {
    const url = `/client/${clientId}/recharge`;
    console.log('🔗 URL:', url);
    const response = await apiClient.post(url, { quantity, notes });
    return response.data;
  },

  toggleBlock: async (clientId: string, blocked: boolean, reason?: string | null, duration?: number | null) => {
    const url = `/client/${clientId}/block`;  // ← CORRECT
    console.log('🔗 Appel toggleBlock vers:', url, { blocked, reason, duration });
    const response = await apiClient.post(url, {
      blocked,
      reason,
      duration_days: duration   // ← nom cohérent avec le serveur
    });
    return response.data;
  },

  toggleActive: async (clientId: string, active: boolean) => {
    const url = `/client/${clientId}/toggle-active`;  // ← CORRECT
    console.log('🔗 Appel toggleActive vers:', url, { active });
    const response = await apiClient.post(url, { active });
    return response.data;
  },

  deleteClient: async (clientId: string) => {
    const url = `/client/${clientId}`;
    console.log('🔗 Suppression client:', url);
    const response = await apiClient.delete(url);
    return response.data;
  },

};

// ============================================
// NOTIFICATIONS
// ============================================
export const notifications = {
  getAll: async (params?: any) => {
    // CORRECTION : Enlever /api/v1 du chemin car API_URL contient déjà /api/v1
    const response = await apiClient.get('/notifications', { params });
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await apiClient.post(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await apiClient.post('/notifications/read-all');
    return response.data;
  },

  archive: async (id: string) => {
    const response = await apiClient.post(`/notifications/${id}/archive`);
    return response.data;
  },

  createBroadcast: async (data: any) => {
    const response = await apiClient.post('/notifications/broadcast', data);
    return response.data;
  },

  createPromotion: async (data: any) => {
    const response = await apiClient.post('/notifications/promotion', data);
    return response.data;
  },

  getBroadcasts: async () => {
    const response = await apiClient.get('/notifications/broadcasts');
    return response.data;
  },

  getPromotions: async () => {
    const response = await apiClient.get('/notifications/promotions');
    return response.data;
  },

  getStats: async (params?: any) => {
    const response = await apiClient.get('/notifications/stats', { params });
    return response.data;
  },

  getPreferences: async () => {
    const response = await apiClient.get('/notifications/preferences');
    return response.data;
  },

  updatePreferences: async (data: any) => {
    const response = await apiClient.put('/notifications/preferences', data);
    return response.data;
  },
};

// ============================================
// INVITATIONS
// ============================================

// lib/api-invitations.ts  (remplace entièrement le bloc invitations)
export const invitations = {
  // Créer un lien d'invitation → POST /invitations
  create: async (data: {
    role: string;
    permissions: string[];
    max_uses: number;
    expires_in_days: number;
    email?: string;
  }) => {
    const response = await apiClient.post('/invitations', data);  // ← ICI : /invitations (sans /create)
    return response.data;
  },

  // Lister toutes les invitations → GET /invitations
  getAll: async (params?: any) => {
    const response = await apiClient.get('/invitations', { params });
    return response.data;
  },

  // Récupérer une invitation par token → GET /invitations/token/:token
  getByToken: async (token: string) => {
    const response = await apiClient.get(`/invitations/token/${token}`);
    return response.data;
  },

  // Supprimer une invitation → DELETE /invitations/:id
  delete: async (id: string) => {
    const response = await apiClient.delete(`/invitations/${id}`);
    return response.data;
  },

  // Envoyer l'invitation par email → POST /invitations/:id/send
  sendByEmail: async (invitationId: string, email: string) => {
    const response = await apiClient.post(`/invitations/${invitationId}/send`, { email });
    return response.data;
  },

  // Statistiques (si tu l'utilises plus tard)
  getStats: async () => {
    const response = await apiClient.get('/invitations/stats');
    return response.data;
  },
};

export const payments = {
  // Enregistrer un paiement
  create: async (data: {
    invoice_id: string;
    amount: number;
    payment_method: string;
    reference?: string;
    notes?: string;
  }) => {
    const response = await apiClient.post('/payments', data);
    return response.data;
  },

  // Valider un paiement
  verify: async (paymentId: string, notes?: string) => {
    const response = await apiClient.post(`/payments/${paymentId}/verify`, { notes });
    return response.data;
  },

  // Récupérer tous les paiements
  getAll: async (params?: any) => {
    const response = await apiClient.get('/payments', { params });
    return response.data;
  },

  // Récupérer les paiements d'une facture
  getInvoicePayments: async (invoiceId: string) => {
    const response = await apiClient.get(`/invoices/${invoiceId}/payments`);
    return response.data;
  },

  // Uploader une preuve de paiement
  uploadProof: async (paymentId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post(`/payments/${paymentId}/upload-proof`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Exporter les paiements
  exportCSV: async (params?: any) => {
    const response = await apiClient.get('/payments/export/csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // Statistiques
  getStats: async (period: '7days' | '30days' | '90days' = '30days') => {
    const response = await apiClient.get('/payments/stats', {
      params: { period },
    });
    return response.data;
  },
};



// Ré-export des modules séparés
export { messageStock } from './api/message-stock';

// Export par défaut (si tu l'utilises ailleurs)
export default apiClient;

