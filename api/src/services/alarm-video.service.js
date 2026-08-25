// api/src/services/alarm-video.service.js
const axios = require('axios');
const logger = require('../utils/logger');
const authService = require('./alarm-auth.service');

class AlarmVideoService {
  constructor() {
    this.baseURL = process.env.ALARM_API_BASE_URL || 'https://api.hetuv2x.com';
  }

  async _callApi(method, path, body = null, retry = true) {
    const headers = await authService.getHeaders();
    const url = `${this.baseURL}${path}`;
    try {
      const response = await axios({ method, url, data: body, headers, timeout: 20000 });
      if (response.data.code === undefined && response.status === 200) {
        logger.warn('[Hetu] Réponse sans code, mais HTTP 200 -> accepté');
        return { code: 200, data: response.data };
      }
      if (response.data.code === 200) return response.data;
      if (response.data.code === 500 && response.data.message === 'CODE_0572') {
        logger.warn('[Hetu] CODE_0572 -> aucune donnée');
        return { code: 200, data: { list: [] } };
      }
      throw new Error(`API error: CODE_${response.data.code} - ${response.data.message || 'Unknown'}`);
    } catch (err) {
      if (retry && err.response?.status === 401) {
        logger.warn('[Hetu] Token expiré, refresh...');
        authService.forceRefresh();
        return this._callApi(method, path, body, false);
      }
      throw err;
    }
  }

