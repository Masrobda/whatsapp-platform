'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiSmartphone,
  FiUser,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiRefreshCw,
  FiSearch,
  FiCheck,
  FiX,
  FiUpload,
  FiCopy,
  FiActivity,
  FiPlay,
  FiPause,
  FiEye,
  FiClock,
  FiBarChart2,
  FiAlertCircle,
  FiDownload,
  FiFilter,
  FiStar,
  FiMessageSquare
} from 'react-icons/fi';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';

// ────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────
interface ClientStats {
  messages_sent_24h: number;
  messages_sent_total: number;
  conversations_active: number;
  conversations_total: number;
  last_message_at?: string;
  last_activity: string;
  quality_rating?: string;
  tier_current?: string;
}

interface Assignment {
  client_id: string;
  client_name: string;
  client_email: string;
  is_primary: boolean;
  assigned_at: string;
  daily_limit?: number;
  notes?: string;
  stats?: ClientStats;
}

interface WhatsAppNumber {
  id: string;
  phone_number: string;
  display_name?: string;
  quality_rating: string;
  tier_current: string;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  messages_sent_24h: number;
  daily_conversation_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notes?: string;
  assignments?: Assignment[];
  primary_client?: {
    client_id: string;
    client_name: string;
    client_email: string;
  };
}

interface Client {
  id: string;
  company_name: string;
  email: string;
}

interface QueueStats {
  total_messages_24h?: number;
  avg_response_time?: number;
  active_conversations?: number;
  error_rate?: number;
}

interface TableRow {
  id: string; // ID unique pour la ligne (number.id + client_id)
  number_id: string;
  phone_number: string;
  display_name?: string;
  client_id: string;
  client_name: string;
  client_email: string;
  is_primary: boolean;
  quality_rating: string;
  tier_current: string;
  messages_sent_24h: number;
  daily_conversation_limit: number;
  is_active: boolean;
  created_at?: string;
  updated_at: string;
  notes?: string;
  assignment_notes?: string;
  is_paused: boolean;
}

