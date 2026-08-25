'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiMenu, FiX } from 'react-icons/fi';
import Image from 'next/image';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { label: 'Accueil', href: '/' },
    { label: 'Services', href: '#services' },
    { label: 'WhatsApp API', href: '#whatsapp-api' },
    { label: 'Fonctionnalités', href: '#features' },
    { label: 'Témoignages', href: '#testimonials' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20"> {/* Hauteur augmentée pour plus d'air */}
          
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="md:hidden relative w-17 h-17">
              <Image src="/fbmlogo.png" alt="Logo" fill className="object-contain" priority />
            </div>
            <div className="hidden md:block relative w-32 h-32">
              <Image src="/fbslogo.png" alt="Logo" fill className="object-contain" priority />
            </div>
            <div className="ml-1">
              <h1 className="text-lg font-bold text-dark whitespace-nowrap">NEXT LTD</h1>
              <p className="text-[10px] text-gray-500 hidden lg:block uppercase tracking-wider">
                Numeric EXport Technologies
              </p>
            </div>
          </Link>

          {/* Desktop Menu - Spacing adjusted */}
          <div className="hidden xl:flex items-center gap-5">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-700 hover:text-primary font-medium transition-colors whitespace-nowrap text-sm"
                onClick={(e) => {
                  if (item.href.startsWith('#')) {
                    e.preventDefault();
                    const element = document.querySelector(item.href);
                    if (element) element.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons - flex-shrink-0 prevents crushing */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <Link
              href="https://dashboard.numericexport.com/login"
              className="px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 rounded-lg transition-colors border border-primary whitespace-nowrap"
              target="_blank"
              rel="noopener noreferrer"
            >
              Connexion
            </Link>
            <Link
              href="https://dashboard.numericexport.com/register"
              className="px-5 py-2 text-sm font-semibold bg-gradient-primary text-white rounded-lg hover:opacity-90 transition-opacity shadow-md whitespace-nowrap"
              target="_blank"
              rel="noopener noreferrer"
            >
              Essai gratuit
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Menu"
          >
            {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu - Remains unchanged as it was already vertical */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 animate-fadeIn">
          <div className="px-4 py-6 space-y-4">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block text-base font-medium text-gray-700 hover:text-primary"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              <Link
                href="https://dashboard.numericexport.com/login"
                className="w-full py-3 text-center text-primary font-bold border border-primary rounded-xl"
                onClick={() => setIsOpen(false)}
              >
                Connexion
              </Link>
              <Link
                href="https://dashboard.numericexport.com/register"
                className="w-full py-3 text-center bg-gradient-primary text-white font-bold rounded-xl shadow-lg"
                onClick={() => setIsOpen(false)}
              >
                Commencer gratuitement
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
