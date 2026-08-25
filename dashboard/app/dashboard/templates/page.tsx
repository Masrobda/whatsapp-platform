'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Cookies from 'js-cookie';
import {
  FiSend,
  FiRefreshCw,
  FiPlus,
  FiEye,
  FiCopy,
  FiEdit,
  FiTrash2,
  FiMessageSquare,
  FiImage,
  FiVideo,
  FiFile,
  FiCheckCircle, 
  FiXCircle
} from 'react-icons/fi';

interface Template {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  header_type: string;
  header_content: string;
  body_content: string;
  footer_content: string;
  buttons: any[];
  variables: number[];
  wa_template_id: string;
  created_at: string;
  created_by_name: string;
}

interface FormData {
  name: string;
  language: string;
  category: string;
  header_type: string;
  header_content: string;
  body_content: string;
  footer_content: string;
  buttons: any[];
  status: string;
}

interface PreviewData {
  header: string;
  body: string;
  footer: string;
  buttons: any[];
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<number, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    language: 'fr',
    category: 'UTILITY',
    header_type: 'none',
    header_content: '',
    body_content: '',
    footer_content: '',
    buttons: [],
    status: 'draft'
  });

  // Charger les templates au montage
  useEffect(() => {
    loadTemplates();
  }, []);

  // Mettre à jour les variables de prévisualisation quand le template change
  useEffect(() => {
    if (previewTemplate) {
      const vars: Record<number, string> = {};
      previewTemplate.variables.forEach(v => {
        vars[v] = `Variable ${v}`;
      });
      setPreviewVariables(vars);
    }
  }, [previewTemplate]);

  // Charger les templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const token = Cookies.get('token');
      const res = await fetch('/api/v1/templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Erreur chargement templates');
      }
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors du chargement des templates');
    } finally {
      setLoading(false);
    }
  };

  // Créer un template - VERSION MODIFIÉE
  const handleCreate = async () => {
    const bodyTrimmed = formData.body_content?.trim() || '';
    
    // MODIFICATION: Avertissement mais pas de blocage
    if (!bodyTrimmed) {
      if (!confirm('Le corps du message est vide. Voulez-vous vraiment créer un template avec un contenu vide ?')) {
        return;
      }
    }

    const payload = {
      ...formData,
      body_content: bodyTrimmed
    };

    console.log('PAYLOAD ENVOYÉ (création) :', JSON.stringify(payload, null, 2));
    
    try {
      const token = Cookies.get('token');
      const res = await fetch('/api/v1/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Statut réponse création :', res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Erreur serveur complète :', errorData);
        throw new Error(errorData.message || 'Erreur création template');
      }

      await loadTemplates();
      setShowCreateForm(false);
      resetForm();
      alert('Template créé avec succès');
    } catch (error: unknown) {
      console.error('Erreur complète création :', error);
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      alert(msg || 'Erreur lors de la création');
    }
  };

  // Mettre à jour un template - VERSION MODIFIÉE
  const handleUpdate = async () => {
    if (!editingTemplate) return;

    const bodyTrimmed = formData.body_content?.trim() || '';
    
    // MODIFICATION: Avertissement mais pas de blocage
    if (!bodyTrimmed) {
      if (!confirm('Le corps du message est vide. Voulez-vous vraiment mettre à jour avec un contenu vide ?')) {
        return;
      }
    }

    const payload = {
      ...formData,
      body_content: bodyTrimmed
    };

    console.log('PAYLOAD ENVOYÉ (mise à jour) :', JSON.stringify(payload, null, 2));
    
    try {
      const token = Cookies.get('token');
      const res = await fetch(`/api/v1/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Statut réponse mise à jour :', res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Erreur serveur complète :', errorData);
        throw new Error(errorData.message || 'Erreur mise à jour');
      }

      await loadTemplates();
      setEditingTemplate(null);
      resetForm();
      alert('Template mis à jour avec succès');
    } catch (error: unknown) {
      console.error('Erreur complète mise à jour :', error);
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      alert(msg || 'Erreur lors de la mise à jour');
    }
  };

  // Soumettre à Meta
  const handleSubmitToMeta = async (id: string) => {
    if (!confirm('Envoyer ce template à Meta pour validation ?')) return;
    try {
      const token = Cookies.get('token');
      const res = await fetch(`/api/v1/templates/${id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erreur soumission');
      }
      await loadTemplates();
      alert('Template soumis avec succès à Meta');
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors de la soumission');
    }
  };

  // Rafraîchir statut
  const handleRefreshStatus = async (id: string) => {
    try {
      const token = Cookies.get('token');
      const res = await fetch(`/api/v1/templates/${id}/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erreur rafraîchissement');
      }
      await loadTemplates();
      alert('Statut du template mis à jour');
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors du rafraîchissement');
    }
  };

// Approuver manuellement un template
const handleManualApprove = async (id: string) => {
  const reason = prompt('Raison de l\'approbation (optionnel):');
  if (!confirm('Approuver ce template manuellement ?')) return;
  
  try {
    const token = Cookies.get('token');
    const res = await fetch(`/api/v1/templates/${id}/manual-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'approved',
        reason: reason || 'Approuvé manuellement'
      })
    });

    if (!res.ok) throw new Error('Erreur mise à jour statut');
    
    await loadTemplates();
    alert('Template approuvé avec succès');
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur lors de l\'approbation');
  }
};

