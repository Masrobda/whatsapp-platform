// app/dashboard/documentation/api-integration/page.tsx
'use client';

import { useState } from 'react';
import {
  FiCode,
  FiCopy,
  FiCheck,
  FiKey,
  FiHardDrive,
  FiUpload,
  FiDownload,
  FiTrash2,
  FiInfo,
  FiShield,
  FiClock,
  FiUsers,
  FiLock,
  FiUnlock
} from 'react-icons/fi';

export default function ApiIntegrationDoc() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CodeBlock = ({ code, id }: { code: string, id: string }) => (
    <div className="relative bg-gray-900 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto">
      <pre className="text-sm">{code}</pre>
      <button
        onClick={() => copyToClipboard(code, id)}
        className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        title="Copier"
      >
        {copied === id ? (
          <FiCheck className="h-4 w-4 text-green-400" />
        ) : (
          <FiCopy className="h-4 w-4 text-gray-400" />
        )}
      </button>
    </div>
  );

  const sections = [
    {
      id: 'intro',
      title: 'Introduction',
      icon: <FiInfo className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Bienvenue sur l'API de stockage de NUMERICEXPORT. Cette API vous permet d'intégrer facilement
            notre solution de stockage cloud dans vos applications. Tous les paiements se font par virement
            bancaire avec validation manuelle par notre équipe financière.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Points importants</h4>
            <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
              <li>Tous les montants sont en FCFA (XOF)</li>
              <li>Les commandes sont validées manuellement après réception du virement</li>
              <li>Une facture HTML est générée automatiquement à la validation</li>
              <li>En cas d'expiration, les données sont conservées 7 jours</li>
              <li>L'administrateur a tous les droits de gestion</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'auth',
      title: 'Authentification',
      icon: <FiKey className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Tous les appels API nécessitent un token JWT dans l'en-tête Authorization.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-mono text-sm text-gray-800 mb-2">Authorization: Bearer &lt;VOTRE_TOKEN&gt;</p>
          </div>
          
          <h4 className="font-medium text-gray-900 mt-4">Obtenir un token</h4>
          <CodeBlock
            id="auth-code"
            code={`curl -X POST "https://api.numericexport.com/api/v1/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "client@entreprise.com",
    "password": "votre-mot-de-passe"
  }'`}
          />
        </div>
      )
    },
    {
      id: 'endpoints',
      title: 'Endpoints disponibles',
      icon: <FiHardDrive className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <p className="text-gray-700">
            Voici les endpoints que vous pouvez utiliser pour intégrer notre service de stockage.
          </p>

          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Méthode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-blue-600">GET</td>
                <td className="px-4 py-3 text-sm font-mono">/storage/subscription</td>
                <td className="px-4 py-3 text-sm">Récupérer votre abonnement actuel</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-blue-600">GET</td>
                <td className="px-4 py-3 text-sm font-mono">/storage/client/storage/{'{spaceId}'}</td>
                <td className="px-4 py-3 text-sm">Détails de l'espace (quota, utilisation)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-green-600">POST</td>
                <td className="px-4 py-3 text-sm font-mono">/storage/client/storage/{'{spaceId}'}/upload</td>
                <td className="px-4 py-3 text-sm">Uploader un fichier (multipart/form-data)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-blue-600">GET</td>
                <td className="px-4 py-3 text-sm font-mono">/storage/client/storage/{'{spaceId}'}/files/{'{filename}'}</td>
                <td className="px-4 py-3 text-sm">Télécharger un fichier</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-red-600">DELETE</td>
                <td className="px-4 py-3 text-sm font-mono">/storage/client/storage/{'{spaceId}'}/files/{'{filename}'}</td>
                <td className="px-4 py-3 text-sm">Supprimer un fichier</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-green-600">POST</td>
                <td className="px-4 py-3 text-sm font-mono">/storage/order</td>
                <td className="px-4 py-3 text-sm">Créer une commande (en attente de validation)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-green-600">POST</td>
                <td className="px-4 py-3 text-sm font-mono">/storage/order/renew</td>
                <td className="px-4 py-3 text-sm">Renouvellement automatique (facture générée)</td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    },
    {
      id: 'examples',
      title: 'Exemples d\'utilisation',
      icon: <FiCode className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <h4 className="font-medium text-gray-900">1. Vérifier l'état de son espace</h4>
          <CodeBlock
            id="example-status"
            code={`curl -X GET "https://api.numericexport.com/api/v1/storage/client/storage/5843a985-..." \\
  -H "Authorization: Bearer VOTRE_TOKEN"`}
          />

          <h4 className="font-medium text-gray-900 mt-4">2. Uploader un fichier</h4>
          <CodeBlock
            id="example-upload"
            code={`curl -X POST "https://api.numericexport.com/api/v1/storage/client/storage/5843a985.../upload" \\
  -H "Authorization: Bearer VOTRE_TOKEN" \\
  -F "file=@/chemin/vers/mon-fichier.pdf"`}
          />

          <h4 className="font-medium text-gray-900 mt-4">3. Télécharger un fichier</h4>
          <CodeBlock
            id="example-download"
            code={`curl -X GET "https://api.numericexport.com/api/v1/storage/client/storage/5843a985.../files/mon-fichier.pdf" \\
  -H "Authorization: Bearer VOTRE_TOKEN" \\
  --output "fichier_telecharge.pdf"`}
          />

          <h4 className="font-medium text-gray-900 mt-4">4. Créer une commande</h4>
          <CodeBlock
            id="example-order"
            code={`curl -X POST "https://api.numericexport.com/api/v1/storage/order" \\
  -H "Authorization: Bearer VOTRE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "offer_id": "pro",
    "period_type": "year",
    "months": 12
  }'`}
          />

          <h4 className="font-medium text-gray-900 mt-4">5. Renouvellement automatique</h4>
          <CodeBlock
            id="example-renew"
            code={`curl -X POST "https://api.numericexport.com/api/v1/storage/order/renew" \\
  -H "Authorization: Bearer VOTRE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "offer_id": "pro",
    "months": 12
  }'`}
          />
        </div>
      )
    },
    {
      id: 'admin',
      title: 'Endpoints Administration',
      icon: <FiUsers className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Ces endpoints sont réservés aux administrateurs pour la gestion des espaces.
          </p>

          <h4 className="font-medium text-gray-900 mt-4">Modifier le quota (taille en Go)</h4>
          <CodeBlock
            id="admin-size"
            code={`curl -X PUT "https://api.numericexport.com/api/v1/admin/storage/ID_DU_SPACE/size" \\
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN" \\
  -H "Content-Type: application/json" \\
  -d '{"size_gb": 50}'`}
          />

          <h4 className="font-medium text-gray-900 mt-4">Modifier la date d'expiration</h4>
          <CodeBlock
            id="admin-expiration"
            code={`curl -X PUT "https://api.numericexport.com/api/v1/admin/storage/ID_DU_SPACE/expiration" \\
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN" \\
  -H "Content-Type: application/json" \\
  -d '{"expires_at": "2026-12-31"}'`}
          />

          <h4 className="font-medium text-gray-900 mt-4">Bloquer/Activer un espace</h4>
          <CodeBlock
            id="admin-block"
            code={`# Bloquer
curl -X POST "https://api.numericexport.com/api/v1/admin/storage/ID_DU_SPACE/block" \\
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN"

# Activer
curl -X POST "https://api.numericexport.com/api/v1/admin/storage/ID_DU_SPACE/activate" \\
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN"`}
          />

          <h4 className="font-medium text-gray-900 mt-4">Renouveler un abonnement (admin)</h4>
          <CodeBlock
            id="admin-renew"
            code={`curl -X POST "https://api.numericexport.com/api/v1/admin/storage/ID_DU_SPACE/renew" \\
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN" \\
  -H "Content-Type: application/json" \\
  -d '{"months": 12, "auto_generate_invoice": true}'`}
          />

          <h4 className="font-medium text-gray-900 mt-4">Réassigner à un autre client</h4>
          <CodeBlock
            id="admin-reassign"
            code={`curl -X POST "https://api.numericexport.com/api/v1/admin/storage/ID_DU_SPACE/reassign" \\
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN" \\
  -H "Content-Type: application/json" \\
  -d '{"clientId": "ID_DU_NOUVEAU_CLIENT"}'`}
          />
        </div>
      )
    },
    {
      id: 'errors',
      title: 'Gestion des erreurs',
      icon: <FiShield className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            L'API retourne des codes HTTP standards et des messages d'erreur explicites.
          </p>

          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signification</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">200</td>
                <td className="px-4 py-3 text-sm">Succès</td>
                <td className="px-4 py-3 text-sm">Traitement réussi</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">400</td>
                <td className="px-4 py-3 text-sm">Requête invalide</td>
                <td className="px-4 py-3 text-sm">Vérifiez les paramètres</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">401</td>
                <td className="px-4 py-3 text-sm">Non authentifié</td>
                <td className="px-4 py-3 text-sm">Token manquant ou invalide</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">403</td>
                <td className="px-4 py-3 text-sm">Accès refusé</td>
                <td className="px-4 py-3 text-sm">Vérifiez le statut de l'espace</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">404</td>
                <td className="px-4 py-3 text-sm">Ressource non trouvée</td>
                <td className="px-4 py-3 text-sm">ID de l'espace ou fichier invalide</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">429</td>
                <td className="px-4 py-3 text-sm">Trop de requêtes</td>
                <td className="px-4 py-3 text-sm">Attendez avant de réessayer</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">500</td>
                <td className="px-4 py-3 text-sm">Erreur serveur</td>
                <td className="px-4 py-3 text-sm">Contactez le support</td>
              </tr>
            </tbody>
          </table>

          <h4 className="font-medium text-gray-900 mt-4">Exemple d'erreur (espace expiré)</h4>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <pre className="text-sm text-red-800">
{`{
  "success": false,
  "message": "Abonnement expiré. Veuillez renouveler votre abonnement.",
  "code": "EXPIRED"
}`}
            </pre>
          </div>

          <h4 className="font-medium text-gray-900 mt-4">Exemple d'erreur (espace bloqué)</h4>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <pre className="text-sm text-red-800">
{`{
  "success": false,
  "message": "Espace bloqué par l'administration. Contactez le support.",
  "code": "BLOCKED"
}`}
            </pre>
          </div>

          <h4 className="font-medium text-gray-900 mt-4">Exemple d'erreur (espace plein)</h4>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <pre className="text-sm text-yellow-800">
{`{
  "success": false,
  "message": "Espace disque saturé. Libérez de l'espace ou augmentez votre quota.",
  "code": "FULL",
  "used": "45.2 GB",
  "limit": "50 GB"
}`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 'workflow',
      title: 'Workflow de commande',
      icon: <FiClock className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Voici le processus complet pour souscrire à un abonnement :
          </p>

          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            
            <div className="relative pl-12 pb-8">
              <div className="absolute left-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">1</div>
              <h4 className="font-medium text-gray-900 mb-2">Choix de l'offre</h4>
              <p className="text-gray-600">Le client sélectionne une offre sur l'interface ou via l'API.</p>
            </div>

            <div className="relative pl-12 pb-8">
              <div className="absolute left-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">2</div>
              <h4 className="font-medium text-gray-900 mb-2">Création de la commande</h4>
              <p className="text-gray-600">Une commande est créée avec le statut "pending".</p>
            </div>

            <div className="relative pl-12 pb-8">
              <div className="absolute left-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold">3</div>
              <h4 className="font-medium text-gray-900 mb-2">Paiement par virement</h4>
              <p className="text-gray-600">Le client effectue le virement bancaire selon les instructions de la facture.</p>
            </div>

            <div className="relative pl-12 pb-8">
              <div className="absolute left-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">4</div>
              <h4 className="font-medium text-gray-900 mb-2">Validation par l'admin</h4>
              <p className="text-gray-600">Le responsable financier ou l'admin valide la commande après réception du virement.</p>
            </div>

            <div className="relative pl-12 pb-8">
              <div className="absolute left-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">5</div>
              <h4 className="font-medium text-gray-900 mb-2">Génération de la facture</h4>
              <p className="text-gray-600">Une facture HTML est générée automatiquement.</p>
            </div>

            <div className="relative pl-12">
              <div className="absolute left-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">6</div>
              <h4 className="font-medium text-gray-900 mb-2">Activation de l'espace</h4>
              <p className="text-gray-600">L'espace de stockage est activé avec le quota choisi.</p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-green-800 mb-2">Cas particulier : Renouvellement</h4>
            <p className="text-green-700">
              Lors du renouvellement, la validation est automatique et la facture est générée immédiatement.
              On considère que le client est déjà connu et que le paiement est implicite.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'security',
      title: 'Sécurité',
      icon: <FiLock className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>🔐 Toutes les communications sont chiffrées en TLS 1.3</li>
            <li>🔑 Authentification par JWT avec expiration toutes les 24h</li>
            <li>📁 Fichiers stockés avec chiffrement AES-256 au repos</li>
            <li>👤 Isolation stricte entre les espaces clients</li>
            <li>📊 Journalisation de toutes les actions</li>
            <li>⏱️ Rate limiting : 100 requêtes par minute par IP</li>
            <li>🛡️ Protection contre les attaques DDoS et injection</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Documentation d'intégration API
        </h1>
        <p className="text-gray-600">
          Guide complet pour intégrer notre solution de stockage cloud dans votre application
        </p>
        <div className="mt-4 p-4 bg-[var(--primary-green)]/10 border border-[var(--primary-green)] rounded-lg">
          <p className="text-sm text-[var(--primary-green-dark)]">
            <strong>Base URL :</strong> https://api.numericexport.com/api/v1
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="text-[var(--primary-green)]">{section.icon}</div>
              <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
            </div>
            <div className="p-6">
              {section.content}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-800 mb-2">📞 Besoin d'aide ?</h3>
        <p className="text-blue-700 mb-4">
          Notre équipe est disponible pour vous accompagner dans votre intégration.
        </p>
        <div className="flex gap-4">
          <a
            href="mailto:api@numericexport.com"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Contacter le support API
          </a>
          <a
            href="/dashboard/messages/new"
            className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Envoyer un message
          </a>
        </div>
      </div>
    </div>
  );
}
