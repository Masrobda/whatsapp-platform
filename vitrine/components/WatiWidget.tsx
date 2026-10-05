'use client';

import { useEffect } from 'react';

// Types pour éviter l'utilisation de "any"
interface WatiChatButtonSettings {
  backgroundColor: string;
  ctaText: string;
  borderRadius: string;
  marginLeft: string;
  marginRight: string;
  marginBottom: string;
  ctaIconWATI: boolean;
  position: string;
}

interface WatiBrandSettings {
  brandName: string;
  brandSubTitle: string;
  brandImg: string;
  welcomeText: string;
  messageText: string;
  backgroundColor: string;
  ctaText: string;
  borderRadius: string;
  autoShow: boolean;
  phoneNumber: string;
}

interface WatiWidgetOptions {
  enabled: boolean;
  chatButtonSetting: WatiChatButtonSettings;
  brandSetting: WatiBrandSettings;
}

// Déclaration globale pour la fonction du widget
declare global {
  interface Window {
    CreateWhatsappChatWidget: (options: WatiWidgetOptions) => void;
  }
}

export default function WatiWidget() {
  useEffect(() => {
    // Évite d'ajouter plusieurs fois le script
    if (document.querySelector('script[src*="watiWidget.js"]')) return;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://wati-integration-prod-service.clare.ai/v2/watiWidget.js?88049';

    const options: WatiWidgetOptions = {
      enabled: true,
      chatButtonSetting: {
        backgroundColor: '#00e785',
        ctaText: 'Chat with us',
        borderRadius: '25',
        marginLeft: '0',
        marginRight: '20',
        marginBottom: '20',
        ctaIconWATI: false,
        position: 'right',
      },
      brandSetting: {
        brandName: 'NEXT LTD',
        brandSubTitle: 'undefined',
        brandImg: 'https://dashboard.numericexport.com/logook3.png',
        welcomeText: 'Salut!\nComment puis-je t\'aider?',
        messageText: 'Bonjour,%0Avous avez des questions ?%0ANous sommes là pour vous aider.',
        backgroundColor: '#00e785',
        ctaText: 'Chat with us',
        borderRadius: '25',
        autoShow: false,
        phoneNumber: '237696578107',
      },
    };

    script.onload = () => {
      if (typeof window.CreateWhatsappChatWidget === 'function') {
        window.CreateWhatsappChatWidget(options);
      }
    };

    document.body.appendChild(script);
  }, []);

  return null;
}
