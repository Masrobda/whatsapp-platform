'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FiMail, FiLock, FiUser, FiPhone, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    company_name: '',
    company_type: 'entreprise',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);

    try {
      await auth.register(formData);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      const errorData = err.response?.data;

      if (errorData?.code === 'VALIDATION_ERROR' && errorData?.errors?.length > 0) {
        const firstError = errorData.errors[0];
        let userMessage = firstError.message;

        if (firstError.field === 'password') {
          userMessage = "Le mot de passe est trop faible : " + userMessage;
        }

        setError(userMessage);
      } else {
        setError(errorData?.message || "Une erreur est survenue lors de l'inscription. Veuillez réessayer.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ────────────────────────────────────────────────
  //  Affichage conditionnel → doit être au niveau du composant
  // ────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-custom-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="text-success" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-dark mb-2">Inscription réussie !</h2>
          <p className="text-gray-600 mb-4">
            Votre compte a été créé avec succès. Un email de bienvenue vous a été envoyé avec vos identifiants API.
          </p>
          <p className="text-sm text-gray-500">
            Vous allez être redirigé vers la page de connexion...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="mb-8 md:mb-12">
          <img
            src="/logook1.png"
            alt="NEXT LTD Logo"
            className="h-20 md:h-24 w-auto object-contain drop-shadow-lg mx-auto"
          />
        </div>

        {/* Card d'inscription */}
        <div className="bg-white rounded-lg shadow-custom-lg p-8">
          <h2 className="text-2xl font-bold text-dark mb-6">Créer un compte</h2>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-error">
              <FiAlertCircle className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Nom de l'entreprise"
                placeholder="Ma Société"
                icon={<FiUser />}
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Type de compte
                </label>
                <select
                  value={formData.company_type}
                  onChange={(e) => setFormData({ ...formData, company_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="entreprise">Entreprise</option>
                  <option value="personnel">Personnel</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="email"
                label="Email"
                placeholder="votre@email.com"
                icon={<FiMail />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <Input
                type="tel"
                label="Téléphone"
                placeholder="+237600000000"
                icon={<FiPhone />}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  type="password"
                  label="Mot de passe"
                  placeholder="••••••"
                  icon={<FiLock />}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                {formData.password && (
                  <p className="text-xs text-gray-500 mt-1">
                    Doit contenir : majuscule, minuscule, chiffre, caractère spécial (@$!%*?&)
                  </p>
                )}
              </div>

              <Input
                type="password"
                label="Confirmer le mot de passe"
                placeholder="•••••••"
                icon={<FiLock />}
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                required
              />
            </div>

            {/* Info période d'essai */}
            <div className="bg-secondary/10 border border-secondary rounded-lg p-4">
              <h4 className="font-medium text-dark mb-2">🎁 Offre de bienvenue</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ 25 messages gratuits pour tester</li>
                <li>✓ Valable pendant 5 jours</li>
                <li>✓ 5 messages maximum par jour</li>
                <li>✓ Identifiants API générés automatiquement</li>
              </ul>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                required
                className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label className="text-sm text-gray-600">
                J'accepte les{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  conditions d'utilisation
                </Link>
                {' '}et la{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  politique de confidentialité
                </Link>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
            >
              Créer mon compte
            </Button>
          </form>

          {/* Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Déjà client ?</span>
            </div>
          </div>

          {/* Login link */}
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Se connecter
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-white/80 text-sm mt-6">
          © 2026 NEXT LTD - Tous droits réservés
        </p>
      </div>
    </div>
  );
}
