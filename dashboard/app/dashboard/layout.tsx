'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get('token');
    const userCookie = Cookies.get('user');

    console.log("--- Dashboard Auth Check ---");
    console.log("Token présent:", !!token);
    console.log("Cookie utilisateur brut:", userCookie);

    if (!token || !userCookie) {
      console.warn("Session manquante ou cookie vide, redirection...");
      router.push('/login');
      return;
    }

    try {
      const userData = JSON.parse(userCookie);
      
      // Sécurité si l'objet est {} (cas détecté dans tes logs)
      if (!userData || Object.keys(userData).length === 0) {
        console.error("Données utilisateur vides dans le cookie");
        Cookies.remove('user'); // On nettoie le cookie corrompu
        router.push('/login');
        return;
      }

      console.log("Données utilisateur validées:", userData);
      setUser(userData);
    } catch (error) {
      console.error('Erreur de parsing JSON:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-500 font-medium">Chargement sécurisé...</p>
        </div>
      </div>
    );
  }

  // Si on n'a pas d'utilisateur après le chargement, on n'affiche rien
  if (!user || Object.keys(user).length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* On injecte les données normalisées dans la Sidebar */}
        <Sidebar
          userType={user.type || 'client'}
          userRole={user.role || user.user_role || ''}
        />

        <div className="flex-1 flex flex-col min-h-screen">
          <Header user={user} />
          <main className="flex-1 p-6">
            {children}
          </main>

          <footer className="p-6 text-center text-gray-400 text-[10px] uppercase tracking-widest font-bold">
            © 2026 NEXT LTD | Workspace Version 2.0.4
          </footer>
        </div>
      </div>
    </div>
  );
}
