'use client';

import Link from 'next/link';
import { FiCheck, FiMessageCircle, FiZap } from 'react-icons/fi';

export default function Hero() {
  return (
    <section className="relative pt-24 pb-16 bg-gradient-to-br from-primary via-primary-light to-secondary overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-secondary rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6">
              <FiZap className="text-secondary-light" />
              <span className="text-sm font-medium">Solution WhatsApp Business API</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Intégrez WhatsApp dans vos applications
            </h1>

            <p className="text-lg md:text-xl text-white/90 mb-8">
              Envoyez des messages WhatsApp à vos clients via notre API simple et puissante.
              Solution professionnelle efficace.
            </p>

            {/* Features */}
            <div className="space-y-3 mb-8">
              {[
                '25 messages gratuits pour tester',
                'Intégration simple en 5 minutes',
                'Support de 7 langages de programmation',
                'Dashboard complet inclus',
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                    <FiCheck size={16} className="text-white" />
                  </div>
                  <span className="text-white/90">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="https://dashboard.numericexport.com/register"
                className="px-8 py-4 bg-white text-primary rounded-lg font-bold text-center hover:bg-gray-100 transition-colors shadow-lg"
              >
                Commencer gratuitement
              </Link>
              <a
                href="#whatsapp-api"
                className="px-8 py-4 border-2 border-white text-white rounded-lg font-bold text-center hover:bg-white/10 transition-colors"
              >
                En savoir plus
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-8 pt-8 border-t border-white/20">
              <p className="text-white/70 text-sm mb-4">Ils nous font confiance</p>
              <div className="flex flex-wrap items-center gap-4">
                {/* Badge 1 - Sécurité */}
                <div className="group relative">
                  <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg flex items-center gap-2 hover:bg-white/20 transition-all duration-300 border border-white/5 hover:border-white/20">
                    <svg className="w-4 h-4 text-secondary-light" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                    </svg>
                    <span className="font-medium text-white">Solution certifiée</span>
                  </div>
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-lg">
                    API conforme aux standards
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>

                {/* Badge 2 - Performance */}
                <div className="group relative">
                  <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg flex items-center gap-2 hover:bg-white/20 transition-all duration-300 border border-white/5 hover:border-white/20">
                    <svg className="w-4 h-4 text-secondary-light" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                    <span className="font-medium text-white">99.9% de disponibilité</span>
                  </div>
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-lg">
                    Infrastructure hautement fiable
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>

                {/* Badge 3 - Support */}
                <div className="group relative">
                  <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg flex items-center gap-2 hover:bg-white/20 transition-all duration-300 border border-white/5 hover:border-white/20">
                    <svg className="w-4 h-4 text-secondary-light" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm12 0h-8v2h8v-2zm0 4h-8v2h8v-2zm-10 0H6v2h2v-2z"/>
                    </svg>
                    <span className="font-medium text-white">Support technique</span>
                  </div>
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-lg">
                    Assistance prioritaire 24/7
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>

                {/* Badge 4 - Prix */}
                <div className="group relative">
                  <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg flex items-center gap-2 hover:bg-white/20 transition-all duration-300 border border-white/5 hover:border-white/20">
                    <svg className="w-4 h-4 text-secondary-light" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.5 1L8 7h7l-3.5-6zm0 22L8 17h7l-3.5 6zM12 10.5l-3 5h6l-3-5z"/>
                    </svg>
                    <span className="font-medium text-white">Prix transparents</span>
                  </div>
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-lg">
                    Sans frais cachés
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>
              </div>

              {/* Message de confiance */}
              <p className="text-white/50 text-xs mt-4 text-center">
                Rejoignez +500 entreprises qui utilisent notre solution au Cameroun
              </p>
            </div>
          </div>

          {/* Right Content - Illustration */}
          <div className="relative hidden lg:block">
            <div className="relative">
              {/* Phone mockup */}
              <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-4 max-w-sm mx-auto">
                <div className="bg-gray-100 rounded-2xl p-4 space-y-3">
                  {/* WhatsApp-like messages */}
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-gradient-primary rounded-full flex-shrink-0" />
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-gray-700">Bonjour ! Votre commande #1234 a été expédiée 📦</p>
                      <p className="text-xs text-gray-400 mt-1">10:32</p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <div className="bg-primary text-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm">Merci ! Quand sera-t-elle livrée ?</p>
                      <p className="text-xs text-white/70 mt-1">10:33</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-gradient-primary rounded-full flex-shrink-0" />
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-gray-700">Livraison prévue demain entre 9h et 12h ⏰</p>
                      <p className="text-xs text-gray-400 mt-1">10:33</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-secondary rounded-2xl shadow-xl animate-float flex items-center justify-center">
                <FiMessageCircle className="text-white" size={40} />
              </div>

              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-accent rounded-full shadow-xl animate-float" style={{ animationDelay: '1s' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
