'use client';

import { FiBarChart2, FiCpu, FiLink, FiShield } from 'react-icons/fi';
import Image from 'next/image';

export default function Features() {
  const features = [
    {
      icon: <FiBarChart2 />,
      title: 'Tableaux de bord personnalisables',
      description: 'Visualisez vos indicateurs clés de performance avec des dashboards entièrement configurables selon vos besoins.',
      image: '/images/dashboard-preview.png', // Remplacer par votre image
      bgColor: 'from-blue-500 to-blue-600',
    },
    {
  icon: <FiCpu />,
  title: 'Automatisation intelligente',
  description: "Automatisez vos processus métier avec notre technologie IA qui s'adapte à vos spécificités.",
  image: '/images/automation-preview.png', // Remplacer par votre image
  bgColor: 'from-purple-500 to-purple-600',
},
{
  icon: <FiLink />,
  title: 'Intégrations multiples',
  description: "Connectez tous vos outils existants grâce à nos connecteurs API et nos solutions d'intégration.",
  image: '/images/integrations-preview.png', // Remplacer par votre image
  bgColor: 'from-green-500 to-green-600',
},

    {
      icon: <FiShield />,
      title: 'Sécurité de niveau enterprise',
      description: 'Bénéficiez de la meilleure protection pour vos données avec notre infrastructure sécurisée et certifiée.',
      image: '/images/security-preview.png', // Remplacer par votre image
      bgColor: 'from-red-500 to-red-600',
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 rounded-full mb-4">
            <span className="text-sm font-medium text-secondary">Fonctionnalités</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
            Des outils puissants pour votre réussite
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Découvrez comment nos solutions transforment votre façon de travailler
          </p>
        </div>

        {/* Features Grid */}
        <div className="space-y-24">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`grid lg:grid-cols-2 gap-12 items-center ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              {/* Content */}
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6`}>
                  <span className="text-white text-3xl">{feature.icon}</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-dark mb-4">
                  {feature.title}
                </h3>
                <p className="text-lg text-gray-600 leading-relaxed mb-6">
                  {feature.description}
                </p>
                <div className="flex items-center gap-4">
                  <div className="h-1 w-16 bg-gradient-primary rounded-full" />
                  <span className="text-sm text-gray-500">En savoir plus</span>
                </div>
              </div>

              {/* Image Placeholder */}
              <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                <div className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgColor} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity`} />
                  <div className="relative bg-gray-100 rounded-2xl overflow-hidden shadow-2xl aspect-video">
                    {/* Placeholder avec dégradé */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgColor} opacity-10`} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-6xl opacity-20">{feature.icon}</span>
                    </div>
                    {/* Image réelle - Commentée en attendant les vraies images */}
                      <Image
                      src={feature.image}
                      alt={feature.title}
                      width={800}
                      height={450}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-24 bg-gradient-primary rounded-3xl p-12 text-center">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-5xl md:text-6xl font-bold text-white mb-2">+45%</div>
              <p className="text-white/90 text-lg">d&apos;efficacité en moyenne pour nos clients</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-white mb-2">24/7</div>
              <p className="text-white/90 text-lg">Support technique disponible</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-white mb-2">99.9%</div>
              <p className="text-white/90 text-lg">Temps de disponibilité garanti</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