// ────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ────────────────────────────────────────────────
export default function WhatsAppManagementPage() {
  // ── États ───────────────────────────────────────
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
const [selectedNumberForAssignment, setSelectedNumberForAssignment] = useState<WhatsAppNumber | null>(null);
const [currentAssignments, setCurrentAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNumberDetails, setSelectedNumberDetails] = useState<WhatsAppNumber | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [pausedQueues, setPausedQueues] = useState<Set<string>>(new Set());
  const [showEditNotesModal, setShowEditNotesModal] = useState(false);
const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
const [editNotesContent, setEditNotesContent] = useState('');
const [showLimitModal, setShowLimitModal] = useState(false);
const [selectedRowForLimit, setSelectedRowForLimit] = useState<TableRow | null>(null);
const [newLimitValue, setNewLimitValue] = useState(1000);

  // Modals
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Formulaires
  const [selectedNumber, setSelectedNumber] = useState<WhatsAppNumber | null>(null);
  const [bulkImportData, setBulkImportData] = useState({ numbers: '', client_id: '' });
  const [reassignData, setReassignData] = useState({ client_id: '' });
  const [newNumberData, setNewNumberData] = useState({
    phone_number: '',
    display_name: '',
    client_id: '',
    notes: '',
    daily_conversation_limit: 1000
  });

  const [filters, setFilters] = useState({
    client_id: '',
    quality_rating: '',
    search: '',
    is_active: '',
    tier_current: '',
    date_from: '',
    date_to: ''
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // ── Config ──────────────────────────────────────
  const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin.replace('dashboard', 'api') : '';

  const getToken = useCallback(() => {
  if (typeof window !== 'undefined') {
    return Cookies.get('token') || '';
  }
  return '';
}, []);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── Chargement des données ──────────────────────
const fetchData = useCallback(async (isRefresh = false) => {
  const token = getToken();
  if (!token) {
    showNotification('error', 'Veuillez vous reconnecter');
    setLoading(false);
    return;
  }

  if (isRefresh) setRefreshing(true);
  else setLoading(true);

  setError(null);

  try {
    // 1. Numéros WhatsApp
     const numbersRes = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers`, {
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});


    if (numbersRes.status === 401) {
      showNotification('error', 'Session expirée → reconnexion requise');
      return;
    }

    if (!numbersRes.ok) {
      throw new Error(`Erreur serveur ${numbersRes.status}`);
    }

    const numbersJson = await numbersRes.json();
    setNumbers(numbersJson.data || numbersJson.numbers || []);
    if (numbersJson.data) {
  for (const num of numbersJson.data) {
    await checkQueueStatus(num.phone_number);
  }
}


    // 2. Clients - Essai d'abord la route admin spécifique
    try {
      // Priorité à la route admin spécifique WhatsApp
      const adminClientsRes = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/clients/list`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (adminClientsRes.ok) {
        const adminClientsData = await adminClientsRes.json();
        setClients(adminClientsData.data || []);
      } else {
        // Fallback vers la route standard
        console.warn('Route admin non disponible, utilisation route standard');
        const clientsRes = await fetch(`${API_BASE_URL}/api/v1/clients`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (clientsRes.ok) {
          const clientsJson = await clientsRes.json();
          setClients(clientsJson.data || clientsJson || []);
        }
      }
    } catch (err) {
      console.error('Erreur chargement clients:', err);
      setClients([]); // Tableau vide par défaut
    }

    // 3. Statistiques de la file d'attente (optionnel)
    try {
  const queueRes = await fetch(`${API_BASE_URL}/api/v1/monitoring/queue-stats`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (queueRes.ok) {
    const queueJson = await queueRes.json();
    // La réponse a une propriété 'stats' d'après votre route
    setQueueStats(queueJson.stats || queueJson);
  }
} catch (queueErr) {
  console.error('[QueueStats] Erreur:', queueErr);
  setQueueStats(null);
}


  } catch (err: any) {
    console.error('[fetchData] Erreur:', err);
    setError(err.message || 'Impossible de charger les données');
    showNotification('error', 'Erreur de chargement');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [getToken, API_BASE_URL]);

  // Chargement initial
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── ACTIONS API ─────────────────────────────────

// Activer/Reprendre la file d'attente
const handleResumeQueue = async (number: WhatsAppNumber) => {
  const token = getToken();
  if (!token) return showNotification('error', 'Veuillez vous reconnecter');

  try {
    const formattedPhone = number.phone_number.startsWith('+')
      ? number.phone_number
      : `+${number.phone_number}`;

    const res = await fetch(`${API_BASE_URL}/api/v1/messages/whatsapp/${encodeURIComponent(formattedPhone)}/resume`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Échec reprise');

    // Mettre à jour l'état local
    setPausedQueues(prev => {
      const newSet = new Set(prev);
      newSet.delete(number.phone_number);
      return newSet;
    });

    showNotification('success', `File d'attente reprise pour ${number.phone_number}`);
  } catch (error: any) {
    showNotification('error', error.message || 'Erreur lors de la reprise');
  }
};

// Mettre en pause la file d'attente
const handlePauseQueue = async (number: WhatsAppNumber) => {
  const token = getToken();
  if (!token) return showNotification('error', 'Veuillez vous reconnecter');

  try {
    const formattedPhone = number.phone_number.startsWith('+')
      ? number.phone_number
      : `+${number.phone_number}`;

    const res = await fetch(`${API_BASE_URL}/api/v1/messages/whatsapp/${encodeURIComponent(formattedPhone)}/pause`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Échec pause');

    // Mettre à jour l'état local
    setPausedQueues(prev => new Set(prev).add(number.phone_number));

    showNotification('success', `File d'attente en pause pour ${number.phone_number}`);
  } catch (error: any) {
    showNotification('error', error.message || 'Erreur lors de la pause');
  }
};

  // Vérifier le statut
  const handleCheckStatus = async (number: WhatsAppNumber) => {
    const token = getToken();
    if (!token) return showNotification('error', 'Veuillez vous reconnecter');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/monitoring/whatsapp/${encodeURIComponent(number.phone_number)}/status`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Échec vérification statut');

      const statusData = await res.json();

      showNotification('info', `Statut ${number.phone_number}: ${statusData.status || 'OK'}`);
      fetchData(true);
    } catch (error) {
      showNotification('error', 'Erreur lors de la vérification du statut');
    }
  };

  // Ajouter un nouveau numéro
  const handleAddNumber = async () => {
  const token = getToken();
  if (!token) return showNotification('error', 'Veuillez vous reconnecter');

  if (!newNumberData.phone_number) {
    return showNotification('error', 'Le numéro est requis');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newNumberData)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Échec ajout');
    }

    showNotification('success', 'Numéro ajouté avec succès');
    setShowAddModal(false);
    setNewNumberData({
      phone_number: '',
      display_name: '',
      client_id: '',
      notes: '',
      daily_conversation_limit: 1000
    });
    fetchData(true);
  } catch (error: any) {
    showNotification('error', error.message || 'Erreur lors de l\'ajout');
  }
};

 const handleToggleStatus = async (number: { id: string; is_active: boolean }) => {

  const token = getToken();
  if (!token) return showNotification('error', 'Veuillez vous reconnecter');

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${number.id}/toggle`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_active: !number.is_active })
    });

    if (!res.ok) throw new Error('Échec modification statut');

    showNotification('success', `Numéro ${!number.is_active ? 'activé' : 'désactivé'} avec succès`);
    fetchData(true);
  } catch (error) {
    showNotification('error', 'Erreur lors du changement de statut');
  }
};

  // Modifier un numéro
  const handleEditNumber = async () => {
    if (!selectedNumber) return;

    const token = getToken();
    if (!token) return showNotification('error', 'Veuillez vous reconnecter');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedNumber.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          display_name: selectedNumber.display_name,
          notes: selectedNumber.notes,
          daily_conversation_limit: selectedNumber.daily_conversation_limit
        })
      });

      if (!res.ok) throw new Error('Échec modification');

      showNotification('success', 'Numéro modifié avec succès');
      setShowEditModal(false);
      setSelectedNumber(null);
      fetchData(true);
    } catch (error) {
      showNotification('error', 'Erreur lors de la modification');
    }
  };

  // Sauvegarder les notes
  const handleSaveNotes = async () => {
    if (!selectedNumberDetails) return;

    const token = getToken();
    if (!token) return showNotification('error', 'Veuillez vous reconnecter');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedNumberDetails.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: notesContent })
      });

      if (!res.ok) throw new Error('Échec sauvegarde notes');

      showNotification('success', 'Notes sauvegardées avec succès');
      setEditingNotes(false);
      setSelectedNumberDetails({ ...selectedNumberDetails, notes: notesContent });
      fetchData(true);
    } catch (error) {
      showNotification('error', 'Erreur lors de la sauvegarde des notes');
    }
  };

  // Import massif
  const handleBulkImport = async () => {
    const token = getToken();
    if (!token) return showNotification('error', 'Veuillez vous reconnecter');

    const phoneNumbers = bulkImportData.numbers
      .split('\n')
      .map(n => n.trim())
      .filter(Boolean);

    if (!phoneNumbers.length) return showNotification('error', 'Aucun numéro valide');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          numbers: phoneNumbers,
          client_id: bulkImportData.client_id || null
        })
      });

      if (!res.ok) throw new Error('Échec import');

      showNotification('success', `${phoneNumbers.length} numéro(s) importé(s) / mis à jour`);
      setShowBulkImport(false);
      setBulkImportData({ numbers: '', client_id: '' });
      fetchData(true);
    } catch {
      showNotification('error', 'Erreur lors de l’import');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    try {
      const headers = ['Numéro', 'Nom', 'Client', 'Qualité', 'Messages 24h', 'Limite', 'Statut', 'Date création'];
      const csvData = filteredNumbers.map(n => [
        n.phone_number,
        n.display_name || '',
        n.client_name || 'Non assigné',
        n.quality_rating || 'UNKNOWN',
        n.messages_sent_24h?.toString() || '0',
        n.daily_conversation_limit?.toString() || '1000',
        n.is_active ? 'Actif' : 'Inactif',
        n.created_at ? format(new Date(n.created_at), 'dd/MM/yyyy') : ''
      ]);

      const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whatsapp_numbers_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export CSV error:', error);
      showNotification('error', 'Erreur lors de l\'export');
    }
  };

  // Réassignation
  const handleReassign = async () => {
    if (!selectedNumber) return;

    const token = getToken();
    if (!token) return showNotification('error', 'Veuillez vous reconnecter');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedNumber.id}/reassign`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ client_id: reassignData.client_id || null })
      });

      if (!res.ok) throw new Error('Échec réassignation');

      showNotification('success', 'Numéro réassigné avec succès');
      setShowReassignModal(false);
      setSelectedNumber(null);
      setReassignData({ client_id: '' });
      fetchData(true);
    } catch {
      showNotification('error', 'Erreur lors de la réassignation');
    }
  };

  // Suppression
  const handleDelete = async (id: string) => {
    if (!confirm('Confirmer la suppression définitive ? Cette action est irréversible.')) return;

    const token = getToken();
    if (!token) return showNotification('error', 'Veuillez vous reconnecter');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Échec suppression');

      showNotification('success', 'Numéro supprimé avec succès');
      fetchData(true);
    } catch {
      showNotification('error', 'Erreur lors de la suppression');
    }
  };

const checkQueueStatus = async (phoneNumber: string) => {
  const token = getToken();
  if (!token) return;

  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const res = await fetch(`${API_BASE_URL}/api/v1/monitoring/whatsapp/${encodeURIComponent(formattedPhone)}/status`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      // Si le statut indique "paused", ajouter à l'état
      if (data.status === 'paused') {
        setPausedQueues(prev => new Set(prev).add(phoneNumber));
      }
    }
  } catch (error) {
    console.error('Erreur vérification statut:', error);
  }
};

// Fonctions pour gérer les assignations
const handleOpenAssignmentModal = async (number: WhatsAppNumber) => {
  setSelectedNumberForAssignment(number);
  
  // Charger les assignations actuelles
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${number.id}/assignments`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      setCurrentAssignments(data.data || []);
    }
  } catch (error) {
    console.error('Erreur chargement assignations:', error);
  }
  
  setShowAssignmentModal(true);
};

