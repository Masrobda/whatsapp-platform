'use client';
import { useState } from 'react';
import { FiMail, FiPhone, FiMapPin, FiSend, FiLoader, FiCheckCircle } from 'react-icons/fi';

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      subject: formData.get('subject'),
      message: formData.get('message'),
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSent(true);
      } else {
        alert("Une erreur est survenue lors de l'envoi.");
      }
    } catch {
      alert("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <section className="py-20 bg-gray-50 flex items-center justify-center text-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl">
          <FiCheckCircle className="text-secondary mx-auto mb-4" size={60} />
          <h2 className="text-2xl font-bold mb-2">Message envoyé !</h2>
          <p className="text-gray-600">L&apos;équipe de NEXT LTD vous répondra très bientôt.</p>
          <button
            onClick={() => setSent(false)}
            className="mt-6 text-primary font-bold underline"
          >
            Renvoyer un autre message
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left: Contact Info */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-dark mb-6">
              Contactez-nous
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Notre équipe d&apos;experts est à votre disposition pour répondre à toutes vos questions
              et vous accompagner dans vos projets.
            </p>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiMail className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-dark mb-1">Email</h3>
                  <a href="mailto:team@numericexport.com" className="text-primary hover:underline">
                    team@numericexport.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiPhone className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-dark mb-1">Téléphone</h3>
                  <a href="tel:+237600000000" className="text-primary hover:underline">
                    (+237) 651 01 90 69 / 696 57 81 07
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiMapPin className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-dark mb-1">Adresse</h3>
                  <p className="text-gray-600">
                    Douala, Cameroun
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 p-6 bg-white rounded-xl shadow-md">
              <h3 className="font-bold text-dark mb-4">Horaires d&apos;ouverture</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Lundi - Vendredi</span>
                  <span className="font-medium text-dark">8h00 - 18h00</span>
                </div>
                <div className="flex justify-between">
                  <span>Samedi</span>
                  <span className="font-medium text-dark">9h00 - 14h00</span>
                </div>
                <div className="flex justify-between">
                  <span>Dimanche</span>
                  <span className="font-medium text-dark">Fermé</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-dark mb-6">Envoyez-nous un message</h3>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Nom complet</label>
                <input
                  name="name"
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Email</label>
                <input
                  name="email"
                  type="email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Téléphone</label>
                <input
                  name="phone"
                  type="tel"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="+237 6XX XX XX XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Sujet</label>
                <select
                  name="subject"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  <option>WhatsApp Business API</option>
                  <option>Développement web/mobile</option>
                  <option>Conseil IT</option>
                  <option>Marketing digital</option>
                  <option>Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Message</label>
                <textarea
                  name="message"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Décrivez votre projet..."
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {loading ? <FiLoader className="animate-spin" /> : <FiSend />}
                {loading ? 'Envoi...' : 'Envoyer le message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
