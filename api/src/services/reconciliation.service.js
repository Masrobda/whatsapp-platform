// src/services/reconciliation.service.js
const { query } = require('../config/database');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

class ReconciliationService {
    
    // Générer un rapport basé sur les messages envoyés
    async generateReport(userId, data) {
        const { bsp_id, period_start, period_end } = data;
        
        try {
            // 1. Récupérer le BSP pour connaître le coût par message
            const bsp = await query(
                `SELECT id, name, message_cost FROM bsp_providers WHERE id = $1`,
                [bsp_id]
            );
            
            if (bsp.rows.length === 0) {
                throw new Error('BSP non trouvé');
            }
            
            const bspData = bsp.rows[0];
            
            // 2. Calculer les métriques internes depuis la table messages
            const internalStats = await query(`
                SELECT 
                    COUNT(*) as messages_count,
                    COUNT(CASE WHEN wa_status = 'delivered' THEN 1 END) as delivered_count,
                    COUNT(CASE WHEN wa_status = 'failed' THEN 1 END) as failed_count,
                    SUM(estimated_cost) as total_cost
                FROM messages 
                WHERE created_at BETWEEN $1 AND $2
                    AND channel = 'whatsapp'
            `, [period_start, period_end]);
            
            const stats = internalStats.rows[0];
            const messagesCount = parseInt(stats.messages_count || 0);
            const internalCost = parseFloat(stats.total_cost || 0);
            
            // 3. Calculer le coût théorique basé sur le BSP
            const theoreticalCost = messagesCount * parseFloat(bspData.message_cost);
            
            // 4. Créer le rapport
            const result = await query(`
                INSERT INTO reconciliation_reports 
                (bsp_id, period_start, period_end, 
                 internal_messages_count, internal_total_cost,
                 status, generated_by, generated_at)
                VALUES ($1, $2, $3, $4, $5, 'draft', $6, CURRENT_TIMESTAMP)
                RETURNING *
            `, [bsp_id, period_start, period_end, messagesCount, theoreticalCost, userId]);
            
            const report = result.rows[0];
            
            // 5. Log
            await this.logHistory(report.id, 'generated', { generated_by: userId }, userId);
            
            return report;
            
        } catch (error) {
            logger.error('Erreur génération rapport:', error);
            throw error;
        }
    }
    