// Fonction pour transformer les données en lignes
const prepareTableRows = useCallback((numbers: WhatsAppNumber[]): TableRow[] => {
  const rows: TableRow[] = [];

  numbers.forEach(number => {
    if (number.assignments && number.assignments.length > 0) {
      // Une ligne par client assigné
      number.assignments.forEach(assignment => {
        rows.push({
          id: `${number.id}-${assignment.client_id}`,
          number_id: number.id,
          phone_number: number.phone_number,
          display_name: number.display_name,
          client_id: assignment.client_id,
          client_name: assignment.client_name,
          client_email: assignment.client_email,
          is_primary: assignment.is_primary,
          quality_rating: assignment.stats?.quality_rating || number.quality_rating || 'UNKNOWN',
          tier_current: assignment.stats?.tier_current || number.tier_current || 'TIER_1',
          messages_sent_24h: assignment.stats?.messages_sent_24h || 0,
          daily_conversation_limit: assignment.daily_limit || number.daily_conversation_limit || 1000,
          is_active: number.is_active,
          created_at: number.created_at,
          updated_at: number.updated_at,
          notes: number.notes,
          assignment_notes: assignment.notes,
          is_paused: pausedQueues.has(number.phone_number)
        });
      });
    } else {
      // Ligne pour le client principal ou non assigné
      rows.push({
        id: `${number.id}-${number.client_id || 'unassigned'}`,
        number_id: number.id,
        phone_number: number.phone_number,
        display_name: number.display_name,
        client_id: number.client_id || '',
        client_name: number.client_name || 'Non assigné',
        client_email: number.client_email || '',
        is_primary: true,
        quality_rating: number.quality_rating || 'UNKNOWN',
        tier_current: number.tier_current || 'TIER_1',
        messages_sent_24h: number.messages_sent_24h || 0,
        daily_conversation_limit: number.daily_conversation_limit || 1000,
        is_active: number.is_active,
        created_at: number.created_at,
        updated_at: number.updated_at,
        notes: number.notes,
        is_paused: pausedQueues.has(number.phone_number)
      });
    }
  });

  return rows;
}, [pausedQueues]);

const handleAssignNumber = async (clientId: string, isPrimary: boolean, notes: string) => {
  if (!selectedNumberForAssignment) return;

  const token = getToken();
  if (!token) {
    showNotification('error', 'Veuillez vous reconnecter');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedNumberForAssignment.id}/assign`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ client_id: clientId, is_primary: isPrimary, notes })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Échec assignation");
    }

    // Recharger les assignations
    const updated = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedNumberForAssignment.id}/assignments`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (updated.ok) {
      const data = await updated.json();
      setCurrentAssignments(data.data || []);
    }

    showNotification('success', 'Client assigné avec succès');
    
    // Rafraîchir la liste principale
    fetchData(true);
    
  } catch (error: any) {
    console.error('Erreur assignation:', error);
    showNotification('error', error.message || 'Erreur lors de l\'assignation');
  }
};


