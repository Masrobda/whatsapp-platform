'use client';
import Link from 'next/link';
import { FiCheck, FiCode, FiZap, FiShield, FiTrendingUp } from 'react-icons/fi';

export default function WhatsAppAPI() {
  const features = [
    {
      icon: <FiZap />,
      title: 'Intégration rapide',
      description: 'Commencez à envoyer des messages en moins de 5 minutes avec notre API simple.',
    },
    {
      icon: <FiCode />,
      title: 'Multi-langages',
      description: 'Support de PHP, Python, Node.js, Java, Go, .NET et PowerShell.',
    },
    {
      icon: <FiShield />,
      title: 'Fiable & Sécurisé',
      description: 'Infrastructure robuste avec authentification JWT et rate limiting.',
    },
    {
      icon: <FiTrendingUp />,
      title: 'Évolutif',
      description: 'Solution scalable qui grandit avec vos besoins, du test à la production.',
    },
  ];

  const useCases = [
    'Notifications transactionnelles (commandes, livraisons)',
    'Confirmations de rendez-vous',
    'Alertes et rappels automatiques',
    'Support client conversationnel',
    'Campagnes marketing personnalisées',
    'Codes OTP et authentification',
  ];

  return (
    <section id="whatsapp-api" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <span className="text-sm font-medium text-primary">Solution Phare</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
            WhatsApp Business API
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Intégrez WhatsApp dans vos applications et communiquez avec vos clients
            sur leur canal de messagerie préféré.
          </p>
        </div>
        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <div
              key={index}
              className="text-center p-6 rounded-xl bg-gray-50 hover:bg-primary/5 transition-colors"
            >
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">{feature.icon}</span>
              </div>
              <h3 className="font-bold text-dark mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Use Cases */}
          <div>
            <h3 className="text-2xl font-bold text-dark mb-6">
              Cas d&apos;usage
            </h3>
            <div className="space-y-3">
              {useCases.map((useCase, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-secondary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="text-secondary" size={14} />
                  </div>
                  <span className="text-gray-700">{useCase}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 p-6 bg-gradient-primary rounded-xl text-white">
              <h4 className="font-bold mb-2">🎁 Offre découverte</h4>
              <p className="text-white/90 mb-4">
                25 messages gratuits pour tester notre solution pendant 5 jours.
              </p>
              <Link
                href="https://dashboard.numericexport.com/register"
                className="inline-block px-6 py-3 bg-white text-primary rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Commencer maintenant
              </Link>
            </div>
          </div>
          {/* Right: Code Example */}
          <div>
            <div className="bg-dark rounded-xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="ml-auto text-gray-400 text-sm">example.js</span>
              </div>
              <pre className="text-sm text-gray-300 overflow-x-auto">
                <code>{`const axios = require('axios');
const apiToken = 'nxt_your_token';
const apiUrl = 'https://api.numericexport.com';
// Envoyer un message
await axios.post(
  \`\${apiUrl}/api/v1/messages/send\`,
  {
    recipient_phone: '+237600000000',
    message_type: 'text',
    message_content: 'Hello World! 👋'
  },
  {
    headers: {
      'Authorization': \`Bearer \${apiToken}\`
    }
  }
);
// C&apos;est aussi simple que ça ! 🚀`}</code>
              </pre>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <Link
                  href="https://dashboard.numericexport.com/dashboard/documentation"
                  className="text-secondary hover:text-secondary-light text-sm"
                >
                  Voir la documentation complète →
                </Link>
              </div>
            </div>
          </div>
        </div>
        {/* Pricing */}
        <div className="mt-16 bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 md:p-12">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-dark mb-2">Tarification simple</h3>
            <p className="text-gray-600">Payez uniquement les messages que vous envoyez</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="mb-2">
  <a
    href="#contact"
    className="inline-block px-8 py-3 bg-gradient-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
  >
    Nous contacter
  </a>
</div>
              <div className="text-sm text-gray-600">Pour toute négociation tarifaire</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">0 FCFA</div>
              <div className="text-sm text-gray-600">frais d&apos;installation</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">24/7</div>
              <div className="text-sm text-gray-600">support technique</div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            * Tarifs dégressifs disponibles pour volumes importants
          </p>
        </div>
      </div>
    </section>
  );
}
