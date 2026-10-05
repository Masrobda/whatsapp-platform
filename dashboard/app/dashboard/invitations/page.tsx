'use client';

import { useEffect, useState } from 'react';
import { invitations as invitationsAPI } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatDateTime, copyToClipboard } from '@/lib/utils';
import { 
  FiPlus, 
  FiCopy, 
  FiCheck, 
  FiMail, 
  FiTrash2, 
  FiLink,
  FiChevronLeft,
  FiChevronRight,
  FiUsers
} from 'react-icons/fi';

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 5, totalPages: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    role: 'secretaire',
    permissions: [] as string[],
    max_uses: 1,
    expires_in_days: 3,
    email: '',
  });

  useEffect(() => {
    loadInvitations();
  }, [pagination.page]);

  const loadInvitations = async () => {
    setIsLoading(true);
    try {
      const response = await invitationsAPI.getAll({
        page: pagination.page,
        limit: pagination.limit,
      });
      setInvitations(response.invitations);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Erreur chargement invitations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await invitationsAPI.create(formData);
      setShowCreateModal(false);
      setFormData({
        role: 'secretaire',
        permissions: [],
        max_uses: 1,
        expires_in_days: 3,
        email: '',
      });
      loadInvitations();
      alert('Invitation créée avec succès !');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const handleSendEmail = async (invitationId: string) => {
    if (!formData.email) {
      alert('Veuillez entrer un email');
      return;
    }

    try {
      await invitationsAPI.sendByEmail(invitationId, formData.email);
      setShowSendModal(null);
      alert('Invitation envoyée par email avec succès !');
    } catch (error: any) {
      alert(error.response?.data?.message || "Erreur lors de l'envoi");
    }
  };

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/register/invitation?token=${token}`;

    const success = await copyToClipboard(link);
    if (success) {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      alert('Lien copié !\n' + link);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette invitation ?')) {
      try {
        await invitationsAPI.delete(id);
        loadInvitations();
        alert('Invitation supprimée avec succès !');
      } catch (error: any) {
        alert(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrateur',
      secretaire: 'Secrétaire/Commercial',
      commercial: 'Commercial',
      auditeur: 'Auditeur',
      responsable_achat: 'Responsable Achats',
      responsable_financier: 'Responsable Financier',
    };
    return roles[role] || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Gestion des invitations</h1>
          <p className="text-gray-500 mt-1">Invitez des membres à rejoindre l'équipe</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <FiPlus className="mr-2" />
          Nouvelle invitation
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="text-center">
            <FiUsers className="text-primary mx-auto mb-2" size={32} />
            <p className="text-sm text-gray-500">Total invitations</p>
            <h3 className="text-2xl font-bold text-dark">{pagination.total}</h3>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="text-center">
            <FiCheck className="text-success mx-auto mb-2" size={32} />
            <p className="text-sm text-gray-500">Utilisées</p>
            <h3 className="text-2xl font-bold text-dark">
              {invitations.reduce((acc, inv) => acc + inv.current_uses, 0)}
            </h3>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="text-center">
            <FiLink className="text-accent mx-auto mb-2" size={32} />
            <p className="text-sm text-gray-500">Actives</p>
            <h3 className="text-2xl font-bold text-dark">
              {invitations.filter(inv => new Date(inv.expires_at) > new Date()).length}
            </h3>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="text-center">
            <FiMail className="text-warning mx-auto mb-2" size={32} />
            <p className="text-sm text-gray-500">Restantes</p>
            <h3 className="text-2xl font-bold text-dark">
              {invitations.filter(inv => inv.current_uses < inv.max_uses).length}
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* Tableau des invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : invitations.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rôle</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Token</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Utilisations</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Expire le</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((invitation) => {
                      const isExpired = new Date(invitation.expires_at) < new Date();
                      const isUsedUp = invitation.current_uses >= invitation.max_uses;
                      
                      return (
                        <tr key={invitation.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {getRoleLabel(invitation.role)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-sm">
                            {invitation.token.substring(0, 15)}...
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              isUsedUp ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {invitation.current_uses} / {invitation.max_uses}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {formatDateTime(invitation.expires_at)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyLink(invitation.token)}
                              >
                                {copiedToken === invitation.token ? <FiCheck /> : <FiCopy />}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowSendModal(invitation.id)}
                              >
                                <FiMail />
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDelete(invitation.id)}
                              >
                                <FiTrash2 />
                              </Button>
                            </div>
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
                  Page {pagination.page} sur {pagination.totalPages} ({pagination.total} invitations)
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
              <p className="text-gray-500 mb-4">Aucune invitation créée</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <FiPlus className="mr-2" />
                Créer ma première invitation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de création */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-dark mb-4">Nouvelle invitation</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Rôle</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="secretaire">Secrétaire/Commercial</option>
                  <option value="commercial">Commercial</option>
                  <option value="auditeur">Auditeur</option>
                  <option value="responsable_achat">Responsable Achats</option>
                  <option value="responsable_financier">Responsable Financier</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Nombre maximum d'utilisations
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Expire dans (jours)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={formData.expires_in_days}
                  onChange={(e) => setFormData({ ...formData, expires_in_days: parseInt(e.target.value) || 3 })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Email (optionnel - pour envoi immédiat)
                </label>
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                className="flex-1"
              >
                Créer l'invitation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'envoi par email */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-dark mb-4">Envoyer l'invitation par email</h2>

            <div className="space-y-4">
              <Input
                type="email"
                label="Email du destinataire"
                placeholder="collaborateur@exemple.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSendModal(null);
                  setFormData({ ...formData, email: '' });
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={() => handleSendEmail(showSendModal)}
                className="flex-1"
              >
                <FiMail className="mr-2" />
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
