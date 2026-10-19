// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─────────────────────────────────────────────
// Utilitaire pour combiner les classes Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────
// Formatage monétaire (FCFA par défaut)
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "FCFA",
  locale: string = "fr-CM"
): string {
  if (amount == null || isNaN(Number(amount))) return "—";

  const value = Number(amount);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency === "FCFA" ? "XAF" : currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("XAF", currency); // remplace XAF par FCFA si besoin
}

// ─────────────────────────────────────────────
// Formatage de dates avec date-fns
export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  try {
    return format(new Date(date), formatStr, { locale: fr });
  } catch (error) {
    return '-';
  }
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd/MM/yyyy à HH:mm');
}

// ─────────────────────────────────────────────
// Formatage téléphone (ex: +237 6XX XX XX XX)
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('237') && cleaned.length === 12) {
    return `+237 ${cleaned.slice(3,6)} ${cleaned.slice(6,9)} ${cleaned.slice(9)}`;
  }
  return phone;
}

// ─────────────────────────────────────────────
// Copier dans le presse-papiers (async)
export async function copyToClipboard(text: string, notify = true): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    if (notify) {
      console.log("Copié :", text);
      // toast.success("Copié !"); // décommente si tu réinstalles react-hot-toast
    }
    return true;
  } catch (err) {
    console.error("Erreur copie :", err);
    return false;
  }
}

// ─────────────────────────────────────────────
// Télécharger un fichier (version complète - unique)
export function downloadFile(
  data: Blob | string,
  fileName: string,
  type: string = "application/octet-stream"
): void {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Badge de statut avec couleurs dédiées
export function getStatusBadge(status: string | undefined): {
  label: string;
  className: string;
  bgColor: string;
  color: string;
} {
  const statusMap: Record<string, { label: string; className: string; bgColor: string; color: string }> = {
    // Orders
    pending: { label: 'En instance de validation', color: 'text-yellow-700', bgColor: 'bg-yellow-100', className: 'bg-yellow-100 text-yellow-700' },
    validated_secretary: { label: 'Revue administrative effectuée', color: 'text-blue-700', bgColor: 'bg-blue-100', className: 'bg-blue-100 text-blue-700' },
    validated_auditor: { label: 'Contrôle qualité validé', color: 'text-indigo-700', bgColor: 'bg-indigo-100', className: 'bg-indigo-100 text-indigo-700' },
    validated_financial: { label: 'Vérification budgétaire approuvée', color: 'text-purple-700', bgColor: 'bg-purple-100', className: 'bg-purple-100 text-purple-700' },
    invoice_generated: { label: 'Facture émise', color: 'text-cyan-700', bgColor: 'bg-cyan-100', className: 'bg-cyan-100 text-cyan-700' },
    purchase_completed: { label: 'Achat finalisé', color: 'text-green-700', bgColor: 'bg-green-100', className: 'bg-green-100 text-green-700' },
    completed: { label: 'Dossier clôturé', color: 'text-green-700', bgColor: 'bg-green-100', className: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Annulé', color: 'text-red-700', bgColor: 'bg-red-100', className: 'bg-red-100 text-red-700' },
    
    // Messages
    queued: { label: 'En file', color: 'text-gray-700', bgColor: 'bg-gray-100', className: 'bg-gray-100 text-gray-700' },
    sent: { label: 'Envoyé', color: 'text-blue-700', bgColor: 'bg-blue-100', className: 'bg-blue-100 text-blue-700' },
    delivered: { label: 'Livré', color: 'text-green-700', bgColor: 'bg-green-100', className: 'bg-green-100 text-green-700' },
    read: { label: 'Lu', color: 'text-purple-700', bgColor: 'bg-purple-100', className: 'bg-purple-100 text-purple-700' },
    failed: { label: 'Échec', color: 'text-red-700', bgColor: 'bg-red-100', className: 'bg-red-100 text-red-700' },
    
    // Invoices
    draft: { label: 'Brouillon', color: 'text-gray-700', bgColor: 'bg-gray-100', className: 'bg-gray-100 text-gray-700' },
    proforma_generated: { label: 'Proforma', color: 'text-blue-700', bgColor: 'bg-blue-100', className: 'bg-blue-100 text-blue-700' },
    proforma_validated: { label: 'Proforma validée', color: 'text-indigo-700', bgColor: 'bg-indigo-100', className: 'bg-indigo-100 text-indigo-700' },
    final_generated: { label: 'Facture finale', color: 'text-purple-700', bgColor: 'bg-purple-100', className: 'bg-purple-100 text-purple-700' },
    invoice_sent: { label: 'Envoyée', color: 'text-cyan-700', bgColor: 'bg-cyan-100', className: 'bg-cyan-100 text-cyan-700' },
    paid: { label: 'Payée', color: 'text-green-700', bgColor: 'bg-green-100', className: 'bg-green-100 text-green-700' },
    archived: { label: 'Archivée', color: 'text-gray-700', bgColor: 'bg-gray-100', className: 'bg-gray-100 text-gray-700' },

    // Décaissements (cohérence avec ta page)
    awaiting_receipt: { label: 'Attente reçu', color: 'text-orange-700', bgColor: 'bg-orange-100', className: 'bg-orange-100 text-orange-700' },
  };

  const key = (status || '').toLowerCase();
  return statusMap[key] || { 
    label: status || 'Inconnu', 
    className: 'bg-gray-100 text-gray-800', 
    bgColor: 'bg-gray-100', 
    color: 'text-gray-800' 
  };
}

// ─────────────────────────────────────────────
// Label des rôles
export function getRoleLabel(role: string): string {
  const roleMap: Record<string, string> = {
    admin: 'Administrateur',
    secretaire: 'Secrétaire',
    commercial: 'Commercial',
    auditeur: 'Auditeur',
    responsable_achat: 'Responsable Achats',
    responsable_financier: 'Responsable Financier',
  };
  return roleMap[role] || role;
}

// ─────────────────────────────────────────────
// Valider un email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ─────────────────────────────────────────────
// Valider un numéro de téléphone
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// ─────────────────────────────────────────────
// Calculer le pourcentage
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// ─────────────────────────────────────────────
// Tronquer un texte
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ─────────────────────────────────────────────
// Couleur aléatoire pour avatars
const avatarColors = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500',
];

export function getAvatarColor(name: string | null | undefined): string {
  if (!name) return 'bg-gray-500';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ─────────────────────────────────────────────
// Initiales d'un nom
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
