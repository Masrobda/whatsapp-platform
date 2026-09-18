'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate, formatCurrency } from '@/lib/utils';
import { FiFileText, FiDownload, FiAlertCircle, FiPrinter, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';
import Cookies from 'js-cookie';

export default function MissingInvoicesReportPage() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    validated_financial: 0,
    invoice_generated: 0,
    with_invoice: 0,
    without_invoice: 0
  });

  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) setUser(JSON.parse(userCookie));
    loadMissingInvoices();
  }, []);

  const loadMissingInvoices = async () => {
    setIsLoading(true);
    try {
      // Charger toutes les commandes
      const response = await apiClient.get('/orders?limit=1000');
      const allOrders = response.data.orders || [];
      
      // Filtrer les commandes qui devraient avoir une facture
      const ordersNeedingInvoice = allOrders.filter((order: any) => 
        (order.status === 'validated_financial' || order.status === 'invoice_generated') && 
        !order.invoice_generated
      );
      
      setOrders(ordersNeedingInvoice);
      
      // Calculer les statistiques
      const validatedFinancial = allOrders.filter((o: any) => o.status === 'validated_financial').length;
      const invoiceGenerated = allOrders.filter((o: any) => o.status === 'invoice_generated').length;
      const withInvoice = allOrders.filter((o: any) => o.invoice_generated).length;
      
      setStats({
        total: ordersNeedingInvoice.length,
        validated_financial: validatedFinancial,
        invoice_generated: invoiceGenerated,
        with_invoice: withInvoice,
        without_invoice: ordersNeedingInvoice.length
      });
      
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!confirm(`Générer les factures pour ${orders.length} commandes ?\nCela peut prendre quelques minutes.`)) return;
    
    setIsGenerating(true);
    const results = { success: 0, failed: 0 };
    
    for (const order of orders) {
      try {
        await apiClient.post(`/orders/${order.id}/generate-invoice`);
        results.success++;
      } catch (error) {
        console.error(`Erreur pour ${order.order_code}:`, error);
        results.failed++;
      }
      // Petite pause pour ne pas surcharger le serveur
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsGenerating(false);
    alert(`✅ Génération terminée:\n${results.success} succès\n${results.failed} échecs`);
    loadMissingInvoices();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du rapport...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-black mb-2">Rapport des Factures Manquantes</h1>
        <p className="text-white/80">Surveillance et correction des factures non générées</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Factures manquantes</p>
                <p className="text-2xl font-black text-red-800">{stats.without_invoice}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <FiAlertCircle className="text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Validées financièrement</p>
                <p className="text-2xl font-black text-blue-800">{stats.validated_financial}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <FiCheckCircle className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Factures générées</p>
                <p className="text-2xl font-black text-green-800">{stats.with_invoice}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <FiFileText className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Statut facture</p>
                <p className="text-2xl font-black text-purple-800">{stats.invoice_generated}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <FiFileText className="text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Total à traiter</p>
                <p className="text-2xl font-black text-orange-800">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <FiPrinter className="text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card className="border border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center">
                <FiPrinter className="text-white text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-yellow-800">Génération en masse</h3>
                <p className="text-sm text-yellow-700">
                  Générer automatiquement toutes les factures manquantes
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadMissingInvoices}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FiRefreshCw /> Actualiser
              </Button>
              <Button
                onClick={handleGenerateAll}
                isLoading={isGenerating}
                disabled={orders.length === 0}
                variant="primary"
                className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500"
              >
                <FiPrinter /> Générer {orders.length} factures
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des commandes */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Commande</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Client</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Montant</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Statut</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Date</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="font-mono font-bold">{order.order_code}</div>
                      <div className="text-xs text-gray-500">{order.quantity} messages</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium">{order.company_name || order.client_email}</div>
                    </td>
                    <td className="py-4 px-6 font-bold text-primary">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        order.status === 'validated_financial' 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="py-4 px-6">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/dashboard/orders/validation?order=${order.id}`, '_blank')}
                      >
                        Voir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {orders.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
                <FiCheckCircle className="text-3xl text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-700">✅ Toutes les factures sont générées !</h3>
              <p className="text-gray-500">Aucune facture manquante à signaler.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-blue-800 mb-3">Instructions</h3>
          <ul className="space-y-2 text-blue-700">
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
              <span>Les commandes avec statut "validated_financial" ou "invoice_generated" doivent avoir une facture proforma</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
              <span>Cliquez sur "Générer" pour créer automatiquement toutes les factures manquantes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
              <span>La génération peut prendre quelques secondes par facture</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">4</span>
              <span>Les factures générées seront disponibles dans le module Factures & Décaissements</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
