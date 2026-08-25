// api/src/services/hetu-websocket.service.js
const WebSocket = require('ws');
const logger = require('../utils/logger');
const authService = require('./alarm-auth.service');
const alarmVideoService = require('./alarm-video.service');
const { uploadAndConvertVideoFromStream, uploadAndConvertImageFromStream } = require('./storage-upload.service');
const vehicleMappingService = require('./vehicle-mapping.service');
const { normalizePhoneNumber } = require('../utils/phone-validator');
const { markVideoAsSent, isVideoAlreadySent } = require('./alarm-notification.service');
const { addAlarmToQueue } = require('./alarm-queue.service');
const alarmCorrelation = require('./alarm-correlation.service');
const hetuAlarmDetailService = require('./hetu-alarm-detail.service');
const { v4: uuidv4 } = require('uuid');

const alarmLabels = {
  emergencyAlarm: "Alerte d'urgence détectée",
  speedingAlarm: "Excès de vitesse détectée",
  fatigueDrivingAlarm: "Conduite fatiguée détectée",
  fatigueDriving: "Conduite fatiguée détectée",
  forwardCollision: "Collision frontale détectée",
  laneDeparture: "Franchissement de ligne détectée",
  pedestrianCollision: "Risque piéton détectée",
  makeCalls: "Appel au volant détectée",
};

function getAlarmLabel(type) {
  return alarmLabels[type] || `⚠️ Alarme ${type}`;
}

const FALLBACK_REST_DELAY_MS = 30 * 1000; // 30 secondes

class HetuWebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
    this.username = null;
    this.language = 'fr-FR';
    this.fallbackTimers = new Map();
    alarmCorrelation.onReady((alarmNo, payload) => this._onAlarmReady(alarmNo, payload));
  }

  async connect(username, language = 'fr-FR') {
    console.log('[HetuWS] 🔌 Tentative de connexion...');
    this.username = username || process.env.HETU_WEBSOCKET_USERNAME;
    this.language = language;
    if (!this.username) {
      console.log('[HetuWS] ❌ Username non défini');
      logger.error('[HetuWS] Username non défini (HETU_WEBSOCKET_USERNAME)');
      return;
    }

    try {
      const token = await authService.getToken();
      console.log('[HetuWS] 🔑 Token obtenu');
      const encodedToken = encodeURIComponent(token);
      const url = `${process.env.HETU_WEBSOCKET_URL || 'ws://api.hetuv2x.com:20007'}/vehicleWs/${this.username}/${encodedToken}/${this.language}`;
      console.log(`[HetuWS] 🌐 Connexion à ${url}`);
      logger.info(`[HetuWS] Connexion à ${url}`);

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[HetuWS] ✅ WebSocket connecté !');
        logger.info('[HetuWS] Connecté');
        this.subscribe();
        this.startHeartbeat();
      });

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(message);
        } catch (err) {
          logger.error('[HetuWS] Erreur parsing message:', err.message);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[HetuWS] ❌ Erreur connexion:', err.message);
        logger.error('[HetuWS] Erreur WebSocket:', err.message);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.stopHeartbeat();
        logger.warn('[HetuWS] Déconnecté, tentative de reconnexion...');
        this.reconnect();
      });
    } catch (err) {
      logger.error('[HetuWS] Erreur connexion:', err.message);
      this.reconnect();
    }
  }

  subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const subscribeMsg = {
      messageType: 'subscribe',
      data: {
        dataTypes: ['vehicleCommonAlarm', 'vehicleActiveSafeAlarm', 'vehicleAlarmFile'],
        vehicleOnlineInterval: 1
      }
    };
    this.ws.send(JSON.stringify(subscribeMsg));
    logger.info('[HetuWS] Abonnement envoyé (vehicleCommonAlarm, vehicleActiveSafeAlarm, vehicleAlarmFile)');
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ messageType: 'heartBeat', data: Date.now() }));
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[HetuWS] Nombre maximal de tentatives de reconnexion atteint');
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    logger.info(`[HetuWS] Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    setTimeout(() => this.connect(this.username, this.language), delay);
  }

  async handleMessage(message) {
    const { messageType, data } = message;
    if (!data) return;
    switch (messageType) {
      case 'vehicleCommonAlarm':
      case 'vehicleActiveSafeAlarm':
        this.handleIncomingAlarm(data);
        break;
      case 'vehicleAlarmFile':
        this.handleIncomingFile(data);
        break;
      default:
        // ignorer
    }
  }

  async handleAlarm(alarmData) {
    return this.handleIncomingAlarm(alarmData);
  }

  async simulateAlarmFile(fileData) {
    return this.handleIncomingFile(fileData);
  }

  handleIncomingAlarm(alarmData) {
    const { alarmNo, licenseNum, alarmType, startTime } = alarmData;
    console.log(`[HetuWS] 🔔 Alarme reçue: alarmNo=${alarmNo}, licenseNum=${licenseNum}, alarmType=${alarmType}, startTime=${startTime}`);

    if (!licenseNum) {
      console.log('[HetuWS] ❌ Alarme sans plaque, ignorée');
      logger.warn('[HetuWS] Alarme sans plaque');
      return;
    }
    if (!alarmNo) {
      console.log('[HetuWS] ⚠️ Alarme sans alarmNo, bascule directe sur la recherche REST');
      this._fallbackRestSearch(alarmData);
      return;
    }

    alarmCorrelation.registerAlarm(alarmData);
    this._scheduleFallback(alarmNo, alarmData);
  }

  handleIncomingFile(fileData) {
    const { alarmNo, fileName, filePath, fileType, fileSize } = fileData;
    console.log(`[HetuWS] 📎 Fichier reçu: alarmNo=${alarmNo}, fileName=${fileName}, fileType=${fileType}, fileSize=${fileSize}`);
    console.log(`[HetuWS] 📎 filePath=${filePath}`);

    if (!alarmNo) {
      console.log('[HetuWS] ⚠️ Fichier reçu sans alarmNo, impossible de le corréler, ignoré');
      return;
    }
    if (!filePath) {
      console.log(`[HetuWS] ⚠️ Fichier alarmNo=${alarmNo} sans filePath, ignoré`);
      return;
    }
    alarmCorrelation.registerFile(fileData);
  }

  _scheduleFallback(alarmNo, alarmData) {
    if (this.fallbackTimers.has(alarmNo)) return;
    const timer = setTimeout(() => {
      this.fallbackTimers.delete(alarmNo);
      if (alarmCorrelation.isTriggered(alarmNo)) {
        console.log(`[HetuWS] ✅ alarmNo=${alarmNo} déjà traité via vehicleAlarmFile, fallback REST annulé`);
        return;
      }
      console.log(`[HetuWS] ⏰ Aucun vehicleAlarmFile reçu pour alarmNo=${alarmNo} après ${FALLBACK_REST_DELAY_MS / 1000}s, bascule sur la recherche REST`);
      this._fallbackRestSearch(alarmData);
    }, FALLBACK_REST_DELAY_MS);
    this.fallbackTimers.set(alarmNo, timer);
  }

  /**
   * Enrichit les données d'une alarme via l'API REST Hetu (FORCE)
   */
  async _enrichAlarmData(alarmData, licenseNum, alarmNo, startTime) {
    console.log(`[HetuWS] 🔍 Enrichissement FORCE pour alarmNo=${alarmNo}`);
    if (!alarmNo) {
      console.log('[HetuWS] ⚠️ Pas d\'alarmNo, impossible d\'enrichir');
      return alarmData;
    }

    console.log(`[HetuWS] 📡 Appel REST pour alarmNo=${alarmNo}`);
    const details = await hetuAlarmDetailService.getAlarmDetails(licenseNum, alarmNo, startTime);
    if (!details) {
      console.log(`[HetuWS] ⚠️ Aucun détail trouvé pour alarmNo=${alarmNo}, on garde les données brutes`);
      return alarmData;
    }

    const enriched = {
      ...alarmData,
      location: details.location || alarmData.location,
      latitude: details.latitude !== undefined ? details.latitude : alarmData.latitude,
      longitude: details.longitude !== undefined ? details.longitude : alarmData.longitude,
      speed: details.alarmSpeed !== undefined ? details.alarmSpeed : (alarmData.speed || alarmData.alarmSpeed || 0),
      alarmSpeed: details.alarmSpeed !== undefined ? details.alarmSpeed : (alarmData.alarmSpeed || 0),
      driverName: details.driverName || alarmData.driverName,
      motorcadeName: details.motorcadeName || alarmData.motorcadeName,
    };

    console.log(`[HetuWS] ✅ Données enrichies: latitude=${enriched.latitude}, longitude=${enriched.longitude}, speed=${enriched.speed}`);
    return enriched;
  }

  async _onAlarmReady(alarmNo, { alarm, files }) {
    const timer = this.fallbackTimers.get(alarmNo);
    if (timer) {
      clearTimeout(timer);
      this.fallbackTimers.delete(alarmNo);
    }

    if (!files || files.length === 0) {
      console.log(`[HetuWS] ⚠️ alarmNo=${alarmNo} déclenché mais sans fichier, recherche REST de secours`);
      await this._fallbackRestSearch(alarm);
      return;
    }

    const enrichedAlarm = await this._enrichAlarmData(alarm, alarm.licenseNum, alarmNo, alarm.startTime);

    const sortedFiles = [...files].sort((a, b) => {
      const aIsVideo = /\.(mp4|mov|avi)$/i.test(a.filePath || a.fileName || '');
      const bIsVideo = /\.(mp4|mov|avi)$/i.test(b.filePath || b.fileName || '');
      return (aIsVideo === bIsVideo) ? 0 : (aIsVideo ? -1 : 1);
    });

    console.log(`[HetuWS] 📦 alarmNo=${alarmNo} -> ${sortedFiles.length} fichier(s)`);

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const delayMs = i === 0 ? 0 : 3000;
      await this._processSingleFile(enrichedAlarm, file, delayMs);
    }
  }

  /**
   * Traite un fichier individuel (corrigé avec les bonnes variables)
   */
  async _processSingleFile(alarmData, fileInfo, delayMs = 0) {
    const {
      licenseNum,
      alarmType,
      startTime,
      location,
      latitude,
      longitude,
      speed,
      alarmSpeed,
      driverName,
      motorcadeName,
      alarmNo,
      alarmFlag
    } = alarmData;

    const { filePath, fileId, fileSize, viaWebSocket = true } = fileInfo;

    console.log(`[HetuWS] _processSingleFile: latitude=${latitude}, longitude=${longitude}, location=${location}, alarmSpeed=${alarmSpeed}`);

    // --- Position ---
    let lat = parseFloat(latitude);
    let lon = parseFloat(longitude);
    let pos = '';

    if (!isNaN(lat) && !isNaN(lon)) {
      pos = `${lat},${lon}`;
    } else if (location && location.includes(',')) {
      const parts = location.split(',').map(s => s.trim());
      if (parts.length === 2) {
        lon = parseFloat(parts[0]);
        lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
          pos = `${lat},${lon}`;
        }
      }
    }

    const gps = pos || 'N/A';
    const position = pos || '';

    // --- Vitesse ---
    let speedValue = parseFloat(speed || alarmSpeed || 0);
    if (!speedValue && alarmFlag) {
      try {
        const flag = typeof alarmFlag === 'string' ? JSON.parse(alarmFlag) : alarmFlag;
        speedValue = parseFloat(flag?.alarmSpeed || flag?.speed || flag?.vehicleSpeed || 0);
      } catch (_) {}
    }
    if (isNaN(speedValue)) speedValue = 0;

    // --- Téléphone ---
    const phone = await vehicleMappingService.getPhoneByLicense(licenseNum);
    const recipient = normalizePhoneNumber(phone);
    if (!recipient) {
      console.log(`[HetuWS] ❌ Aucun téléphone pour ${licenseNum}`);
      return;
    }

    // Vérifier doublon
    const alreadySent = await isVideoAlreadySent(fileId, filePath);
    if (alreadySent) {
      console.log(`[HetuWS] ⚠️ Média déjà envoyé pour fileId=${fileId} / alarmNo=${alarmNo}, on arrête ce fichier`);
      return;
    }

    // --- Téléchargement ---
    let stream, originalName;
    if (viaWebSocket) {
      const result = await alarmVideoService.downloadFromUrl(filePath, licenseNum, alarmType, fileSize);
      stream = result.stream;
      originalName = result.originalName;
    } else {
      const result = await alarmVideoService.downloadVideoByPath(filePath, licenseNum, alarmType);
      stream = result.stream;
      originalName = result.originalName;
    }

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath);
    const mediaType = isImage ? 'image' : 'video';

    const uploadResult = isImage
      ? await uploadAndConvertImageFromStream(stream, originalName, process.env.SYSTEM_CLIENT_ID, licenseNum)
      : await uploadAndConvertVideoFromStream(stream, originalName, process.env.SYSTEM_CLIENT_ID, licenseNum);

    if (!uploadResult.success) {
      console.log(`[HetuWS] ❌ Échec upload pour alarmNo=${alarmNo}: ${uploadResult.error}`);
      return;
    }

    const mediaUrl = uploadResult.publicUrl;
    console.log(`[HetuWS] ✅ Média uploadé: ${mediaUrl} (${mediaType})`);

    // --- Template ---
    const alarmLabel = getAlarmLabel(alarmType);
    const vehicleInfo = `${licenseNum}${motorcadeName ? ` (${motorcadeName})` : ''}`;
    const driver = driverName || 'Non spécifié';
    const driverPhone = recipient;
    const time = startTime ? startTime.replace('T', ' ').slice(0, 19) : new Date().toISOString().slice(0, 19);

    const templateParams = {
      "1": mediaUrl,
      "2": alarmLabel,
      "3": vehicleInfo,
      "4": driver,
      "5": driverPhone,
      "6": position,
      "7": gps,
      "8": speedValue + ' km/h',
      "9": time
    };

    const templateName = mediaType === 'image' ? 'next_alarm_image_02' : 'next_alarm_video_02';
    const messageId = uuidv4();
          const alarmJobData = {
        licenseNum,
        alarmType,
        alarmNo,
        fileId,
        filePath,
        startTime: time,
        recipientPhone: recipient,
        clientId: process.env.SYSTEM_CLIENT_ID,
        alarmLabel,
        templateName,
        templateParams,           // déjà présent
        messageId,
        channelNumber: process.env.DEFAULT_WHATSAPP_NUMBER,
        
        // === DONNÉES ENRICHIES AJOUTÉES ===
        location: alarmData.location,
        latitude: alarmData.latitude,
        longitude: alarmData.longitude,
        speed: alarmData.speed,
        alarmSpeed: alarmData.alarmSpeed || alarmData.speed,
        driverName: alarmData.driverName,
        motorcadeName: alarmData.motorcadeName
      };

    console.log(`[HetuWS] 📤 Ajout à la queue alarm-processing pour ${recipient} (messageId=${messageId}, alarmNo=${alarmNo}, delay=${delayMs}ms)`);
    const queueResult = await addAlarmToQueue(alarmJobData, delayMs);
    if (queueResult.success) {
      await markVideoAsSent(fileId, filePath, licenseNum, alarmType, recipient, messageId);
      console.log(`[HetuWS] ✅ Alarme ${mediaType} mise en file (alarm-processing) pour ${recipient} (messageId=${messageId})`);
    } else {
      console.log(`[HetuWS] ❌ Échec ajout à la queue alarme: ${queueResult.error || 'inconnu'}`);
    }
  }

  /**
   * Filet de sécurité : recherche REST si aucun fichier n'arrive par WebSocket.
   */
  async _fallbackRestSearch(alarmData) {
    const { licenseNum, alarmType, startTime } = alarmData;

    if (!startTime) {
      console.log('[HetuWS] ⚠️ Pas de startTime, impossible de faire une recherche REST de secours');
      await this._scheduleDeferredRetry(alarmData, null);
      return;
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + 120000);
    const startStr = start.toISOString().replace('T', ' ').slice(0, 19);
    const endStr = end.toISOString().replace('T', ' ').slice(0, 19);
    console.log(`[HetuWS] 🔎 [Fallback REST] Recherche média pour ${licenseNum} entre ${startStr} et ${endStr}`);

    try {
      const result = await alarmVideoService.fetchAllVideos(licenseNum, startStr, endStr, alarmType);
      const videos = result.data?.list || [];
      const video = videos.find(v => v.uploadStatus === 1) || videos.find(v => !!v.filePath);
      if (video) {
        const enrichedAlarm = await this._enrichAlarmData(alarmData, licenseNum, alarmData.alarmNo, startTime);
        await this._processSingleFile(enrichedAlarm, { filePath: video.filePath, fileId: video.fileId, viaWebSocket: false }, 0);
        return;
      }
      console.log(`[HetuWS] ⚠️ [Fallback REST] Aucune vidéo avec filePath trouvée pour ${licenseNum}`);
    } catch (err) {
      console.log(`[HetuWS] ❌ [Fallback REST] Erreur recherche média:`, err.message);
    }

    await this._scheduleDeferredRetry(alarmData, null);
  }

  async _scheduleDeferredRetry(alarmData, fileInfo) {
    const { licenseNum, alarmType, startTime } = alarmData;
    const phone = await vehicleMappingService.getPhoneByLicense(licenseNum);
    const recipient = normalizePhoneNumber(phone);
    if (!recipient) {
      console.log(`[HetuWS] ❌ Aucun téléphone pour ${licenseNum}, abandon`);
      return;
    }

    const retryJobData = {
      ...alarmData,
      retryCount: 1,
      maxRetries: 5,
      originalStartTime: startTime,
      recipientPhone: recipient,
      clientId: process.env.SYSTEM_CLIENT_ID,
      channelNumber: process.env.DEFAULT_WHATSAPP_NUMBER,
      messageId: uuidv4()
    };
    const queueResult = await addAlarmToQueue(retryJobData, 120000);
    if (queueResult.success) {
      console.log(`[HetuWS] 📅 Job différé ajouté pour ${recipient} (retry 1/5, alarmNo=${alarmData.alarmNo || 'n/a'})`);
    } else {
      console.error(`[HetuWS] ❌ Échec ajout job différé`);
    }
  }
}

module.exports = new HetuWebSocketService();
