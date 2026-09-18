'use client';

import { useState, useEffect } from 'react';
import { FiX, FiUser, FiStar, FiTrash2, FiPlus } from 'react-icons/fi';

interface Client {
  id: string;
  company_name: string;
  email: string;
}

interface Assignment {
  client_id: string;
  client_name: string;
  client_email: string;
  is_primary: boolean;
  assigned_at: string;
  notes?: string;
}

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  numberId: string;
  phoneNumber: string;
  currentAssignments: Assignment[];
  clients: Client[];
  onAssign: (clientId: string, isPrimary: boolean, notes: string) => Promise<void>;
  onRemove: (clientId: string) => Promise<void>;
}

export default function AssignmentModal({
  isOpen,
  onClose,
  numberId,
  phoneNumber,
  currentAssignments,
  clients,
  onAssign,
  onRemove
}: AssignmentModalProps) {
  const [selectedClient, setSelectedClient] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Filtrer les clients déjà assignés
  const availableClients = clients.filter(
    c => !currentAssignments.some(a => a.client_id === c.id)
  );

  const handleAssign = async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      await onAssign(selectedClient, isPrimary, notes);
      setSelectedClient('');
      setIsPrimary(false);
      setNotes('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              Gérer les assignations
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <FiX size={24} />
            </button>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="font-medium">Numéro : <span className="font-mono">{phoneNumber}</span></p>
            <p className="text-sm text-gray-600 mt-1">
              {currentAssignments.length} client(s) assigné(s)
            </p>
          </div>

          {/* Liste des assignations actuelles */}
          <div className="mb-6">
            <h4 className="font-semibold mb-3">Clients assignés</h4>
            <div className="space-y-2">
              {currentAssignments.map((assignment) => (
                <div
                  key={assignment.client_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
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
                      {assignment.notes && (
                        <p className="text-xs text-gray-400 mt-1">📝 {assignment.notes}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(assignment.client_id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Retirer l'assignation"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}

              {currentAssignments.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Aucun client assigné pour l'instant
                </p>
              )}
            </div>
          </div>

          {/* Nouvelle assignation */}
          {availableClients.length > 0 && (
            <div className="border-t pt-6">
              <h4 className="font-semibold mb-3">Assigner à un nouveau client</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Sélectionner un client</option>
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="isPrimary" className="text-sm">
                    Client principal (défaut pour les envois)
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="Informations complémentaires..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setSelectedClient('');
                      setIsPrimary(false);
                      setNotes('');
                    }}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Effacer
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedClient || loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <FiPlus size={16} />
                    Assigner
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
