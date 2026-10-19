'use client';

import { useState, useEffect } from 'react';
import {
  FiMessageSquare,
  FiCopy,
  FiEye,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiFilter,
  FiImage,
  FiVideo,
  FiFile,
  FiRefreshCw
} from 'react-icons/fi';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cookies from 'js-cookie';

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  header_type: string;
  header_content?: string;
  body_content: string;
  footer_content?: string;
  buttons: any[];
  variables: number[];
  assignment_notes?: string;
  assigned_at: string;
}

interface PreviewData {
  header: string;
  body: string;
  footer: string;
  buttons: any[];
}

export default function MyTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<number, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com').replace(/\/api\/v1\/?$/, '');

  const getToken = () => Cookies.get('token') || '';

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Charger les templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const token = getToken();

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/template-assignments/my-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Erreur chargement');

      const data = await res.json();
      setTemplates(data.data || []);
    } catch (error) {
      console.error('Erreur chargement templates:', error);
      showNotification('error', 'Erreur lors du chargement des templates');
    } finally {
      setLoading(false);
    }
  };

  // Initialiser les variables de prévisualisation
  useEffect(() => {
    if (selectedTemplate) {
      const vars: Record<number, string> = {};
      selectedTemplate.variables.forEach(v => {
        vars[v] = `Variable ${v}`;
      });
      setPreviewVariables(vars);
      generatePreview(selectedTemplate, vars);
    }
  }, [selectedTemplate]);

  // Générer la prévisualisation

  const generatePreview = async (template: Template, variables: Record<number, string>) => {
  const token = getToken();

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/templates/client/preview/${template.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ variables })
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Accès non autorisé à ce template');
      }
      throw new Error('Erreur prévisualisation');
    }

    const data = await res.json();
    setPreviewData(data.preview);
  } catch (error) {
    console.error('Erreur prévisualisation:', error);
    
    // ✅ CORRECTION : Vérifier le type de l'erreur
    let errorMessage = 'Erreur lors de la prévisualisation';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    showNotification('error', errorMessage);
  }
};

  // Mettre à jour une variable
  const handleVariableChange = (varIndex: number, value: string) => {
    const newVars = { ...previewVariables, [varIndex]: value };
    setPreviewVariables(newVars);
    if (selectedTemplate) {
      generatePreview(selectedTemplate, newVars);
    }
  };

  // Copier le template (pour utilisation dans l'API)
  const handleCopyTemplate = (template: Template) => {
    const templateData = {
      name: template.name,
      language: template.language,
      components: [
        ...(template.header_content ? [{
          type: 'HEADER',
          format: template.header_type.toUpperCase(),
          text: template.header_content
        }] : []),
        {
          type: 'BODY',
          text: template.body_content
        },
        ...(template.footer_content ? [{
          type: 'FOOTER',
          text: template.footer_content
        }] : []),
        ...template.buttons.map(btn => ({
          type: 'BUTTONS',
          buttons: [btn]
        }))
      ]
    };

    navigator.clipboard.writeText(JSON.stringify(templateData, null, 2));
    showNotification('success', 'Template copié dans le presse-papier');
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

  // Filtrer les templates
  const filteredTemplates = templates.filter(t => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (languageFilter !== 'all' && t.language !== languageFilter) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        t.name.toLowerCase().includes(term) ||
        t.body_content.toLowerCase().includes(term) ||
        t.assignment_notes?.toLowerCase().includes(term)
      );
    }
    
    return true;
  });

  // Extraire les catégories et langues uniques pour les filtres
  const categories = ['all', ...new Set(templates.map(t => t.category))];
  const languages = ['all', ...new Set(templates.map(t => t.language))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiRefreshCw className="animate-spin h-12 w-12 mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Chargement de vos templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.message}
        </div>
      )}

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiMessageSquare className="text-green-600" />
          Mes templates WhatsApp
        </h1>
        <p className="text-gray-600 mt-1">
          Templates disponibles pour vos envois de messages
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-600">Templates disponibles</p>
          <p className="text-3xl font-bold text-gray-900">{templates.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-600">Catégories</p>
          <p className="text-3xl font-bold text-gray-900">
            {new Set(templates.map(t => t.category)).size}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-600">Langues</p>
          <p className="text-3xl font-bold text-gray-900">
            {new Set(templates.map(t => t.language)).size}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un template..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'Toutes catégories' : cat}
              </option>
            ))}
          </select>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>
                {lang === 'all' ? 'Toutes langues' : lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste des templates */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <FiMessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun template disponible</h3>
          <p className="text-gray-500">
            Vous n'avez pas encore de templates assignés à votre compte.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border hover:shadow-lg transition cursor-pointer"
              onClick={() => {
                setSelectedTemplate(template);
                setShowPreview(true);
              }}
            >
              <div className="p-6">
                {/* En-tête */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                        {template.category}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full uppercase">
                        {template.language}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getHeaderIcon(template.header_type)}
                    {template.variables.length > 0 && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                        {template.variables.length} var
                      </span>
                    )}
                  </div>
                </div>

                {/* Aperçu du contenu */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {template.body_content}
                  </p>
                </div>

                {/* Pied */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <FiClock size={12} />
                    <span>Assigné le {format(new Date(template.assigned_at), 'dd/MM/yyyy')}</span>
                  </div>
                  {template.assignment_notes && (
                    <span className="truncate max-w-[150px]" title={template.assignment_notes}>
                      📝 {template.assignment_notes}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de prévisualisation */}
      {showPreview && selectedTemplate && previewData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedTemplate.category} • {selectedTemplate.language.toUpperCase()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyTemplate(selectedTemplate)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Copier le template"
                  >
                    <FiCopy size={20} />
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Simulation WhatsApp */}
              <div className="bg-gray-100 rounded-lg p-6 mb-6">
                {/* Header */}
                {previewData.header && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">En-tête</p>
                    <div className="bg-white rounded-lg p-4">
                      <p className="text-base">{previewData.header}</p>
                    </div>
                  </div>
                )}

                {/* Body */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Corps du message</p>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-base whitespace-pre-wrap">{previewData.body}</p>
                  </div>
                </div>

                {/* Footer */}
                {previewData.footer && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Pied de page</p>
                    <div className="bg-white rounded-lg p-4">
                      <p className="text-sm text-gray-600">{previewData.footer}</p>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                {previewData.buttons && previewData.buttons.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Boutons</p>
                    <div className="space-y-2">
                      {previewData.buttons.map((btn, idx) => (
                        <button
                          key={idx}
                          className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg text-sm text-center hover:bg-gray-50 transition"
                          disabled
                        >
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Variables */}
              {selectedTemplate.variables.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Variables du template</h4>
                  <div className="space-y-3">
                    {selectedTemplate.variables.map((v) => (
                      <div key={v} className="flex items-center gap-3">
                        <span className="text-sm font-mono bg-gray-100 px-3 py-2 rounded-lg min-w-[60px]">
                          {'{{'}{v}{'}}'}
                        </span>
                        <input
                          type="text"
                          value={previewVariables[v] || ''}
                          onChange={(e) => handleVariableChange(v, e.target.value)}
                          placeholder={`Valeur pour la variable ${v}`}
                          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes d'assignation */}
              {selectedTemplate.assignment_notes && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Note :</span> {selectedTemplate.assignment_notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
