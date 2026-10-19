const { query } = require('./src/config/database');
const logger = require('./src/utils/logger');

async function processStatsBatch() {
  try {
    console.log('🔄 Processing stats batch...');
    const result = await query('SELECT process_stats_buffer_batch()');
    console.log('✅ Stats batch processed at', new Date().toISOString());
  } catch (error) {
    console.error('❌ Error processing stats:', error.message);
    logger.error('Stats worker error:', error);
  }
}

// Attendre 10 secondes avant le premier traitement
setTimeout(() => {
  console.log('🚀 Stats worker started (every 10 seconds)');
  // Lancer immédiatement
  processStatsBatch();
  // Puis toutes les 10 secondes
  setInterval(processStatsBatch, 10000);
}, 5000);

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log('👋 Stats worker stopped');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('👋 Stats worker terminated');
  process.exit();
});
