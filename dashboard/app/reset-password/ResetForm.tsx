'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FiLock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { auth } from '@/lib/api';

export default function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!token) {
      setError('Token manquant. Veuillez utiliser le lien reçu par email.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await auth.resetPassword(token, password, confirmPassword);
      setMessage(data.message || 'Votre mot de passe a été réinitialisé avec succès.');
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 4000);
    } catch (err: any) {
      const errData = err.response?.data;

      if (errData?.code === 'VALIDATION_ERROR' && errData?.errors?.length > 0) {
        const firstError = errData.errors[0];
        let userMessage = firstError.message;

        if (firstError.field === 'password') {
          userMessage = "Mot de passe invalide : " + userMessage;
        } else if (firstError.field === 'confirm_password') {
          userMessage = "Les mots de passe ne correspondent pas";
        }

        setError(userMessage);
      } else {
        setError(
          errData?.message ||
          (errData?.code === 'TOKEN_EXPIRED' ? 'Ce lien a expiré. Veuillez en demander un nouveau.' :
           errData?.code === 'TOKEN_USED' ? 'Ce lien a déjà été utilisé.' :
           'Une erreur est survenue. Veuillez réessayer.')
        );
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
          <h2 className="text-2xl font-bold text-dark mb-2">Mot de passe réinitialisé !</h2>
          <p className="text-gray-600 mb-4">
            Vous allez être redirigé vers la page de connexion...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-custom-lg p-8">
      <h2 className="text-2xl font-bold text-dark mb-6 text-center">
        Réinitialiser votre mot de passe
      </h2>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-error">
          <FiAlertCircle className="flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          type="password"
          label="Nouveau mot de passe"
          placeholder="••••••••"
          icon={<FiLock />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Input
          type="password"
          label="Confirmer le mot de passe"
          placeholder="••••••••"
          icon={<FiLock />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <div className="text-xs text-gray-500">
          Le mot de passe doit contenir au moins : une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&)
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isLoading}
          disabled={!token || isLoading}
        >
          Réinitialiser le mot de passe
        </Button>
      </form>

      <div className="mt-8 text-center">
        <Link href="/login" className="text-primary hover:underline font-medium">
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
