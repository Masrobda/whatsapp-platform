'use client';

import Image from 'next/image';

export default function Testimonials() {
  const testimonials = [
    { name: 'Marie Kouam', role: 'Directrice E-commerce', company: 'Fashion Store CM', rating: 5, text: "La mise en place d’une infogérance avec support technique dédié a transformé notre service client. Nous avons augmenté notre taux de conversion de 35% en seulement 3 mois." },
    { name: 'Paul Essomba', role: 'Fondateur & CEO', company: 'LogiTrack Solutions', rating: 5, text: "Le dashboard personnalisable nous a permis de centraliser tous nos KPIs. L'automatisation intelligente nous fait gagner un temps précieux." },
    { name: 'Sandrine Mbala', role: 'Responsable Marketing', company: 'BeautyHub', rating: 5, text: "Support réactif, documentation claire et résultats mesurables. Notre ROI a été multiplié par 3." },
    // ... Gardez vos autres témoignages ici
  ];

  const partnerLogos = [
    { name: 'Partner 1', src: '/images/avatar1.png' },
    { name: 'Partner 2', src: '/images/avatar2.png' },
    { name: 'Partner 3', src: '/images/avatar3.png' },
    { name: 'Partner 4', src: '/images/avatar4.png' },
    { name: 'Partner 5', src: '/images/avatar5.png' },
  ];

  return (
    <section id="testimonials" className="py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Titre et Grille (Inchangés) */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-dark mb-4">Ils nous font confiance</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-gray-50 rounded-2xl p-8 relative">
               {/* Design avec cercle bleu et lettre */}
               <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold">{testimonial.name}</div>
                  <div className="text-sm text-primary">{testimonial.company}</div>
                </div>
              </div>
              <p className="mt-4 text-gray-700 italic">&quot;{testimonial.text}&quot;</p>
            </div>
          ))}
        </div>

        {/* Section Carrousel de Logos */}
        <div className="pt-12 border-t border-gray-100">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-10">
            Propulsant les leaders du marché
          </p>
          
          {/* Conteneur du carrousel */}
          <div className="relative flex overflow-x-hidden">
            <div className="flex animate-marquee whitespace-nowrap items-center">
              {/* On double la liste pour créer l'effet infini */}
              {[...partnerLogos, ...partnerLogos].map((partner, i) => (
                <div key={i} className="mx-8 flex-shrink-0">
                  <div className="relative w-16 h-16 transition-transform duration-300 hover:scale-110">
                    <Image
                      src={partner.src}
                      alt={partner.name}
                      fill
                      className="object-contain rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
