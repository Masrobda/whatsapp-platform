import { Suspense } from 'react';
import ResetForm from './ResetForm'; // ← importe le composant client

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="mb-8 md:mb-12">
          <img
            src="/logook1.png"
            alt="NEXT LTD Logo"
            className="h-20 md:h-24 w-auto object-contain drop-shadow-lg mx-auto"
          />
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-lg shadow-custom-lg p-8 text-center">
            <p className="text-gray-600">Chargement du formulaire...</p>
          </div>
        }>
          <ResetForm />
        </Suspense>

        <p className="text-center text-white/80 text-sm mt-8">
          © 2026 NEXT LTD - Tous droits réservés
        </p>
      </div>
    </div>
  );
}
