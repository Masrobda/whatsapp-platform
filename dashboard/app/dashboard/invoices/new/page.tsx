// app/dashboard/invoices/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FiFileText,
  FiArrowLeft,
  FiSave,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiUser,
  FiHardDrive,
  FiCalendar,
  FiDollarSign,
  FiRefreshCw
} from 'react-icons/fi';
import Cookies from 'js-cookie';

interface Space {
  id: string;
  client_id: string;
  company_name: string;
  email: string;
  offer_name: string;
  storage_gb: number;
  amount_fcfa: number;
  expires_at: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams.get('spaceId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    amount: 0,
    months: 1,
    description: '',
    notes: ''
  });

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com/api/v1';

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return Cookies.get('token') || '';
    }
    return '';
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const loadSpaceData = async () => {
      if (!spaceId) {
        showNotification('error', 'ID d\'espace manquant');
        return;
      }

      try {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        // Route: /api/v1/admin/storage/space/:spaceId
        const response = await fetch(`${API_BASE_URL}/admin/storage/space/${spaceId}`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Espace non trouvé');

        const data = await response.json();
        setSpace(data.space);

        // Générer un numéro de facture
        const today = new Date();
        const invoiceNumber = `FACT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        
        setFormData({
          invoiceNumber,
          amount: data.space.amount_fcfa || 0,
          months: 1,
          description: `Facture pour l'espace de stockage ${data.space.offer_name || ''}`,
          notes: ''
        });

      } catch (err) {
        showNotification('error', 'Erreur lors du chargement');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSpaceData();
  }, [spaceId]);

  const generateInvoiceHtml = () => {
    const date = new Date().toLocaleDateString('fr-FR');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    const dueDateStr = dueDate.toLocaleDateString('fr-FR');

    const amountFormatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(formData.amount);

    return `
    <!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${formData.invoiceNumber} — NEXT LTD</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    /* ── Charte officielle ── */
    :root {
      --green:      #2d7a3e;
      --green-lt:   #3a9950;
      --green-dk:   #1e5a2f;
      --lime:       #8bc34a;
      --lime-lt:    #aed581;
      --lime-dk:    #689f38;
      --blue:       #1976d2;
      --n-50:       #f8faf9;
      --n-100:      #f0f7f3;
      --n-200:      #e5ebe8;
      --n-300:      #cbd5d0;
      --n-400:      #9eada5;
      --n-500:      #6b7c74;
      --n-700:      #2f3935;
      --n-800:      #1a1f1d;
    }

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'DM Sans', sans-serif;
      -webkit-font-smoothing: antialiased;
      background: var(--n-50);
      padding: 40px 20px;
      min-height: 100vh;
    }

    /* ── Wrapper print-safe ── */
    .invoice {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border-radius: 6px;
      border: 1px solid var(--n-200);
      box-shadow: 0 2px 8px rgba(0,0,0,.04), 0 16px 40px rgba(0,0,0,.07);
      overflow: hidden;
    }

    /* ════════════════════════
       BANDES DÉCORATIVES
    ════════════════════════ */
    .stripe-top {
      height: 5px;
      background: linear-gradient(90deg, var(--green-dk) 0%, var(--green) 40%, var(--lime) 75%, #42a5f5 100%);
    }
    .stripe-bottom {
      height: 5px;
      background: linear-gradient(90deg, var(--green-dk) 0%, var(--green) 40%, var(--lime) 75%, #42a5f5 100%);
    }

    /* ════════════════════════
       HEADER
    ════════════════════════ */
    .header {
      background: linear-gradient(135deg, var(--green-dk) 0%, var(--green) 65%, #2d7540 100%);
      padding: 32px 48px 28px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .header::before {
      content: '';
      position: absolute; top: -60px; right: -60px;
      width: 200px; height: 200px;
      background: radial-gradient(circle, rgba(139,195,74,.1) 0%, transparent 70%);
      border-radius: 50%; pointer-events: none;
    }

    /* Corner filets */
    .fc { position: absolute; width: 20px; height: 20px; border-style: solid; border-color: rgba(139,195,74,.3); }
    .fc-tl { top: 12px; left: 12px; border-width: 2px 0 0 2px; }
    .fc-tr { top: 12px; right: 12px; border-width: 2px 2px 0 0; }
    .fc-bl { bottom: 12px; left: 12px; border-width: 0 0 2px 2px; }
    .fc-br { bottom: 12px; right: 12px; border-width: 0 2px 2px 0; }

    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative; z-index: 1;
    }

    .logo-wrap {
      width: 64px; height: 64px;
      border-radius: 12px;
      background: rgba(255,255,255,.12);
      border: 1.5px solid rgba(255,255,255,.25);
      padding: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: hidden;
    }

    .logo-wrap img {
      width: 100%; height: 100%; object-fit: contain;
    }

    .logo-mono {
      font-family: 'Cormorant Garamond', serif;
      font-size: 20px; font-weight: 700;
      color: #aed581; letter-spacing: .04em;
      display: none;
    }

    .brand-text-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 26px; font-weight: 600;
      color: #fff; letter-spacing: .015em; line-height: 1.15;
    }

    .brand-text-sub {
      font-size: 11px; color: rgba(255,255,255,.5);
      letter-spacing: .1em; text-transform: uppercase;
      margin-top: 3px; font-weight: 300;
    }

    .brand-coords {
      margin-top: 6px;
      font-size: 10.5px; color: rgba(255,255,255,.55);
      line-height: 1.6; font-weight: 300;
    }

    /* Bloc FACTURE (droite) */
    .title-block {
      text-align: right;
      position: relative; z-index: 1;
      flex-shrink: 0;
    }

    .title-block h2 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px; font-weight: 700;
      color: #fff; letter-spacing: .03em;
      line-height: 1;
    }

    /* Underline sous FACTURE */
    .title-underline {
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(139,195,74,.7));
      margin: 6px 0 10px;
    }

    .inv-num {
      display: inline-block;
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(139,195,74,.3);
      border-radius: 3px;
      padding: 5px 14px;
      font-size: 14px; font-weight: 600;
      color: #aed581; letter-spacing: .06em;
    }

    /* ════════════════════════
       INFO BAND (Dates)
    ════════════════════════ */
    .info-band {
      display: flex;
      background: var(--n-100);
      border-bottom: 1px solid var(--n-200);
    }

    .info-cell {
      flex: 1;
      padding: 14px 24px;
      border-right: 1px solid var(--n-200);
      text-align: center;
    }

    .info-cell:last-child { border-right: none; }

    .info-cell .ic-label {
      font-size: 9px; text-transform: uppercase;
      letter-spacing: .14em; color: var(--n-500);
      font-weight: 500; margin-bottom: 5px;
    }

    .info-cell .ic-value {
      font-family: 'Cormorant Garamond', serif;
      font-size: 17px; font-weight: 600;
      color: var(--green-dk); letter-spacing: .02em;
    }

    /* ════════════════════════
       BODY
    ════════════════════════ */
    .body { padding: 36px 48px; }

    /* Section label */
    .sec-head {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 16px;
    }

    .sec-icon {
      width: 26px; height: 26px;
      background: var(--n-100); border: 1px solid var(--n-200);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .sec-icon svg { width: 13px; height: 13px; }

    .sec-lbl {
      font-size: 10px; letter-spacing: .16em;
      text-transform: uppercase; color: var(--n-500);
      font-weight: 500; flex-shrink: 0;
    }

    .sec-line {
      flex: 1; height: 1px;
      background: linear-gradient(90deg, var(--n-200), transparent);
    }

    /* ── Bloc client ── */
    .client-block {
      background: var(--n-50);
      border: 1px solid var(--n-200);
      border-left: 3px solid var(--green);
      border-radius: 4px;
      padding: 16px 20px;
      margin-bottom: 28px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px 24px;
    }

    .client-field .cf-label {
      font-size: 9px; letter-spacing: .12em;
      text-transform: uppercase; color: var(--n-400);
      font-weight: 500; margin-bottom: 3px;
      display: flex; align-items: center; gap: 5px;
    }

    .cf-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--lime); flex-shrink: 0; }

    .client-field .cf-value {
      font-size: 14px; font-weight: 600;
      color: var(--n-800); line-height: 1.3;
    }

    .client-field .cf-value.company {
      font-family: 'Cormorant Garamond', serif;
      font-size: 18px; color: var(--green);
    }

    /* ── Tableau ── */
    .inv-table {
      width: 100%; border-collapse: collapse;
      margin-bottom: 0;
    }

    .inv-table thead tr {
      background: var(--green-dk);
    }

    .inv-table th {
      padding: 12px 16px;
      font-size: 9px; letter-spacing: .14em;
      text-transform: uppercase; font-weight: 600;
      color: #fff; text-align: left;
    }

    .inv-table th:last-child { text-align: right; }

    .inv-table tbody tr {
      border-bottom: 1px solid var(--n-200);
      transition: background .15s;
    }

    .inv-table tbody tr:hover { background: var(--n-50); }

    .inv-table td {
      padding: 16px;
      font-size: 13px; color: var(--n-800);
      vertical-align: top;
    }

    .inv-table td:last-child { text-align: right; }

    .item-title {
      font-weight: 600; color: var(--n-800);
      margin-bottom: 3px; font-size: 14px;
    }

    .item-sub {
      font-size: 11.5px; color: var(--n-400);
      line-height: 1.6; font-weight: 300;
    }

    .item-badge {
      display: inline-block;
      background: rgba(139,195,74,.12);
      border: 1px solid rgba(104,159,56,.25);
      border-radius: 100px;
      padding: 2px 10px;
      font-size: 10px; font-weight: 600;
      color: var(--lime-dk); letter-spacing: .05em;
      margin-top: 6px;
    }

    .amount-cell {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px; font-weight: 700;
      color: var(--green-dk);
      white-space: nowrap;
    }

    /* ── Totaux ── */
    .totals-row {
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid var(--n-200);
      padding: 16px 16px 0;
      margin-bottom: 28px;
    }

    .totals-table {
      min-width: 260px;
    }

    .totals-table tr td {
      padding: 6px 0;
      font-size: 13px;
    }

    .totals-table tr td:last-child {
      text-align: right;
      font-weight: 600;
      padding-left: 32px;
    }

    .totals-table .t-muted { color: var(--n-500); }

    .totals-table .t-total {
      border-top: 1.5px solid var(--green);
      padding-top: 10px !important;
    }

    .totals-table .t-total td {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px; font-weight: 700;
      color: var(--green-dk);
    }

    /* ── Instructions de paiement ── */
    .payment-block {
      background: var(--n-50);
      border: 1px solid var(--n-200);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 28px;
    }

    .payment-header {
      background: var(--green);
      padding: 10px 20px;
      display: flex; align-items: center; gap: 10px;
    }

    .payment-header span {
      font-size: 10px; font-weight: 600;
      color: #fff; letter-spacing: .1em; text-transform: uppercase;
    }

    .payment-header svg { width: 14px; height: 14px; flex-shrink: 0; }

    .payment-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1px;
      background: var(--n-200);
    }

    .pay-cell {
      background: #fff;
      padding: 14px 20px;
      transition: background .15s;
    }

    .pay-cell:hover { background: var(--n-50); }

    .pay-label {
      font-size: 9px; letter-spacing: .12em;
      text-transform: uppercase; color: var(--n-500);
      font-weight: 500; margin-bottom: 5px;
      display: flex; align-items: center; gap: 5px;
    }

    .pay-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--green); flex-shrink: 0; }

    .pay-value {
      font-size: 13px; font-weight: 600;
      color: var(--n-800); line-height: 1.3;
    }

    .pay-value.ref {
      font-family: 'DM Sans', monospace;
      color: var(--green); font-size: 14px;
    }

    .pay-cell.full {
      grid-column: span 2;
    }

    /* ── Remarques ── */
    .note-block {
      background: rgba(139,195,74,.06);
      border: 1px solid rgba(104,159,56,.18);
      border-left: 3px solid var(--lime);
      border-radius: 4px;
      padding: 14px 18px;
      margin-bottom: 24px;
      font-size: 12px; color: var(--n-600);
      font-style: italic; line-height: 1.7;
    }

    /* ════════════════════════
       FOOTER
    ════════════════════════ */
    .footer {
      padding: 18px 48px;
      border-top: 1px solid var(--n-200);
      background: var(--n-50);
      display: flex; align-items: center;
      justify-content: space-between; gap: 16px;
      flex-wrap: wrap;
    }

    .footer-legal {
      font-size: 10.5px; color: var(--n-400);
      line-height: 1.7; letter-spacing: .02em;
    }

    .footer-legal em { font-style: normal; color: var(--green); font-weight: 500; }

    .footer-links { display: flex; gap: 18px; }

    .footer-links a {
      font-size: 10.5px; color: var(--n-400);
      text-decoration: none; letter-spacing: .05em;
      transition: color .18s;
    }

    .footer-links a:hover { color: var(--green); }

    /* ════════════════════════
       PRINT
    ════════════════════════ */
    @media print {
      body { background: none; padding: 0; }
      .invoice {
        box-shadow: none; border: none;
        border-radius: 0; max-width: 100%;
      }
    }

    @media (max-width: 600px) {
      .header { padding: 24px 20px; flex-direction: column; align-items: flex-start; }
      .title-block { text-align: left; }
      .body { padding: 24px 20px; }
      .footer { padding: 16px 20px; flex-direction: column; }
      .info-band { flex-direction: column; }
      .info-cell { border-right: none; border-bottom: 1px solid var(--n-200); }
      .payment-grid { grid-template-columns: 1fr; }
      .pay-cell.full { grid-column: span 1; }
    }
  </style>
</head>
<body>
<div class="invoice">

  <div class="stripe-top"></div>

  <!-- ════════════ HEADER ════════════ -->
  <div class="header">
    <div class="fc fc-tl"></div><div class="fc fc-tr"></div>
    <div class="fc fc-bl"></div><div class="fc fc-br"></div>

    <div class="brand">
      <div class="logo-wrap">
        <img
          src="/logook1.png"
          alt="NEXT LTD"
          onerror="this.style.display='none'; document.getElementById('lm').style.display='block';"
        >
        <span class="logo-mono" id="lm">NE</span>
      </div>
      <div>
        <div class="brand-text-name">Numeric Export Technologies</div>
        <div class="brand-text-sub">NEXT LTD</div>
        <div class="brand-coords">
          BP 15368 Douala, Cameroun<br>
          (+237) 696 578 107 &nbsp;·&nbsp; team@numericexport.com<br>
          www.numericexport.com
        </div>
      </div>
    </div>

    <div class="title-block">
      <h2>FACTURE</h2>
      <div class="title-underline"></div>
      <div class="inv-num">N° ${formData.invoiceNumber}</div>
    </div>
  </div>

  <!-- ════════════ INFO BAND ════════════ -->
  <div class="info-band">
    <div class="info-cell">
      <div class="ic-label">Date d'émission</div>
      <div class="ic-value">${date}</div>
    </div>
    <div class="info-cell">
      <div class="ic-label">Date d'échéance</div>
      <div class="ic-value">${dueDateStr}</div>
    </div>
    <div class="info-cell">
      <div class="ic-label">Durée</div>
      <div class="ic-value">${formData.months} mois</div>
    </div>
    <div class="info-cell">
      <div class="ic-label">Statut</div>
      <div class="ic-value" style="color:var(--lime-dk)">En attente</div>
    </div>
  </div>

  <!-- ════════════ BODY ════════════ -->
  <div class="body">

    <!-- Section client -->
    <div class="sec-head">
      <div class="sec-icon">
        <svg viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="4.5" r="2.5" stroke="#6b7c74" stroke-width="1.3"/>
          <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="#6b7c74" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </div>
      <span class="sec-lbl">Informations client</span>
      <div class="sec-line"></div>
    </div>

    <div class="client-block">
      <div class="client-field">
        <div class="cf-label"><span class="cf-dot"></span>Entreprise</div>
        <div class="cf-value company">${space?.company_name || 'Client'}</div>
      </div>
      <div class="client-field">
        <div class="cf-label"><span class="cf-dot"></span>Email</div>
        <div class="cf-value">${space?.email || '—'}</div>
      </div>

    <!-- Section prestations -->
    <div class="sec-head">
      <div class="sec-icon">
        <svg viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="#6b7c74" stroke-width="1.3"/>
          <path d="M4 5h6M4 7.5h6M4 10h4" stroke="#6b7c74" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </div>
      <span class="sec-lbl">Détail des prestations</span>
      <div class="sec-line"></div>
    </div>

    <table class="inv-table" style="margin-bottom:0">
      <thead>
        <tr>
          <th style="width:60%">Description</th>
          <th>Offre</th>
          <th>Période</th>
          <th>Montant</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="item-title">${formData.description || 'Abonnement stockage cloud'}</div>
            <div class="item-sub">
              Service de stockage professionnel sécurisé<br>
              Capacité : ${space?.storage_gb || 0} Go inclus
            </div>
            <span class="item-badge">Abonnement</span>
          </td>
          <td style="font-size:13px;font-weight:600;color:var(--green);vertical-align:top;padding-top:18px">
            ${space?.offer_name || '—'}
          </td>
          <td style="font-size:13px;color:var(--n-600);vertical-align:top;padding-top:18px;white-space:nowrap">
            ${formData.months} mois
          </td>
          <td style="vertical-align:top;padding-top:14px">
            <div class="amount-cell">${amountFormatted}</div>
            <div style="font-size:10px;color:var(--n-400);margin-top:2px;text-align:right">TTC</div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Totaux -->
    <div class="totals-row">
      <table class="totals-table">
        <tr>
          <td class="t-muted">Sous-total HT</td>
          <td class="t-muted">${amountFormatted}</td>
        </tr>
        <tr>
          <td class="t-muted">TVA (0%)</td>
          <td class="t-muted">0 FCFA</td>
        </tr>
        <tr class="t-total">
          <td style="font-size:13px;font-weight:600;color:var(--green-dk)">Total TTC</td>
          <td>${amountFormatted}</td>
        </tr>
      </table>
    </div>

    <!-- Instructions de paiement -->
    <div class="sec-head">
      <div class="sec-icon">
        <svg viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="3.5" width="11" height="8" rx="1" stroke="#6b7c74" stroke-width="1.3"/>
          <path d="M1.5 6.5h11" stroke="#6b7c74" stroke-width="1.3"/>
          <rect x="3.5" y="8.5" width="3" height="1.5" rx=".5" fill="#6b7c74"/>
        </svg>
      </div>
      <span class="sec-lbl">Instructions de paiement</span>
      <div class="sec-line"></div>
    </div>

    <div class="payment-block">
      <div class="payment-header">
        <svg viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="3" width="11" height="8" rx="1" stroke="white" stroke-width="1.3"/>
          <path d="M1.5 6h11" stroke="white" stroke-width="1.3"/>
        </svg>
        <span>Virement bancaire</span>
      </div>
      <div class="payment-grid">
        <div class="pay-cell">
          <div class="pay-label"><span class="pay-dot"></span>Banque</div>
          <div class="pay-value">CCA BANK</div>
        </div>
        <div class="pay-cell">
          <div class="pay-label"><span class="pay-dot"></span>Mode</div>
          <div class="pay-value">Virement bancaire ou espèces</div>
        </div>
        <div class="pay-cell full">
          <div class="pay-label"><span class="pay-dot"></span>Numéro de compte</div>
          <div class="pay-value" style="font-family:'DM Sans',monospace;letter-spacing:.08em">10039 10038 00280436301 03</div>
        </div>
        <div class="pay-cell">
          <div class="pay-label"><span class="pay-dot"></span>Délai de paiement</div>
          <div class="pay-value">60 jours après réception</div>
        </div>
        <div class="pay-cell">
          <div class="pay-label"><span class="pay-dot"></span>Référence obligatoire</div>
          <div class="pay-value ref">${formData.invoiceNumber}</div>
        </div>
      </div>
    </div>

    <!-- Note légère -->
    <div class="note-block">
      Passé le délai d'échéance, des pénalités de retard de 1,5 % par mois pourront être appliquées conformément aux conditions générales de vente.
      Tout règlement doit mentionner la référence de facture ci-dessus.
    </div>

  </div><!-- /body -->

  <!-- ════════════ FOOTER ════════════ -->
  <div class="footer">
    <div class="footer-legal">
      <em>NEXT LTD</em> — Numeric Export Technologies<br>
      RCM : CM-DLA-02-2026-B12-00012 &nbsp;·&nbsp; BP 15368 Douala, Cameroun
    </div>
    <div class="footer-links">
      <a href="https://www.numericexport.com">numericexport.com</a>
      <a href="mailto:team@numericexport.com">team@numericexport.com</a>
    </div>
  </div>

  <div class="stripe-bottom"></div>

</div>
</body>
</html>

 `;
  };

  const handleSaveInvoice = async () => {
    try {
      setSaving(true);
      const token = getToken();
      if (!token) return;

      const invoiceHtml = generateInvoiceHtml();

      // Route à créer si nécessaire, ou utiliser ordersController.validateOrderHandler
      // Pour l'instant, on simule la création
      showNotification('success', 'Facture générée avec succès');
      setTimeout(() => router.push('/dashboard/invoices'), 1500);

    } catch (err) {
      showNotification('error', 'Erreur lors de la création');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-green)] mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <FiCheck /> : <FiAlertCircle />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}><FiX /></button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <FiArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Nouvelle facture</h1>
      </div>

      {space && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p><strong>Client:</strong> {space.company_name || space.email}</p>
          <p><strong>Espace:</strong> {space.id}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveInvoice(); }} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de facture</label>
              <input type="text" required value={formData.invoiceNumber} onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Montant (FCFA)</label>
              <input type="number" required min="0" value={formData.amount} onChange={(e) => setFormData({...formData, amount: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mois</label>
              <input type="number" min="1" value={formData.months} onChange={(e) => setFormData({...formData, months: parseInt(e.target.value) || 1})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[var(--primary-green)] text-white rounded-lg flex items-center gap-2">
              {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
              {saving ? 'Génération...' : 'Générer la facture'}
            </button>
          </div>
        </form>
      </div>

      {formData.amount > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Aperçu</h3>
          <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto" dangerouslySetInnerHTML={{ __html: generateInvoiceHtml() }} />
        </div>
      )}
    </div>
  );
}
