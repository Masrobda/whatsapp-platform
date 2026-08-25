'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { invitations as invitationsAPI, auth } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FiUser, FiMail, FiLock, FiCheckCircle, FiXCircle } from 'react-icons/fi';

// Composant interne qui contient toute la logique (utilise useSearchParams)
function InvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      validateInvitation();
    } else {
      router.push('/register');
    }
  }, [token, router]);

  const validateInvitation = async () => {
    try {
      const response = await invitationsAPI.getByToken(token!);
      setInvitation(response.invitation);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Lien d\'invitation invalide');
    } finally {
      setIsLoading(false);
    }
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  if (formData.password !== formData.confirm_password) {
    setError('Les mots de passe ne correspondent pas');
    return;
  }

  setIsSubmitting(true);

  try {
    const payload = {
      full_name: formData.full_name,
      email: formData.email,
      password: formData.password,
      confirm_password: formData.confirm_password,
      invitation_token: token,
    };

    console.log('PAYLOAD ENVOYÉ :', payload);
    console.log('ROUTE APPELÉE :', '/auth/register/invitation');  // ← log de confirmation

    await auth.register(payload, '/auth/register/invitation');

    setSuccess(true);
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  } catch (err: any) {
    console.error('Erreur inscription complète :', err.response?.data);
    setError(err.response?.data?.message || 'Erreur lors de l\'inscription');
  } finally {
    setIsSubmitting(false);
  }
};


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-custom-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiXCircle className="text-error" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-dark mb-2">Lien invalide</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/login')}>
            Retour à la connexion
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-custom-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="text-success" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-dark mb-2">Compte créé !</h2>
          <p className="text-gray-600 mb-4">
            Votre compte a été créé avec succès. Vous allez être redirigé vers la page de connexion.
          </p>
        </div>
      </div>
    );
  }

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrateur',
      secretaire: 'Secrétaire/Commercial',
      commercial: 'Commercial',
      auditeur: 'Auditeur',
      responsable_achat: 'Responsable Achats',
      responsable_financier: 'Responsable Financier',
    };
    return roles[role] || role;
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">NEXT LTD</h1>
          <p className="text-secondary-light">Invitation à rejoindre l'équipe</p>
        </div>

        {/* Card d'inscription */}
        <div className="bg-white rounded-lg shadow-custom-lg p-8">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Invitation en tant que :</h3>
            <p className="text-lg font-bold text-primary">{getRoleLabel(invitation.role)}</p>
            <p className="text-sm text-blue-700 mt-1">
              Expire le : {new Date(invitation.expires_at).toLocaleDateString('fr-FR')}
            </p>
          </div>

          <h2 className="text-2xl font-bold text-dark mb-6">Créer votre compte</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Nom complet"
              placeholder="John Doe"
              icon={<FiUser />}
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />

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
              type="password"
              label="Mot de passe"
              placeholder="••••••••"
              icon={<FiLock />}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            <Input
              type="password"
              label="Confirmer le mot de passe"
              placeholder="••••••••"
              icon={<FiLock />}
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isSubmitting}
            >
              Rejoindre l'équipe
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Composant exporté (page) avec Suspense
export default function InvitationRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      }
    >
      <InvitationContent />
    </Suspense>
  );
}
