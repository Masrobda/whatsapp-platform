// api/src/routes/v1/alarm.routes.js
const alarmController = require('../../controllers/alarm.controller');
const { authenticateBoth } = require('../../middlewares/authenticate-both');

async function alarmRoutes(fastify, opts) {
  fastify.post('/send-video', { preValidation: authenticateBoth }, alarmController.sendAlarmVideo);
  // NOUVELLE ROUTE : Test WebSocket (simule une alarme)
  fastify.post('/test-websocket', { preValidation: authenticateBoth }, alarmController.testWebSocketAlarm);
}

module.exports = alarmRoutes;
