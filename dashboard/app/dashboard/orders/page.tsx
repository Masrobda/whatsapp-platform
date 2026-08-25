'use client';

import { useEffect, useState } from 'react';
import { orders as ordersAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency, formatDate, getStatusBadge } from '@/lib/utils';
import { FiPlus, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 5, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [quantity, setQuantity] = useState('100');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [pagination.page]);

  const loadOrders = async () => {
    try {
      const response = await ordersAPI.getAll({ page: pagination.page, limit: pagination.limit });
      setOrders(response.orders);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!quantity || parseInt(quantity) < 1) {
      alert('Veuillez entrer une quantité valide');
      return;
    }

    setIsCreating(true);
    try {
      await ordersAPI.create(parseInt(quantity));
      setShowModal(false);
      setQuantity('100');
      loadOrders();
      alert('Commande créée avec succès !');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  const calculateSimulation = () => {
    const qty = parseInt(quantity) || 0;
    const unitPrice = 20; // Prix par défaut
    const subtotal = qty * unitPrice;
    const vatRate = 19.25;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    return { subtotal, vatAmount, total };
  };

  const simulation = calculateSimulation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Mes commandes</h1>
          <p className="text-gray-500 mt-1">Gérez vos commandes de messages</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <FiPlus className="mr-2" />
          Nouvelle commande
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des commandes</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Code</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Quantité</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Prix unitaire</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const statusBadge = getStatusBadge(order.status);
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{order.order_code}</td>
                          <td className="py-3 px-4">{order.quantity.toLocaleString()}</td>
                          <td className="py-3 px-4">{formatCurrency(order.unit_price)}</td>
                          <td className="py-3 px-4 font-bold">{formatCurrency(order.total_amount)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 ${statusBadge.bgColor} ${statusBadge.color} text-xs rounded-full`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {formatDate(order.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.totalPages} ({pagination.total} commandes)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                  >
                    <FiChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    <FiChevronRight />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Aucune commande pour le moment</p>
              <Button onClick={() => setShowModal(true)}>
                <FiPlus className="mr-2" />
                Créer ma première commande
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nouvelle Commande */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-dark mb-4">Nouvelle commande</h2>

            <div className="space-y-4">
              <Input
                type="number"
                label="Quantité de messages"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                placeholder="100"
              />

              {/* Simulation */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-medium text-dark mb-3">Simulation de la commande</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sous-total :</span>
                  <span className="font-medium">{formatCurrency(simulation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">TVA (19.25%) :</span>
                  <span className="font-medium">{formatCurrency(simulation.vatAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-300">
                  <span>Total :</span>
                  <span className="text-primary">{formatCurrency(simulation.total)}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  ℹ️ Votre commande sera validée par notre équipe. Vous recevrez une facture proforma par email.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateOrder}
                isLoading={isCreating}
                className="flex-1"
              >
                Confirmer la commande
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
