'use client';
import { useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/api';
import Button from '@/components/ui/Button';      // ← réutilise le Button de register
import Input from '@/components/ui/Input';        // ← réutilise Input stylé
import { FiMail, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const data = await auth.forgotPassword(email, 'client');
      setMessage(data.message || 'Si cet email existe, un lien de réinitialisation vous a été envoyé.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="mb-8 md:mb-12">
          <img
            src="/logook1.png"
            alt="NEXT LTD Logo"
            className="h-20 md:h-24 w-auto object-contain drop-shadow-lg mx-auto"
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-custom-lg p-8">
          <h2 className="text-2xl font-bold text-dark mb-4 text-center">
            Mot de passe oublié ?
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-error">
              <FiAlertCircle className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {message && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-success">
              <FiCheckCircle className="flex-shrink-0" />
              <span className="text-sm">{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="email"
              label="Adresse email"
              placeholder="votre@email.com"
              icon={<FiMail />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
            >
              Envoyer le lien de réinitialisation
            </Button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/login" className="text-primary hover:underline font-medium">
              ← Retour à la connexion
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/80 text-sm mt-8">
          © 2026 NEXT LTD - Tous droits réservés
        </p>
      </div>
    </div>
  );
}