  /**
   * Télécharge directement un fichier depuis son URL complète (ex: le filePath
   * fourni par le message WebSocket vehicleAlarmFile, qui est une URL FTP HTTP
   * publique du type http://IP:PORT/ftp/upload/...).
   *
   * IMPORTANT : ne PAS passer par /vehicle-openapi/historyreplay/download dans
   * ce cas — cet endpoint Hetu est conçu pour un chemin interne, pas pour une
   * URL complète, et renvoie une erreur 500 (JSON {"code":500,...}) silencieuse
   * qui était auparavant écrite par erreur comme si c'était le fichier vidéo.
   *
   * Vérifie aussi que la taille téléchargée correspond bien à expectedSize
   * (fourni par vehicleAlarmFile, champ fileSize) afin de détecter tout fichier
   * d'erreur déguisé en flux vidéo (typiquement quelques dizaines d'octets de
   * JSON au lieu de plusieurs centaines de Ko / quelques Mo).
   */
  async downloadFromUrl(fileUrl, licenseNum, alarmType, expectedSize = null) {
    logger.info(`[AlarmVideo] Téléchargement direct depuis URL: ${fileUrl}`);

    const streamResponse = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 120000,
      validateStatus: () => true
    });

    if (streamResponse.status !== 200) {
      throw new Error(`Téléchargement échoué (status ${streamResponse.status}) pour ${fileUrl}`);
    }

    const contentType = streamResponse.headers['content-type'] || '';
    const contentLength = parseInt(streamResponse.headers['content-length'] || '0', 10);
    logger.info(`[AlarmVideo] Réponse: Content-Type=${contentType}, Content-Length=${contentLength}`);

    // Détection précoce d'une fausse réponse JSON d'erreur (ex: {"code":500,...})
    // déguisée en succès HTTP 200. On vérifie le Content-Type ET, si disponible,
    // la taille attendue transmise par vehicleAlarmFile.
    if (contentType.includes('application/json')) {
      throw new Error(`Réponse JSON inattendue au lieu d'un fichier média pour ${fileUrl} (Content-Type=${contentType})`);
    }
    if (expectedSize && contentLength && Math.abs(contentLength - expectedSize) > expectedSize * 0.05) {
      // Tolérance de 5% : la taille réelle peut légèrement différer de l'annonce
      throw new Error(`Taille du fichier suspecte: reçu ${contentLength} octets, attendu ~${expectedSize} octets pour ${fileUrl}`);
    }

    const extMatch = fileUrl.match(/\.(\w+)(\?|$)/);
    const ext = extMatch ? extMatch[1] : 'mp4';
    const originalName = `${licenseNum}_${alarmType || 'alarm'}_${Date.now()}.${ext}`;

    return {
      stream: streamResponse.data,
      originalName,
      startTime: new Date().toISOString(),
      duration: 0,
      declaredSize: contentLength
    };
  }

  /**
   * Télécharge directement une vidéo à partir de son filePath, en passant par
   * l'endpoint Hetu /vehicle-openapi/historyreplay/download (chemin RELATIF
   * interne attendu par cet endpoint, PAS une URL complète).
   *
   * Conservé pour compatibilité avec le fallback REST (fetchAllVideos /
   * fetchFirstAlarmVideo), où filePath peut être un chemin interne Hetu plutôt
   * qu'une URL FTP complète. Pour les fichiers reçus via vehicleAlarmFile
   * (URL FTP complète), utiliser downloadFromUrl à la place.
   */
  async downloadVideoByPath(filePath, licenseNum, alarmType) {
    const headers = await authService.getHeaders();
    const downloadUrl = `${this.baseURL}/vehicle-openapi/historyreplay/download?filePath=${encodeURIComponent(filePath)}`;
    logger.info(`[AlarmVideo] Téléchargement direct: ${downloadUrl}`);

    const streamResponse = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      headers,
      timeout: 120000,
      validateStatus: () => true
    });

    if (streamResponse.status !== 200) {
      throw new Error(`Téléchargement échoué (status ${streamResponse.status})`);
    }

    const contentType = streamResponse.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      throw new Error(`Réponse JSON inattendue au lieu d'un fichier média (Content-Type=${contentType})`);
    }

    const originalName = `${licenseNum}_${alarmType || 'alarm'}_${Date.now()}.mp4`;
    return {
      stream: streamResponse.data,
      originalName,
      startTime: new Date().toISOString(),
      duration: 0
    };
  }

  /**
   * Récupère toutes les vidéos pour une plaque donnée (sans filtration alarmType)
   */
  async fetchAllVideos(licenseNum, startTime, endTime, alarmType = null) {
    const payload = {
      licenseNum,
      startTime,
      endTime,
      fileType: 1
    };

    const result = await this._callApi('POST', '/vehicle-openapi/historyreplay/media/file', payload);
    let videos = result.data?.list || [];

    if (alarmType && videos.length > 0) {
      videos = videos.filter(v => v.alarmType === alarmType);
    }

    return { data: { list: videos } };
  }

  /**
   * Récupère la première vidéo d'alarme et la télécharge
   */
  async fetchFirstAlarmVideo(licenseNum, alarmType, startTime, endTime, channelNum = null) {
    const payload = {
      licenseNum,
      startTime,
      endTime,
      fileType: 1
    };
    if (channelNum) payload.channelNum = channelNum;

    logger.info(`[AlarmVideo] Requête media/file: ${JSON.stringify(payload)}`);
    const result = await this._callApi('POST', '/vehicle-openapi/historyreplay/media/file', payload);
    let videos = result.data?.list || [];

    if (alarmType && videos.length > 0) {
      videos = videos.filter(v => v.alarmType === alarmType);
      logger.info(`[AlarmVideo] Filtrage alarmType=${alarmType} → ${videos.length} vidéo(s)`);
    }

    if (videos.length === 0) {
      throw new Error(`Aucune vidéo trouvée pour ${licenseNum}${alarmType ? ` avec alarme ${alarmType}` : ''} entre ${startTime} et ${endTime}`);
    }

    const video = videos.find(v => v.uploadStatus === 1) || videos[0];
    if (!video.filePath) throw new Error(`filePath manquant pour la vidéo ${video.fileId}`);

    logger.info(`[AlarmVideo] Vidéo sélectionnée: fileId=${video.fileId}, path=${video.filePath}`);

    const headers = await authService.getHeaders();
    const downloadUrl = `${this.baseURL}/vehicle-openapi/historyreplay/download?filePath=${encodeURIComponent(video.filePath)}`;
    logger.info(`[AlarmVideo] Téléchargement depuis: ${downloadUrl}`);

    const streamResponse = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      headers,
      timeout: 120000,
      validateStatus: () => true
    });

    if (streamResponse.status !== 200) {
      throw new Error(`Téléchargement échoué (status ${streamResponse.status})`);
    }

    const contentLength = streamResponse.headers['content-length'];
    logger.info(`[AlarmVideo] Taille annoncée: ${contentLength || 'inconnue'} octets`);

    const contentType = streamResponse.headers['content-type'];
    if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
      logger.warn(`[AlarmVideo] Content-Type inattendu: ${contentType}`);
    }
    if (contentType && contentType.includes('application/json')) {
      throw new Error(`Réponse JSON inattendue au lieu d'un fichier média (Content-Type=${contentType})`);
    }

    const originalName = `${licenseNum}_${alarmType || 'alarm'}_${(video.fileTime || '').replace(/[-: ]/g, '')}.mp4`;
    return {
      stream: streamResponse.data,
      originalName,
      startTime: video.fileTime,
      duration: video.videoDuration || 0,
      fileId: video.fileId,
      filePath: video.filePath
    };
  }
}

module.exports = new AlarmVideoService();
