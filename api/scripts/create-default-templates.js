// scripts/create-default-templates.js
const preludeService = require('../src/services/prelude.service');

async function createDefaultTemplates() {
    console.log('Création des templates par défaut...');

    const templates = [
        {
            name: 'welcome_text',
            language: 'fr',
            category: 'UTILITY',
            header_type: 'none',
            body_content: 'Bonjour {{1}}, bienvenue sur notre service !',
            footer_content: 'Équipe NEXT LTD',
            buttons: []
        },
        {
            name: 'otp_auth',
            language: 'fr',
            category: 'AUTHENTICATION',
            header_type: 'text',
            header_content: 'Code de vérification',
            body_content: 'Votre code est : {{1}}\nValable 10 minutes.',
            footer_content: 'Ne partagez pas ce code',
            buttons: []
        },
        {
            name: 'order_confirmation',
            language: 'fr',
            category: 'UTILITY',
            header_type: 'text',
            header_content: 'Commande #{{1}} confirmée',
            body_content: 'Bonjour {{2}},\nVotre commande de {{3}} a été confirmée.\nMontant: {{4}} FCFA\nLivraison prévue: {{5}}',
            footer_content: 'Merci pour votre confiance',
            buttons: []
        },
        {
            name: 'promo_marketing',
            language: 'fr',
            category: 'MARKETING',
            header_type: 'image',
            header_content: 'https://example.com/promo.jpg',
            body_content: '🔥 {{1}}% de réduction !\nCode: {{2}}\nValable jusqu\'au {{3}}',
            footer_content: 'NEXT LTD',
            buttons: [
                {
                    type: 'URL',
                    text: 'Voir l\'offre',
                    url: 'https://numericexport.com/promo'
                }
            ]
        }
    ];

    for (const template of templates) {
        try {
            const result = await preludeService.createTemplate({
                ...template,
                created_by: null // Admin system
            });
            console.log(`✅ Template créé: ${template.name} (${result.status})`);
        } catch (error) {
            console.error(`❌ Erreur ${template.name}:`, error.message);
        }
    }
}

createDefaultTemplates();