const handleRemoveAssignment = async (clientId: string) => {
  if (!selectedNumberForAssignment) return;
  
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedNumberForAssignment.id}/assignments/${clientId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) throw new Error("Échec retrait");
  
  // Mettre à jour la liste
  setCurrentAssignments(prev => prev.filter(a => a.client_id !== clientId));
  fetchData(true);
};

const handleViewClientMessages = (row: TableRow) => {
  // Ouvrir un modal avec l'historique des messages du client
  showNotification('info', `Chargement des messages pour ${row.client_name}...`);
  // Implémentez la logique pour afficher les messages
  // Par exemple, rediriger vers une page de messages avec filtres
  // router.push(`/dashboard/messages?client=${row.client_id}&number=${row.number_id}`);
};

const handleViewClientStats = (row: TableRow) => {
  // Ouvrir un modal avec les statistiques détaillées
  showNotification('info', `Statistiques détaillées pour ${row.client_name}`);
  // Implémentez la logique pour afficher les stats détaillées
};

const handleEditAssignmentNotes = (row: TableRow) => {
  // Ouvrir un modal pour éditer les notes d'assignation
  setSelectedRow(row);
  setEditNotesContent(row.assignment_notes || '');
  setShowEditNotesModal(true);
};

// Fonction pour sauvegarder les notes modifiées
const handleSaveAssignmentNotes = async () => {
  if (!selectedRow || !selectedNumberForAssignment) return;

  const token = getToken();
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedRow.number_id}/assignments/${selectedRow.client_id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes: editNotesContent })
    });

    if (!res.ok) throw new Error('Échec mise à jour');

    showNotification('success', 'Notes mises à jour');
    setShowEditNotesModal(false);
    fetchData(true);
  } catch (error) {
    showNotification('error', 'Erreur lors de la mise à jour');
  }
};


// Fonction pour ouvrir le modal de modification de limite
const handleOpenLimitModal = (row: TableRow) => {
  setSelectedRowForLimit(row);
  setNewLimitValue(row.daily_conversation_limit);
  setShowLimitModal(true);
};

