// /var/www/numericexport/dashboard/app/dashboard/page.tsx

'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { client as clientAPI, messages as messagesAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatCurrency, calculatePercentage } from '@/lib/utils';
import { FiTrendingUp, FiSend, FiCheckCircle, FiXCircle, FiClock, FiBookOpen } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AdminNotificationCenter from '@/components/admin/AdminNotificationCenter';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
const WARNING_BEFORE = 60 * 1000;

// --- Périodes disponibles pour le filtre ---
const PERIODS = [
  { value: '24h', label: '24 heures' },
  { value: '7days', label: '7 jours' },
  { value: '15days', label: '15 jours' },
  { value: '30days', label: '30 jours' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  // --- État pour la période sélectionnée ---
  const [period, setPeriod] = useState('7days');

  useEffect(() => {
    const userCookie = Cookies.get('user');
    console.log('📦 [Dashboard] userCookie:', userCookie);

    if (userCookie) {
      try {
        const user = JSON.parse(userCookie);
        console.log('📦 [Dashboard] user parsed:', user);
        setUserRole(user.role?.toLowerCase() || user.type?.toLowerCase() || '');
      } catch (e) {
        console.error('Erreur parsing user cookie:', e);
      }
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    localStorage.setItem('lastActivity', Date.now().toString());
    setShowInactivityWarning(false);
  }, []);

  useEffect(() => {
    let warningTimer: NodeJS.Timeout;
    let checkInterval: NodeJS.Timeout;

    const checkInactivity = () => {
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0', 10);
      const now = Date.now();
      const inactiveTime = now - lastActivity;

      if (inactiveTime >= INACTIVITY_TIMEOUT - WARNING_BEFORE && inactiveTime < INACTIVITY_TIMEOUT) {
        if (!showInactivityWarning) {
          setShowInactivityWarning(true);
          warningTimer = setTimeout(() => {
            setShowInactivityWarning(false);
          }, WARNING_BEFORE);
        }
      }

      if (inactiveTime >= INACTIVITY_TIMEOUT) {
        Cookies.remove('token');
        Cookies.remove('user');
        localStorage.removeItem('lastActivity');
        router.replace('/login?session=expired');
      }
    };

    checkInterval = setInterval(checkInactivity, 10000);

    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();
    checkInactivity();

    return () => {
      clearInterval(checkInterval);
      clearTimeout(warningTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [router, resetInactivityTimer, showInactivityWarning]);

  // --- Chargement des données selon la période ---
  const loadData = async (selectedPeriod = '7days') => {
    try {
      const [dashboardData, statsData] = await Promise.all([
        clientAPI.getDashboard(),
        messagesAPI.getStats(selectedPeriod as any),
      ]);
      setDashboard(dashboardData.dashboard);

      const statsObj = statsData.stats || {};
      const sent = statsObj.sent || 0;
      const delivered = statsObj.delivered || 0;
      const read = statsObj.read || 0;
      const failed = statsObj.failed || 0;
      const queued = statsObj.queued || 0;
      const total_messages = statsObj.total_messages || 0;

      // --- NOUVELLES FORMULES ---
      // Taux de livraison = delivered / (sent - failed)
      const deliveryDenominator = sent - failed;
      const deliveryRate = deliveryDenominator > 0 ? (delivered / deliveryDenominator) * 100 : 0;

      // Taux de lecture = read / delivered
      const readRate = delivered > 0 ? (read / delivered) * 100 : 0;

      // Taux d'échec (conservé comme avant) = failed / (sent + failed)
      const totalProcessed = sent + failed;
      const failedRate = totalProcessed > 0 ? (failed / totalProcessed) * 100 : 0;
      // ---------------------------------

      const finalStats = {
        total_messages,
        sent,
        delivered,
        read,
        failed,
        queued,
        sent_total: sent,
        // Remplacer l'ancien success_rate par deliveryRate
        success_rate: deliveryRate,
        failed_rate: failedRate,
        // Ajouter le taux de lecture pour l'utiliser dans l'affichage
        read_rate: readRate,
        daily_stats: statsData.daily_stats || [],
      };

      if (!finalStats.daily_stats || finalStats.daily_stats.length === 0) {
        finalStats.daily_stats = [
          { date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), sent: 0, delivered: 0, failed: 0, read: 0, queued: 0 }
        ];
      }

      setStats(finalStats);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      setStats({
        total_messages: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        queued: 0,
        success_rate: 0,
        failed_rate: 0,
        read_rate: 0,
        daily_stats: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Recharger les données quand la période change
  useEffect(() => {
    loadData(period);
  }, [period]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const quotaTotal = dashboard?.client?.quota?.total || 0;
  const quotaRemaining = dashboard?.client?.quota?.remaining || 0;
  const quotaPercentage = quotaTotal > 0 ? (quotaRemaining / quotaTotal * 100) : 0;
  const quotaUsed = quotaTotal - quotaRemaining;
  const quotaUsedPercentage = quotaTotal > 0 ? (quotaUsed / quotaTotal * 100) : 0;

  // Debug
  console.log('📊 [Dashboard] Stats:', stats);
  console.log('👤 [Dashboard] userRole:', userRole);

  // --- Récupérer le libellé de la période active pour l'affichage ---
  const activePeriodLabel = PERIODS.find(p => p.value === period)?.label || '7 jours';

  return (
    <div className="space-y-6 relative">
      {showInactivityWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl border border-gray-200">
            <h3 className="text-2xl font-bold text-red-600 mb-4">Inactivité détectée</h3>
            <p className="text-gray-700 text-lg mb-6 leading-relaxed">
              Pour des raisons de sécurité, vous serez <strong>déconnecté dans 60 secondes</strong>.<br />
              Bougez la souris, cliquez ou appuyez sur une touche pour rester connecté.
            </p>
            <button
              onClick={() => {
                resetInactivityTimer();
                setShowInactivityWarning(false);
              }}
              className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Je suis toujours là !
            </button>
          </div>
        </div>
      )}

      {/* === FILTRES DE PÉRIODE === */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-white">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                period === p.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Carte Quota */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Quota restant</p>
                <h3 className="text-3xl font-bold text-dark">
                  {quotaRemaining.toLocaleString()}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  sur {quotaTotal.toLocaleString()} messages
                </p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                <FiTrendingUp className="text-white" size={28} />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Utilisé: {quotaUsed.toLocaleString()}</span>
                <span>Restant: {quotaRemaining.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${quotaUsedPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-green-600">{quotaPercentage.toFixed(1)}% disponible</span>
                <span className="text-blue-600">{quotaUsedPercentage.toFixed(1)}% utilisé</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte Messages Envoyés */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Messages envoyés</p>
                <h3 className="text-3xl font-bold text-dark">{stats?.sent?.toLocaleString() || 0}</h3>
                <p className="text-xs text-blue-600 mt-1">{activePeriodLabel}</p>
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <FiSend className="text-blue-600" size={28} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte Messages Livrés - affiche le nouveau taux de livraison */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Messages livrés</p>
                <h3 className="text-3xl font-bold text-green-600">{stats?.delivered?.toLocaleString() || 0}</h3>
                <p className="text-xs text-green-600 mt-1">
                  {stats?.success_rate?.toFixed(1) || 0}% de succès
                </p>
              </div>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <FiCheckCircle className="text-green-600" size={28} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte Messages Échoués */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Messages échoués</p>
                <h3 className="text-3xl font-bold text-red-600">{stats?.failed?.toLocaleString() || 0}</h3>
                <p className="text-xs text-red-600 mt-1">
                  {stats?.failed_rate?.toFixed(1) || 0}% d'échec
                </p>
              </div>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <FiXCircle className="text-red-600" size={28} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques supplémentaires (lues et en file d'attente) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Messages lus</p>
                <h3 className="text-3xl font-bold text-purple-600">{stats?.read?.toLocaleString() || 0}</h3>
                {/* Nouveau taux de lecture : read / delivered */}
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.delivered && stats?.delivered > 0
                    ? ((stats?.read || 0) / stats.delivered * 100).toFixed(1)
                    : 0}% des livrés
                </p>
              </div>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <FiBookOpen className="text-purple-600" size={28} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">En file d'attente</p>
                <h3 className="text-3xl font-bold text-orange-600">{stats?.queued?.toLocaleString() || 0}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  En cours de traitement
                </p>
              </div>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <FiClock className="text-orange-600" size={28} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Centre de communication - visible uniquement pour les admins */}
      {userRole === 'admin' && (
        <>
          <div className="bg-green-100 p-2 text-center text-green-800 rounded mb-2">
            🔧 Mode admin détecté - Centre de communication visible
          </div>
          <AdminNotificationCenter />
        </>
      )}

      {/* Graphique d'activité */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activité - {activePeriodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.daily_stats || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Envoyés" />
                  <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Livrés" />
                  <Line type="monotone" dataKey="read" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} name="Lus" />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Échoués" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résumé des statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total messages</span>
                <span className="font-bold text-dark">{stats?.total_messages?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Envoyés</span>
                <span className="font-bold text-blue-600">{stats?.sent?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Livrés</span>
                <span className="font-bold text-green-600">{stats?.delivered?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Lus</span>
                <span className="font-bold text-purple-600">{stats?.read?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Échoués</span>
                <span className="font-bold text-red-600">{stats?.failed?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">En attente</span>
                <span className="font-bold text-orange-600">{stats?.queued?.toLocaleString() || 0}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-3">
              {/* Taux de succès */}
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Taux de succès</span>
                  <span className="font-bold text-green-600">{stats?.success_rate?.toFixed(1) || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(stats?.success_rate || 0, 100)}%` }}
                  />
                </div>
              </div>
              {/* Taux de lecture (ajouté) */}
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Taux de lecture</span>
                  <span className="font-bold text-purple-600">
                    {stats?.delivered && stats?.delivered > 0
                      ? ((stats?.read || 0) / stats.delivered * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(stats?.delivered && stats?.delivered > 0 ? (stats.read / stats.delivered * 100) : 0, 100)}%` }}
                  />
                </div>
              </div>
              {/* Taux d'échec */}
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Taux d'échec</span>
                  <span className="font-bold text-red-600">{stats?.failed_rate?.toFixed(1) || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(stats?.failed_rate || 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informations de compte */}
      <Card>
        <CardHeader>
          <CardTitle>Informations de compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Tarif par message</p>
            <p className="text-xl font-bold text-dark">
              {formatCurrency(dashboard?.client?.pricing?.message_cost || 20)}
            </p>
            {dashboard?.client?.pricing?.is_custom && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                Tarif négocié
              </span>
            )}
          </div>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Période d'essai</p>
            {dashboard?.client?.trial_expires_at ? (
              <p className="text-sm text-orange-600">
                Expire le {new Date(dashboard.client.trial_expires_at).toLocaleDateString('fr-FR')}
              </p>
            ) : (
              <p className="text-sm text-green-600">Compte actif</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Commandes récentes */}
      <Card>
        <CardHeader>
          <CardTitle>Commandes récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard?.recent_orders?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">Code</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">Quantité</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_orders.map((order: any) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-dark">{order.order_code}</td>
                      <td className="py-3 px-4">{order.quantity.toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold">{formatCurrency(order.total_amount)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-600">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">Aucune commande enregistrée</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