    // Mettre à jour un rapport avec les données fournisseur
  async updateReport(reportId, updateData, userId) {
    const { 
        provider_messages_count,
        provider_invoice_amount,
        provider_invoice_number,
        provider_invoice_date,
        notes,
        invoice_file
    } = updateData;
    
    console.log('=== UPDATE REPORT DEBUG ===');
    console.log('reportId:', reportId);
    console.log('updateData:', updateData);
    console.log('provider_messages_count:', provider_messages_count);
    console.log('provider_invoice_amount:', provider_invoice_amount);
    
    try {
        // Récupérer le rapport actuel
        const report = await this.getReportById(reportId);
        console.log('Rapport existant:', report);
        
        if (!report) throw new Error('Rapport non trouvé');
        
        let invoice_path = null;
        if (invoice_file && invoice_file.buffer) {
            invoice_path = await this.saveInvoiceFile(invoice_file, reportId);
        }
        
        // Préparer les valeurs (convertir les strings en nombres)
        let newProviderMessagesCount = report.provider_messages_count;
        let newProviderInvoiceAmount = report.provider_invoice_amount;
        
        if (provider_messages_count !== undefined && provider_messages_count !== null && provider_messages_count !== '') {
            newProviderMessagesCount = parseInt(provider_messages_count);
            console.log('Nouveau provider_messages_count:', newProviderMessagesCount);
        }
        
        if (provider_invoice_amount !== undefined && provider_invoice_amount !== null && provider_invoice_amount !== '') {
            newProviderInvoiceAmount = parseFloat(provider_invoice_amount);
            console.log('Nouveau provider_invoice_amount:', newProviderInvoiceAmount);
        }
        
        // Calculer les écarts
        let messagesDiscrepancy = 0;
        let amountDiscrepancy = 0;
        
        if (newProviderMessagesCount !== null && newProviderMessagesCount !== undefined) {
            messagesDiscrepancy = newProviderMessagesCount - report.internal_messages_count;
            console.log('messagesDiscrepancy:', messagesDiscrepancy);
        }
        
        if (newProviderInvoiceAmount !== null && newProviderInvoiceAmount !== undefined) {
            amountDiscrepancy = newProviderInvoiceAmount - report.internal_total_cost;
            console.log('amountDiscrepancy:', amountDiscrepancy);
        }
        
        // Déterminer le nouveau statut
        let newStatus = report.status;
        if (newProviderMessagesCount !== null || newProviderInvoiceAmount !== null) {
            newStatus = 'pending';
        }
        
        console.log('newStatus:', newStatus);
        
        // Requête SQL directe pour éviter les problèmes
        const result = await query(`
            UPDATE reconciliation_reports 
            SET 
                provider_messages_count = COALESCE($1, provider_messages_count),
                provider_invoice_amount = COALESCE($2, provider_invoice_amount),
                provider_invoice_number = COALESCE($3, provider_invoice_number),
                provider_invoice_date = COALESCE($4, provider_invoice_date),
                provider_invoice_path = COALESCE($5, provider_invoice_path),
                messages_discrepancy = $6,
                amount_discrepancy = $7,
                status = $8,
                notes = COALESCE($9, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $10
            RETURNING *
        `, [
            newProviderMessagesCount,
            newProviderInvoiceAmount,
            provider_invoice_number || null,
            provider_invoice_date || null,
            invoice_path,
            messagesDiscrepancy,
            amountDiscrepancy,
            newStatus,
            notes || null,
            reportId
        ]);
        
        console.log('Résultat mise à jour:', result.rows[0]);
        
        await this.logHistory(reportId, 'updated', updateData, userId);
        
        return result.rows[0];
        
    } catch (error) {
        console.error('Erreur détaillée updateReport:', error);
        logger.error('Erreur mise à jour rapport:', error);
        throw error;
    }
}
    
     // Valider ou rejeter un rapport
    async validateReport(reportId, status, notes, userId) {
    const validStatuses = ['approved', 'rejected', 'closed'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Statut invalide. Utilisez: ${validStatuses.join(', ')}`);
    }
    
    console.log('=== VALIDATE REPORT ===');
    console.log('reportId:', reportId);
    console.log('status:', status);
    console.log('notes:', notes);
    console.log('userId:', userId);
    
    try {
        // Requête SQL avec gestion explicite des types
        let queryStr = `
            UPDATE reconciliation_reports 
            SET status = $1,
                validated_by = $2,
                validated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        const params = [status, userId];
        
        // Ajouter les notes seulement si fournies
        if (notes && notes !== '') {
            queryStr += `, notes = $3`;
            params.push(notes);
        }
        
        queryStr += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(reportId);
        
        console.log('Query:', queryStr);
        console.log('Params:', params);
        
        const result = await query(queryStr, params);
        
        if (result.rows.length === 0) {
            throw new Error('Rapport non trouvé');
        }
        
        await this.logHistory(reportId, 'validated', { status, notes }, userId);
        
        return result.rows[0];
        
    } catch (error) {
        console.error('Erreur validateReport:', error);
        logger.error('Erreur validation rapport:', error);
        throw error;
    }
}
    
