// app/dashboard/reconciliation/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Cookies from 'js-cookie';
import { 
    FiPlus, FiUpload, FiCheck, FiX, FiDownload, 
    FiRefreshCw, FiTrendingUp, FiFileText, FiCalendar,
    FiThumbsUp, FiThumbsDown, FiAlertCircle
} from 'react-icons/fi';

interface BSPProvider {
    id: string;
    name: string;
    message_cost: number;
}

interface ReconciliationReport {
    id: string;
    bsp_id: string;
    bsp_name: string;
    period_start: string;
    period_end: string;
    internal_messages_count: number;
    internal_total_cost: number;
    provider_messages_count: number | null;
    provider_invoice_amount: number | null;
    provider_invoice_number: string | null;
    messages_discrepancy: number;
    amount_discrepancy: number;
    status: string;
    notes: string | null;
    generated_at: string;
}

export default function ReconciliationPage() {
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [providers, setProviders] = useState<BSPProvider[]>([]);
    const [statistics, setStatistics] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedReport, setSelectedReport] = useState<ReconciliationReport | null>(null);
    
    const [formData, setFormData] = useState({
        bsp_id: '',
        period_start: '',
        period_end: ''
    });
    
    const [updateForm, setUpdateForm] = useState({
        provider_messages_count: '',
        provider_invoice_amount: '',
        provider_invoice_number: '',
        notes: ''
    });
    const [file, setFile] = useState<File | null>(null);
    
    const [filters, setFilters] = useState({
        status: '',
        bsp_id: ''
    });

    useEffect(() => {
        loadProviders();
        loadReports();
        loadStatistics();
    }, [filters]);

    const loadProviders = async () => {
        try {
            const token = Cookies.get('token');
            const res = await fetch('/api/v1/reconciliation/bsp', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProviders(data.providers || []);
            }
        } catch (err) {
            console.error('Erreur chargement BSP:', err);
        }
    };

    const loadReports = async () => {
        try {
            const token = Cookies.get('token');
            const queryParams = new URLSearchParams();
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.bsp_id) queryParams.append('bsp_id', filters.bsp_id);
            
            const res = await fetch(`/api/v1/reconciliation?${queryParams}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                setReports(data.reports || []);
            }
        } catch (err) {
            console.error('Erreur chargement rapports:', err);
        }
    };

    const loadStatistics = async () => {
        try {
            const token = Cookies.get('token');
            const res = await fetch('/api/v1/reconciliation/statistics', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatistics(data.statistics);
            }
        } catch (err) {
            console.error('Erreur chargement stats:', err);
        }
    };

    const handleGenerate = async () => {
        if (!formData.bsp_id || !formData.period_start || !formData.period_end) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        setLoading(true);
        try {
            const token = Cookies.get('token');
            const res = await fetch('/api/v1/reconciliation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                alert('Rapport généré avec succès');
                loadReports();
                loadStatistics();
                setShowForm(false);
                setFormData({ bsp_id: '', period_start: '', period_end: '' });
            } else {
                const error = await res.json();
                alert(`Erreur: ${error.message}`);
            }
        } catch (err) {
            console.error(err);
            alert('Erreur serveur');
        } finally {
            setLoading(false);
        }
    };

   // app/dashboard/reconciliation/page.tsx
// Remplacez handleUpdate

const handleUpdate = async () => {
    if (!selectedReport) return;

    setLoading(true);
    try {
        const token = Cookies.get('token');
        
        // Préparer les données à envoyer
        const updatePayload: any = {};
        
        if (updateForm.provider_messages_count && updateForm.provider_messages_count !== '') {
            updatePayload.provider_messages_count = parseInt(updateForm.provider_messages_count);
        }
        if (updateForm.provider_invoice_amount && updateForm.provider_invoice_amount !== '') {
            updatePayload.provider_invoice_amount = parseFloat(updateForm.provider_invoice_amount);
        }
        if (updateForm.provider_invoice_number && updateForm.provider_invoice_number !== '') {
            updatePayload.provider_invoice_number = updateForm.provider_invoice_number;
        }
        if (updateForm.notes && updateForm.notes !== '') {
            updatePayload.notes = updateForm.notes;
        }
        
        console.log('Update payload:', updatePayload);
        
        // Si aucun champ rempli
        if (Object.keys(updatePayload).length === 0 && !file) {
            alert('Veuillez remplir au moins un champ');
            setLoading(false);
            return;
        }
        
        // Envoyer en JSON (plus fiable que FormData pour les nombres)
        const res = await fetch(`/api/v1/reconciliation/${selectedReport.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload),
        });

        const result = await res.json();
        console.log('Réponse serveur:', result);

        if (res.ok) {
            alert('Rapport mis à jour avec succès');
            loadReports();
            loadStatistics();
            setSelectedReport(null);
            setUpdateForm({ 
                provider_messages_count: '', 
                provider_invoice_amount: '', 
                provider_invoice_number: '', 
                notes: '' 
            });
            setFile(null);
        } else {
            alert(`Erreur: ${result.message || 'Erreur lors de la mise à jour'}`);
        }
    } catch (err) {
        console.error('Erreur:', err);
        alert('Erreur lors de la mise à jour');
    } finally {
        setLoading(false);
    }
};

  const handleValidate = async (reportId: string, status: string) => {
    const action = status === 'approved' ? 'approuver' : status === 'rejected' ? 'rejeter' : 'clôturer';
    if (!confirm(`Voulez-vous ${action} ce rapport ?`)) return;

    setLoading(true);
    try {
        const token = Cookies.get('token');
        
        console.log('Validation payload:', { status });
        
        const res = await fetch(`/api/v1/reconciliation/${reportId}/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });

        const result = await res.json();
        console.log('Réponse validation:', result);

        if (res.ok) {
            alert(`Rapport ${action} avec succès`);
            loadReports();
            loadStatistics();
        } else {
            alert(`Erreur: ${result.message || 'Erreur lors de la validation'}`);
        }
    } catch (err) {
        console.error('Erreur validation:', err);
        alert('Erreur lors de la validation');
    } finally {
        setLoading(false);
    }
};


    const handleRecalculate = async (reportId: string) => {
        try {
            const token = Cookies.get('token');
            const res = await fetch(`/api/v1/reconciliation/${reportId}/recalculate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                alert('Écarts recalculés');
                loadReports();
            }
        } catch (err) {
            console.error(err);
            alert('Erreur lors du recalcul');
        }
    };

    const handleExport = async (reportId: string) => {
        try {
            const token = Cookies.get('token');
            const res = await fetch(`/api/v1/reconciliation/${reportId}/export`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `reconciliation_${reportId}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Erreur export:', err);
            alert('Erreur lors de l\'export');
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-700',
            pending: 'bg-yellow-100 text-yellow-700',
            approved: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-700',
            closed: 'bg-blue-100 text-blue-700'
        };
        const labels: Record<string, string> = {
            draft: 'Brouillon',
            pending: 'En attente',
            approved: 'Approuvé',
            rejected: 'Rejeté',
            closed: 'Clôturé'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    const formatAmount = (amount: number | null | undefined) => {
        if (amount == null) return '—';
        return Number(amount).toLocaleString('fr-FR') + ' FCFA';
    };

    return (
        <div className="space-y-6 p-6">
            {/* En-tête */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Réconciliation Financière</h1>
                    <p className="text-gray-500 mt-1">Vérifiez vos factures fournisseurs</p>
                </div>
                <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
                    <FiPlus /> Nouveau rapport
                </Button>
            </div>

            {/* Statistiques */}
            {statistics && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Card>
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <FiFileText className="text-2xl text-blue-500" />
                                <span className="text-2xl font-bold">{statistics.total_reports || 0}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">Total rapports</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <FiAlertCircle className="text-2xl text-yellow-500" />
                                <span className="text-2xl font-bold">{statistics.pending_reports || 0}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">En attente</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <FiThumbsUp className="text-2xl text-green-500" />
                                <span className="text-2xl font-bold">{statistics.approved_reports || 0}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">Approuvés</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <FiTrendingUp className="text-2xl text-red-500" />
                                <span className="text-2xl font-bold">{formatAmount(statistics.total_overcharge)}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">Surfacturations</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <FiTrendingUp className="text-2xl text-orange-500" />
                                <span className="text-2xl font-bold">{formatAmount(statistics.total_undercharge)}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">Sous-facturations</p>
                        </div>
                    </Card>
                </div>
            )}

            {/* Filtres */}
            <Card>
                <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="px-3 py-2 border rounded-lg"
                        >
                            <option value="">Tous les statuts</option>
                            <option value="draft">Brouillon</option>
                            <option value="pending">En attente</option>
                            <option value="approved">Approuvé</option>
                            <option value="rejected">Rejeté</option>
                        </select>
                        <select
                            value={filters.bsp_id}
                            onChange={(e) => setFilters({ ...filters, bsp_id: e.target.value })}
                            className="px-3 py-2 border rounded-lg"
                        >
                            <option value="">Tous les BSP</option>
                            {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* Liste des rapports */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold mb-6">Rapports de réconciliation</h2>

                    {reports.length === 0 ? (
                        <p className="text-gray-500 text-center py-12">Aucun rapport. Cliquez sur "Nouveau rapport" pour commencer.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-4 px-4">Période</th>
                                        <th className="text-left py-4 px-4">BSP</th>
                                        <th className="text-left py-4 px-4">Messages</th>
                                        <th className="text-left py-4 px-4">Coût interne</th>
                                        <th className="text-left py-4 px-4">Coût facturé</th>
                                        <th className="text-left py-4 px-4">Écart</th>
                                        <th className="text-left py-4 px-4">Statut</th>
                                        <th className="text-left py-4 px-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-gray-50">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <FiCalendar className="text-gray-400" />
                                                    <span className="text-sm">
                                                        {new Date(report.period_start).toLocaleDateString()} → {new Date(report.period_end).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 font-medium">{report.bsp_name}</td>
                                            <td className="py-4 px-4">{report.internal_messages_count?.toLocaleString()}</td>
                                            <td className="py-4 px-4">{formatAmount(report.internal_total_cost)}</td>
                                            <td className="py-4 px-4">{formatAmount(report.provider_invoice_amount)}</td>
                                            <td className="py-4 px-4">
    {report.amount_discrepancy !== 0 && report.amount_discrepancy !== null ? (
        <span className={report.amount_discrepancy > 0 ? 'text-red-600' : 'text-green-600'}>
            {report.amount_discrepancy > 0 ? '+' : ''}{formatAmount(report.amount_discrepancy)}
        </span>
    ) : report.provider_invoice_amount ? (
        <span className="text-yellow-600">
            À vérifier
        </span>
    ) : (
        <span className="text-gray-400">—</span>
    )}
</td>

                                            <td className="py-4 px-4">{getStatusBadge(report.status)}</td>
                                            <td className="py-4 px-4">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        setSelectedReport(report);
                                                        setUpdateForm({
                                                            provider_messages_count: report.provider_messages_count?.toString() || '',
                                                            provider_invoice_amount: report.provider_invoice_amount?.toString() || '',
                                                            provider_invoice_number: report.provider_invoice_number || '',
                                                            notes: report.notes || ''
                                                        });
                                                        setFile(null);
                                                    }}>
                                                        <FiUpload />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleExport(report.id)}>
                                                        <FiDownload />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleRecalculate(report.id)}>
                                                        <FiRefreshCw />
                                                    </Button>
                                                    {report.status === 'pending' && (
    <>
        <Button 
            size="sm" 
            variant="primary" 
            onClick={() => handleValidate(report.id, 'approved')}
            className="bg-green-600 hover:bg-green-700"
        >
            <FiThumbsUp />
        </Button>
        <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleValidate(report.id, 'rejected')}
            className="border-red-500 text-red-500 hover:bg-red-50"
        >
            <FiThumbsDown />
        </Button>
    </>
)}

                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Card>

            {/* Modal Nouveau Rapport */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">Nouveau rapport</h2>
                                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                                    <FiX size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <select
                                    value={formData.bsp_id}
                                    onChange={(e) => setFormData({ ...formData, bsp_id: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="">Sélectionner un BSP</option>
                                    {providers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.message_cost} FCFA/message)</option>
                                    ))}
                                </select>
                                <Input
                                    type="date"
                                    label="Début période"
                                    value={formData.period_start}
                                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                                />
                                <Input
                                    type="date"
                                    label="Fin période"
                                    value={formData.period_end}
                                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                                />
                                <div className="flex gap-4 pt-4">
                                    <Button onClick={handleGenerate} disabled={loading} className="flex-1">
                                        {loading ? 'Génération...' : 'Générer'}
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                                        Annuler
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal Mise à jour */}
            {selectedReport && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-lg w-full max-h-[90vh] overflow-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">
                                    Mettre à jour - {selectedReport.bsp_name}
                                </h2>
                                <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600">
                                    <FiX size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">Vos métriques internes</p>
                                    <p className="text-2xl font-bold">{selectedReport.internal_messages_count?.toLocaleString()} messages</p>
                                    <p className="text-lg">{formatAmount(selectedReport.internal_total_cost)}</p>
                                </div>

                                <Input
                                    label="Nombre de messages facturés"
                                    type="number"
                                    value={updateForm.provider_messages_count}
                                    onChange={(e) => setUpdateForm({ ...updateForm, provider_messages_count: e.target.value })}
                                    placeholder="Ex: 15000"
                                />

                                <Input
                                    label="Montant facturé (FCFA)"
                                    type="number"
                                    step="0.01"
                                    value={updateForm.provider_invoice_amount}
                                    onChange={(e) => setUpdateForm({ ...updateForm, provider_invoice_amount: e.target.value })}
                                    placeholder="Ex: 75000"
                                />

                                <Input
                                    label="Numéro de facture"
                                    value={updateForm.provider_invoice_number}
                                    onChange={(e) => setUpdateForm({ ...updateForm, provider_invoice_number: e.target.value })}
                                    placeholder="Ex: FACT-2024-001"
                                />

                                <div>
                                    <label className="block text-sm font-medium mb-2">Facture (PDF)</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        className="block w-full text-sm"
                                    />
                                    {file && <p className="mt-2 text-sm text-green-600">✓ {file.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Notes</label>
                                    <textarea
                                        value={updateForm.notes}
                                        onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                                        rows={3}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="Observations..."
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button onClick={handleUpdate} disabled={loading} className="flex-1">
                                        {loading ? 'Sauvegarde...' : 'Sauvegarder'}
                                    </Button>
                                    <Button variant="outline" onClick={() => setSelectedReport(null)} className="flex-1">
                                        Annuler
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
