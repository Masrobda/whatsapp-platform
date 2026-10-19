'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiUpload } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface Mapping {
  id: number;
  license_num: string;
  phone_number: string;
  driver_name: string | null;
  created_at: string;
  updated_at: string;
}

export default function VehicleMappingPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [formData, setFormData] = useState({ license_num: '', phone_number: '', driver_name: '' });
  const [importData, setImportData] = useState('');

  const fetchMappings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/vehicle-mapping', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      } else {
        toast.error('Erreur lors du chargement');
      }
    } catch (err) {
      toast.error('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editing ? `/api/v1/vehicle-mapping/${editing.id}` : '/api/v1/vehicle-mapping';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success(editing ? 'Mapping mis à jour' : 'Mapping ajouté');
        setShowForm(false);
        setEditing(null);
        setFormData({ license_num: '', phone_number: '', driver_name: '' });
        fetchMappings();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Erreur');
      }
    } catch (err) {
      toast.error('Erreur réseau');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce mapping ?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/vehicle-mapping/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Mapping supprimé');
        fetchMappings();
      } else {
        toast.error('Erreur');
      }
    } catch (err) {
      toast.error('Erreur réseau');
    }
  };

  const handleBulkImport = async () => {
    try {
      const rows = importData.split('\n').filter(row => row.trim());
      const mappings = rows.map(row => {
        const [license_num, phone_number, driver_name] = row.split(',').map(s => s.trim());
        return { license_num, phone_number, driver_name };
      });
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/vehicle-mapping/bulk-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mappings })
      });
      if (res.ok) {
        toast.success('Import réussi');
        setImportData('');
        fetchMappings();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Erreur');
      }
    } catch (err) {
      toast.error('Erreur');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestion des véhicules</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditing(null); setFormData({ license_num: '', phone_number: '', driver_name: '' }); setShowForm(!showForm); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <FiPlus /> Ajouter
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Plaque *</label>
              <input
                type="text"
                value={formData.license_num}
                onChange={e => setFormData({ ...formData, license_num: e.target.value.toUpperCase() })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Téléphone *</label>
              <input
                type="text"
                value={formData.phone_number}
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                placeholder="+2376XXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nom du conducteur</label>
              <input
                type="text"
                value={formData.driver_name}
                onChange={e => setFormData({ ...formData, driver_name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Optionnel"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {editing ? 'Mettre à jour' : 'Ajouter'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
        <h3 className="font-semibold text-gray-700 mb-2">Import en masse (CSV)</h3>
        <p className="text-sm text-gray-500 mb-2">Format : plaque,téléphone,nom_conducteur (une ligne par véhicule)</p>
        <textarea
          value={importData}
          onChange={e => setImportData(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          placeholder="LT404NK,+237674855790,Jean\nABC123,+237699999999,Marc"
        />
        <button onClick={handleBulkImport} className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
          <FiUpload /> Importer
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plaque</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conducteur</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Chargement...</td></tr>
            ) : mappings.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Aucun véhicule enregistré</td></tr>
            ) : (
              mappings.map(m => (
                <tr key={m.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{m.license_num}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{m.phone_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{m.driver_name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => { setEditing(m); setFormData({ license_num: m.license_num, phone_number: m.phone_number, driver_name: m.driver_name || '' }); setShowForm(true); }}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <FiEdit2 className="inline" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:text-red-800">
                      <FiTrash2 className="inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
