'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FiHome,
  FiShoppingCart,
  FiFileText,
  FiSend,
  FiBook,
  FiSettings,
  FiUsers,
  FiBarChart2,
  FiClipboard,
  FiCheckCircle,
  FiMail,
  FiCreditCard,
  FiFile,
  FiDollarSign,
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiX,
} from 'react-icons/fi';

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  userTypes?: ('client' | 'user')[];
}

interface SidebarProps {
  userType: 'client' | 'user';
  userRole?: string;
}

export default function SidebarEnhanced({ userType, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Tous les menus disponibles
  const allMenuItems: MenuItem[] = [
    // Menu commun
    { 
      label: 'Tableau de bord', 
      href: '/dashboard', 
      icon: <FiHome />,
      userTypes: ['client', 'user']
    },
    { 
      label: 'Mes commandes', 
      href: '/dashboard/orders', 
      icon: <FiShoppingCart />,
      userTypes: ['client']
    },
    { 
      label: 'Mes factures', 
      href: '/dashboard/invoices', 
      icon: <FiFileText />,
      userTypes: ['client']
    },
    { 
      label: 'Messages', 
      href: '/dashboard/messages', 
      icon: <FiSend />,
      userTypes: ['client']
    },

    // Admin & Staff
    {
      label: 'Clients',
      href: '/dashboard/clients',
      icon: <FiUsers />,
      roles: ['admin', 'secretaire', 'commercial', 'auditeur', 'responsable_financier', 'responsable_achat']
    },
    {
      label: 'Invitations',
      href: '/dashboard/invitations',
      icon: <FiMail />,
      roles: ['admin']
    },
    {
      label: 'Validation commandes',
      href: '/dashboard/orders/validation',
      icon: <FiCheckCircle />,
      roles: ['admin', 'secretaire', 'commercial', 'auditeur', 'responsable_financier', 'responsable_achat']
    },
    {
      label: 'Templates WhatsApp',
      href: '/dashboard/templates',
      icon: <FiFile />,
      roles: ['admin', 'secretaire', 'commercial']
    },
    {
      label: 'Paiements',
      href: '/dashboard/payments',
      icon: <FiCreditCard />,
      roles: ['admin', 'responsable_financier']
    },
    {
      label: 'Décaissements',
      href: '/dashboard/disbursements',
      icon: <FiDollarSign />,
      roles: ['admin', 'responsable_achat', 'responsable_financier']
    },
    {
      label: 'Réconciliation',
      href: '/dashboard/reconciliation',
      icon: <FiBarChart2 />,
      roles: ['admin', 'responsable_financier']
    },
    {
      label: 'Statistiques',
      href: '/dashboard/stats',
      icon: <FiBarChart2 />,
      roles: ['admin']
    },

    // Outils techniques
    { 
      label: 'Documentation API', 
      href: '/dashboard/documentation', 
      icon: <FiBook />,
      userTypes: ['client', 'user']
    },
    { 
      label: 'Testeur API', 
      href: '/dashboard/api-tester', 
      icon: <FiClipboard />,
      userTypes: ['client', 'user']
    },
    {
  label: 'Paiements',
  href: '/dashboard/payments',
  icon: <FiCreditCard />,
  roles: ['admin', 'responsable_financier']
},
    { 
      label: 'Paramètres', 
      href: '/dashboard/settings', 
      icon: <FiSettings />,
      userTypes: ['client', 'user']
    },
  ];

  // Filtrage des items selon le type et rôle
  const filteredItems = allMenuItems.filter((item) => {
    // Si restriction par type d'utilisateur
    if (item.userTypes && !item.userTypes.includes(userType)) {
      return false;
    }
    
    // Si restriction par rôle
    if (item.roles && userType === 'user' && userRole) {
      return item.roles.includes(userRole);
    }
    
    // Si c'est un client et pas de restriction spécifique
    if (userType === 'client') {
      return !item.roles; // Les clients ne voient que les items sans restriction de rôle
    }
    
    return true;
  });

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const sidebarClasses = cn(
    'bg-white border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300 ease-in-out',
    isCollapsed ? 'w-20' : 'w-64',
    'fixed md:relative z-40', // Mobile: fixed, Desktop: relative
    'transform md:transform-none', // Animation sur mobile
    isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Mobile toggle button */}
      <button
        onClick={toggleMobileSidebar}
        className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md md:hidden"
      >
        {isMobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {/* Logo */}
        <div className={cn("p-6 border-b border-gray-200", isCollapsed && "p-4")}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden transition-all">
                <h1 className="text-lg font-bold text-dark whitespace-nowrap">NEXT LTD</h1>
                <p className="text-xs text-gray-500 whitespace-nowrap">Dashboard</p>
              </div>
            )}
          </Link>
        </div>

        {/* Toggle button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 hidden md:block"
        >
          {isCollapsed ? (
            <FiChevronRight className="text-gray-600" />
          ) : (
            <FiChevronLeft className="text-gray-600" />
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-primary text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-dark'
                )}
                onClick={() => setIsMobileOpen(false)}
              >
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                {!isCollapsed && (
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                )}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <p className={cn(
            "text-xs text-gray-500 text-center",
            isCollapsed && "text-[10px]"
          )}>
            © 2026 NEXT LTD
          </p>
        </div>
      </aside>
    </>
  );
}