// Rejeter manuellement un template
const handleManualReject = async (id: string) => {
  const reason = prompt('Raison du rejet (obligatoire):');
  if (!reason) {
    alert('La raison du rejet est obligatoire');
    return;
  }
  
  if (!confirm('Rejeter ce template manuellement ?')) return;
  
  try {
    const token = Cookies.get('token');
    const res = await fetch(`/api/v1/templates/${id}/manual-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'rejected',
        reason: reason
      })
    });

    if (!res.ok) throw new Error('Erreur mise à jour statut');
    
    await loadTemplates();
    alert('Template rejeté avec succès');
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur lors du rejet');
  }
};

  // Dupliquer template
  const handleDuplicate = async (id: string) => {
    try {
      const token = Cookies.get('token');
      const res = await fetch(`/api/v1/templates/${id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erreur duplication');
      }
      await loadTemplates();
      alert('Template dupliqué avec succès');
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors de la duplication');
    }
  };

  // Supprimer template
  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) return;
    try {
      const token = Cookies.get('token');
      const res = await fetch(`/api/v1/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erreur suppression');
      }
      await loadTemplates();
      alert('Template supprimé avec succès');
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors de la suppression');
    }
  };

  // Prévisualiser template
  const handlePreview = async (template: Template) => {
    setPreviewTemplate(template);
    try {
      const token = Cookies.get('token');
      const res = await fetch(`/api/v1/templates/${template.id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ variables: previewVariables })
      });
      if (!res.ok) {
        throw new Error('Erreur prévisualisation');
      }
      const data = await res.json();
      setPreviewData(data.preview);
      setShowPreview(true);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la prévisualisation');
    }
  };

  // Éditer template
  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      language: template.language,
      category: template.category,
      header_type: template.header_type,
      header_content: template.header_content || '',
      body_content: template.body_content,
      footer_content: template.footer_content || '',
      buttons: template.buttons || [],
      status: template.status
    });
  };

  // Réinitialiser formulaire
  const resetForm = () => {
    setFormData({
      name: '',
      language: 'fr',
      category: 'UTILITY',
      header_type: 'none',
      header_content: '',
      body_content: '',
      footer_content: '',
      buttons: [],
      status: 'draft'
    });
  };

  // Obtenir la classe de couleur pour le statut
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-gray-100 text-gray-700',
      'pending': 'bg-yellow-100 text-yellow-700',
      'approved': 'bg-green-100 text-green-700',
      'rejected': 'bg-red-100 text-red-700'
    };
    return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  // Obtenir l'icône du type d'en-tête
  const getHeaderIcon = (type: string) => {
    switch(type) {
      case 'image': return <FiImage className="text-blue-500" />;
      case 'video': return <FiVideo className="text-purple-500" />;
      case 'document': return <FiFile className="text-orange-500" />;
      default: return <FiMessageSquare className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-dark">Templates WhatsApp</h1>
          <p className="text-gray-600 mt-1">Gérez vos templates de messages avec variables dynamiques</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="flex items-center">
          <FiPlus className="mr-2" />
          Nouveau template
        </Button>
      </div>

      {/* Formulaire de création/édition */}
      {(showCreateForm || editingTemplate) && (
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingTemplate ? 'Modifier le template' : 'Créer un template'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Input
                label="Nom du template"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="ex: bienvenue_client"
                helper="Uniquement lettres, chiffres et underscores"
              />
              <div>
                <label className="block text-sm font-medium mb-2">Langue</label>
                <select
                  value={formData.language}
                  onChange={e => setFormData({...formData, language: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                  <option value="es">Espagnol</option>
                  <option value="pt">Portugais</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Catégorie</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="UTILITY">Utilitaire</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Authentification</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Type d'en-tête</label>
                <select
                  value={formData.header_type}
                  onChange={e => setFormData({...formData, header_type: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="none">Aucun</option>
                  <option value="text">Texte</option>
                  <option value="image">Image</option>
                  <option value="video">Vidéo</option>
                  <option value="document">Document</option>
                </select>
              </div>
            </div>

            {formData.header_type === 'text' && (
              <div className="mb-6">
                <Input
                  label="Contenu de l'en-tête"
                  value={formData.header_content}
                  onChange={e => setFormData({...formData, header_content: e.target.value})}
                  placeholder="Texte de l'en-tête (utilisez {{1}}, {{2}} pour les variables)"
                  helper="Les variables doivent correspondre à celles du corps du message"
                />
              </div>
            )}

            {['image', 'video', 'document'].includes(formData.header_type) && (
              <div className="mb-6">
                <Input
                  label="URL du média"
                  value={formData.header_content}
                  onChange={e => setFormData({...formData, header_content: e.target.value})}
                  placeholder={`URL de l'${formData.header_type}`}
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Corps du message
                <span className="text-xs text-gray-500 ml-2">
                  Utilisez {'{{1}}'}, {'{{2}}'} pour les variables
                </span>
              </label>
              <textarea
                value={formData.body_content}
                onChange={e => setFormData({...formData, body_content: e.target.value})}
                rows={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono"
                placeholder="Bonjour {{1}}, votre commande #{{2}} est prête. Montant: {{3}} FCFA"
              />
              {/* Aperçu des variables détectées */}
              {formData.body_content && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Variables détectées:</span>{' '}
                  {Array.from(new Set(formData.body_content.match(/{{\d+}}/g) || [])).map(v => (
                    <span key={v} className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs mr-1">
                      {v}
                    </span>
                  ))}
                </div>
              )}
              {/* Message d'avertissement si vide */}
              {!formData.body_content?.trim() && (
                <p className="mt-2 text-sm text-orange-600">
                  ⚠️ Corps du message vide - un message par défaut sera utilisé
                </p>
              )}
            </div>

            <div className="mb-6">
              <Input
                label="Pied de page (optionnel)"
                value={formData.footer_content}
                onChange={e => setFormData({...formData, footer_content: e.target.value})}
                placeholder="Texte du pied de page"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={editingTemplate ? handleUpdate : handleCreate}
                className="flex items-center"
              >
                {editingTemplate ? 'Mettre à jour' : 'Créer le template'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Liste des templates */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Templates existants</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-gray-600">Chargement...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FiMessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-600">Aucun template pour le moment</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateForm(true)}
              >
                Créer votre premier template
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Nom</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Statut</th>
                    <th className="text-left py-3 px-4">Catégorie</th>
                    <th className="text-left py-3 px-4">Langue</th>
                    <th className="text-left py-3 px-4">Créé par</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-medium">{template.name}</div>
                        {template.variables && template.variables.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {template.variables.length} variable(s)
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getHeaderIcon(template.header_type)}
                          <span className="text-sm">{template.header_type}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}>
                          {template.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm">{template.category}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm uppercase">{template.language}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm">{template.created_by_name || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreview(template)}
                            className="flex items-center p-2"
                            title="Prévisualiser"
                          >
                            <FiEye size={16} />
                          </Button>
                          {template.status === 'draft' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(template)}
                                className="flex items-center p-2"
                                title="Modifier"
                              >
                                <FiEdit size={16} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSubmitToMeta(template.id)}
                                className="flex items-center p-2 text-blue-600"
                                title="Soumettre à Meta"
                              >
                                <FiSend size={16} />
                              </Button>
                            </>
                          )}
                          {template.wa_template_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRefreshStatus(template.id)}
                              className="flex items-center p-2"
                              title="Rafraîchir statut"
                            >
                              <FiRefreshCw size={16} />
                            </Button>
                          )}
                           {template.status === 'pending' && (
  <>
    <Button
      size="sm"
      variant="ghost"
      onClick={() => handleManualApprove(template.id)}
      className="flex items-center p-2 text-green-600"
      title="Approuver manuellement"
    >
      <FiCheckCircle size={16} />
    </Button>
    <Button
      size="sm"
      variant="ghost"
      onClick={() => handleManualReject(template.id)}
      className="flex items-center p-2 text-red-600"
      title="Rejeter manuellement"
    >
      <FiXCircle size={16} />
    </Button>
  </>
)}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicate(template.id)}
                            className="flex items-center p-2"
                            title="Dupliquer"
                          >
                            <FiCopy size={16} />
                          </Button>
                          {template.status !== 'approved' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(template.id)}
                              className="flex items-center p-2 text-red-600"
                              title="Supprimer"
                            >
                              <FiTrash2 size={16} />
                            </Button>
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

      {/* Modal de prévisualisation */}
      {showPreview && previewData && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Prévisualisation</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Simulation WhatsApp */}
              <div className="bg-gray-100 rounded-lg p-4">
                {/* Header */}
                {previewData.header && (
                  <div className="mb-3 p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600 font-medium">En-tête</p>
                    <p className="text-base">{previewData.header}</p>
                  </div>
                )}

                {/* Body */}
                <div className="mb-3 p-3 bg-white rounded-lg">
                  <p className="text-base whitespace-pre-wrap">{previewData.body}</p>
                </div>

                {/* Footer */}
                {previewData.footer && (
                  <div className="mb-3 p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">{previewData.footer}</p>
                  </div>
                )}

                {/* Buttons */}
                {previewData.buttons && previewData.buttons.length > 0 && (
                  <div className="space-y-2">
                    {previewData.buttons.map((btn, idx) => (
                      <button
                        key={idx}
                        className="w-full py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm text-center hover:bg-gray-50"
                        disabled
                      >
                        {btn.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Variables */}
              {previewTemplate.variables.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Variables</h4>
                  <div className="space-y-2">
                    {previewTemplate.variables.map((v) => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {'{{'}{v}{'}}'}
                        </span>
                        <input
                          type="text"
                          value={previewVariables[v] || ''}
                          onChange={(e) => {
                            const newVars = {...previewVariables, [v]: e.target.value};
                            setPreviewVariables(newVars);
                            handlePreview(previewTemplate);
                          }}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                          placeholder={`Valeur pour ${v}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