    // Recalculer les écarts
    async recalculateDiscrepancies(reportId) {
        const report = await this.getReportById(reportId);
        if (!report) throw new Error('Rapport non trouvé');
        
        const messagesDiscrepancy = (report.provider_messages_count || 0) - report.internal_messages_count;
        const amountDiscrepancy = (report.provider_invoice_amount || 0) - report.internal_total_cost;
        
        const result = await query(`
            UPDATE reconciliation_reports 
            SET messages_discrepancy = $1,
                amount_discrepancy = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [messagesDiscrepancy, amountDiscrepancy, reportId]);
        
        return result.rows[0];
    }
    
    // Exporter en CSV
    // src/services/reconciliation.service.js
// Corrigez la méthode exportToCSV

async exportToCSV(reportId) {
    const report = await this.getReportById(reportId);
    if (!report) throw new Error('Rapport non trouvé');
    
    // Récupérer le BSP
    const bsp = await query(`SELECT name FROM bsp_providers WHERE id = $1`, [report.bsp_id]);
    const bspName = bsp.rows[0]?.name || 'Inconnu';
    
    // Construire le CSV avec BOM UTF-8
    const rows = [];
    
    // En-tête du rapport
    rows.push(['RAPPORT DE RÉCONCILIATION']);
    rows.push(['Date d\'export', new Date().toLocaleString('fr-FR')]);
    rows.push(['ID Rapport', report.id]);
    rows.push(['BSP', bspName]);
    rows.push(['Période', `${report.period_start} → ${report.period_end}`]);
    rows.push(['Statut', this.getStatusLabel(report.status)]);
    rows.push([]);
    
    // Section 1: Métriques internes
    rows.push(['1. MÉTRIQUES INTERNES (vos messages)']);
    rows.push(['Description', 'Valeur']);
    rows.push(['Nombre total de messages', report.internal_messages_count?.toLocaleString() || '0']);
    rows.push(['Coût total théorique', `${(report.internal_total_cost || 0).toLocaleString()} FCFA`]);
    rows.push([]);
    
    // Section 2: Métriques fournisseur
    rows.push(['2. MÉTRIQUES FOURNISSEUR (facture)']);
    rows.push(['Description', 'Valeur']);
    rows.push(['Nombre de messages facturés', report.provider_messages_count?.toLocaleString() || 'Non renseigné']);
    rows.push(['Montant facturé', report.provider_invoice_amount ? `${report.provider_invoice_amount.toLocaleString()} FCFA` : 'Non renseigné']);
    rows.push(['Numéro de facture', report.provider_invoice_number || 'Non renseigné']);
    rows.push(['Date facture', report.provider_invoice_date || 'Non renseignée']);
    rows.push([]);
    
    // Section 3: Écarts
    rows.push(['3. ÉCARTS DÉTECTÉS']);
    rows.push(['Type', 'Valeur', 'Interprétation']);
    
    const msgDiff = report.messages_discrepancy || 0;
    const amountDiff = report.amount_discrepancy || 0;
    
    let msgInterpretation = '';
    if (msgDiff > 0) msgInterpretation = `+${msgDiff} messages facturés en trop`;
    else if (msgDiff < 0) msgInterpretation = `${Math.abs(msgDiff)} messages manquants`;
    else msgInterpretation = 'Aucun écart';
    
    let amountInterpretation = '';
    if (amountDiff > 0) amountInterpretation = `Surfacturation de ${amountDiff.toLocaleString()} FCFA`;
    else if (amountDiff < 0) amountInterpretation = `Sous-facturation de ${Math.abs(amountDiff).toLocaleString()} FCFA`;
    else amountInterpretation = 'Aucun écart';
    
    rows.push(['Écart messages', msgDiff.toLocaleString(), msgInterpretation]);
    rows.push(['Écart montant', `${amountDiff.toLocaleString()} FCFA`, amountInterpretation]);
    rows.push([]);
    
    // Section 4: Conclusion
    rows.push(['4. CONCLUSION']);
    if (msgDiff === 0 && amountDiff === 0) {
        rows.push(['✅ RAPPORT CONFORME - Aucun écart détecté']);
    } else if (Math.abs(amountDiff) < 1000) {
        rows.push(['⚠️ ÉCARTS MINEURS - À vérifier avec le fournisseur']);
    } else {
        rows.push(['❌ ÉCARTS SIGNIFICATIFS - Réclamation nécessaire']);
    }
    
    if (report.notes) {
        rows.push([]);
        rows.push(['5. NOTES']);
        rows.push([report.notes]);
    }
    
    // Convertir en CSV avec échappement UTF-8
    const csvContent = rows.map(row => 
        row.map(cell => {
            // Échapper les guillemets et gérer les caractères spéciaux
            const str = String(cell || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',')
    ).join('\n');
    
    // Ajouter BOM UTF-8 pour Excel
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;
    
    return Buffer.from(csvWithBom, 'utf-8');
}

    
    // Récupérer tous les rapports
    async getReports(filters = {}) {
        const { page = 1, limit = 10, status, bsp_id, start_date, end_date } = filters;
        const offset = (page - 1) * limit;
        
        let where = 'WHERE 1=1';
        const params = [];
        
        if (status) {
            where += ` AND r.status = $${params.length + 1}`;
            params.push(status);
        }
        if (bsp_id) {
            where += ` AND r.bsp_id = $${params.length + 1}`;
            params.push(bsp_id);
        }
        if (start_date) {
            where += ` AND r.period_start >= $${params.length + 1}`;
            params.push(start_date);
        }
        if (end_date) {
            where += ` AND r.period_end <= $${params.length + 1}`;
            params.push(end_date);
        }
        
        const countRes = await query(`SELECT COUNT(*) FROM reconciliation_reports r ${where}`, params);
        const total = parseInt(countRes.rows[0].count);
        
        const res = await query(`
            SELECT r.*, 
                   b.name as bsp_name,
                   b.message_cost as bsp_cost,
                   u1.email as generated_by_email,
                   u2.email as validated_by_email
            FROM reconciliation_reports r
            LEFT JOIN bsp_providers b ON b.id = r.bsp_id
            LEFT JOIN users u1 ON u1.id = r.generated_by
            LEFT JOIN users u2 ON u2.id = r.validated_by
            ${where}
            ORDER BY r.generated_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, limit, offset]);
        
