import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-primary flex flex-col items-center justify-center px-4 relative">
      {/* Logo */}
      <div className="mb-8 md:mb-12">
        <img
          src="/logook1.png"
          alt="NEXT LTD Logo"
          className="h-20 md:h-24 w-auto object-contain drop-shadow-lg mx-auto"
        />
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-custom-lg p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-dark text-center mb-6">Connexion</h2>

          <Suspense
            fallback={
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement...</p>
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-white/80 text-sm mt-6">
          © 2026 NEXT LTD - Tous droits réservés
        </p>
      </div>
    </div>
  );
}
