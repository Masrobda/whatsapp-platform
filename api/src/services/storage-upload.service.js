const fs = require('fs-extra');
const path = require('path');
const { pipeline } = require('stream/promises');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');

const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/storage/clients';

// Taille minimale plausible pour un fichier vidéo/image d'alarme. En dessous,
// on considère qu'il s'agit très probablement d'une réponse d'erreur (JSON,
// page HTML, etc.) déguisée en fichier média plutôt que d'un vrai média.
// Constaté en production : une réponse d'erreur Hetu de type
// {"code":500,"message":"500","data":null} ne fait que 40 octets.
const MIN_PLAUSIBLE_FILE_SIZE_BYTES = 1024; // 1 Ko

// WhatsApp recommande des images qui ne dépassent pas 1600px de large/haut et
// quelques Mo ; on borne ici par sécurité même si Hetu envoie déjà des images
// raisonnables, pour éviter d'envoyer un JPEG inutilement lourd.
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 85;

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Convertit une vidéo en H.264/AAC (compatible WhatsApp) sans redimensionner
 * pour préserver la qualité d'origine.
 */
async function convertToWhatsAppCompatible(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',               // qualité (23 = bon compromis)
        '-maxrate 2.5M',         // bitrate max augmenté pour meilleure qualité
        '-bufsize 5M',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
        '-pix_fmt yuv420p'
        // Suppression du filtre scale/pad → on garde la résolution d'origine
      ])
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Étape commune aux deux types de média : récupère (ou crée) l'espace de
 * stockage actif du client, et garantit l'existence du dossier client + du
 * dossier temporaire de conversion. Retourne les chemins nécessaires.
 */

async function _prepareStorageSpace(clientId) {
  // 1. Récupérer l'espace actif
  let spaceRes = await query(
    `SELECT id, size_limit_bytes, current_usage_bytes
     FROM storage_spaces
     WHERE client_id = $1 AND is_active = true AND deleted_at IS NULL
     LIMIT 1`,
    [clientId]
  );

  let spaceId;
  let limitBytes;
  let currentUsage;

  if (spaceRes.rowCount === 0) {
    // Créer un espace par défaut (50 Mo)
    logger.warn(`Aucun espace actif pour client ${clientId}, création automatique...`);
    spaceId = uuidv4();
    const defaultSizeBytes = 50 * 1024 * 1024; // 50 Mo
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO storage_spaces
       (id, client_id, size_limit_bytes, current_usage_bytes, is_active, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [spaceId, clientId, defaultSizeBytes, 0, true, expiresAt, clientId]
    );
    await fs.ensureDir(path.join(STORAGE_PATH, spaceId));
    logger.info(`Espace de stockage créé pour client ${clientId} : ${spaceId}`);
    limitBytes = defaultSizeBytes;
    currentUsage = 0;
  } else {
    const row = spaceRes.rows[0];
    spaceId = row.id;
    limitBytes = parseInt(row.size_limit_bytes);
    currentUsage = parseInt(row.current_usage_bytes) || 0;
  }

  // --- Vérification du quota ---
  if (currentUsage >= limitBytes) {
    const usedFormatted = formatBytes(currentUsage);
    const limitFormatted = formatBytes(limitBytes);
    throw new Error(
      `Espace de stockage saturé (${usedFormatted} / ${limitFormatted}). Veuillez libérer de l'espace ou augmenter votre abonnement.`
    );
  }

  const clientFolder = path.join(STORAGE_PATH, spaceId);
  await fs.ensureDir(clientFolder);

  const tempDir = path.join(STORAGE_PATH, 'temp_conversion');
  await fs.ensureDir(tempDir);

  return { spaceId, clientFolder, tempDir, limitBytes, currentUsage };
}

/**
 * Écrit le flux d'entrée sur disque et vérifie qu'il n'est pas vide ni
 * anormalement petit (cas d'une réponse d'erreur du serveur distant déguisée
 * en fichier média — voir constat de production en tête de fichier).
 */
async function _writeAndValidateInputStream(stream, tempInputPath) {
  const writeStream = fs.createWriteStream(tempInputPath);
  await pipeline(stream, writeStream);

  const inputStats = await fs.stat(tempInputPath);
  if (inputStats.size === 0) {
    throw new Error('Le fichier téléchargé est vide');
  }
  if (inputStats.size < MIN_PLAUSIBLE_FILE_SIZE_BYTES) {
    let preview = '';
    try {
      preview = (await fs.readFile(tempInputPath, 'utf8')).slice(0, 200);
    } catch (_) {
      preview = '(contenu binaire illisible en texte)';
    }
    throw new Error(`Fichier téléchargé anormalement petit (${inputStats.size} octets) — probable réponse d'erreur du serveur distant plutôt qu'un média réel. Contenu: ${preview}`);
  }
  return inputStats;
}

