const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const logger = require('../utils/logger');

const queueName = 'alarm-processing';
let queueInstance = null;

function getQueue() {
  if (!queueInstance) {
    queueInstance = new Queue(queueName, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 }
      }
    });
    logger.info(`Queue ${queueName} initialisée`);
  }
  return queueInstance;
}

async function addAlarmToQueue(data, delay = 0) {
  const queue = getQueue();
  const jobId = `alarm_${data.fileId || data.licenseNum || 'unknown'}_${Date.now()}`;
  const job = await queue.add('process-alarm', data, {
    jobId,
    priority: 1,
    delay: delay
  });
  logger.info(`Job ajouté: ${jobId} (delay ${delay}ms)`);
  return { success: true, jobId: job.id };
}

module.exports = { addAlarmToQueue };
