const winston = require('winston');
require('winston-daily-rotate-file'); // ← installe ça : npm i winston-daily-rotate-file
const path = require('path');

const logDir = '/var/log/numericexport';

// Format commun (json + timestamp + erreurs stack + metadata)
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format console (seulement dev)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple()
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: jsonFormat,
  defaultMeta: { service: 'nextltd-api', env: process.env.NODE_ENV },
  transports: [
    // Erreurs critiques → fichier dédié + rotation quotidienne
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
    }),

    // Tous les logs → rotation quotidienne
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '30d',
    }),
  ],
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
    }),
  ],
});

// Console uniquement en dev
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug',
  }));
}

// Option très utile en prod : silent si variable d'env le demande
if (process.env.LOG_SILENT === 'true') {
  logger.silent = true;
}

module.exports = logger;