// Fonction pour mettre à jour la limite
const handleUpdateLimit = async () => {
  if (!selectedRowForLimit) return;

  const token = getToken();
  if (!token) {
    showNotification('error', 'Veuillez vous reconnecter');
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/whatsapp/admin/numbers/${selectedRowForLimit.number_id}/assignments/${selectedRowForLimit.client_id}/limit`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ daily_limit: newLimitValue })
      }
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Erreur mise à jour');
    }

    showNotification('success', 'Limite mise à jour avec succès');
    setShowLimitModal(false);
    fetchData(true); // Rafraîchir les données
  } catch (error: any) {
    showNotification('error', error.message || 'Erreur lors de la mise à jour');
  }
};



  // ── Filtrage ─────────────────────────────────────
  const filteredNumbers = numbers.filter(n => {
    try {
      if (filters.client_id && n.client_id !== filters.client_id) return false;
      if (filters.quality_rating && n.quality_rating !== filters.quality_rating) return false;
      if (filters.tier_current && n.tier_current !== filters.tier_current) return false;
      if (filters.is_active !== '' && String(n.is_active) !== filters.is_active) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return (
          (n.phone_number?.toLowerCase() || '').includes(s) ||
          (n.display_name?.toLowerCase() || '').includes(s) ||
          (n.client_name?.toLowerCase() || '').includes(s) ||
          (n.notes?.toLowerCase() || '').includes(s)
        );
      }
      if (filters.date_from && n.created_at && new Date(n.created_at) < new Date(filters.date_from)) return false;
      if (filters.date_to && n.created_at && new Date(n.created_at) > new Date(filters.date_to)) return false;
      return true;
    } catch (error) {
      console.error('Filter error:', error);
      return true;
    }
  });

  const tableRows = prepareTableRows(filteredNumbers);

  // ── Helpers ──────────────────────────────────────
  const getQualityBadgeColor = (rating: string = 'UNKNOWN') => {
    switch (rating?.toUpperCase()) {
      case 'GREEN':
      case 'HIGH':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'YELLOW':
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'RED':
      case 'LOW':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTierBadgeColor = (tier: string = 'TIER_1') => {
    switch (tier) {
      case 'TIER_3':
        return 'bg-purple-100 text-purple-800';
      case 'TIER_2':
        return 'bg-blue-100 text-blue-800';
      case 'TIER_1':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Calcul des statistiques avec valeurs par défaut
  const totalNumbers = numbers?.length || 0;
  const activeNumbers = numbers?.filter(n => n.is_active)?.length || 0;
  const totalMessages24h = tableRows.reduce((sum, row) => sum + (row.messages_sent_24h || 0), 0);
const totalDailyLimit = tableRows.reduce((sum, row) => sum + (row.daily_conversation_limit || 1000), 0);
  const usageRate = totalDailyLimit > 0 ? Math.round((totalMessages24h / totalDailyLimit) * 100) : 0;
  const greenQualityCount = tableRows.filter(row => 
  row.quality_rating === 'GREEN' || row.quality_rating === 'HIGH'
).length;
const tier3Count = tableRows.filter(row => row.tier_current === 'TIER_3').length;
  // ── RENDER ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiRefreshCw className="animate-spin h-12 w-12 mx-auto mb-4 text-green-600" />
          <p className="text-gray-600 font-medium">Chargement des numéros WhatsApp...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-lg border-l-4 shadow-sm ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-500 text-green-800'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-500 text-red-800'
              : 'bg-blue-50 border-blue-500 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' && <FiCheck className="text-green-600" />}
            {notification.type === 'error' && <FiX className="text-red-600" />}
            {notification.type === 'info' && <FiAlertCircle className="text-blue-600" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Erreur globale */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded-lg">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => fetchData()}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium transition"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* En-tête avec stats avancées */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <FiSmartphone className="text-green-600" />
            Gestion WhatsApp
          </h1>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
            >
              <FiPlus size={16} />
              Nouveau numéro
            </button>
            <button
              onClick={() => setShowBulkImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <FiUpload size={16} />
              Import massif
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-sm"
            >
              <FiDownload size={16} />
              Export CSV
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <FiRefreshCw className={`${refreshing ? 'animate-spin' : ''}`} size={16} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Stats avancées - avec valeurs par défaut */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
            <p className="text-sm text-green-700 font-medium">Total numéros</p>
            <p className="text-3xl font-bold text-gray-900">{totalNumbers}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700 font-medium">Numéros actifs</p>
            <p className="text-3xl font-bold text-green-700">
              {activeNumbers}
              <span className="text-sm font-normal text-gray-600 ml-2">
                / {totalNumbers}
              </span>
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
            <p className="text-sm text-purple-700 font-medium">Messages 24h</p>
            <p className="text-3xl font-bold text-purple-700">
              {totalMessages24h.toLocaleString()}
            </p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-100">
            <p className="text-sm text-yellow-700 font-medium">Qualité GREEN</p>
            <p className="text-3xl font-bold text-yellow-700">
              {greenQualityCount}
            </p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700 font-medium">Tier 3</p>
            <p className="text-3xl font-bold text-gray-900">
              {tier3Count}
            </p>
          </div>
        </div>

        {/* Stats file d'attente - avec vérifications */}
        {queueStats && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              <FiBarChart2 className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">Statistiques en temps réel</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600">Messages total 24h</p>
                <p className="text-lg font-semibold">
                  {queueStats.total_messages_24h?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Conversations actives</p>
                <p className="text-lg font-semibold">
                  {queueStats.active_conversations?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Temps réponse moyen</p>
                <p className="text-lg font-semibold">
                  {queueStats.avg_response_time ? `${queueStats.avg_response_time}s` : 'N/A'}
                </p>
              </div>
             <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-lg border border-yellow-100">
  <p className="text-sm text-yellow-700 font-medium">Files en pause</p>
  <p className="text-3xl font-bold text-yellow-700">
    {pausedQueues.size}
  </p>
</div>
            </div>
          </div>
        )}
      </div>

      {/* Filtres améliorés */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
        >
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-600" />
            <span className="font-medium text-gray-900">Filtres avancés</span>
            <span className="text-sm text-gray-600 ml-2">
              ({filteredNumbers?.length || 0} résultats)
            </span>
          </div>
          <span className="text-gray-600">{showFilters ? '−' : '+'}</span>
        </button>

        {showFilters && (
          <div className="p-6 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Client</label>
                <select
                  value={filters.client_id}
                  onChange={e => setFilters({ ...filters, client_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Tous les clients</option>
                  <option value="unassigned">Non assigné</option>
                  {clients?.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Qualité</label>
                <select
                  value={filters.quality_rating}
                  onChange={e => setFilters({ ...filters, quality_rating: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Toutes</option>
                  <option value="GREEN">Verte (Haute)</option>
                  <option value="YELLOW">Jaune (Moyenne)</option>
                  <option value="RED">Rouge (Basse)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Tier</label>
                <select
                  value={filters.tier_current}
                  onChange={e => setFilters({ ...filters, tier_current: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Tous</option>
                  <option value="TIER_1">Tier 1</option>
                  <option value="TIER_2">Tier 2</option>
                  <option value="TIER_3">Tier 3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Statut</label>
                <select
                  value={filters.is_active}
                  onChange={e => setFilters({ ...filters, is_active: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Tous</option>
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Date création (de)</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={e => setFilters({ ...filters, date_from: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Date création (à)</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={e => setFilters({ ...filters, date_to: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-700">Recherche</label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={e => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Numéro, nom, client, notes..."
                    className="w-full pl-10 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4 gap-2">
              <button
                onClick={() => setFilters({
                  client_id: '',
                  quality_rating: '',
                  search: '',
                  is_active: '',
                  tier_current: '',
                  date_from: '',
                  date_to: ''
                })}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tableau principal avec toutes les actions */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FiSmartphone className="text-green-600" />
            Numéros WhatsApp ({filteredNumbers?.length || 0})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                  Numéro / Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                  Qualité / Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                  Messages 24h
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                  Statut
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
  {tableRows.length === 0 ? (
    <tr>
      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
        <div className="flex flex-col items-center gap-2">
          <FiSmartphone className="h-12 w-12 text-gray-400" />
          <p>Aucun numéro ne correspond aux filtres actuels</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 text-green-600 hover:text-green-700 font-medium"
          >
            Ajouter un numéro
          </button>
        </div>
      </td>
    </tr>
  ) : (
    tableRows.map(row => (
      <tr key={row.id} className="hover:bg-gray-50 transition">
        <td className="px-6 py-4">
          {/* Numéro / Contact */}
          <div className="flex flex-col">
            <span className="font-mono font-medium text-gray-900">
              {row.phone_number}
            </span>
            {row.display_name && (
              <span className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                <FiUser size={12} />
                {row.display_name}
              </span>
            )}
            {row.assignment_notes && (
              <span className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                📝 {row.assignment_notes.substring(0, 50)}
                {row.assignment_notes.length > 50 && '...'}
              </span>
            )}
          </div>
        </td>

        <td className="px-6 py-4">
          {/* Client */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-900">
                {row.client_name}
              </span>
              {row.is_primary && (
                <FiStar className="text-yellow-500 fill-current" size={12} />
              )}
            </div>
            <span className="text-xs text-gray-500">
              {row.client_email}
            </span>
          </div>
        </td>

        <td className="px-6 py-4">
          {/* Qualité / Tier */}
          <div className="flex flex-col gap-1">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 w-fit ${getQualityBadgeColor(row.quality_rating)}`}>
              <FiActivity size={10} />
              {row.quality_rating}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 w-fit ${getTierBadgeColor(row.tier_current)}`}>
              <FiBarChart2 size={10} />
              {row.tier_current}
            </span>
          </div>
        </td>

        <td className="px-6 py-4">
          {/* Messages 24h */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {row.messages_sent_24h.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">
                / {row.daily_conversation_limit.toLocaleString()}
              </span>
            </div>
            <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    (row.messages_sent_24h / row.daily_conversation_limit) * 100,
                    100
                  )}%`
                }}
              />
            </div>
          </div>
        </td>

        <td className="px-6 py-4">
          {/* Statut */}
          <div className="flex flex-col gap-1">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 w-fit ${
                row.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {row.is_active ? (
                <>
                  <FiPlay size={10} />
                  Actif
                </>
              ) : (
                <>
                  <FiPause size={10} />
                  Inactif
                </>
              )}
            </span>

            {/* Indicateur de file d'attente */}
            {row.is_paused && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 w-fit bg-yellow-100 text-yellow-800">
                <FiClock size={10} />
                File en pause
              </span>
            )}

            {row.updated_at && (
              <span className="text-xs text-gray-500">
                MAJ: {format(new Date(row.updated_at), 'dd/MM/yy HH:mm', { locale: fr })}
              </span>
            )}
          </div>
        </td>

        <td className="px-6 py-4">
          {/* Actions complètes - version intégrée */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {/* Actions pour la file d'attente */}
            {row.is_paused ? (
              <button
                onClick={() => handleResumeQueue({ 
                  id: row.number_id, 
                  phone_number: row.phone_number 
                } as WhatsAppNumber)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition group relative"
                title="Reprendre la file d'attente"
              >
                <FiPlay size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                  Reprendre
                </span>
              </button>
            ) : (
              <button
                onClick={() => handlePauseQueue({ 
                  id: row.number_id, 
                  phone_number: row.phone_number 
                } as WhatsAppNumber)}
                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition group relative"
                title="Mettre en pause la file d'attente"
              >
                <FiPause size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                  Pause
                </span>
              </button>
            )}

            {/* Activation/Désactivation du numéro */}
            {row.is_active ? (
              <button
                onClick={() => handleToggleStatus({ 
                  id: row.number_id, 
                  is_active: row.is_active 
                })}
                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition group relative"
                title="Désactiver le numéro"
              >
                <FiPause size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                  Désactiver
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleToggleStatus({ 
                  id: row.number_id, 
                  is_active: row.is_active 
                })}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition group relative"
                title="Activer le numéro"
              >
                <FiPlay size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                  Activer
                </span>
              </button>
            )}

            {/* Vérifier statut */}
            <button
              onClick={() => handleCheckStatus({ 
                id: row.number_id, 
                phone_number: row.phone_number 
              } as WhatsAppNumber)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition group relative"
              title="Vérifier le statut"
            >
              <FiEye size={18} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                Statut
              </span>
            </button>

            {/* Gérer les assignations multiples */}
            <button
              onClick={() => handleOpenAssignmentModal({ 
                id: row.number_id, 
                phone_number: row.phone_number 
              } as WhatsAppNumber)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition group relative"
              title="Gérer les assignations"
            >
              <FiUser size={18} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                Assigner
              </span>
            </button>
            {/* Modifier la limite quotidienne du client */}
<button
  onClick={() => handleOpenLimitModal(row)}
  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition group relative"
  title="Modifier la limite quotidienne"
>
  <FiBarChart2 size={18} />
  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
    Limite
  </span>
</button>

            {/* Modifier le numéro */}
            <button
              onClick={() => {
                setSelectedNumber({ 
                  id: row.number_id, 
                  phone_number: row.phone_number,
                  display_name: row.display_name,
                  notes: row.notes,
                  daily_conversation_limit: row.daily_conversation_limit
                } as WhatsAppNumber);
                setShowEditModal(true);
              }}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition group relative"
              title="Modifier le numéro"
            >
              <FiEdit2 size={18} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                Modifier
              </span>
            </button>

            {/* Voir détails du numéro */}
            <button
              onClick={() => {
                setSelectedNumberDetails({ 
                  id: row.number_id, 
                  phone_number: row.phone_number,
                  display_name: row.display_name,
                  client_name: row.client_name,
                  client_email: row.client_email,
                  quality_rating: row.quality_rating,
                  tier_current: row.tier_current,
                  messages_sent_24h: row.messages_sent_24h,
                  daily_conversation_limit: row.daily_conversation_limit,
                  is_active: row.is_active,
                  created_at: row.created_at || '',
                  updated_at: row.updated_at,
                  notes: row.notes
                } as WhatsAppNumber);
                setNotesContent(row.notes || '');
                setShowDetailsModal(true);
              }}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition group relative"
              title="Voir détails"
            >
              <FiEye size={18} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                Détails
              </span>
            </button>

            {/* Copier le numéro */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(row.phone_number || '');
                showNotification('success', 'Numéro copié');
              }}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition group relative"
              title="Copier le numéro"
            >
              <FiCopy size={18} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                Copier
              </span>
            </button>

            {/* Retirer ce client du numéro */}
            <button
              onClick={() => handleRemoveAssignment(row.client_id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition group relative"
              title="Retirer ce client"
            >
              <FiTrash2 size={18} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                Retirer
              </span>
            </button>

            {/* Supprimer le numéro (uniquement si dernier client ou admin) */}
            {(!row.client_id || row.client_id === '') && (
              <button
                onClick={() => handleDelete(row.number_id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition group relative"
                title="Supprimer le numéro"
              >
                <FiTrash2 size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                  Supprimer
                </span>
              </button>
            )}
          </div>
        </td>
      </tr>
    ))
  )}
</tbody>

          </table>
        </div>
      </div>

      {/* ── MODAL AJOUT NUMÉRO ────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Ajouter un numéro WhatsApp</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro WhatsApp *
                  </label>
                  <input
                    type="text"
                    value={newNumberData.phone_number}
                    onChange={e => setNewNumberData({ ...newNumberData, phone_number: e.target.value })}
                    placeholder="+237691234567"
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 font-mono"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Format international recommandé
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom d'affichage
                  </label>
                  <input
                    type="text"
                    value={newNumberData.display_name}
                    onChange={e => setNewNumberData({ ...newNumberData, display_name: e.target.value })}
                    placeholder="Ex: Support client"
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigner à un client
                  </label>
                  <select
                    value={newNumberData.client_id}
                    onChange={e => setNewNumberData({ ...newNumberData, client_id: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Non assigné (libre)</option>
                    {clients?.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limite quotidienne
                  </label>
                  <input
                    type="number"
                    value={newNumberData.daily_conversation_limit}
                    onChange={e => setNewNumberData({ ...newNumberData, daily_conversation_limit: parseInt(e.target.value) || 1000 })}
                    min="1"
                    max="100000"
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={newNumberData.notes}
                    onChange={e => setNewNumberData({ ...newNumberData, notes: e.target.value })}
                    rows={3}
                    placeholder="Informations complémentaires..."
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAddNumber}
                    disabled={!newNumberData.phone_number}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Ajouter le numéro
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MODIFICATION ────────────────────────────── */}
      {showEditModal && selectedNumber && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Modifier le numéro</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedNumber(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-mono font-medium">{selectedNumber.phone_number || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom d'affichage
                  </label>
                  <input
                    type="text"
                    value={selectedNumber.display_name || ''}
                    onChange={e => setSelectedNumber({ ...selectedNumber, display_name: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limite quotidienne
                  </label>
                  <input
                    type="number"
                    value={selectedNumber.daily_conversation_limit || 1000}
                    onChange={e => setSelectedNumber({ ...selectedNumber, daily_conversation_limit: parseInt(e.target.value) || 1000 })}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={selectedNumber.notes || ''}
                    onChange={e => setSelectedNumber({ ...selectedNumber, notes: e.target.value })}
                    rows={4}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedNumber(null);
                    }}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleEditNumber}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DÉTAILS ────────────────────────────── */}
      {showDetailsModal && selectedNumberDetails && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Détails du numéro</h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedNumberDetails(null);
                    setEditingNotes(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Informations générales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase">Numéro</p>
                    <p className="font-mono font-medium text-lg">{selectedNumberDetails.phone_number || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase">Nom d'affichage</p>
                    <p className="font-medium">{selectedNumberDetails.display_name || '—'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase">Client</p>
                    <p className="font-medium">{selectedNumberDetails.client_name || 'Non assigné'}</p>
                    {selectedNumberDetails.client_email && (
                      <p className="text-sm text-gray-600">{selectedNumberDetails.client_email}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase">Date création</p>
                    <p className="font-medium">
                      {selectedNumberDetails.created_at
                        ? format(new Date(selectedNumberDetails.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Métriques */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FiBarChart2 />
                    Métriques
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Qualité</p>
                      <p className={`text-sm font-medium px-2 py-1 rounded-full inline-block mt-1 ${getQualityBadgeColor(selectedNumberDetails.quality_rating)}`}>
                        {selectedNumberDetails.quality_rating || 'UNKNOWN'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tier</p>
                      <p className={`text-sm font-medium px-2 py-1 rounded-full inline-block mt-1 ${getTierBadgeColor(selectedNumberDetails.tier_current)}`}>
                        {selectedNumberDetails.tier_current || 'TIER_1'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Messages 24h</p>
                      <p className="text-lg font-bold">{(selectedNumberDetails.messages_sent_24h || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Limite quotidienne</p>
                      <p className="text-lg font-bold">{(selectedNumberDetails.daily_conversation_limit || 1000).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <FiEdit2 />
                      Notes
                    </h4>
                    {!editingNotes ? (
                      <button
                        onClick={() => setEditingNotes(true)}
                        className="text-sm text-green-600 hover:text-green-700"
                      >
                        Modifier
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNotes}
                          className="text-sm text-green-600 hover:text-green-700"
                        >
                          Sauvegarder
                        </button>
                        <button
                          onClick={() => {
                            setEditingNotes(false);
                            setNotesContent(selectedNumberDetails.notes || '');
                          }}
                          className="text-sm text-gray-600 hover:text-gray-700"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                  {editingNotes ? (
                    <textarea
                      value={notesContent}
                      onChange={e => setNotesContent(e.target.value)}
                      rows={5}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      placeholder="Ajouter des notes..."
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedNumberDetails.notes || 'Aucune note'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL IMPORT MASSIF ──────────────────────────────── */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Import massif de numéros</h3>
                <button
                  onClick={() => setShowBulkImport(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéros (un par ligne)
                  </label>
                  <textarea
                    value={bulkImportData.numbers}
                    onChange={e => setBulkImportData({ ...bulkImportData, numbers: e.target.value })}
                    placeholder="+237690000001&#10;+237690000002&#10;..."
                    rows={10}
                    className="w-full border rounded-lg px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Les numéros existants seront mis à jour automatiquement.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigner à un client (facultatif)
                  </label>
                  <select
                    value={bulkImportData.client_id}
                    onChange={e => setBulkImportData({ ...bulkImportData, client_id: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Laisser non assigné</option>
                    {clients?.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    onClick={() => setShowBulkImport(false)}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={!bulkImportData.numbers.trim()}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Importer {bulkImportData.numbers.split('\n').filter(Boolean).length} numéro(s)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* ── MODAL D'ASSIGNATION MULTIPLE ────────────────────────────── */}
{showAssignmentModal && selectedNumberForAssignment && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">
            Gérer les assignations
          </h3>
          <button 
            onClick={() => setShowAssignmentModal(false)} 
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="font-medium">Numéro : <span className="font-mono">{selectedNumberForAssignment.phone_number}</span></p>
          <p className="text-sm text-gray-600 mt-1">
            {currentAssignments.length} client(s) assigné(s)
          </p>
        </div>

        {/* Liste des assignations actuelles */}
         {/* Liste des assignations actuelles */}
<div className="mb-6">
  <h4 className="font-semibold mb-3">Clients assignés</h4>
  <div className="space-y-2">
    {currentAssignments.length > 0 ? (
      currentAssignments.map((assignment) => (
        <div
          key={assignment.client_id}
          className="border rounded-lg overflow-hidden"
        >
          {/* En-tête client */}
          <div className="flex items-center justify-between p-3 bg-gray-50">
            <div className="flex items-center gap-3">
              {assignment.is_primary && (
                <span className="text-yellow-500" title="Client principal">
                  <FiStar className="fill-current" />
                </span>
              )}
              <FiUser className="text-gray-400" />
              <div>
                <p className="font-medium">{assignment.client_name}</p>
                <p className="text-sm text-gray-500">{assignment.client_email}</p>
              </div>
            </div>
            <button
              onClick={() => handleRemoveAssignment(assignment.client_id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              title="Retirer l'assignation"
            >
              <FiTrash2 size={16} />
            </button>
          </div>

          {/* Statistiques du client */}
          {assignment.stats && (
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Messages 24h</p>
                <p className="font-semibold">{assignment.stats.messages_sent_24h}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total messages</p>
                <p className="font-semibold">{assignment.stats.messages_sent_total}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Conversations actives</p>
                <p className="font-semibold">{assignment.stats.conversations_active}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total conversations</p>
                <p className="font-semibold">{assignment.stats.conversations_total}</p>
              </div>
              {assignment.stats.last_message_at && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Dernier message</p>
                  <p className="text-sm">
                    {format(new Date(assignment.stats.last_message_at), 'dd/MM/yy HH:mm', { locale: fr })}
                  </p>
                </div>
              )}
              {assignment.stats.quality_rating && (
                <div>
                  <p className="text-xs text-gray-500">Qualité</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getQualityBadgeColor(assignment.stats.quality_rating)}`}>
                    {assignment.stats.quality_rating}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {assignment.notes && (
            <div className="p-3 border-t bg-gray-50 text-sm text-gray-600">
              📝 {assignment.notes}
            </div>
          )}
        </div>
      ))
    ) : (
      <p className="text-center text-gray-500 py-4">
        Aucun client assigné pour l'instant
      </p>
    )}
  </div>
</div>


        {/* Nouvelle assignation */}
        {clients.length > 0 && (
          <div className="border-t pt-6">
            <h4 className="font-semibold mb-3">Assigner à un nouveau client</h4>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const clientId = formData.get('client_id') as string;
              const isPrimary = formData.get('is_primary') === 'on';
              const notes = formData.get('notes') as string;
              if (clientId) {
                handleAssignNumber(clientId, isPrimary, notes);
                e.currentTarget.reset();
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <select
                    name="client_id"
                    required
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Sélectionner un client</option>
                    {clients
                      .filter(c => !currentAssignments.some(a => a.client_id === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name} ({c.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_primary"
                    id="isPrimary"
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="isPrimary" className="text-sm">
                    Client principal (défaut pour les envois)
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="Informations complémentaires..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.querySelector('form');
                      if (form) form.reset();
                    }}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Effacer
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <FiPlus size={16} />
                    Assigner
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{/* Modal d'édition des notes d'assignation */}
{showEditNotesModal && selectedRow && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            Modifier les notes pour {selectedRow.client_name}
          </h3>
          <button
            onClick={() => setShowEditNotesModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={editNotesContent}
              onChange={(e) => setEditNotesContent(e.target.value)}
              rows={5}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              placeholder="Notes sur cette assignation..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowEditNotesModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveAssignmentNotes}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

{/* Modal de modification de limite */}
{showLimitModal && selectedRowForLimit && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            Modifier la limite quotidienne
          </h3>
          <button
            onClick={() => setShowLimitModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Client</p>
            <p className="font-medium">{selectedRowForLimit.client_name}</p>
            <p className="text-xs text-gray-500 mt-1">Numéro: {selectedRowForLimit.phone_number}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Limite quotidienne (messages/24h)
            </label>
            <input
              type="number"
              value={newLimitValue}
              onChange={(e) => setNewLimitValue(parseInt(e.target.value) || 0)}
              min="1"
              max="100000"
              className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Actuelle: {selectedRowForLimit.daily_conversation_limit} messages/24h
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowLimitModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleUpdateLimit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Mettre à jour
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {/* ── MODAL RÉASSIGNATION ──────────────────────────────── */}
      {showReassignModal && selectedNumber && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Réassigner le numéro</h3>
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setSelectedNumber(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium">
                    Numéro : <span className="font-mono">{selectedNumber.phone_number || 'N/A'}</span>
                  </p>
                  {selectedNumber.client_name && (
                    <p className="text-sm text-gray-600 mt-1">
                      Client actuel : {selectedNumber.client_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nouveau client
                  </label>
                  <select
                    value={reassignData.client_id}
                    onChange={e => setReassignData({ client_id: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Non assigné (libre)</option>
                    {clients?.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowReassignModal(false);
                      setSelectedNumber(null);
                    }}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReassign}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Réassigner
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
