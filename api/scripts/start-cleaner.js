// scripts/start-cleaner.js
const storageCleaner = require('../src/services/storage-cleaner.service');

console.log('🚀 Démarrage du service de nettoyage automatique...');
storageCleaner.startCleaner();

// Garder le processus actif
process.stdin.resume();

process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du cleaner...');
    process.exit(0);
});

