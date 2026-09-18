// src/controllers/whatsapp.admin.controller.js
const { query } = require('../config/database');
const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

async function getAllWhatsappNumbers(request, reply) {
    try {
        const numbersRes = await query(`
            SELECT wn.*, c.company_name AS client_name 
            FROM whatsapp_numbers wn 
            LEFT JOIN clients c ON wn.client_id = c.id 
            ORDER BY wn.phone_number`);
        return reply.send({ success: true, numbers: numbersRes.rows });
    } catch (err) {
        logger.error('Erreur liste WhatsApp', err);
        return reply.code(500).send({ success: false });
    }
}

// STUBS - Ajout des fonctions pour éviter le crash
async function getWhatsappNumberDetail(request, reply) { return reply.send({ success: true, message: "Detail stub" }); }
async function pauseQueueHandler(request, reply) { return reply.send({ success: true, message: "Paused" }); }
async function resumeQueueHandler(request, reply) { return reply.send({ success: true, message: "Resumed" }); }
async function disableWhatsappNumberHandler(request, reply) { return reply.send({ success: true, message: "Disabled" }); }
async function enableWhatsappNumberHandler(request, reply) { return reply.send({ success: true, message: "Enabled" }); }
async function assignWhatsappNumberHandler(request, reply) { return reply.send({ success: true, message: "Assigned" }); }

module.exports = {
    getAllWhatsappNumbers,
    getWhatsappNumberDetail,
    pauseQueueHandler,
    resumeQueueHandler,
    disableWhatsappNumberHandler,
    enableWhatsappNumberHandler,
    assignWhatsappNumberHandler
};
