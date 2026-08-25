'use client';

import { useEffect, useState } from 'react';
import { orders as ordersAPI, bsp as bspAPI } from '@/lib/api';
import apiClient from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { formatDate, formatCurrency, getStatusBadge } from '@/lib/utils';
import {
  FiCheck,
  FiShield,
  FiCreditCard,
  FiPackage,
  FiFileText,
  FiShoppingCart,
  FiCheckCircle,
  FiDollarSign,
  FiRefreshCw,
  FiUser,
  FiBarChart2,
  FiTrendingUp,
  FiClock,
  FiAlertCircle,
  FiInfo,
  FiPercent,
  FiCalendar,
  FiDatabase,
  FiEye,
  FiDownload,
  FiChevronDown,
  FiChevronUp,
  FiX,
  FiPrinter,
  FiExternalLink,
  FiCornerUpRight
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface ClientStats {
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  totalSpent: number;
  averageOrder: number;
  companyName?: string;
  clientEmail?: string;
}

interface BspData {
  bsp_id: string;
  messages_to_purchase: number;
  purchase_cost: number;
  purpose: string;
  custom_cost?: number;
}

interface InvoiceStatus {
  id?: string;
  invoice_number?: string;
  pdf_path?: string;
  pdf_exists?: boolean;
  pdf_url?: string;
  qr_code_url?: string;
  stamp_applied?: boolean;
  status?: string;
}

export default function OrderValidationPage() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [filter, setFilter] = useState('to_validate');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [validationNotes, setValidationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientStats, setClientStats] = useState<ClientStats | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    allOrders: any[];
    filteredOrders: any[];
    filter: string;
    timestamp: string;
  } | null>(null);

  // État pour la modal de validation financière avec BSP
  const [showBspModal, setShowBspModal] = useState(false);
  const [bspProviders, setBspProviders] = useState<any[]>([]);
  const [bspData, setBspData] = useState<BspData>({
    bsp_id: '',
    messages_to_purchase: 0,
    purchase_cost: 0,
    purpose: 'Achat messages WhatsApp 360dialog',
    custom_cost: undefined
  });
  const [costCalculation, setCostCalculation] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) setUser(JSON.parse(userCookie));
    loadOrders();
  }, [pagination.page, filter]);

  useEffect(() => {
    if (selectedOrder) {
      loadOrderDetails(selectedOrder.id);
      calculateClientStats(selectedOrder.client_id);
      checkInvoiceStatus(selectedOrder.id);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (showBspModal && selectedOrder) {
      loadBspProviders();
      // Initialiser les valeurs par défaut
      setBspData({
        bsp_id: '',
        messages_to_purchase: selectedOrder.quantity,
        purchase_cost: 0,
        purpose: `Achat de ${selectedOrder.quantity} messages WhatsApp`,
        custom_cost: undefined
      });
    }
  }, [showBspModal, selectedOrder]);

  const loadOrders = async () => {
    console.log("🚀 Chargement TOUTES les commandes");
    setIsLoading(true);

    try {
      const response = await ordersAPI.getAll({
        page: pagination.page,
        limit: 100,
      });

      console.log("📊 API retourne", response.orders.length, "commandes:");

      let filteredOrders = response.orders || [];

      // DEBUG: Vérifiez les champs disponibles
      if (response.orders.length > 0) {
        console.log("🔍 Structure première commande:", {
          id: response.orders[0].id,
          company_name: response.orders[0].company_name,
          client_email: response.orders[0].client_email,
          client: response.orders[0].client,
          status: response.orders[0].status,
        });
      }

      // Filtrage des commandes selon le statut
      if (filter === 'to_validate') {
        console.log("🎯 APPLYING FILTER 'to_validate'");

        // TOUTES les commandes SAUF cancelled
        filteredOrders = response.orders.filter((o: any) => {
          return o.status !== 'cancelled';
        });

        console.log(`📈 Résultat: ${filteredOrders.length}/${response.orders.length} commandes`);

      } else if (filter === 'in_progress') {
        // Commandes en cours de traitement
        filteredOrders = response.orders.filter((o: any) =>
          o.status === 'pending' ||
          o.status === 'validated_secretary' ||
          o.status === 'validated_auditor' ||
          o.status === 'validated_financial'
        );
      } else if (filter === 'completed') {
        // Commandes terminées
        filteredOrders = response.orders.filter((o: any) =>
          o.status === 'purchase_completed' ||
          o.status === 'completed'
        );
      } else if (filter === 'pending') {
        // Uniquement en attente
        filteredOrders = response.orders.filter((o: any) =>
          o.status === 'pending'
        );
      } else if (filter === 'invoices') {
        // Factures générées (maintenant gérées dans le nouveau module)
        filteredOrders = response.orders.filter((o: any) =>
          o.status === 'invoice_generated'
        );
      }
      // 'all' pas besoin de filtre

      // Debug info pour l'état des commandes
      setDebugInfo({
        allOrders: response.orders,
        filteredOrders: filteredOrders,
        filter: filter,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Mise à jour de l'état des commandes filtrées et de la pagination
      setOrders(filteredOrders);
      setPagination(response.pagination);

    } catch (error: any) {
      console.error('❌ Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrderDetails = async (orderId: string) => {
    try {
      const response = await ordersAPI.getById(orderId);
      setOrderDetails(response.order || response);
      console.log("📋 Détails commande chargés:", response);
    } catch (error) {
      console.error("❌ Erreur chargement détails:", error);
    }
  };

  const checkInvoiceStatus = async (orderId: string) => {
    try {
      console.log("🔍 Vérification statut facture pour:", orderId);
      const response = await apiClient.get(`/orders/${orderId}/invoice-status`);

      if (response.data.success) {
        console.log("📄 Statut facture:", response.data.invoice ? "EXISTE" : "MANQUANTE");
        setInvoiceStatus(response.data.invoice || null);

        // Si une facture existe mais que le PDF est manquant
        if (response.data.invoice && !response.data.invoice.pdf_exists) {
          console.warn("⚠️ Facture existe mais PDF manquant:", response.data.invoice);
        }
      }
    } catch (error) {
      console.warn("⚠️ Erreur vérification statut facture:", error);
      setInvoiceStatus(null);
    }
  };

  const loadBspProviders = async () => {
    try {
      const response = await bspAPI.getAll({ active_only: true });
      setBspProviders(response.data || []);

      // Sélectionner le premier BSP par défaut si disponible
      if (response.data && response.data.length > 0) {
        setBspData(prev => ({
          ...prev,
          bsp_id: response.data[0].id
        }));
        // Calculer automatiquement le coût
        setTimeout(() => calculateBspCost(response.data[0].id), 100);
      }
    } catch (error) {
      console.error('Erreur chargement BSP:', error);
    }
  };

  const calculateClientStats = (clientId: string) => {
    if (!orders.length) return;

    const clientOrders = orders.filter(order => order.client_id === clientId);

    const totalOrders = clientOrders.length;
    const paidOrders = clientOrders.filter(o =>
      o.status === 'purchase_completed' ||
      o.status === 'completed'
    ).length;

    const pendingOrders = clientOrders.filter(o => o.status === 'pending').length;

    const inProgressOrders = clientOrders.filter(o =>
      o.status === 'validated_secretary' ||
      o.status === 'validated_auditor' ||
      o.status === 'validated_financial' ||
      o.status === 'invoice_generated'
    ).length;

    const totalSpent = clientOrders.reduce((sum, order) => {
      return sum + parseFloat(order.total_amount || '0');
    }, 0);

    const averageOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;

    // Récupérer le nom de la première commande (toutes ont la même info)
    const firstOrder = clientOrders[0];

    setClientStats({
      totalOrders,
      paidOrders,
      pendingOrders,
      inProgressOrders,
      totalSpent,
      averageOrder,
      companyName: firstOrder?.company_name,
      clientEmail: firstOrder?.client_email,
    });
  };

  // Fonction pour générer manuellement la facture
  const handleGenerateInvoice = async (orderId: string) => {
    if (!confirm('Générer la facture proforma pour cette commande ?')) return;

    setIsSubmitting(true);
    try {
      console.log("🔄 Génération facture pour:", orderId);
      const response = await apiClient.post(`/orders/${orderId}/generate-invoice`);

      if (response.data.success) {
        const invoiceNumber = response.data.invoice?.invoice_number || 'Numéro inconnu';
        alert(`✅ Facture générée avec succès!\nNuméro: ${invoiceNumber}`);

        // Rafraîchir les données
        loadOrders();
        checkInvoiceStatus(orderId);

        // Si on est dans la modal, rafraîchir les détails
        if (selectedOrder?.id === orderId) {
          loadOrderDetails(orderId);
        }
      } else {
        alert('⚠️ ' + (response.data.message || 'Erreur lors de la génération'));
      }

    } catch (error: any) {
      console.error('❌ Erreur génération facture:', error);
      const errorMsg = error.response?.data?.message || 'Erreur lors de la génération de la facture';
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour générer avec tampon et QR code
  const handleGenerateInvoiceWithStamp = async (orderId: string) => {
    if (!confirm('Générer la facture proforma avec tampon et QR code ?')) return;

    setIsSubmitting(true);
    try {
      console.log("🔄 Génération facture avec tampon pour:", orderId);
      const response = await apiClient.post(`/orders/${orderId}/proforma-with-stamp`);

      if (response.data.success) {
        alert(`✅ Facture avec tampon générée avec succès!\nNuméro: ${response.data.invoice?.invoice_number}`);

        // Rafraîchir les données
        loadOrders();
        checkInvoiceStatus(orderId);

        if (selectedOrder?.id === orderId) {
          loadOrderDetails(orderId);
        }
      } else {
        alert('⚠️ ' + (response.data.message || 'Erreur lors de la génération'));
      }

    } catch (error: any) {
      console.error('❌ Erreur génération facture avec tampon:', error);
      alert(error.response?.data?.message || 'Erreur lors de la génération');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logique de rôle améliorée - Correction pour le flow complet
  const canValidate = (order: any, role?: string) => {
    if (!role) return false;

    console.log(`🔐 canValidate: ${order.order_code} (${order.status}) pour ${role}`);

    // L'admin peut valider à tous les niveaux SAUF quand c'est terminé
    if (role === 'admin') {
      return order.status !== 'purchase_completed' && order.status !== 'cancelled';
    }

    // Rôles associés aux statuts
    const statusMap: Record<string, string[]> = {
      'pending': ['secretaire', 'commercial'],
      'validated_secretary': ['auditeur'],
      'validated_auditor': ['responsable_financier'],
      'validated_financial': ['responsable_achat'],
      'invoice_generated': ['responsable_achat'],
    };

    return statusMap[order.status]?.includes(role) || false;
  };

  // Libellés d'actions précis avec icônes
  const getActionLabel = (order: any, role?: string) => {
    switch (order.status) {
      case 'pending':
        return { label: 'Approuver (Secrétariat)', icon: <FiCheckCircle />, color: 'bg-blue-500' };
      case 'validated_secretary':
        return { label: 'Certifier (Audit)', icon: <FiShield />, color: 'bg-purple-500' };
      case 'validated_auditor':
        return { label: 'Autoriser Paiement (Finance)', icon: <FiCreditCard />, color: 'bg-indigo-500' };
      case 'validated_financial':
      case 'invoice_generated':
        return { label: 'Voir détails', icon: <FiEye />, color: 'bg-gray-500' };
      case 'purchase_completed':
        return { label: 'Achat terminé', icon: <FiCheckCircle />, color: 'bg-green-600' };
      default:
        return { label: 'Terminé', icon: <FiCheck />, color: 'bg-gray-500' };
    }
  };

  // Gestionnaire de validation complet
  const handleValidation = async (orderId: string) => {
    if (!selectedOrder) return;
    setIsSubmitting(true);

    try {
      const status = selectedOrder.status;
      let successMessage = '';

      console.log("🚀 Début validation pour:", {
        orderId,
        status,
        orderCode: selectedOrder.order_code
      });

      if (status === 'pending') {
        await ordersAPI.validateBySecretary(orderId, validationNotes);
        successMessage = '✅ Validé par le secrétariat';

      } else if (status === 'validated_secretary') {
        await ordersAPI.validateByAuditor(orderId);
        successMessage = '✅ Certifié par l\'audit';

      } else if (status === 'validated_auditor') {
        // AU LIEU de valider directement, ouvrir la modal BSP
        setShowBspModal(true);
        setIsSubmitting(false);
        return;

      } else if (status === 'validated_financial' || status === 'invoice_generated') {
        // Ces actions sont maintenant dans le module Factures
        successMessage = 'Cette commande est prête pour le module Factures & Décaissements';

      } else if (status === 'purchase_completed') {
        alert('Cette commande est déjà terminée.');
        setIsSubmitting(false);
        return;
      }

      console.log("🎉 Validation réussie:", successMessage);

      // Réinitialisation complète de l'UI
      setSelectedOrder(null);
      setValidationNotes('');
      setClientStats(null);
      setOrderDetails(null);
      setInvoiceStatus(null);

      // Rechargement des données
      setTimeout(() => {
        loadOrders();
        if (successMessage) alert(successMessage);
      }, 500);

    } catch (error: any) {
      console.error("❌ Erreur détaillée:", error);
      const errorMsg = error.response?.data?.message || error.message || '❌ Erreur lors de la validation';
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour calculer le coût avec BSP
  const calculateBspCost = async (bspId?: string) => {
    if (!selectedOrder) return;

    const targetBspId = bspId || bspData.bsp_id;
    if (!targetBspId || !bspData.messages_to_purchase) return;

    setIsCalculating(true);
    try {
      const response = await bspAPI.calculateCost({
        bsp_id: targetBspId,
        quantity: bspData.messages_to_purchase,
        custom_cost: bspData.custom_cost
      });

      setCostCalculation(response.data);
      setBspData(prev => ({
        ...prev,
        purchase_cost: response.data.total_cost
      }));
    } catch (error) {
      console.error('Erreur calcul coût BSP:', error);
      alert('Erreur lors du calcul des coûts');
    } finally {
      setIsCalculating(false);
    }
  };

  // Fonction pour valider avec BSP
  const handleBspValidation = async () => {
    if (!selectedOrder || !bspData.bsp_id) {
      alert('Veuillez sélectionner un fournisseur BSP');
      return;
    }

    setIsSubmitting(true);
    try {
      // Créer une nouvelle fonction API pour la validation financière avec BSP
      const response = await apiClient.post(`/orders/${selectedOrder.id}/validate/financial-with-bsp`, bspData);

      console.log("✅ Validation financière avec BSP réussie:", response.data);

      // Fermer la modal
      setShowBspModal(false);
      setBspData({
        bsp_id: '',
        messages_to_purchase: 0,
        purchase_cost: 0,
        purpose: 'Achat messages WhatsApp 360dialog',
        custom_cost: undefined
      });
      setCostCalculation(null);

      // Recharger les commandes
      loadOrders();
      setSelectedOrder(null);
      setInvoiceStatus(null);

      alert('✅ Validation financière effectuée avec BSP et facture proforma générée');

    } catch (error: any) {
      console.error("❌ Erreur validation avec BSP:", error);
      alert(error.response?.data?.message || 'Erreur lors de la validation avec BSP');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Obtenir le nom/email du client de manière sécurisée
  const getClientInfo = (order: any) => {
    return {
      companyName: order.company_name || order.client?.company_name || 'Non spécifié',
      email: order.client_email || order.client?.email || 'Non spécifié'
    };
  };

  // Fonction pour forcer la génération de facture depuis n'importe quel statut
  const handleForceGenerateInvoice = async (orderId: string) => {
    if (!confirm('⚠️ Forcer la génération de facture ?\nCette action générera une nouvelle facture même s\'il en existe déjà une.')) return;

    setIsSubmitting(true);
    try {
      // Essayer d'abord avec tampon, sinon méthode simple
      const response = await apiClient.post(`/orders/${orderId}/proforma-with-stamp`);

      if (response.data.success) {
        alert(`✅ Facture forcée générée!\nNuméro: ${response.data.invoice?.invoice_number}`);
        loadOrders();
        checkInvoiceStatus(orderId);
      }
    } catch (error) {
      // Fallback à la méthode simple
      try {
        const simpleResponse = await apiClient.post(`/orders/${orderId}/generate-invoice`);
        if (simpleResponse.data.success) {
          alert(`✅ Facture simple générée!\nNuméro: ${simpleResponse.data.invoice?.invoice_number}`);
          loadOrders();
          checkInvoiceStatus(orderId);
        }
      } catch (fallbackError) {
        alert('❌ Échec des deux méthodes de génération');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
  try {
    const token = Cookies.get('token');
    
    if (!token) {
      alert('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    // URL CORRECTE : API + /api/v1 + route + token en query
    const downloadUrl = `https://api.numericexport.com/api/v1/orders/invoices/${invoiceId}/download?token=${token}`;

    console.log('Téléchargement tentative URL:', downloadUrl);

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`  // optionnel si token déjà en query, mais plus sûr
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur réponse:', response.status, errorText);
      alert(`Erreur ${response.status}: ${errorText || 'Impossible de télécharger la facture'}`);
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FACTURE_${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (error) {
    console.error('Erreur complète téléchargement:', error);
    alert('Erreur lors du téléchargement. Vérifiez votre connexion ou réessayez.');
  }
};

  // Fonction pour QR Code

const handleViewQRCode = (qrCodeUrl: string) => {
  let apiUrl = qrCodeUrl.trim();

  console.log('URL QR originale :', apiUrl);

  // Cas legacy dashboard (à garder si tu as encore des anciens QR codes)
  if (apiUrl.includes('dashboard.numericexport.com/verify-invoice/')) {
    apiUrl = apiUrl.replace(
      'https://dashboard.numericexport.com/verify-invoice/',
      `${process.env.API_BASE_URL || 'https://api.numericexport.com'}/api/v1/orders/invoices/`
    );
    // Gère le ?token= → /verify?token= si besoin
    if (apiUrl.includes('?token=')) {
      apiUrl = apiUrl.replace('?token=', '/verify?token=');
    }
  }

  // Nettoyage intelligent : remplace seulement si le pattern existe SANS le bon préfixe
  // On évite de créer des doublons
  if (!apiUrl.includes('/api/v1/orders/invoices/')) {
    apiUrl = apiUrl.replace('/api/v1/invoices/', '/api/v1/orders/invoices/');
    apiUrl = apiUrl.replace('/invoices/', '/api/v1/orders/invoices/');
  }

  // Optionnel : force le bon domaine si besoin (sécurité)
  if (!apiUrl.startsWith('https://api.numericexport.com')) {
    apiUrl = apiUrl.replace(/^https?:\/\/[^/]+/, process.env.API_BASE_URL || 'https://api.numericexport.com');
  }

  console.log('URL finale pour ouverture :', apiUrl);

  window.open(apiUrl, '_blank', 'noopener,noreferrer');
};

  const tabs = [
    {
      id: 'to_validate',
      label: '📋 Toutes les commandes',
      content: <OrdersTable
        orders={orders}
        user={user}
        isLoading={isLoading}
        canValidate={canValidate}
        getActionLabel={getActionLabel}
        setSelectedOrder={setSelectedOrder}
        getClientInfo={getClientInfo}
      />
    },
    {
      id: 'pending',
      label: '⏳ En attente',
      content: <OrdersTable
        orders={orders.filter(o => o.status === 'pending')}
        user={user}
        isLoading={isLoading}
        canValidate={canValidate}
        getActionLabel={getActionLabel}
        setSelectedOrder={setSelectedOrder}
        getClientInfo={getClientInfo}
      />
    },
    {
      id: 'in_progress',
      label: '🔄 En cours',
      content: <OrdersTable
        orders={orders.filter(o =>
          o.status === 'validated_secretary' ||
          o.status === 'validated_auditor' ||
          o.status === 'validated_financial'
        )}
        user={user}
        isLoading={isLoading}
        canValidate={canValidate}
        getActionLabel={getActionLabel}
        setSelectedOrder={setSelectedOrder}
        getClientInfo={getClientInfo}
      />
    },
    {
      id: 'invoices',
      label: '🧾 Factures générées',
      content: <OrdersTable
        orders={orders.filter(o => o.status === 'invoice_generated')}
        user={user}
        isLoading={isLoading}
        canValidate={canValidate}
        getActionLabel={getActionLabel}
        setSelectedOrder={setSelectedOrder}
        getClientInfo={getClientInfo}
      />
    },
    {
      id: 'missing_invoices',
      label: '⚠️ Factures manquantes',
      content: <OrdersTable
        orders={orders.filter(o =>
          (o.status === 'validated_financial' || o.status === 'invoice_generated') &&
          !o.invoice_generated
        )}
        user={user}
        isLoading={isLoading}
        canValidate={canValidate}
        getActionLabel={getActionLabel}
        setSelectedOrder={setSelectedOrder}
        getClientInfo={getClientInfo}
        showGenerateButton={true}
      />
    },
    {
      id: 'completed',
      label: '✅ Terminées',
      content: <OrdersTable
        orders={orders.filter(o =>
          o.status === 'purchase_completed' ||
          o.status === 'completed'
        )}
        user={user}
        isLoading={isLoading}
        canValidate={canValidate}
        getActionLabel={getActionLabel}
        setSelectedOrder={setSelectedOrder}
        getClientInfo={getClientInfo}
      />
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête amélioré */}
      <div className="bg-gradient-primary rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-2">Validation des Commandes</h1>
            <p className="text-white/80 text-sm">
              Workflow d'approbation sécurisé • Rôle: <span className="font-bold">{user?.role?.replace('_', ' ') || 'Non défini'}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs opacity-80">Commandes totales</p>
              <p className="text-2xl font-black">{orders.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-xl font-bold">{user?.role?.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">En attente</p>
                <p className="text-2xl font-black text-blue-800">
                  {orders.filter(o => o.status === 'pending').length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <FiClock className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">En cours</p>
                <p className="text-2xl font-black text-purple-800">
                  {orders.filter(o =>
                    o.status === 'validated_secretary' ||
                    o.status === 'validated_auditor' ||
                    o.status === 'validated_financial'
                  ).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <FiRefreshCw className="text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-cyan-50 to-cyan-100 border-cyan-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyan-600 font-medium">Factures</p>
                <p className="text-2xl font-black text-cyan-800">
                  {orders.filter(o => o.status === 'invoice_generated').length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <FiFileText className="text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Factures OK</p>
                <p className="text-2xl font-black text-orange-800">
                  {orders.filter(o =>
                    o.status === 'invoice_generated' &&
                    o.invoice_generated
                  ).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <FiCheckCircle className="text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Factures manq.</p>
                <p className="text-2xl font-black text-red-800">
                  {orders.filter(o =>
                    (o.status === 'validated_financial' || o.status === 'invoice_generated') &&
                    !o.invoice_generated
                  ).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <FiAlertCircle className="text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Terminées</p>
                <p className="text-2xl font-black text-green-800">
                  {orders.filter(o => o.status === 'purchase_completed' || o.status === 'completed').length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <FiCheckCircle className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      {(user?.role === 'financial_manager' || user?.role === 'admin') && (
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <FiPrinter className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-blue-800">Gestion des factures</h3>
                  <p className="text-sm text-blue-600">Actions rapides pour les responsables financiers</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => window.open('/dashboard/orders/missing-invoices-report', '_blank')}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FiFileText /> Rapport manquantes
                </Button>
                <Button
                  onClick={() => window.open('/dashboard/orders/invoice-errors', '_blank')}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FiAlertCircle /> Erreurs facturation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onglets principaux */}
      <Card className="border-none shadow-xl">
        <CardContent className="p-0">
          <Tabs tabs={tabs} defaultTab="to_validate" />
        </CardContent>
      </Card>

      {/* Modal de Validation Avancé - NOUVELLE VERSION */}
      {selectedOrder && !showBspModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* En-tête modal */}
            <div className="bg-gradient-to-r from-primary to-primary-dark p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {getActionLabel(selectedOrder, user?.role).icon}
                    <h3 className="text-xl font-bold">
                      {getActionLabel(selectedOrder, user?.role).label}
                    </h3>
                  </div>
                  <p className="text-white/80 text-sm">
                    Commande: <span className="font-mono font-bold">{selectedOrder.order_code}</span>
                    {' • '}Client: <span className="font-bold">{getClientInfo(selectedOrder).companyName}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setClientStats(null);
                    setOrderDetails(null);
                    setInvoiceStatus(null);
                  }}
                  className="text-white/80 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Section 1: Informations Client */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold text-dark mb-3 flex items-center gap-2">
                  <FiUser /> Informations Client
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Entreprise</p>
                    <p className="font-semibold text-dark">{getClientInfo(selectedOrder).companyName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Email</p>
                    <p className="font-semibold text-dark">{getClientInfo(selectedOrder).email}</p>
                  </div>
                </div>

                {/* Statistiques Client */}
                {clientStats && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h5 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <FiDatabase /> Historique du Client ({clientStats.totalOrders} commandes)
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600">Total</p>
                        <p className="text-lg font-black text-blue-800">{clientStats.totalOrders}</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600">Payées</p>
                        <p className="text-lg font-black text-green-800">{clientStats.paidOrders}</p>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded-lg">
                        <p className="text-xs text-yellow-600">En attente</p>
                        <p className="text-lg font-black text-yellow-800">{clientStats.pendingOrders}</p>
                      </div>
                      <div className="text-center p-2 bg-purple-50 rounded-lg">
                        <p className="text-xs text-purple-600">En cours</p>
                        <p className="text-lg font-black text-purple-800">{clientStats.inProgressOrders}</p>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <p className="text-xs text-gray-500">
                        Total dépensé: <span className="font-bold">{formatCurrency(clientStats.totalSpent)}</span>
                        {' • '}Moyenne/commande: <span className="font-bold">{formatCurrency(clientStats.averageOrder)}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Détails Commande */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-bold text-dark flex items-center gap-2">
                    <FiShoppingCart /> Détails de la Commande
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quantité:</span>
                      <span className="font-bold">{selectedOrder.quantity.toLocaleString()} messages</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prix unitaire:</span>
                      <span className="font-bold">{formatCurrency(selectedOrder.unit_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sous-total:</span>
                      <span className="font-bold">{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">TVA ({selectedOrder.vat_rate}%):</span>
                      <span className="font-bold">{formatCurrency(selectedOrder.vat_amount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="text-gray-600 font-bold">Total:</span>
                      <span className="text-xl font-black text-primary">
                        {formatCurrency(selectedOrder.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Facture Proforma - NOUVELLE SECTION */}
                <div className="space-y-4">
                  <h4 className="font-bold text-dark flex items-center gap-2">
                    <FiFileText /> Facture Proforma
                  </h4>

                  {invoiceStatus ? (
                    // Facture existante
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <FiCheckCircle className="text-green-600" />
                          </div>
                          <div>
                            <p className="font-bold text-dark">Facture générée</p>
                            <p className="text-sm text-gray-600">
                              Numéro: <span className="font-mono font-bold">{invoiceStatus.invoice_number}</span>
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`w-2 h-2 rounded-full ${invoiceStatus.pdf_exists ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span>PDF: {invoiceStatus.pdf_exists ? '✓ Disponible' : '✗ Manquant'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`w-2 h-2 rounded-full ${invoiceStatus.stamp_applied ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <span>Tampon: {invoiceStatus.stamp_applied ? '✓ Appliqué' : 'Non appliqué'}</span>
                          </div>
                          {invoiceStatus.qr_code_url && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span>QR Code: ✓ Disponible</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          {invoiceStatus.pdf_url && invoiceStatus.pdf_exists && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-2"
                              onClick={() => handleDownloadInvoice(invoiceStatus.id!, invoiceStatus.invoice_number!)}
                            >
                              <FiDownload /> Télécharger
                            </Button>
                          )}

                          {invoiceStatus.qr_code_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-2"
                              onClick={() => handleViewQRCode(invoiceStatus.qr_code_url!)}
                            >
                              <FiExternalLink /> QR Code
                            </Button>
                          )}

                          {(!invoiceStatus.pdf_exists || !invoiceStatus.stamp_applied) && (
                            <Button
                              onClick={() => handleGenerateInvoiceWithStamp(selectedOrder.id)}
                              size="sm"
                              variant="primary"
                              className="flex items-center gap-2"
                              isLoading={isSubmitting}
                            >
                              <FiPrinter /> Regénérer
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (selectedOrder.status === 'validated_financial' || selectedOrder.status === 'invoice_generated') ? (
                    // Pas de facture mais statut le permet
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <FiAlertCircle className="text-yellow-600" />
                          </div>
                          <div>
                            <p className="font-bold text-dark">Facture non générée</p>
                            <p className="text-sm text-gray-600">
                              Cliquez pour générer la facture proforma
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-gray-500">
                            Statut de la commande: <span className="font-bold">{selectedOrder.status}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            La génération prend quelques secondes. Un PDF sera créé avec tampon et QR code.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleGenerateInvoiceWithStamp(selectedOrder.id)}
                            isLoading={isSubmitting}
                            className="flex-1"
                            variant="primary"
                          >
                            <FiPrinter /> Générer avec tampon
                          </Button>

                          <Button
                            onClick={() => handleGenerateInvoice(selectedOrder.id)}
                            isLoading={isSubmitting}
                            className="flex-1"
                            variant="outline"
                          >
                            <FiFileText /> Générer simple
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Pas encore prêt pour la facture
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                          <FiClock className="text-gray-500" />
                        </div>
                        <p className="text-sm text-gray-600">
                          La facture proforma sera générée automatiquement après validation financière.
                        </p>
                        <p className="text-xs text-gray-500">
                          Statut actuel: <span className="font-bold">{selectedOrder.status}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Processus de Validation */}
              <div className="space-y-4">
                <h4 className="font-bold text-dark flex items-center gap-2">
                  <FiCheckCircle /> Étape en Cours
                </h4>
                <div className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${getActionLabel(selectedOrder).color} flex items-center justify-center text-white`}>
                      {getActionLabel(selectedOrder).icon}
                    </div>
                    <div>
                      <p className="font-bold text-dark">{getActionLabel(selectedOrder).label}</p>
                      <p className="text-xs text-gray-500">
                        {selectedOrder.status === 'pending' ? 'Attente validation secrétariat' :
                         selectedOrder.status === 'validated_secretary' ? 'Attente audit interne' :
                         selectedOrder.status === 'validated_auditor' ? 'Attente autorisation financière' :
                         selectedOrder.status === 'validated_financial' ? 'Prêt pour génération facture' :
                         selectedOrder.status === 'invoice_generated' ? 'Facture à générer/valider' :
                         'Processus terminé'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedOrder.status === 'pending' ? 'w-1/5 bg-blue-500' :
                        selectedOrder.status === 'validated_secretary' ? 'w-2/5 bg-purple-500' :
                        selectedOrder.status === 'validated_auditor' ? 'w-3/5 bg-indigo-500' :
                        selectedOrder.status === 'validated_financial' ? 'w-4/5 bg-cyan-500' :
                        selectedOrder.status === 'invoice_generated' ? 'w-full bg-green-500' :
                        'w-full bg-green-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Formulaire Spécifique */}
              <div className="space-y-4">
                {/* Étape Secrétariat */}
                {selectedOrder.status === 'pending' && (
                  <div className="space-y-3">
                    <label className="block font-medium text-gray-700">
                      Notes de Validation Secrétariat
                    </label>
                    <textarea
                      className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Ex: Paiement reçu par virement bancaire, justificatifs vérifiés, coordonnées client confirmées..."
                      value={validationNotes}
                      onChange={(e) => setValidationNotes(e.target.value)}
                      rows={4}
                    />
                    <p className="text-xs text-gray-500">
                      Ces notes seront enregistrées dans l'historique de la commande.
                    </p>
                  </div>
                )}

                {/* Étape Audit (après secrétariat) */}
                {selectedOrder.status === 'validated_secretary' && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <FiShield className="text-purple-600 mt-1" />
                      <div>
                        <p className="text-sm text-purple-800 font-medium">
                          Audit Interne - Étape 2/6
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          La commande a été validée par le secrétariat. Vérifiez la conformité et certifiez l'audit.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Étape Finance (après audit) */}
                {selectedOrder.status === 'validated_auditor' && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <FiCreditCard className="text-indigo-600 mt-1" />
                      <div>
                        <p className="text-sm text-indigo-800 font-medium">
                          Autorisation Financière - Étape 3/6
                        </p>
                        <p className="text-xs text-indigo-600 mt-1">
                          La commande est certifiée par l'audit. Cliquez sur "Valider" pour sélectionner un BSP et générer la facture proforma.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Message pour les étapes suivantes */}
                {(selectedOrder.status === 'validated_financial' || selectedOrder.status === 'invoice_generated') && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <FiInfo className="text-blue-600 mt-1" />
                      <div>
                        <p className="text-sm text-blue-800 font-medium">
                          Actions disponibles
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Cette commande est prête pour la génération de facture. Utilisez les boutons ci-dessus pour générer ou re-générer la facture proforma.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Barre de progression COMPLÈTE */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium text-gray-600">
                  <span className={selectedOrder.status === 'pending' ? 'text-blue-600 font-bold' : ''}>
                    1. Secrétariat
                  </span>
                  <span className={selectedOrder.status === 'validated_secretary' ? 'text-purple-600 font-bold' : ''}>
                    2. Audit
                  </span>
                  <span className={selectedOrder.status === 'validated_auditor' ? 'text-indigo-600 font-bold' : ''}>
                    3. Finance
                  </span>
                  <span className={(selectedOrder.status === 'validated_financial' || selectedOrder.status === 'invoice_generated') ? 'text-cyan-600 font-bold' : ''}>
                    4. Facture
                  </span>
                  <span className={selectedOrder.status === 'purchase_completed' ? 'text-green-700 font-bold' : ''}>
                    5. Terminé
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedOrder.status === 'pending' ? 'w-1/5 bg-blue-500' :
                      selectedOrder.status === 'validated_secretary' ? 'w-2/5 bg-purple-500' :
                      selectedOrder.status === 'validated_auditor' ? 'w-3/5 bg-indigo-500' :
                      selectedOrder.status === 'validated_financial' || selectedOrder.status === 'invoice_generated' ? 'w-4/5 bg-cyan-500' :
                      selectedOrder.status === 'purchase_completed' ? 'w-full bg-green-600' :
                      'w-0 bg-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* Section Debug (visible uniquement pour admin en dev) */}
              {user?.role === 'admin' && process.env.NODE_ENV === 'development' && (
                <div className="mt-6 p-4 bg-gray-900 text-gray-300 rounded-xl">
                  <h5 className="font-mono text-sm mb-2">Debug Info</h5>
                  <pre className="text-xs overflow-auto max-h-40">
                    {JSON.stringify({
                      orderId: selectedOrder.id,
                      orderStatus: selectedOrder.status,
                      invoiceStatus,
                      canValidate: canValidate(selectedOrder, user?.role),
                      hasInvoice: !!invoiceStatus,
                      pdfExists: invoiceStatus?.pdf_exists,
                      timestamp: new Date().toISOString()
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Pied de modal */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => {
                  setSelectedOrder(null);
                  setClientStats(null);
                  setOrderDetails(null);
                  setInvoiceStatus(null);
                }}
                variant="outline"
                className="flex-1"
                disabled={isSubmitting}
              >
                Fermer
              </Button>

              {/* Boutons d'action dynamiques */}
              {selectedOrder.status === 'validated_auditor' ? (
                <Button
                  onClick={() => handleValidation(selectedOrder.id)}
                  isLoading={isSubmitting}
                  className="flex-1"
                  variant="primary"
                >
                  💳 Valider Finance + BSP
                </Button>
              ) : selectedOrder.status === 'validated_secretary' ? (
                <Button
                  onClick={() => handleValidation(selectedOrder.id)}
                  isLoading={isSubmitting}
                  className="flex-1"
                  variant="primary"
                >
                  🛡️ Certifier Audit
                </Button>
              ) : selectedOrder.status === 'pending' ? (
                <Button
                  onClick={() => handleValidation(selectedOrder.id)}
                  isLoading={isSubmitting}
                  className="flex-1"
                  variant="primary"
                  disabled={!validationNotes.trim()}
                >
                  ✓ Valider Secrétariat
                </Button>
              ) : (selectedOrder.status === 'validated_financial' || selectedOrder.status === 'invoice_generated') && !invoiceStatus ? (
                <Button
                  onClick={() => handleGenerateInvoiceWithStamp(selectedOrder.id)}
                  isLoading={isSubmitting}
                  className="flex-1"
                  variant="primary"
                >
                  🖨️ Générer Facture
                </Button>
              ) : (
                <Button
                  onClick={() => handleForceGenerateInvoice(selectedOrder.id)}
                  isLoading={isSubmitting}
                  className="flex-1"
                  variant="outline"
                >
                  🔄 Forcer génération
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de validation financière avec BSP */}
      {showBspModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Validation Financière avec BSP</h3>
                  <p className="text-white/80 text-sm">
                    Commande: {selectedOrder.order_code} • Client: {getClientInfo(selectedOrder).companyName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowBspModal(false);
                    setBspData({
                      bsp_id: '',
                      messages_to_purchase: 0,
                      purchase_cost: 0,
                      purpose: 'Achat messages WhatsApp 360dialog',
                      custom_cost: undefined
                    });
                    setCostCalculation(null);
                  }}
                  className="text-white/80 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Résumé de la commande */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold text-dark mb-3">Résumé de la commande</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Quantité commandée:</p>
                    <p className="text-lg font-bold">{selectedOrder.quantity.toLocaleString()} messages</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Montant total:</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(selectedOrder.total_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Sélection du BSP */}
              <div className="space-y-3">
                <label className="block font-medium text-gray-700">
                  Sélectionnez le fournisseur BSP
                </label>
                <Select
                  options={bspProviders.map(bsp => ({
                    value: bsp.id,
                    label: `${bsp.name} - ${formatCurrency(bsp.message_cost)}/message`
                  }))}
                  value={bspData.bsp_id}
                  onChange={(value) => {
                    setBspData(prev => ({ ...prev, bsp_id: value }));
                    calculateBspCost(value);
                  }}
                  placeholder="Choisissez un fournisseur BSP"
                />
                <p className="text-xs text-gray-500">
                  Le BSP sélectionné déterminera le coût d'achat et générera automatiquement la facture proforma.
                </p>
              </div>

              {/* Configuration de l'achat */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de messages à acheter
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={bspData.messages_to_purchase || selectedOrder.quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || selectedOrder.quantity;
                        setBspData(prev => ({ ...prev, messages_to_purchase: value }));
                        setTimeout(() => calculateBspCost(), 500);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coût personnalisé par message (optionnel)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bspData.custom_cost || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseFloat(e.target.value) : undefined;
                        setBspData(prev => ({ ...prev, custom_cost: value }));
                        setTimeout(() => calculateBspCost(), 500);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Laisser vide pour utiliser le tarif BSP"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Libellé du décaissement
                  </label>
                  <input
                    type="text"
                    value={bspData.purpose}
                    onChange={(e) => setBspData(prev => ({ ...prev, purpose: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ex: Achat messages WhatsApp - Commande XYZ"
                  />
                </div>
              </div>

              {/* Simulation des coûts */}
              {costCalculation && (
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 p-4">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <FiBarChart2 /> Simulation des coûts
                  </h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Coût des messages:</span>
                      <span className="font-bold">
                        {formatCurrency(costCalculation.subtotal)}
                        <span className="text-sm text-gray-500 ml-2">
                          ({formatCurrency(costCalculation.message_cost)} × {bspData.messages_to_purchase})
                        </span>
                      </span>
                    </div>

                    {costCalculation.fixed_charges > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Frais fixes:</span>
                        <span className="font-bold text-orange-600">
                          + {formatCurrency(costCalculation.fixed_charges)}
                        </span>
                      </div>
                    )}

                    {costCalculation.percent_charges > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Frais variables ({costCalculation.percent_charges}%):</span>
                        <span className="font-bold text-orange-600">
                          + {formatCurrency(costCalculation.subtotal * (costCalculation.percent_charges / 100))}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-gray-300 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-800">Coût total estimé:</span>
                        <span className="text-xl font-black text-primary">
                          {formatCurrency(costCalculation.total_cost)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">
                          Coût par message: {formatCurrency(costCalculation.cost_per_message)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analyse de marge */}
              {costCalculation && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
                  <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                    <FiTrendingUp /> Analyse de marge
                  </h4>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                      <p className="text-sm text-gray-600">Chiffre d'affaires</p>
                      <p className="text-2xl font-black text-primary">
                        {formatCurrency(selectedOrder.total_amount)}
                      </p>
                    </div>

                    <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                      <p className="text-sm text-gray-600">Coût d'achat</p>
                      <p className="text-2xl font-bold text-cyan-600">
                        {formatCurrency(costCalculation.total_cost)}
                      </p>
                    </div>
                  </div>

                  <div className="text-center p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-green-800">Marge brute estimée:</span>
                      <span className="text-xl font-black text-green-600">
                        {formatCurrency(selectedOrder.total_amount - costCalculation.total_cost)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-green-700">
                        Ratio de marge: {((selectedOrder.total_amount - costCalculation.total_cost) / selectedOrder.total_amount * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions automatiques */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-4">
                <h4 className="font-bold text-blue-800 mb-2">Actions automatiques après validation:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li className="flex items-center gap-2">
                    <FiCheckCircle className="text-green-500" />
                    <span>Génération automatique de la facture proforma</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <FiCheckCircle className="text-green-500" />
                    <span>Transfert vers le module Factures & Décaissements</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <FiCheckCircle className="text-green-500" />
                    <span>Notification au responsable des achats</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Pied de modal */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => {
                  setShowBspModal(false);
                  setBspData({
                    bsp_id: '',
                    messages_to_purchase: 0,
                    purchase_cost: 0,
                    purpose: 'Achat messages WhatsApp 360dialog',
                    custom_cost: undefined
                  });
                  setCostCalculation(null);
                }}
                variant="outline"
                className="flex-1"
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                onClick={handleBspValidation}
                isLoading={isSubmitting || isCalculating}
                className="flex-1"
                variant="primary"
                disabled={!bspData.bsp_id || !bspData.purpose || isCalculating}
              >
                {isCalculating ? 'Calcul en cours...' : '✅ Valider avec BSP et générer facture'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Composant OrdersTable amélioré
function OrdersTable({
  orders,
  isLoading,
  canValidate,
  getActionLabel,
  setSelectedOrder,
  user,
  getClientInfo,
  pagination,
  onPageChange,
  showGenerateButton = false,
}: any) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calcul des données paginées
  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, startIndex + itemsPerPage);

  // Gestion du changement de page
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (onPageChange) onPageChange(page);
  };

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <FiPackage className="text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-400 animate-pulse">
          Chargement des commandes...
        </p>
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="text-center py-20 bg-gradient-to-b from-gray-50 to-white rounded-xl">
        <div className="inline-block p-6 bg-white rounded-full shadow-lg mb-4">
          <FiShoppingCart className="text-5xl text-gray-300" />
        </div>
        <h3 className="text-xl font-bold text-gray-600 mb-2">Aucune commande trouvée</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          {user?.role === 'admin'
            ? "Les commandes apparaîtront ici quand elles seront créées par les clients."
            : "Les commandes nécessitant votre validation apparaîtront ici."}
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Info de filtre */}
      {showGenerateButton && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-yellow-600 text-xl" />
              <div>
                <p className="font-bold text-yellow-800">Factures manquantes détectées</p>
                <p className="text-sm text-yellow-700">
                  Cliquez sur "Générer" pour créer la facture proforma
                </p>
              </div>
            </div>
            <div className="text-sm text-yellow-800 font-bold">
              {orders.length} commande{orders.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="text-left py-4 px-6 text-xs font-black text-gray-600 uppercase tracking-widest">
                Référence
              </th>
              <th className="text-left py-4 px-6 text-xs font-black text-gray-600 uppercase tracking-widest">
                Client
              </th>
              <th className="text-left py-4 px-6 text-xs font-black text-gray-600 uppercase tracking-widest">
                Montant
              </th>
              <th className="text-left py-4 px-6 text-xs font-black text-gray-600 uppercase tracking-widest">
                État
              </th>
              <th className="text-left py-4 px-6 text-xs font-black text-gray-600 uppercase tracking-widest">
                Date
              </th>
              <th className="text-right py-4 px-6 text-xs font-black text-gray-600 uppercase tracking-widest">
                Action
              </th>
            </tr>
          </thead>
         <tbody className="divide-y divide-gray-100">
            {paginatedOrders.map((order: any) => {
              const status = getStatusBadge(order.status);
              const actionInfo = getActionLabel(order, user?.role);
              const canUserValidate = canValidate(order, user?.role);
              const clientInfo = getClientInfo(order);
              const isMissingInvoice = showGenerateButton ||
                ((order.status === 'validated_financial' || order.status === 'invoice_generated') &&
                 !order.invoice_generated);

              return (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-mono font-bold text-dark group-hover:text-primary transition-colors">
                      {order.order_code}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {order.quantity.toLocaleString()} messages
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-semibold text-dark" title={clientInfo.email}>
                      {clientInfo.companyName}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {clientInfo.email}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-lg font-black text-primary">
                      {formatCurrency(order.total_amount)}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status.bgColor.replace('bg-', 'bg-')}`} />
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${status.bgColor} ${status.color}`}>
                        {status.label}
                      </span>

                      {/* Indicateur facture */}
                      {isMissingInvoice && (
                        <div className="relative group/invoice">
                          <FiFileText className="text-yellow-500 hover:text-yellow-600 cursor-pointer" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/invoice:block z-10">
                            <div className="bg-yellow-500 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                              Facture à générer
                            </div>
                          </div>
                        </div>
                      )}

                      {order.invoice_generated && (
                        <div className="relative group/invoice">
                          <FiCheckCircle className="text-green-500 hover:text-green-600 cursor-pointer" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/invoice:block z-10">
                            <div className="bg-green-500 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                              Facture générée
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      {canUserValidate || showGenerateButton ? (
                        <div className="flex gap-2">
                          {showGenerateButton && (
                            <Button
                              onClick={() => {
                                // Simuler la sélection pour génération
                                const orderForGeneration = { ...order };
                                orderForGeneration.forceGenerate = true;
                                setSelectedOrder(orderForGeneration);
                              }}
                              size="sm"
                              className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90"
                            >
                              <FiPrinter />
                              Générer
                            </Button>
                          )}
                          <Button
                            onClick={() => setSelectedOrder(order)}
                            size="sm"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white hover:opacity-90"
                          >
                            {actionInfo.icon}
                            {actionInfo.label.split(' ')[0]}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 px-3 py-1.5 bg-gray-100 rounded-lg">
                          {order.status === 'purchase_completed' ? 'Terminé' : 'En attente'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 rounded-b-xl">
          <div className="text-sm text-gray-700">
            Affichage de <span className="font-medium">{startIndex + 1}</span> à{' '}
            <span className="font-medium">{Math.min(startIndex + itemsPerPage, orders.length)}</span>{' '}
            sur <span className="font-medium">{orders.length}</span> commandes
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Précédent
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  variant={currentPage === pageNum ? "primary" : "outline"}
                  size="sm"
                  className={`min-w-[40px] ${currentPage === pageNum ? 'bg-primary text-white' : ''}`}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
