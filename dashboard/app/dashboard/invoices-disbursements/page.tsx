'use client';

import { useEffect, useState } from 'react';
import { invoiceDisbursements as invoiceDisbursementAPI } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  FiFileText,
  FiDollarSign,
  FiUpload,
  FiCheckCircle,
  FiEye,
  FiRefreshCw,
  FiAlertCircle,
  FiPercent,
  FiTrendingUp,
  FiX,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface InvoiceDisbursementItem {
  id: string;
  invoice_id: string;
  invoice_number: string;
  disbursement_slip_number?: string;
  company_name: string;
  order_code: string;
  total_amount: number;
  bsp_name?: string;
  bsp_id?: string;
  receipt_path?: string;
  disbursement_status?: string;
  status: string;
  invoice_status: string;
  disbursement_id?: string;
  order_id: string;
  disbursement_messages?: number;
  messages_to_purchase?: number;
  disbursement_purpose?: string;
  disbursement_amount?: number;
  disbursement_purchase_cost?: number;
  bsp_unit_cost?: number;
  bsp_charges?: { fixed?: number; percent?: number };
  invoice_created_at?: string;
  disbursement_created_at?: string;
  validated_at?: string;
  receipt_url?: string;
  disbursement_pdf_url?: string;
  selected_bsp_id?: string;
  disbursement_bsp_id?: string;
}

const getStatusBadge = (item: InvoiceDisbursementItem) => {
  if (item.disbursement_status === 'approved') {
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">✅ Validé & Crédité</span>;
  }
  if (item.disbursement_slip_number) {
    return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">⏳ En attente</span>;
  }
  if (item.status === 'invoice_generated') {
    return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full">🧾 Facture générée</span>;
  }
  return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full">{item.status || 'Inconnu'}</span>;
};

