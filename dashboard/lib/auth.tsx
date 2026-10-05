'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { auth as authAPI } from './api';

interface User {
  id: string;
  email: string;
  company_name?: string;
  full_name?: string;
  role?: string;
  type: 'client' | 'user';
  quota_remaining?: number;
  // Nouveaux champs pour garantir l'affichage du nom
  display_name?: string;
  name_from_email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, userType: 'client' | 'user') => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Fonction pour extraire le nom de l'email
  const getNameFromEmail = (email: string): string => {
    if (!email) return 'Utilisateur';
    const namePart = email.split('@')[0];
    return namePart
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const loadUser = async () => {
      const userCookie = Cookies.get('user');
      const token = Cookies.get('token');
      
      if (!token || !userCookie) {
        setIsLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(userCookie);
        
        // Garantir qu'on a toujours un display_name
        const displayName = 
          parsedUser.company_name || 
          parsedUser.full_name || 
          parsedUser.display_name || 
          getNameFromEmail(parsedUser.email);
        
        // Ajouter le nom extrait de l'email comme fallback
        const enhancedUser = {
          ...parsedUser,
          display_name: displayName,
          name_from_email: getNameFromEmail(parsedUser.email),
        };
        
        setUser(enhancedUser);
      } catch (error) {
        console.error('Erreur parsing user cookie:', error);
        Cookies.remove('user');
        Cookies.remove('token');
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [router]);

  const login = async (email: string, password: string, userType: 'client' | 'user') => {
    const response = await authAPI.login(email, password, userType);

    const userData = response.client || response.user;
    userData.type = userType;
    
    // Ajouter le display_name
    userData.display_name = 
      userData.company_name || 
      userData.full_name || 
      getNameFromEmail(userData.email);
    
    userData.name_from_email = getNameFromEmail(userData.email);

    Cookies.set('token', response.token, { expires: 7 });
    Cookies.set('user', JSON.stringify(userData), { expires: 7 });

    setUser(userData);
  };

  const logout = () => {
    Cookies.remove('token');
    Cookies.remove('user');
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      const userData = response.user;
      
      // Ajouter le display_name
      userData.display_name = 
        userData.company_name || 
        userData.full_name || 
        getNameFromEmail(userData.email);
      
      userData.name_from_email = getNameFromEmail(userData.email);
      
      Cookies.set('user', JSON.stringify(userData), { expires: 7 });
      setUser(userData);
    } catch (error) {
      console.error('Erreur refresh user:', error);
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
