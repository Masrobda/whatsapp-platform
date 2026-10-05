// api/src/queues/socadel.queue.js
'use strict';

const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');

const QUEUE_NAME = 'socadel-jobs';

const socadelQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 500 }
  }
});

/**
 * Enfile une synchronisation globale (batch SQL)
 */
async function enqueueSocadelSync({ requestedBy } = {}) {
  const jobId = `socadel_sync_${Date.now()}`;
  await socadelQueue.add(
    'sync',
    { requestedBy: requestedBy || 'system', at: new Date().toISOString() },
    { jobId, priority: 1 }
  );
  return jobId;
}

module.exports = {
  QUEUE_NAME,
  socadelQueue,
  enqueueSocadelSync
};