const ProfessionalButton = ({ variant, onClick, disabled = false, loading = false, children }: {
  variant: 'view' | 'validate' | 'disbursement' | 'upload' | 'create';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) => {
  const base = "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-sm hover:shadow-md";
  const variants = {
    create: "bg-cyan-600 text-white hover:bg-cyan-700",
    view: "bg-blue-600 text-white hover:bg-blue-700",
    validate: "bg-green-600 text-white hover:bg-green-700",
    disbursement: "bg-purple-600 text-white hover:bg-purple-700",
    upload: "bg-amber-600 text-white hover:bg-amber-700"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${loading ? 'opacity-70 cursor-wait' : ''}`}
    >
      {loading ? 'Génération...' : children}
    </button>
  );
};

const ReceiptPreviewModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
  const isPdf = url.toLowerCase().endsWith('.pdf');
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-4 bg-blue-600 text-white flex justify-between items-center rounded-t-xl">
          <h3 className="text-lg font-bold">Visualisation du document</h3>
          <button onClick={onClose} className="text-2xl">✕</button>
        </div>
        <div className="p-4 flex-1 overflow-auto bg-gray-50">
          {isPdf ? (
            <iframe src={url} className="w-full h-full rounded border" title="Document" />
          ) : (
            <img src={url} alt="Reçu" className="max-w-full mx-auto rounded shadow" />
          )}
        </div>
        <div className="p-4 bg-gray-100 flex justify-end gap-3">
          <Button onClick={() => window.open(url, '_blank')}>Ouvrir</Button>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
};

const BspDetailsModal = ({ item, onClose }: { item: InvoiceDisbursementItem; onClose: () => void }) => {
  const messages = item.disbursement_messages || item.messages_to_purchase || Math.floor(item.total_amount / 1000) || 0;
  const unitCost = item.bsp_unit_cost || 0;
  const subtotal = unitCost * messages;
  const fixed = item.bsp_charges?.fixed || 0;
  const percent = item.bsp_charges?.percent || 0;
  const percentAmount = subtotal * (percent / 100);
  const totalCost = subtotal + fixed + percentAmount;
  const margin = item.total_amount - totalCost;
  const marginPercent = item.total_amount > 0 ? ((margin / item.total_amount) * 100).toFixed(2) : '0.00';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-5 bg-indigo-600 text-white rounded-t-xl flex justify-between items-center">
          <h3 className="text-lg font-bold">Détails BSP & Marge</h3>
          <button onClick={onClose} className="text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">BSP</div>
            <div className="font-medium text-right">{item.bsp_name || '—'}</div>
            <div className="text-gray-600">Coût unitaire message</div>
            <div className="font-medium text-right">{formatCurrency(unitCost)}</div>
            <div className="text-gray-600">Nombre de messages</div>
            <div className="font-medium text-right">{messages}</div>
            <div className="text-gray-600">Sous-total</div>
            <div className="font-medium text-right">{formatCurrency(subtotal)}</div>
            <div className="text-gray-600">Frais fixes</div>
            <div className="font-medium text-right">{formatCurrency(fixed)}</div>
            <div className="text-gray-600">Frais variables ({percent}%)</div>
            <div className="font-medium text-right">{formatCurrency(percentAmount)}</div>
            <div className="border-t pt-2 font-bold text-gray-800">Coût total fournisseur</div>
            <div className="border-t pt-2 font-bold text-indigo-700 text-right">{formatCurrency(totalCost)}</div>
            <div className="font-bold text-gray-800">Montant facturé client</div>
            <div className="font-bold text-right">{formatCurrency(item.total_amount)}</div>
            <div className="border-t pt-3 text-lg font-bold text-green-700">Marge brute</div>
            <div className="border-t pt-3 text-lg font-black text-green-700 text-right">{formatCurrency(margin)}</div>
            <div className="text-gray-600">Taux de marge</div>
            <div className="font-bold text-right">{marginPercent}%</div>
          </div>
        </div>
        <div className="p-5 bg-gray-50 rounded-b-xl flex justify-end">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
};

function DataTable({
  data,
  isLoading,
  setSelectedItem,
  pagination,
  onPageChange,
  setUploadModalOpen,
  handleValidateSupply,
  loadData,
  user
}: {
  data: InvoiceDisbursementItem[];
  isLoading: boolean;
  setSelectedItem: (item: InvoiceDisbursementItem | null) => void;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  onPageChange: (page: number) => void;
  setUploadModalOpen: (open: boolean) => void;
  handleValidateSupply: (id: string) => Promise<void>;
  loadData: () => Promise<void>;
  user: any;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [receiptModal, setReceiptModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' });
  const [bspModalItem, setBspModalItem] = useState<InvoiceDisbursementItem | null>(null);
  const [ficheModal, setFicheModal] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const pageData = data.slice(start, start + itemsPerPage);

  const handleViewReceipt = (item: InvoiceDisbursementItem) => {
    const url = item.receipt_url || `https://api.numericexport.com/api/v1/invoice-disbursements/media/receipts/${item.receipt_path?.split('/').pop() || ''}`;
    setReceiptModal({ open: true, url });
  };

  const handleGenerateSlip = async (item: InvoiceDisbursementItem) => {
    if (!confirm(`Générer la fiche de décaissement pour ${item.invoice_number} ?`)) return;
    setGeneratingFor(item.id);
    try {
      const bspUuid = item.bsp_id || (item as any).disbursement_bsp_id || (item as any).selected_bsp_id;
      if (!bspUuid) {
        throw new Error(`Aucun ID BSP valide trouvé pour "${item.bsp_name || 'ce BSP'}".`);
      }
      const payload = {
        bsp_id: bspUuid,
        messages_to_purchase: item.messages_to_purchase || item.disbursement_messages || Math.floor(item.total_amount / 1000) || 0,
        purpose: item.disbursement_purpose || `Décaissement ${item.invoice_number} - ${item.order_code || 'N/A'}`,
        purchase_cost: item.disbursement_purchase_cost || 0,
        notes: "Généré manuellement depuis le module Factures & Décaissements"
      };
      const res = await invoiceDisbursementAPI.generateDisbursementSlip(item.order_id, payload);
      const responseData = res.data;
      if (responseData.success || responseData.disbursement_slip_number) {
        alert(`Fiche créée avec succès !\nNuméro : ${responseData.disbursement_slip_number || 'généré'}`);
        await loadData();
      } else {
        alert("Réponse inattendue du serveur");
      }
    } catch (err: any) {
      alert(err.message || err.response?.data?.message || "Erreur lors de la génération de la fiche");
    } finally {
      setGeneratingFor(null);
    }
  };

  if (isLoading) return <div className="text-center py-20 text-gray-500">Chargement...</div>;

  if (!data.length) return (
    <div className="text-center py-20 text-gray-600">
      <FiAlertCircle className="mx-auto text-6xl mb-4 text-gray-300" />
      <p className="text-xl font-medium">Aucune donnée disponible</p>
      <p className="mt-2">Essayez un autre filtre ou créez une nouvelle commande.</p>
    </div>
  );

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-max">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">Facture</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">Décaissement</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">Client</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">Montant</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">Messages</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">BSP</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">Statut</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map(item => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="font-bold">{item.invoice_number}</div>
                  <div className="text-xs text-gray-500">
                    {item.invoice_created_at ? formatDate(item.invoice_created_at) : '—'}
                  </div>
                </td>
                <td className="py-3 px-4">{item.disbursement_slip_number || '—'}</td>
                <td className="py-3 px-4">{item.company_name}</td>
                <td className="py-3 px-4 font-bold text-indigo-700">
                  {formatCurrency(item.total_amount)}
                </td>
                <td className="py-3 px-4 text-center font-medium">
                  {item.disbursement_messages || Math.floor(item.total_amount / 1000) || '—'}
                </td>
                <td className="py-3 px-4">{item.bsp_name || '—'}</td>
                <td className="py-3 px-4">{getStatusBadge(item)}</td>
                <td className="py-3 px-4 flex flex-wrap gap-2 justify-end">
                  {item.bsp_name && (
                    <ProfessionalButton variant="view" onClick={() => setBspModalItem(item)}>
                      <FiPercent className="mr-1" /> BSP + Marge
                    </ProfessionalButton>
                  )}
                  {item.disbursement_slip_number && (
                    <ProfessionalButton
                      variant="disbursement"
                      onClick={() => setFicheModal(item.disbursement_slip_number!)}
                    >
                      <FiFileText className="mr-1" /> Fiche
                    </ProfessionalButton>
                  )}
                  {item.receipt_path && (
                    <ProfessionalButton variant="view" onClick={() => handleViewReceipt(item)}>
                      <FiEye className="mr-1" /> Reçu
                    </ProfessionalButton>
                  )}
                  {item.disbursement_slip_number && item.disbursement_status !== 'approved' && (
                    <ProfessionalButton
                      variant="validate"
                      onClick={() => handleValidateSupply(item.disbursement_id!)}
                    >
                      <FiCheckCircle className="mr-1" /> Valider & Créditer
                    </ProfessionalButton>
                  )}
                  {!item.disbursement_slip_number && item.status === 'invoice_generated' && (
                    <ProfessionalButton
                      variant="create"
                      onClick={() => handleGenerateSlip(item)}
                      loading={generatingFor === item.id}
                      disabled={generatingFor === item.id}
                    >
                      <FiPlus className="mr-1" /> Générer fiche
                    </ProfessionalButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receiptModal.open && (
        <ReceiptPreviewModal url={receiptModal.url} onClose={() => setReceiptModal({ open: false, url: '' })} />
      )}

      {bspModalItem && (
        <BspDetailsModal item={bspModalItem} onClose={() => setBspModalItem(null)} />
      )}

      {ficheModal && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
      {/* En-tête */}
      <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold">FICHE DE DÉCAISSEMENT</h3>
          <p className="text-indigo-100 font-mono mt-1">{ficheModal}</p>
        </div>
        <button
          onClick={() => setFicheModal(null)}
          className="text-white hover:text-red-200 text-3xl font-bold leading-none"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* Contenu résumé */}
      <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
        {/* On affiche les infos qu'on a déjà dans l'item correspondant */}
        {(() => {
          // Trouve l'item correspondant au numéro de fiche
          const item = data.find(i => i.disbursement_slip_number === ficheModal);
          if (!item) {
            return (
              <div className="text-center py-12 text-gray-500">
                <FiAlertCircle className="mx-auto text-6xl mb-4" />
                <p>Impossible de retrouver les détails de cette fiche.</p>
              </div>
            );
          }

          return (
            <div className="space-y-8">
              {/* Section 1 - Infos générales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <h4 className="text-lg font-semibold text-indigo-700 mb-3">Commande</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Référence</dt>
                      <dd className="font-medium">{item.order_code || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Montant facturé</dt>
                      <dd className="font-bold text-indigo-700">{formatCurrency(item.total_amount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Messages estimés</dt>
                      <dd className="font-medium">{Math.floor(item.total_amount / 1000) || '—'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <h4 className="text-lg font-semibold text-indigo-700 mb-3">Décaissement</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">BSP</dt>
                      <dd className="font-medium">{item.bsp_name || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Messages à acheter</dt>
                      <dd className="font-medium">{item.disbursement_messages || item.messages_to_purchase || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Coût estimé</dt>
                      <dd className="font-medium">{formatCurrency(item.disbursement_purchase_cost || 0)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* But du décaissement */}
              {item.disbursement_purpose && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <h4 className="text-lg font-semibold text-indigo-700 mb-3">But du décaissement</h4>
                  <p className="text-gray-700 whitespace-pre-line">{item.disbursement_purpose}</p>
                </div>
              )}

              {/* Statut */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-center">
                <div className="inline-block px-6 py-3 bg-yellow-100 text-yellow-800 rounded-full font-medium text-lg">
                  En attente de validation
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  Créée le {formatDate(new Date().toISOString())}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Pied de page avec bouton PDF */}
      <div className="px-6 py-5 border-t bg-gray-50 flex justify-between items-center flex-wrap gap-4">
        <p className="text-sm text-gray-600">
          Pour consulter la version officielle signée et détaillée
        </p>
        <div className="flex gap-4">
          <a
            href={`https://api.numericexport.com/api/v1/invoice-disbursements/media/disbursements/${encodeURIComponent(ficheModal)}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center gap-2 shadow-md"
          >
            <FiFileText size={18} /> Voir la fiche complète (PDF)
          </a>
          <button
            onClick={() => setFicheModal(null)}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 px-2">
          <Button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            <FiChevronLeft className="mr-1" /> Précédent
          </Button>
          <span className="text-sm">
            Page {currentPage} sur {totalPages}
          </span>
          <Button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Suivant <FiChevronRight className="ml-1" />
          </Button>
        </div>
      )}
    </>
  );
}

export default function InvoicesDisbursementsPage() {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<InvoiceDisbursementItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InvoiceDisbursementItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) setUser(JSON.parse(userCookie));
    loadData();
  }, [filter, pagination.page]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await invoiceDisbursementAPI.getAll({
        filter,
        page: pagination.page,
        limit: pagination.limit
      });
      const apiData = res.data;
      const transformedData: InvoiceDisbursementItem[] = (apiData?.data || []).map((item: any) => {
        const amount = Number(
          item.invoice_amount ||
          item.total_amount ||
          item.order_total_amount ||
          item.disbursement_amount ||
          0
        );
        return {
          id: item.invoice_id || item.order_id || `item-${Math.random().toString(36).slice(2)}`,
          invoice_id: item.invoice_id,
          invoice_number: item.invoice_number || `INV-${item.order_code || 'N/A'}`,
          disbursement_slip_number: item.disbursement_slip_number,
          company_name: item.company_name || 'Client inconnu',
          order_code: item.order_code || 'N/A',
          total_amount: amount,
          bsp_name: item.bsp_name,
          bsp_id: item.bsp_id_real || item.disbursement_bsp_id || item.selected_bsp_id || undefined,
          receipt_path: item.receipt_path,
          receipt_url: item.receipt_url,
          disbursement_status: item.disbursement_status,
          status: item.order_status || item.invoice_status || 'invoice_generated',
          invoice_status: item.invoice_status,
          disbursement_id: item.disbursement_id,
          order_id: item.order_id,
          disbursement_messages: Number(item.disbursement_messages || item.messages_to_purchase || 0),
          messages_to_purchase: Number(item.messages_to_purchase || 0),
          disbursement_purpose: item.disbursement_purpose,
          disbursement_amount: Number(item.disbursement_amount || 0),
          disbursement_purchase_cost: Number(item.disbursement_purchase_cost || 0),
          bsp_unit_cost: Number(item.bsp_unit_cost || 0),
          bsp_charges: item.bsp_charges || { fixed: 0, percent: 0 },
          invoice_created_at: item.invoice_created_at,
          disbursement_created_at: item.disbursement_created_at,
          validated_at: item.validated_at
        };
      });
      setData(transformedData);
      if (apiData?.pagination) {
        setPagination(p => ({
          ...p,
          total: apiData.pagination.total || transformedData.length,
          totalPages: apiData.pagination.totalPages || 1
        }));
      }
    } catch (e) {
      console.error('Erreur chargement:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateSupply = async (disbursementId: string) => {
    if (!window.confirm('Valider et créditer immédiatement ?')) return;
    try {
      await invoiceDisbursementAPI.validateSupply(disbursementId, {});
      alert('Validé et crédité !');
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erreur lors de la validation');
    }
  };

  const tabs = [
    { id: 'all', label: '📋 Tous', content: <DataTable data={data} isLoading={isLoading} setSelectedItem={setSelectedItem} pagination={pagination} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} setUploadModalOpen={setUploadModalOpen} handleValidateSupply={handleValidateSupply} loadData={loadData} user={user} /> },
    { id: 'pending', label: '⏳ En attente', content: <DataTable data={data.filter(i => !i.disbursement_slip_number || i.disbursement_status === 'pending')} isLoading={isLoading} setSelectedItem={setSelectedItem} pagination={pagination} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} setUploadModalOpen={setUploadModalOpen} handleValidateSupply={handleValidateSupply} loadData={loadData} user={user} /> },
    { id: 'with_receipts', label: '🧾 Avec reçus', content: <DataTable data={data.filter(i => i.receipt_path)} isLoading={isLoading} setSelectedItem={setSelectedItem} pagination={pagination} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} setUploadModalOpen={setUploadModalOpen} handleValidateSupply={handleValidateSupply} loadData={loadData} user={user} /> },
    { id: 'validated', label: '✅ Validés', content: <DataTable data={data.filter(i => i.disbursement_status === 'approved')} isLoading={isLoading} setSelectedItem={setSelectedItem} pagination={pagination} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} setUploadModalOpen={setUploadModalOpen} handleValidateSupply={handleValidateSupply} loadData={loadData} user={user} /> }
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Factures & Décaissements</h1>
      <Tabs tabs={tabs} defaultTab="all" onTabChange={setFilter} />
      {uploadModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Uploader reçu</h2>
            <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="mb-4 w-full" />
            <div className="flex justify-end gap-4">
              <Button onClick={() => setUploadModalOpen(false)}>Annuler</Button>
              <Button
                disabled={!uploadFile || uploading}
                onClick={async () => {
                  setUploading(true);
                  try {
                    await invoiceDisbursementAPI.uploadReceipt(selectedItem.disbursement_id!, uploadFile!);
                    alert('Reçu uploadé');
                    setUploadModalOpen(false);
                    loadData();
                  } catch {
                    alert('Erreur upload');
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                {uploading ? 'En cours...' : 'Uploader'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
