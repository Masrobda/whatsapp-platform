// src/controllers/reconciliation.controller.js
const reconciliationService = require('../services/reconciliation.service');
const logger = require('../utils/logger');

async function generateReportHandler(request, reply) {
    try {
        const userId = request.user.id;
        const report = await reconciliationService.generateReport(userId, request.body);
        return reply.code(201).send({ 
            success: true, 
            message: 'Rapport généré avec succès',
            data: report 
        });
    } catch (error) {
        logger.error('Erreur génération rapport:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}
 
 async function updateReportHandler(request, reply) {
    try {
        const { id } = request.params;
        const userId = request.user.id;
        
        console.log('=== UPDATE REPORT HANDLER ===');
        console.log('ID:', id);
        console.log('Body:', request.body);
        console.log('File:', request.file);
        
        // Extraire les données du body (que ce soit JSON ou FormData)
        let updateData = {};
        
        // Si c'est du JSON
        if (request.body && typeof request.body === 'object') {
            updateData = { ...request.body };
        }
        
        // Si c'est du multipart/form-data, les valeurs sont dans request.body
        if (request.body) {
            if (request.body.provider_messages_count) {
                updateData.provider_messages_count = request.body.provider_messages_count;
            }
            if (request.body.provider_invoice_amount) {
                updateData.provider_invoice_amount = request.body.provider_invoice_amount;
            }
            if (request.body.provider_invoice_number) {
                updateData.provider_invoice_number = request.body.provider_invoice_number;
            }
            if (request.body.notes) {
                updateData.notes = request.body.notes;
            }
        }
        
        // Gérer le fichier
        if (request.file) {
            updateData.invoice_file = {
                buffer: request.file.buffer,
                originalname: request.file.filename
            };
        }
        
        console.log('Update data final:', updateData);
        
        const report = await reconciliationService.updateReport(id, updateData, userId);
        
        console.log('Rapport mis à jour:', report);
        
        return reply.code(200).send({ 
            success: true, 
            message: 'Rapport mis à jour',
            data: report 
        });
    } catch (error) {
        console.error('Erreur mise à jour:', error);
        logger.error('Erreur mise à jour:', error);
        return reply.code(500).send({
            success: false,
            message: error.message,
            details: error.toString()
        });
    }
}

async function getReportsHandler(request, reply) {
    try {
        const result = await reconciliationService.getReports(request.query);
        return reply.code(200).send({ success: true, ...result });
    } catch (error) {
        logger.error('Erreur récupération:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

async function getReportByIdHandler(request, reply) {
    try {
        const { id } = request.params;
        const report = await reconciliationService.getReportById(id);
        if (!report) {
            return reply.code(404).send({
                success: false,
                message: 'Rapport non trouvé'
            });
        }
        return reply.code(200).send({ success: true, data: report });
    } catch (error) {
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

async function getBSPProvidersHandler(request, reply) {
    try {
        const providers = await reconciliationService.getBSPProviders();
        return reply.code(200).send({ success: true, providers });
    } catch (error) {
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

async function getStatisticsHandler(request, reply) {
    try {
        const statistics = await reconciliationService.getStatistics();
        return reply.code(200).send({ success: true, statistics });
    } catch (error) {
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

async function recalculateHandler(request, reply) {
    try {
        const { id } = request.params;
        const report = await reconciliationService.recalculateDiscrepancies(id);
        return reply.code(200).send({ 
            success: true, 
            message: 'Écarts recalculés',
            data: report 
        });
    } catch (error) {
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

 async function validateHandler(request, reply) {
    try {
        const { id } = request.params;
        const { status, notes } = request.body;
        const userId = request.user.id;
        
        console.log('=== VALIDATE HANDLER ===');
        console.log('ID:', id);
        console.log('Status:', status);
        console.log('Notes:', notes);
        console.log('UserId:', userId);
        
        // Vérifier que le status est valide
        if (!status || !['approved', 'rejected', 'closed'].includes(status)) {
            return reply.code(400).send({
                success: false,
                message: 'Status invalide. Utilisez: approved, rejected, ou closed'
            });
        }
        
        const report = await reconciliationService.validateReport(id, status, notes || null, userId);
        
        return reply.code(200).send({ 
            success: true, 
            message: `Rapport ${status === 'approved' ? 'approuvé' : status === 'rejected' ? 'rejeté' : 'clôturé'} avec succès`,
            data: report 
        });
    } catch (error) {
        console.error('Erreur validation:', error);
        logger.error('Erreur validation:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

async function exportHandler(request, reply) {
    try {
        const { id } = request.params;
        const csvBuffer = await reconciliationService.exportToCSV(id);
        
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename=reconciliation_${id}.csv`);
        reply.send(csvBuffer);
    } catch (error) {
        logger.error('Erreur export:', error);
        return reply.code(500).send({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    generateReportHandler,
    updateReportHandler,
    getReportsHandler,
    getReportByIdHandler,
    getBSPProvidersHandler,
    getStatisticsHandler,
    recalculateHandler,
    validateHandler,
    exportHandler
};
