'use client';
import { FiCode, FiShoppingCart, FiTrendingUp, FiServer, FiGlobe, FiUsers } from 'react-icons/fi';

export default function Services() {
  const services = [
    {
     icon: <FiCode />,
     title: 'Conseil & Ingénierie IT',
     description: "Expertise, assistance et maîtrise d'œuvre dans tous les domaines de l'informatique et du numérique.",
    },

    {
      icon: <FiShoppingCart />,
      title: 'Développement de Solutions',
      description: 'Conception et développement de logiciels, applications mobiles, solutions SaaS et plateformes web.',
    },
    {
      icon: <FiTrendingUp />,
      title: 'Marketing Digital',
      description: 'Stratégies de communication digitale, community management et gestion de campagnes publicitaires en ligne.',
    },
    {
      icon: <FiServer />,
      title: 'Infrastructures IT',
      description: 'Commerce, vente et maintenance de matériels informatiques et équipements de télécommunications.',
    },
    {
      icon: <FiGlobe />,
      title: 'Services Web',
      description: 'Création, hébergement, optimisation SEO/SEA et maintenance de sites internet et e-commerce.',
    },
    {
      icon: <FiUsers />,
      title: 'Support & Formation',
      description: 'Services techniques, formation, support informatique, sécurité des données et infogérance.',
    },
  ];

  return (
    <section id="services" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
            Nos Services
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            NEXT LTD propose une gamme complète de services en technologies de l&apos;information
            pour accompagner votre transformation digitale.
          </p>
        </div>
        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-300 group"
            >
              <div className="w-14 h-14 bg-gradient-primary rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <span className="text-white text-2xl">{service.icon}</span>
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">
                {service.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-dark mb-4">
              Besoin d&apos;un accompagnement personnalisé ?
            </h3>
            <p className="text-gray-600 mb-6">
              Contactez notre équipe d&apos;experts pour discuter de votre projet
            </p>
            <a
              href="#contact"
              className="inline-block px-8 py-3 bg-gradient-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
