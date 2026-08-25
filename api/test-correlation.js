// test-correlation.js (à lancer avec: node test-correlation.js)
const correlation = require('./src/services/alarm-correlation.service');

correlation.onReady((alarmNo, payload) => {
  console.log('✅ READY', alarmNo, payload.files.length, 'fichier(s)');
});

// Cas 1 : alarme arrive avant le fichier
correlation.registerAlarm({ alarmNo: 'TEST1', licenseNum: 'LT404NK', fileNum: 1 });
setTimeout(() => {
  correlation.registerFile({ alarmNo: 'TEST1', filePath: '/x.mp4', uploadStatus: 1, fileName: 'x.mp4' });
}, 500);

// Cas 2 : fichier arrive avant l'alarme
setTimeout(() => {
  correlation.registerFile({ alarmNo: 'TEST2', filePath: '/y.mp4', uploadStatus: 1, fileName: 'y.mp4' });
}, 1000);
setTimeout(() => {
  correlation.registerAlarm({ alarmNo: 'TEST2', licenseNum: 'LT404NK', fileNum: 1 });
}, 1500);

setTimeout(() => process.exit(0), 6000);
