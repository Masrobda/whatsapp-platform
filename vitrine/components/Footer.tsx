'use client';
import Link from 'next/link';
import Image from 'next/image';
import { FiMail, FiMapPin } from 'react-icons/fi';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info avec Logo Image */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-32 h-32">
                <Image
                  src="/images/fnslogo.png"
                  alt="Logo NEXT LTD"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">NEXT LTD</h3>
                <p className="text-xs text-gray-400">Numeric EXport Technologies</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Solutions professionnelles en technologies de l&apos;information et WhatsApp Business API au Cameroun.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <FiMapPin size={16} />
                <span>Face Texaco Omnisport, BP 1538  Douala Cameroun</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <FiMail size={16} />
                <a href="mailto:team@numericexport.com" className="hover:text-secondary transition-colors">
                  team@numericexport.com
                </a>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold mb-4 border-l-4 border-primary pl-3">Services</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#whatsapp-api" className="hover:text-secondary transition-colors">WhatsApp Business API</a></li>
              <li><a href="#services" className="hover:text-secondary transition-colors">Développement web/mobile</a></li>
              <li><a href="#services" className="hover:text-secondary transition-colors">Conseil IT</a></li>
              <li><a href="#services" className="hover:text-secondary transition-colors">Marketing digital</a></li>
              <li><a href="#services" className="hover:text-secondary transition-colors">Infrastructures IT</a></li>
            </ul>
          </div>

          {/* Liens rapides */}
          <div>
            <h4 className="font-bold mb-4 border-l-4 border-primary pl-3">Liens rapides</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="https://dashboard.numericexport.com/login" className="hover:text-secondary transition-colors">
                  Connexion
                </Link>
              </li>
              <li>
                <Link href="https://dashboard.numericexport.com/register" className="hover:text-secondary transition-colors">
                  Inscription
                </Link>
              </li>
              <li>
                <Link href="https://dashboard.numericexport.com/dashboard/documentation" className="hover:text-secondary transition-colors">
                  Documentation API
                </Link>
              </li>
              <li>
                <a href="#contact" className="hover:text-secondary transition-colors">Contact</a>
              </li>
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h4 className="font-bold mb-4 border-l-4 border-primary pl-3">Informations légales</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/terms" prefetch={false} className="hover:text-secondary transition-colors">Conditions d&apos;utilisation</Link></li>
              <li><Link href="/privacy" prefetch={false} className="hover:text-secondary transition-colors">Politique de confidentialité</Link></li>
              <li><Link href="/legal" prefetch={false} className="hover:text-secondary transition-colors">Mentions légales</Link></li>
            </ul>
            <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-[10px] text-gray-500 leading-relaxed uppercase tracking-wider">
                RCCM: CM-DLA-02-2026-B12-00012<br/>
                NUI: M012618314899B
              </p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              © {currentYear} NEXT LTD. Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
