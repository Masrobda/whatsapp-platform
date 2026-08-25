'use client';

import { useState } from 'react';
import { FiChevronDown, FiHelpCircle } from 'react-icons/fi';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Comment fonctionne l'API WhatsApp Business ?",
      answer: "Notre API WhatsApp Business vous permet d'envoyer et de recevoir des messages WhatsApp directement depuis vos applications. Elle offre une intégration simple avec support de 7 langages de programmation. Vous obtenez 25 messages gratuits pour tester pendant 5 jours.",
    },
    {
      question: "Quels sont les délais de mise en œuvre ?",
      answer: "L'intégration de notre API peut se faire en moins de 5 minutes grâce à notre documentation complète. Pour des projets de développement personnalisé, les délais varient selon la complexité, généralement entre 2 à 8 semaines.",
    },
    {
      question: "Proposez-vous un support technique ?",
      answer: "Oui, nous offrons un support technique 24/7 pour tous nos clients. Notre équipe d'experts est disponible par email, téléphone et WhatsApp pour résoudre rapidement tout problème technique.",
    },
    {
      question: "Quelles sont les conditions tarifaires ?",
      answer: "Nous prônons la flexibilité : il n'y a aucun frais d'installation pour l'API. Vous ne payez que le coût par session/message WhatsApp, négocié directement selon vos volumes pour vous garantir le meilleur tarif du marché. Pour nos services de développement et conseil, nous fonctionnons sur devis personnalisé après analyse de vos besoins spécifiques.",
    },
    {
      question: "Est-ce que mes données sont sécurisées ?",
      answer: "Absolument. Nous utilisons une infrastructure de niveau enterprise avec chiffrement de bout en bout et conformité aux normes internationales. Vos données sont hébergées sur des serveurs sécurisés avec sauvegardes automatiques.",
    },
    {
      question: "Puis-je intégrer vos solutions avec mes outils existants ?",
      answer: "Oui, nos solutions offrent de multiples options d'intégration via API REST et webhooks. Nous supportons l'intégration avec la plupart des CRM, ERP et outils de gestion populaires.",
    },
  ];

  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <FiHelpCircle className="text-primary" />
            <span className="text-sm font-medium text-primary">FAQ</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
            Questions fréquentes
          </h2>
          <p className="text-lg text-gray-600">
            Trouvez rapidement des réponses à vos questions
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-md overflow-hidden transition-shadow hover:shadow-lg"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
              >
                <span className="font-bold text-dark pr-4">{faq.question}</span>
                <FiChevronDown
                  className={`flex-shrink-0 text-primary transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  size={24}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center bg-white rounded-2xl shadow-md p-8">
          <h3 className="text-xl font-bold text-dark mb-3">
            Vous avez d&apos;autres questions ?
          </h3>
          <p className="text-gray-600 mb-6">
            Notre équipe est là pour vous aider
          </p>
          <a
            href="#contact"
            className="inline-block px-8 py-3 bg-gradient-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Contactez-nous
          </a>
        </div>
      </div>
    </section>
  );
}
