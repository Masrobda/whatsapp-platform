// src/services/wati.service.js
const axios = require('axios');

class WatiService {
  constructor() {
    this.baseURL = 'https://live-mt-server.wati.io/10144460';
    this.apiKey = process.env.WATI_API_KEY;
if (!this.apiKey) {
  throw new Error('WATI_API_KEY manquant dans les variables d\'environnement');
}
}

  /**
   * Nettoie et valide un numéro de téléphone
   */
  cleanPhoneNumber(phone) {
    let clean = phone?.toString().replace(/\s/g, '') || '';
    if (!clean.startsWith('+')) clean = `+${clean}`;
    return clean;
  }

  /**
   * Nettoie et valide le channel_number
   */
  getChannelNumber(providedChannelNumber) {
    if (providedChannelNumber) {
      return this.cleanPhoneNumber(providedChannelNumber);
    }
    // Channel par défaut
    return '+237689588347';
  }

  /**
   * Formate les paramètres du template
   */
  formatTemplateParameters(params) {
    if (!params) return [];
    
    let parameters = params;
    if (typeof params === 'string') {
      try { 
        parameters = JSON.parse(params); 
      } catch(e) { 
        return []; 
      }
    }
    
    return Object.entries(parameters).map(([key, value]) => ({
      name: key,
      value: String(value)
    }));
  }

  /**
   * Envoi de message template STANDARD (SANS PDF)
   */
  async sendTemplateMessage(recipientPhone, templateName, templateParams = {}, language = 'fr', channelNumber = null) {
    try {
      const cleanPhone = this.cleanPhoneNumber(recipientPhone);
      const cleanChannelNumber = this.getChannelNumber(channelNumber);

      const payload = {
        template_name: templateName,
        broadcast_name: `msg_${Date.now()}`,
        language: language,
        parameters: this.formatTemplateParameters(templateParams),
        channel_number: cleanChannelNumber  // ← SIGNATURE WATI OBLIGATOIRE
      };

      console.log("📤 [WATI] Envoi template STANDARD:", JSON.stringify(payload, null, 2));

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/api/v1/sendTemplateMessage`,
        params: { whatsappNumber: cleanPhone },
        data: payload,
        headers: {
          'Authorization': `Bearer ${this.apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log("✅ [WATI] Réponse BRUTE:", JSON.stringify(response.data, null, 2));
      console.log("✅ [WATI] Réponse template STANDARD:", JSON.stringify(response.data, null, 2));

      return {
        success: true,
        localMessageId: response.data.local_message_id,
        watiMessageId: response.data.message_id || response.data.id,
        status: response.data.status || 'sent'
      };

    } catch (error) {
      console.error('❌ [WATI] Erreur sendTemplateMessage:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message,
        details: error.response?.data 
      };
    }
  }

  /**
   * Envoi de message template avec PDF (FACTURES)
   * CORRECTION: Le PDF doit être dans media_url, PAS dans parameters
   */
 // Version simplifiée et robuste
async sendInvoiceWithPDF(recipientPhone, templateName, templateParams = {}, invoiceData = {}, channelNumber = null) {
  try {
    const cleanPhone = this.cleanPhoneNumber(recipientPhone);
    const cleanChannelNumber = this.getChannelNumber(channelNumber);
    
    const pdfUrl = (invoiceData?.pdfUrl || invoiceData?.url || "").trim();
    if (!pdfUrl.startsWith('http')) {
      throw new Error(`URL du PDF invalide : "${pdfUrl}"`);
    }

    // Fusionner les paramètres template avec le PDF
    const allParameters = {
      ...templateParams,
      file: pdfUrl  // ← Le paramètre "file" tel qu'attendu par le template
    };

    const payload = {
      template_name: templateName,
      broadcast_name: `facture_${Date.now()}`,
      parameters: Object.entries(allParameters).map(([name, value]) => ({
        name: name,
        value: String(value)
      })),
      channel_number: cleanChannelNumber
    };

    console.log("📤 Payload WATI (méthode support):", JSON.stringify(payload, null, 2));

    const response = await axios({
      method: 'post',
      url: `${this.baseURL}/api/v1/sendTemplateMessage`,
      params: { whatsappNumber: cleanPhone },
      data: payload,
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      localMessageId: response.data.local_message_id,
      watiMessageId: response.data.message_id || response.data.id,
      status: response.data.status || 'sent'
    };

  } catch (error) {
    console.error("❌ Erreur:", error.response?.data || error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
}

  /**
   * Envoi de message TEXT simple
   */
async sendTextMessage(recipientPhone, text, channelNumber = null) {
  try {
    const cleanPhone = this.cleanPhoneNumber(recipientPhone);
    const cleanChannelNumber = this.getChannelNumber(channelNumber);

    console.log("📤 [WATI] Envoi TEXT (sendSessionMessage):", { cleanPhone, text, cleanChannelNumber });

    const response = await axios({
      method: 'post',
      url: `${this.baseURL}/api/v1/sendSessionMessage/${encodeURIComponent(cleanPhone)}`,
      params: {
        messageText: text,
        channelPhoneNumber: cleanChannelNumber
      },
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`
      },
      timeout: 30000
    });

    console.log("✅ [WATI] Réponse TEXT:", JSON.stringify(response.data, null, 2));

    // ⚠️ Vérification du champ "result" pour savoir si l'envoi a réussi
    if (response.data.result === false) {
      return {
        success: false,
        error: response.data.message || 'Échec de l\'envoi (ticket expiré)',
        details: response.data
      };
    }

    return {
      success: true,
      localMessageId: response.data.message?.localMessageId,
      watiMessageId: response.data.message?.whatsappMessageId,
      status: response.data.message?.statusString || 'sent'
    };

  } catch (error) {
    console.error('❌ [WATI] Erreur sendTextMessage:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    };
  }
}

  /**
   * Envoi de message MEDIA (image, audio, video, document)
   */
  async sendMediaMessage(recipientPhone, mediaUrl, mediaType = 'image', caption = '', channelNumber = null) {
    try {
      const cleanPhone = this.cleanPhoneNumber(recipientPhone);
      const cleanChannelNumber = this.getChannelNumber(channelNumber);

      const payload = {
        url: mediaUrl,
        filename: mediaUrl.split('/').pop() || 'media',
        caption: caption,
        channel_number: cleanChannelNumber  // ← SIGNATURE WATI OBLIGATOIRE
      };

      // Déterminer l'endpoint selon le type
      let endpoint = '';
      switch(mediaType.toLowerCase()) {
        case 'image': endpoint = '/api/v1/sendImageMessage'; break;
        case 'audio': endpoint = '/api/v1/sendAudioMessage'; break;
        case 'video': endpoint = '/api/v1/sendVideoMessage'; break;
        case 'document': endpoint = '/api/v1/sendDocumentMessage'; break;
        default: endpoint = '/api/v1/sendImageMessage';
      }

      console.log(`📤 [WATI] Envoi MEDIA (${mediaType}):`, JSON.stringify(payload, null, 2));

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}${endpoint}`,
        params: { whatsappNumber: cleanPhone },
        data: payload,
        headers: {
          'Authorization': `Bearer ${this.apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`✅ [WATI] Réponse MEDIA (${mediaType}):`, JSON.stringify(response.data, null, 2));

      return {
        success: true,
        localMessageId: response.data.local_message_id,
        watiMessageId: response.data.message_id || response.data.id,
        status: response.data.status || 'sent'
      };

    } catch (error) {
      console.error(`❌ [WATI] Erreur sendMediaMessage (${mediaType}):`, error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }
}

module.exports = new WatiService();
