'use client';

import { useState, useEffect } from 'react';
import {
  FiUsers,
  FiPlus,
  FiTrash2,
  FiSearch,
  FiX,
  FiRefreshCw,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';

interface Client {
  id: string;
  company_name: string;
  email: string;
  phone?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  header_type: string;
  body_content: string;
  status: string;
}

interface Assignment {
  id: string;
  client_id: string;
  template_id: string;
  assigned_at: string;
  assigned_by_name: string;
  assigned_by_email: string;
  is_active: boolean;
  notes?: string;
  client_name?: string;
  client_email?: string;
  template_name?: string;
  template_category?: string;
}

interface StatsData {
  totalClients: number;
  totalTemplates: number;
  topClients: Array<{ id: string; company_name: string; templates_count: number }>;
  topTemplates: Array<{ id: string; name: string; assignments_count: number }>;
}

export default function TemplateAssignmentsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [statsData, setStatsData] = useState<StatsData>({
    totalClients: 0,
    totalTemplates: 0,
    topClients: [],
    topTemplates: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com').replace(/\/api\/v1\/?$/, '');
  const getToken = () => Cookies.get('token') || '';

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const token = getToken();

    try {
      // 1. Clients
      const clientsRes = await fetch(`${API_BASE_URL}/api/v1/admin/clients-simple`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!clientsRes.ok) throw new Error('Erreur clients');
      const clientsData = await clientsRes.json();
      setClients(clientsData.data || []);

      // 2. Templates approuvés
      const templatesRes = await fetch(`${API_BASE_URL}/api/v1/templates?status=approved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!templatesRes.ok) throw new Error('Erreur templates');
      const templatesData = await templatesRes.json();
      setTemplates(templatesData.templates || []);

      // 3. Statistiques
      await fetchAssignmentStats();

      // 4. Assignations paginées
      await fetchAllAssignments(1);
    } catch (err: any) {
      console.error('Erreur chargement initial:', err);
      showNotification('error', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentStats = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/template-assignments/admin/assignments/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur stats');
      const data = await res.json();

      if (data.success && data.data) {
        setStatsData({
          totalClients: data.data.overview?.total_clients_with_templates || 0,
          totalTemplates: data.data.overview?.total_templates_assigned || 0,
          topClients: data.data.top_clients || [],
          topTemplates: data.data.top_templates || [],
        });
      }
    } catch (err) {
      console.error('Erreur stats:', err);
    }
  };

  const fetchAllAssignments = async (page: number = 1) => {
    const token = getToken();
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/template-assignments/admin/assignments?page=${page}&limit=${pagination.limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Erreur assignations');
      const data = await res.json();

      if (data.success) {
        setAssignments(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      }
    } catch (err) {
      console.error('Erreur fetch assignations:', err);
      showNotification('error', 'Impossible de charger les assignations');
    }
  };

  const handleAssignTemplate = async () => {
    if (!selectedClient || !selectedTemplate) {
      showNotification('error', 'Client et template requis');
      return;
    }

    const token = getToken();
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/template-assignments/admin/assign/${selectedClient}/${selectedTemplate}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes: assignmentNotes }),
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Échec assignation');
      }

      showNotification('success', 'Template assigné avec succès');
      setShowAssignModal(false);
      setSelectedClient('');
      setSelectedTemplate('');
      setAssignmentNotes('');
      fetchAllAssignments(pagination.page); // refresh
      fetchAssignmentStats(); // refresh stats
    } catch (err: any) {
      showNotification('error', err.message || 'Erreur lors de l’assignation');
    }
  };

  const handleRemoveAssignment = async (clientId: string, templateId: string) => {
    if (!confirm('Confirmer le retrait de ce template ?')) return;

    const token = getToken();
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/template-assignments/admin/assign/${clientId}/${templateId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Échec retrait');
      }

      showNotification('success', 'Template retiré avec succès');
      fetchAllAssignments(pagination.page);
      fetchAssignmentStats();
    } catch (err: any) {
      showNotification('error', err.message || 'Erreur lors du retrait');
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (filterStatus === 'active' && !a.is_active) return false;
    if (filterStatus === 'inactive' && a.is_active) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        a.client_name?.toLowerCase().includes(term) ||
        a.client_email?.toLowerCase().includes(term) ||
        a.template_name?.toLowerCase().includes(term) ||
        a.notes?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiRefreshCw className="animate-spin h-12 w-12 mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Notification globale */}
      {notification && (
        <div
          className={`p-4 rounded-lg border ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header + bouton assigner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FiUsers className="text-green-600" />
            Assignations de templates
          </h1>
          <p className="text-gray-600 mt-1">Gérez les accès des clients aux templates</p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <FiPlus size={18} />
          Nouvelle assignation
        </button>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-600">Assignations totales</p>
          <p className="text-3xl font-bold mt-1">{assignments.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-600">Clients concernés</p>
          <p className="text-3xl font-bold mt-1">{statsData.totalClients}</p>
        </div>
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-600">Templates utilisés</p>
          <p className="text-3xl font-bold mt-1">{statsData.totalTemplates}</p>
        </div>
      </div>

      {/* Top 5 clients & templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Top 5 clients</h3>
          {statsData.topClients.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {statsData.topClients.map((client) => (
                <div
                  key={client.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium">{client.company_name}</span>
                  <span className="text-green-700 font-semibold">
                    {client.templates_count} templates
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Top 5 templates</h3>
          {statsData.topTemplates.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {statsData.topTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium">{tpl.name}</span>
                  <span className="text-green-700 font-semibold">
                    {tpl.assignments_count} assignations
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher client, template, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Assigné par
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                    Aucune assignation trouvée
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="font-medium text-gray-900">{assignment.client_name}</div>
                        <div className="text-sm text-gray-500">{assignment.client_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="font-medium text-gray-900">{assignment.template_name}</div>
                        <div className="text-sm text-gray-500">{assignment.template_category}</div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-600">
                      {assignment.assigned_by_name || assignment.assigned_by_email}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(assignment.assigned_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          assignment.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {assignment.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-600 max-w-xs truncate">
                      {assignment.notes || '—'}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      {assignment.is_active && (
                        <button
                          onClick={() => handleRemoveAssignment(assignment.client_id, assignment.template_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full transition"
                          title="Retirer cette assignation"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal assignation */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Nouvelle assignation</h2>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Choisir un client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} — {c.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Choisir un template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category} – {t.language})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (facultatif)
                  </label>
                  <textarea
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    rows={3}
                    placeholder="Détails ou contexte de cette assignation..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAssignTemplate}
                    disabled={!selectedClient || !selectedTemplate}
                    className={`px-6 py-2.5 rounded-lg text-white transition ${
                      selectedClient && selectedTemplate
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-green-400 cursor-not-allowed'
                    }`}
                  >
                    Assigner
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