/**
 * Enregistre le fichier en base (storage_files), génère son URL publique et
 * met à jour l'utilisation de l'espace. Commun aux vidéos et images.
 */
async function _finalizeUpload(spaceId, storedFilename, originalFilename, finalPath, fileSize, finalMimeType, clientId) {
  await query(
    `INSERT INTO storage_files
     (space_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [spaceId, storedFilename, originalFilename, finalPath, fileSize, finalMimeType, clientId]
  );

  const publicToken = uuidv4().replace(/-/g, '');
  const baseUrl = process.env.APP_URL || 'https://numericexport.cloud';
  const safeOriginal = encodeURIComponent(originalFilename);
  const publicUrl = `${baseUrl}/api/v1/storage/s/${publicToken}/${safeOriginal}`;
  await query(
    `UPDATE storage_files SET public_token = $1, public_url = $2
     WHERE space_id = $3 AND filename = $4`,
    [publicToken, publicUrl, spaceId, storedFilename]
  );

  await query(
    `UPDATE storage_spaces
     SET current_usage_bytes = current_usage_bytes + $1, last_activity = NOW()
     WHERE id = $2`,
    [fileSize, spaceId]
  );

  return publicUrl;
}

async function uploadAndConvertVideoFromStream(stream, originalFilename, clientId, licensePlate = null) {
  let tempInputPath = null;
  let tempConvertedPath = null;
  let fallbackUsed = false;

  try {
    const { spaceId, clientFolder, tempDir } = await _prepareStorageSpace(clientId);

    const uniqueId = uuidv4().replace(/-/g, '');
    tempInputPath = path.join(tempDir, `input_${uniqueId}.tmp`);
    tempConvertedPath = path.join(tempDir, `conv_${uniqueId}.mp4`);

    const inputStats = await _writeAndValidateInputStream(stream, tempInputPath);
    logger.info(`[StorageUpload] Fichier temporaire: ${inputStats.size} octets`);

    let finalPath, storedFilename, fileSize, finalMimeType;
    try {
      await convertToWhatsAppCompatible(tempInputPath, tempConvertedPath);
      const convertedStats = await fs.stat(tempConvertedPath);
      if (convertedStats.size === 0) {
        throw new Error('Fichier converti vide');
      }

      const timestamp = Date.now();
      const baseName = path.basename(originalFilename, path.extname(originalFilename)).replace(/[^a-zA-Z0-9]/g, '_');
      storedFilename = `${timestamp}-${uuidv4().substring(0,8)}-${baseName}.mp4`;
      finalPath = path.join(clientFolder, storedFilename);
      await fs.move(tempConvertedPath, finalPath, { overwrite: true });
      fileSize = convertedStats.size;
      finalMimeType = 'video/mp4';
      logger.info(`[StorageUpload] Vidéo convertie avec succès: ${storedFilename} (${fileSize} octets)`);
    } catch (convErr) {
      logger.error(`[StorageUpload] Échec conversion: ${convErr.message} – fallback sur fichier original`);
      fallbackUsed = true;
      const timestamp = Date.now();
      const ext = path.extname(originalFilename) || '.mp4';
      const baseName = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9]/g, '_');
      storedFilename = `${timestamp}-${uuidv4().substring(0,8)}-${baseName}${ext}`;
      finalPath = path.join(clientFolder, storedFilename);
      await fs.move(tempInputPath, finalPath, { overwrite: true });
      const stats = await fs.stat(finalPath);
      fileSize = stats.size;
      finalMimeType = 'video/mp4';
      logger.info(`[StorageUpload] Fichier original sauvegardé: ${storedFilename} (${fileSize} octets)`);
    }

    const publicUrl = await _finalizeUpload(spaceId, storedFilename, originalFilename, finalPath, fileSize, finalMimeType, clientId);

    logger.info(`[StorageUpload] Upload terminé: ${publicUrl} (fallback=${fallbackUsed})`);
    return { success: true, publicUrl, filename: storedFilename, size: fileSize, fallback: fallbackUsed };

  } catch (err) {
    logger.error('[StorageUpload] Erreur fatale:', err.message);
    return { success: false, error: err.message };
  } finally {
    try {
      if (tempInputPath && await fs.pathExists(tempInputPath)) await fs.remove(tempInputPath);
    } catch (_) {}
    try {
      if (tempConvertedPath && await fs.pathExists(tempConvertedPath)) await fs.remove(tempConvertedPath);
    } catch (_) {}
  }
}

/**
 * Valide et normalise une image en JPEG propre, compatible WhatsApp.
 *
 * Contrairement à l'ancien comportement (qui réutilisait par erreur la
 * fonction vidéo, échouait silencieusement la conversion ffmpeg sur une
 * image, et se rabattait sur une copie brute sans aucune validation), cette
 * fonction :
 *  - vérifie via sharp que le flux est bien une image décodable (rejette les
 *    réponses d'erreur déguisées qui auraient dépassé le seuil de taille,
 *    ex: une page HTML d'erreur de plusieurs Ko) ;
 *  - corrige automatiquement l'orientation EXIF (photos prises par la
 *    caméra du véhicule, souvent mal orientées) ;
 *  - limite les dimensions et recompresse en JPEG qualité raisonnable, pour
 *    rester dans les bonnes pratiques WhatsApp sans perte visible.
 *
 * JPEG est nativement accepté par WhatsApp ; cette conversion sert avant
 * tout à garantir un fichier valide et de taille maîtrisée, pas à changer
 * de format pour une question de compatibilité.
 */
async function uploadAndConvertImageFromStream(stream, originalFilename, clientId, licensePlate = null) {
  let tempInputPath = null;
  let tempConvertedPath = null;
  let fallbackUsed = false;

  try {
    const { spaceId, clientFolder, tempDir } = await _prepareStorageSpace(clientId);

    const uniqueId = uuidv4().replace(/-/g, '');
    tempInputPath = path.join(tempDir, `input_${uniqueId}.tmp`);
    tempConvertedPath = path.join(tempDir, `conv_${uniqueId}.jpg`);

    const inputStats = await _writeAndValidateInputStream(stream, tempInputPath);
    logger.info(`[StorageUpload] Fichier image temporaire: ${inputStats.size} octets`);

    let finalPath, storedFilename, fileSize, finalMimeType;
    try {
      // sharp lève une erreur si le contenu n'est pas une image décodable
      // (donc rejette aussi une éventuelle erreur JSON/HTML de taille > 1 Ko)
      await sharp(tempInputPath)
        .rotate() // applique automatiquement l'orientation EXIF, puis la retire
        .resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true })
        .toFile(tempConvertedPath);

      const convertedStats = await fs.stat(tempConvertedPath);
      if (convertedStats.size === 0) {
        throw new Error('Image convertie vide');
      }

      const timestamp = Date.now();
      const baseName = path.basename(originalFilename, path.extname(originalFilename)).replace(/[^a-zA-Z0-9]/g, '_');
      storedFilename = `${timestamp}-${uuidv4().substring(0,8)}-${baseName}.jpg`;
      finalPath = path.join(clientFolder, storedFilename);
      await fs.move(tempConvertedPath, finalPath, { overwrite: true });
      fileSize = convertedStats.size;
      finalMimeType = 'image/jpeg';
      logger.info(`[StorageUpload] Image convertie avec succès: ${storedFilename} (${fileSize} octets, original ${inputStats.size} octets)`);
    } catch (convErr) {
      // Ici, contrairement à la vidéo, un échec de sharp signifie très
      // probablement que le contenu n'est PAS une image valide du tout
      // (donc pas de fallback "copier tel quel" : on préfère échouer
      // explicitement plutôt que d'envoyer un fichier non lisible au client).
      logger.error(`[StorageUpload] Échec validation/conversion image: ${convErr.message}`);
      throw new Error(`Image invalide ou non décodable: ${convErr.message}`);
    }

    const publicUrl = await _finalizeUpload(spaceId, storedFilename, originalFilename, finalPath, fileSize, finalMimeType, clientId);

    logger.info(`[StorageUpload] Upload image terminé: ${publicUrl}`);
    return { success: true, publicUrl, filename: storedFilename, size: fileSize, fallback: fallbackUsed };

  } catch (err) {
    logger.error('[StorageUpload] Erreur fatale (image):', err.message);
    return { success: false, error: err.message };
  } finally {
    try {
      if (tempInputPath && await fs.pathExists(tempInputPath)) await fs.remove(tempInputPath);
    } catch (_) {}
    try {
      if (tempConvertedPath && await fs.pathExists(tempConvertedPath)) await fs.remove(tempConvertedPath);
    } catch (_) {}
  }
}

module.exports = { uploadAndConvertVideoFromStream, uploadAndConvertImageFromStream };
