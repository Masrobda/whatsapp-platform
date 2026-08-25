'use client';

import { useEffect, useState } from 'react';
import Card from './Card';
import { formatCurrency, calculatePercentage } from '@/lib/utils';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

interface PaymentStatsProps {
  period?: '7days' | '30days' | '90days';
}

export default function PaymentStats({ period = '30days' }: PaymentStatsProps) {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    // Simuler l'appel API
    setTimeout(() => {
      setStats({
        total_received: 2450000,
        total_verified: 2100000,
        pending_verification: 350000,
        avg_payment: 54545,
        payment_count: 45,
        verified_count: 38,
        pending_count: 7,
        trends: {
          weekly_growth: 12.5,
          verification_rate: 84.4
        }
      });
      setIsLoading(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Total reçu */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Total reçu</p>
            <h3 className="text-2xl font-bold text-dark">
              {formatCurrency(stats.total_received)}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {stats.payment_count} paiements
            </p>
          </div>
          <div className={`flex items-center ${stats.trends.weekly_growth > 0 ? 'text-success' : 'text-error'}`}>
            {stats.trends.weekly_growth > 0 ? <FiTrendingUp /> : <FiTrendingDown />}
            <span className="text-sm ml-1">{Math.abs(stats.trends.weekly_growth)}%</span>
          </div>
        </div>
      </Card>

      {/* Validés */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Validés</p>
            <h3 className="text-2xl font-bold text-dark">
              {formatCurrency(stats.total_verified)}
            </h3>
            <div className="flex items-center mt-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-success h-2 rounded-full"
                  style={{ width: `${stats.trends.verification_rate}%` }}
                />
              </div>
              <span className="text-xs text-success ml-2">{stats.trends.verification_rate}%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* En attente */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">En attente</p>
            <h3 className="text-2xl font-bold text-dark">
              {formatCurrency(stats.pending_verification)}
            </h3>
            <p className="text-xs text-warning mt-1">
              {stats.pending_count} paiements à vérifier
            </p>
          </div>
        </div>
      </Card>

      {/* Moyenne */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Moyenne par paiement</p>
            <h3 className="text-2xl font-bold text-dark">
              {formatCurrency(stats.avg_payment)}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Dernières {period}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