        return {
            reports: res.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    
    // Récupérer un rapport par ID
    async getReportById(reportId) {
        const res = await query(`
            SELECT r.*, 
                   b.name as bsp_name,
                   b.message_cost as bsp_cost,
                   u1.email as generated_by_email,
                   u2.email as validated_by_email
            FROM reconciliation_reports r
            LEFT JOIN bsp_providers b ON b.id = r.bsp_id
            LEFT JOIN users u1 ON u1.id = r.generated_by
            LEFT JOIN users u2 ON u2.id = r.validated_by
            WHERE r.id = $1
        `, [reportId]);
        
        return res.rows[0] || null;
    }
    
    // Récupérer les BSP actifs
    async getBSPProviders() {
        const res = await query(`
            SELECT id, name, message_cost, is_active 
            FROM bsp_providers 
            WHERE is_active = true 
            ORDER BY name
        `);
        return res.rows;
    }
    
    // Statistiques globales
    async getStatistics() {
        const stats = await query(`
            SELECT 
                COUNT(*) as total_reports,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reports,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reports,
                SUM(CASE WHEN amount_discrepancy > 0 THEN amount_discrepancy ELSE 0 END) as total_overcharge,
                SUM(CASE WHEN amount_discrepancy < 0 THEN ABS(amount_discrepancy) ELSE 0 END) as total_undercharge,
                AVG(amount_discrepancy) as avg_discrepancy
            FROM reconciliation_reports
        `);
        
        return stats.rows[0];
    }
    
    // Sauvegarder le fichier de facture
    async saveInvoiceFile(file, reportId) {
        const uploadDir = process.env.INVOICE_STORAGE_PATH || '/var/www/numericexport/media/invoices';
        await fs.mkdir(uploadDir, { recursive: true });
        
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `invoice_${reportId}_${timestamp}_${safeName}`;
        const filePath = path.join(uploadDir, fileName);
        
        await fs.writeFile(filePath, file.buffer);
        return filePath;
    }
    
    // Log d'historique
    async logHistory(reportId, action, changes, userId) {
        try {
            await query(`
                INSERT INTO reconciliation_history (report_id, action, changes, performed_by)
                VALUES ($1, $2, $3, $4)
            `, [reportId, action, JSON.stringify(changes), userId]);
        } catch (err) {
            logger.error('Erreur log history:', err);
        }
    }
    
    getStatusLabel(status) {
        const labels = {
            draft: 'Brouillon',
            pending: 'En attente',
            approved: 'Approuvé',
            rejected: 'Rejeté',
            closed: 'Clôturé'
        };
        return labels[status] || status;
    }
}

module.exports = new ReconciliationService();
