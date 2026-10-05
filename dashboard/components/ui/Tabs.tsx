'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;   // ← Ajouté ici
  className?: string;                      // Optionnel : pour styliser le conteneur global
}

export default function Tabs({
  tabs,
  defaultTab,
  onTabChange,
  className,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  // Fonction qui gère le changement d'onglet
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // On appelle le callback parent si fourni
    onTabChange?.(tabId);
  };

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={cn("w-full", className)}>
      {/* En-têtes des onglets */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'px-6 py-3 font-medium text-sm whitespace-nowrap transition-all duration-200',
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="mt-6">
        {activeContent}
      </div>
    </div>
  );
}
