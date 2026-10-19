// /var/www/numericexport/dashboard/app/promotions/[code]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Cookies from 'js-cookie';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { FiTag, FiPercent, FiCalendar, FiCheckCircle } from 'react-icons/fi';

interface Promotion {
  promotion_code: string;
  title: string;
  message: string;
  discount_percentage: number;
  valid_until: string;
  description?: string;
  terms?: string[];
}

export default function PromotionPage() {
  const params = useParams();
  const code = params.code as string;
  
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPromotion();
  }, [code]);

  const fetchPromotion = async () => {
    try {
      const token = Cookies.get('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/promotions/${code}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!response.ok) throw new Error('Promotion non trouvée');
      const data = await response.json();
      setPromotion(data.promotion);
    } catch (err) {
      setError('Cette promotion n\'existe pas ou a expiré.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(promotion?.promotion_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d7a3e]"></div>
      </div>
    );
  }

  if (error || !promotion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center p-8">
          <FiTag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Promotion non trouvée</h1>
          <p className="text-gray-600">{error || 'Cette promotion est invalide ou a expirée.'}</p>
        </Card>
      </div>
    );
  }

  const isValid = new Date(promotion.valid_until) > new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="overflow-hidden border-2 border-green-100">
          {/* Bandeau promotion */}
          <div className="bg-gradient-to-r from-[#2d7a3e] to-[#8bc34a] p-6 text-white text-center">
            <FiTag className="w-12 h-12 mx-auto mb-3" />
            <h1 className="text-3xl font-bold mb-2">{promotion.title}</h1>
            <p className="text-lg opacity-90">{promotion.message}</p>
          </div>

          <CardContent className="p-8">
            {/* Code promo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-4 bg-gray-100 rounded-full px-6 py-3">
                <span className="text-sm font-medium text-gray-600">Code promo :</span>
                <span className="text-2xl font-mono font-bold text-[#2d7a3e] tracking-wider">
                  {promotion.promotion_code}
                </span>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
            </div>

            {/* Grille d'informations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <FiPercent className="w-8 h-8 text-[#2d7a3e] mx-auto mb-2" />
                <p className="text-sm text-gray-600">Réduction</p>
                <p className="text-2xl font-bold text-gray-900">-{promotion.discount_percentage}%</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <FiCalendar className="w-8 h-8 text-[#2d7a3e] mx-auto mb-2" />
                <p className="text-sm text-gray-600">Valable jusqu'au</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(promotion.valid_until).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <FiCheckCircle className={`w-8 h-8 mx-auto mb-2 ${isValid ? 'text-green-600' : 'text-red-500'}`} />
                <p className="text-sm text-gray-600">Statut</p>
                <p className={`text-lg font-semibold ${isValid ? 'text-green-600' : 'text-red-500'}`}>
                  {isValid ? 'Valide' : 'Expirée'}
                </p>
              </div>
            </div>

            {/* Conditions */}
            {promotion.terms && promotion.terms.length > 0 && (
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Conditions d'utilisation</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {promotion.terms.map((term, idx) => (
                    <li key={idx}>{term}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bouton d'action */}
            <div className="text-center mt-8">
              <a
                href="/dashboard/orders/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2d7a3e] hover:bg-[#1e5a2f] text-white rounded-lg font-semibold transition-colors"
              >
                <FiTag />
                Commander avec ce code promo
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
