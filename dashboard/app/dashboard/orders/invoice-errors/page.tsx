'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { FiAlertTriangle, FiFileText, FiRefreshCw, FiDownload, FiEye } from 'react-icons/fi';
import Cookies from 'js-cookie';

export default function InvoiceErrorsPage() {
  const [user, setUser] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) setUser(JSON.parse(userCookie));
    loadErrors();
  }, []);

  const loadErrors = async () => {
    setIsLoading(true);
    try {
      // Vérifier les factures avec problèmes
      const response = await apiClient.get('/orders/invoices/list?limit=100');
      const invoices = response.data.invoices || [];
      
      // Trouver les factures avec problèmes
      const problematicInvoices = invoices.filter((invoice: any) => {
        // Factures sans PDF
        if (!invoice.pdf_path) return true;
        
        // Factures avec statut problématique
        if (invoice.status === 'error' || invoice.status === 'failed') return true;
        
        // Factures plus vieilles que 7 jours sans téléchargement
        const created = new Date(invoice.created_at);
        const now = new Date();
        const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
        
        return diffDays > 7 && !invoice.downloaded_at;
      });
      
      setErrors(problematicInvoices);
      
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixInvoice = async (invoiceId: string) => {
    try {
      await apiClient.post(`/orders/invoices/${invoiceId}/regenerate`);
      alert('Facture régénérée avec succès');
      loadErrors();
    } catch (error) {
      alert('Erreur lors de la régénération');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyse des erreurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-black mb-2">Erreurs de Facturation</h1>
        <p className="text-white/80">Surveillance et correction des problèmes de facturation</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Factures avec erreurs</p>
                <p className="text-2xl font-black text-red-800">{errors.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <FiAlertTriangle className="text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Sans PDF</p>
                <p className="text-2xl font-black text-orange-800">
                  {errors.filter(e => !e.pdf_path).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <FiFileText className="text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Statut erreur</p>
                <p className="text-2xl font-black text-yellow-800">
                  {errors.filter(e => e.status === 'error' || e.status === 'failed').length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <FiAlertTriangle className="text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Anciennes (&gt;7j)</p>
                <p className="text-2xl font-black text-blue-800">
                  {errors.filter(e => {
                    const created = new Date(e.created_at);
                    const now = new Date();
                    const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
                    return diffDays > 7;
                  }).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <FiFileText className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card className="border border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                <FiAlertTriangle className="text-white text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-red-800">Actions de correction</h3>
                <p className="text-sm text-red-700">
                  Régénération des factures problématiques
                </p>
              </div>
            </div>
            <Button
              onClick={loadErrors}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FiRefreshCw /> Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des erreurs */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Facture</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Commande</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Problème</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Date</th>
                  <th className="py-3 px-6 text-left text-xs font-bold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.map((invoice) => {
                  let problem = '';
                  if (!invoice.pdf_path) problem = 'PDF manquant';
                  else if (invoice.status === 'error') problem = 'Statut erreur';
                  else if (invoice.status === 'failed') problem = 'Échec génération';
                  else {
                    const created = new Date(invoice.created_at);
                    const now = new Date();
                    const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
                    if (diffDays > 7) problem = 'Ancienne (>7j)';
                  }
                  
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="font-mono font-bold">{invoice.invoice_number}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium">{invoice.order_code}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          problem.includes('manquant') 
                            ? 'bg-red-100 text-red-800'
                            : problem.includes('erreur') || problem.includes('échec')
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {problem}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">
                        {formatDate(invoice.created_at)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFixInvoice(invoice.id)}
                          >
                            Corriger
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/dashboard/orders/validation?invoice=${invoice.id}`, '_blank')}
                          >
                            Détails
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {errors.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
                <FiFileText className="text-3xl text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-700">✅ Aucune erreur détectée !</h3>
              <p className="text-gray-500">Toutes les factures sont correctement générées.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guide de dépannage */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-gray-800 mb-3">Guide de dépannage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">PDF manquant</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Vérifier les permissions du dossier /media/invoices</li>
                <li>• Vérifier l'espace disque disponible</li>
                <li>• Redémarrer le service PDF generation</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Statut erreur</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Vérifier les logs du serveur</li>
                <li>• Tester la génération manuelle</li>
                <li>• Contacter l'administrateur système</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
