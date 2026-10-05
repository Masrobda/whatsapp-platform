'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Notifications from '@/components/ui/Notifications';
import { FiBell, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { getInitials, getAvatarColor } from '@/lib/utils';

interface HeaderProps {
  user: any;
}

export default function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  // 1. Calcul dynamique du nom à afficher
  const displayName =
    user.type === 'client'
      ? user.company_name || user.email?.split('@')[0] || 'Client'
      : user.full_name || user.email?.split('@')[0] || 'Membre équipe';

  // 2. Mapping des rôles avec l'objet fourni
  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    secretaire: 'Secrétaire',
    commercial: 'Commercial',
    auditeur: 'Auditeur',
    responsable_achat: 'Responsable Achats',
    responsable_financier: 'Responsable Financier',
  };

  const roleLabel =
    user.type === 'client'
      ? 'Client'
      : roleLabels[user.role?.toLowerCase()] || user.role || 'Équipe';

  const handleLogout = () => {
    Cookies.remove('token');
    Cookies.remove('user');
    router.push('/login');
  };

  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(displayName);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Section Bienvenue */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-dark">
            Bienvenue, {displayName.split(' ')[0] || displayName} ! 👋
          </h2>
          <p className="text-sm text-gray-600">
            {roleLabel}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <Notifications userType={user.type} />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className={`w-10 h-10 ${avatarColor} rounded-full flex items-center justify-center shadow-inner`}>
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-bold text-dark">{displayName}</p>
                <p className="text-[10px] uppercase tracking-wider font-black text-gray-400">{roleLabel}</p>
              </div>
            </button>

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-20 animate-slide-in">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="text-sm font-bold text-dark">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        router.push('/dashboard/settings');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <FiSettings className="text-gray-400" size={18} />
                      Paramètres du profil
                    </button>
                  </div>

                  <div className="border-t border-gray-50 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
                    >
                      <FiLogOut size={18} />
                      Déconnexion
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
