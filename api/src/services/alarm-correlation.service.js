// api/src/services/alarm-correlation.service.js
//
// Corrèle les messages WebSocket "vehicleCommonAlarm" / "vehicleActiveSafeAlarm"
// (les alarmes) avec les messages "vehicleAlarmFile" (les pièces jointes vidéo/image)
// en utilisant alarmNo comme clé commune.
//
// L'ordre d'arrivée des deux messages n'est PAS garanti par la plateforme Hetu :
// le fichier peut arriver avant ou après l'alarme. Ce service stocke temporairement
// ce qui arrive en premier et déclenche un callback dès que les deux parties sont
// réunies pour un alarmNo donné.
//
// IMPORTANT (constaté en production le 27/06/2026) : le champ uploadStatus de
// vehicleAlarmFile vaut systématiquement null, même quand le fichier est déjà
// téléchargeable (vérifié manuellement : curl direct sur filePath → HTTP 200,
// taille exacte = fileSize annoncé). uploadStatus n'est donc PAS fiable et ne
// doit plus être utilisé comme critère. On considère un fichier exploitable
// dès qu'il a un filePath non vide.

const logger = require('../utils/logger');

// TTL avant qu'une entrée orpheline (alarme sans fichier, ou fichier sans alarme)
// soit purgée du cache.
const ENTRY_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Délai de grâce : une fois qu'on a une alarme + au moins 1 fichier exploitable,
// on attend un court instant pour voir si d'autres fichiers (fileNum > 1)
// arrivent, avant de déclencher le traitement. Évite d'envoyer 2 notifications
// si 2 fichiers arrivent à quelques centaines de ms d'écart.
const GRACE_PERIOD_MS = 2000;

// Nettoyage périodique du cache
const CLEANUP_INTERVAL_MS = 60 * 1000;

class AlarmCorrelationService {
  constructor() {
    // alarmNo -> { alarm, files: [], graceTimer, createdAt, triggered }
    this.cache = new Map();
    this._onReady = null; // callback(alarmNo, { alarm, files })

    this.cleanupInterval = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Enregistre le callback appelé dès qu'une alarme + au moins un fichier
   * exploitable (filePath non vide) sont disponibles pour un alarmNo.
   */
  onReady(callback) {
    this._onReady = callback;
  }

  _getOrCreateEntry(alarmNo) {
    let entry = this.cache.get(alarmNo);
    if (!entry) {
      entry = {
        alarm: null,
        files: [],
        graceTimer: null,
        createdAt: Date.now(),
        triggered: false
      };
      this.cache.set(alarmNo, entry);
    }
    return entry;
  }

  /**
   * Appelé à la réception d'un message vehicleCommonAlarm / vehicleActiveSafeAlarm
   */
  registerAlarm(alarmData) {
    const { alarmNo } = alarmData;
    if (!alarmNo) {
      logger.warn('[AlarmCorrelation] Alarme reçue sans alarmNo, impossible de corréler');
      return;
    }

    const entry = this._getOrCreateEntry(alarmNo);
    if (entry.triggered) {
      logger.info(`[AlarmCorrelation] alarmNo=${alarmNo} déjà traité, alarme ignorée`);
      return;
    }
    entry.alarm = alarmData;
    console.log(`[AlarmCorrelation] 📋 Alarme enregistrée alarmNo=${alarmNo}, fileNum attendu=${alarmData.fileNum || 0}, fichiers déjà reçus=${entry.files.length}`);
    this._maybeSchedule(alarmNo);
  }

  /**
   * Appelé à la réception d'un message vehicleAlarmFile.
   * Un fichier est considéré exploitable dès qu'il a un filePath non vide,
   * indépendamment de uploadStatus (non fiable, voir note en tête de fichier).
   */
  registerFile(fileData) {
    const { alarmNo, filePath } = fileData;
    if (!alarmNo) {
      logger.warn('[AlarmCorrelation] Fichier reçu sans alarmNo, impossible de corréler');
      return;
    }
    if (!filePath) {
      console.log(`[AlarmCorrelation] ⚠️ Fichier alarmNo=${alarmNo} sans filePath, ignoré`);
      return;
    }

    const entry = this._getOrCreateEntry(alarmNo);
    if (entry.triggered) {
      logger.info(`[AlarmCorrelation] alarmNo=${alarmNo} déjà traité, fichier ignoré`);
      return;
    }

    // Évite les doublons si le même fichier est repoussé plusieurs fois
    const already = entry.files.find(f => f.filePath === filePath);
    if (!already) {
      entry.files.push(fileData);
    }

    console.log(`[AlarmCorrelation] 📎 Fichier enregistré alarmNo=${alarmNo}, fileName=${fileData.fileName}, total fichiers=${entry.files.length}`);
    this._maybeSchedule(alarmNo);
  }

  _maybeSchedule(alarmNo) {
    const entry = this.cache.get(alarmNo);
    if (!entry || entry.triggered) return;

    const usableFiles = entry.files.filter(f => !!f.filePath);
    if (!entry.alarm || usableFiles.length === 0) {
      // On attend encore l'une des deux moitiés
      return;
    }

    const expectedCount = entry.alarm.fileNum || 1;
    const haveAll = usableFiles.length >= expectedCount;

    // Si on a déjà tout, ou si un timer de grâce est déjà lancé, ne rien refaire
    if (entry.graceTimer) {
      if (haveAll) {
        clearTimeout(entry.graceTimer);
        entry.graceTimer = null;
        this._trigger(alarmNo);
      }
      return;
    }

    if (haveAll) {
      this._trigger(alarmNo);
    } else {
      // On a l'alarme + au moins 1 fichier exploitable, mais pas tous les fichiers attendus.
      // On laisse une courte fenêtre de grâce pour le(s) fichier(s) restant(s), puis on
      // déclenche quand même avec ce qu'on a (mieux vaut envoyer 1 vidéo que rien).
      entry.graceTimer = setTimeout(() => {
        entry.graceTimer = null;
        this._trigger(alarmNo);
      }, GRACE_PERIOD_MS);
    }
  }

  _trigger(alarmNo) {
    const entry = this.cache.get(alarmNo);
    if (!entry || entry.triggered) return;
    entry.triggered = true;

    const usableFiles = entry.files.filter(f => !!f.filePath);
    console.log(`[AlarmCorrelation] 🚀 Déclenchement alarmNo=${alarmNo} avec ${usableFiles.length} fichier(s) exploitable(s)`);

    if (this._onReady) {
      try {
        this._onReady(alarmNo, { alarm: entry.alarm, files: usableFiles });
      } catch (err) {
        logger.error(`[AlarmCorrelation] Erreur dans le callback onReady pour alarmNo=${alarmNo}:`, err.message);
      }
    }

    // On garde l'entrée en cache (marquée triggered) jusqu'au prochain nettoyage,
    // pour ignorer les messages tardifs/dupliqués liés au même alarmNo.
  }

  /**
   * Permet de vérifier si une alarme a déjà été déclenchée (utile pour le worker / retry)
   */
  isTriggered(alarmNo) {
    return !!this.cache.get(alarmNo)?.triggered;
  }

  _cleanup() {
    const now = Date.now();
    for (const [alarmNo, entry] of this.cache.entries()) {
      if (now - entry.createdAt > ENTRY_TTL_MS) {
        if (entry.graceTimer) clearTimeout(entry.graceTimer);
        this.cache.delete(alarmNo);
      }
    }
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }
}

module.exports = new AlarmCorrelationService();
