import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getFirebaseDatabase } from '../config/firebase';
import { env } from '../config/environment';
import { sendIncidentAlertEmail, sendTimescaleObservationEmail } from '../services/emailService';
import { syncGlobalEmergencyStatus } from '../services/emergencyService';
import {
  BoundingBox,
  IncidentRecord,
  IncidentGroupRecord,
  NotificationRecord,
  TimescaleObservation,
} from '../types/incident';

function generateIncidentId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `inc_${ts}_${rand}`;
}

function generateObservationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `obs_${ts}_${rand}`;
}

function generateNotificationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `notif_${ts}_${rand}`;
}

/**
 * Checks whether an evidence file exists locally on disk inside EVACAI_EVIDENCE_DIR.
 * Looks in standard M7 path: evidence/incidents/{mallId}/{evidenceId}.jpg
 * or backward-compatible M6 path: evidence/{mallId}/{cameraId}/{evidenceId}.jpg
 */
function checkLocalEvidenceFile(
  mallId: string,
  cameraId: string,
  evidenceId: string,
  fileName?: string
): { exists: boolean; relativePath: string | null; fileName: string | null } {
  if (!evidenceId && !fileName) {
    return { exists: false, relativePath: null, fileName: null };
  }

  const cleanFile = fileName ? path.basename(fileName) : `${path.basename(evidenceId)}.jpg`;
  const cleanMall = path.basename(mallId);
  const cleanCam = path.basename(cameraId);

  const candidate1 = path.join(env.evidenceDir, 'incidents', cleanMall, cleanFile);
  const candidate2 = path.join(env.evidenceDir, cleanMall, cleanCam, cleanFile);
  const candidate3 = path.join(env.evidenceDir, cleanFile);

  if (fs.existsSync(candidate1)) {
    return {
      exists: true,
      relativePath: `incidents/${cleanMall}/${cleanFile}`,
      fileName: cleanFile,
    };
  }

  if (fs.existsSync(candidate2)) {
    return {
      exists: true,
      relativePath: `${cleanMall}/${cleanCam}/${cleanFile}`,
      fileName: cleanFile,
    };
  }

  if (fs.existsSync(candidate3)) {
    return {
      exists: true,
      relativePath: cleanFile,
      fileName: cleanFile,
    };
  }

  // File not found on disk, but safe format
  return {
    exists: false,
    relativePath: `incidents/${cleanMall}/${cleanFile}`,
    fileName: cleanFile,
  };
}

/**
 * POST /api/detection
 * Detection ingestion endpoint called by the Python AI Service.
 * Authenticated via X-AI-Service-Key header.
 */
export async function ingestDetection(req: Request, res: Response): Promise<void> {
  // 1. Shared secret authentication
  const serviceKey = req.headers['x-ai-service-key'];
  if (!serviceKey || serviceKey !== env.aiServiceKey) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid X-AI-Service-Key header.' },
    });
    return;
  }

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  const {
    cameraId,
    mallId,
    detectionType,
    confidence,
    timestamp,
    boundingBoxes,
    evidenceId,
    evidenceFileName,
    evidenceRelativePath,
    eventId,
  } = req.body || {};

  // 2. Comprehensive Payload Validation
  if (!cameraId || typeof cameraId !== 'string' || !cameraId.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field "cameraId" must be a non-empty string.' },
    });
    return;
  }

  if (!mallId || typeof mallId !== 'string' || !mallId.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field "mallId" must be a non-empty string.' },
    });
    return;
  }

  const normType = String(detectionType || '').toLowerCase().trim();
  if (!['fire', 'smoke', 'fire_and_smoke'].includes(normType)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Field "detectionType" must be "fire", "smoke", or "fire_and_smoke" (received: "${detectionType}").`,
      },
    });
    return;
  }

  const numConfidence = Number(confidence);
  if (typeof confidence !== 'number' || isNaN(numConfidence) || numConfidence < 0 || numConfidence > 1) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field "confidence" must be a number between 0.0 and 1.0.' },
    });
    return;
  }

  if (!timestamp || isNaN(Date.parse(timestamp))) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field "timestamp" must be a valid ISO 8601 date string.' },
    });
    return;
  }

  // Validate bounding boxes if provided
  const parsedBoxes: BoundingBox[] = [];
  if (boundingBoxes !== undefined && boundingBoxes !== null) {
    if (!Array.isArray(boundingBoxes)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Field "boundingBoxes" must be an array.' },
      });
      return;
    }

    for (const b of boundingBoxes) {
      if (
        typeof b.x !== 'number' ||
        typeof b.y !== 'number' ||
        typeof b.width !== 'number' ||
        typeof b.height !== 'number' ||
        typeof b.confidence !== 'number'
      ) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Bounding box entries must have numeric coordinates and confidence.' },
        });
        return;
      }
      const cleanBox: BoundingBox = {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        class_name: b.class_name || b.class || normType,
        confidence: b.confidence,
      };
      if (typeof b.x_norm === 'number') cleanBox.x_norm = b.x_norm;
      if (typeof b.y_norm === 'number') cleanBox.y_norm = b.y_norm;
      if (typeof b.w_norm === 'number') cleanBox.w_norm = b.w_norm;
      if (typeof b.h_norm === 'number') cleanBox.h_norm = b.h_norm;
      parsedBoxes.push(cleanBox);
    }
  }

  // Prevent path traversal on evidence identifiers
  const rawEvidenceId = (evidenceId || eventId || '').toString().trim();
  const rawFileName = (evidenceFileName || '').toString().trim();
  const rawRelPath = (evidenceRelativePath || '').toString().trim();

  if (
    rawEvidenceId.includes('..') ||
    rawEvidenceId.includes('/') ||
    rawEvidenceId.includes('\\') ||
    rawFileName.includes('..') ||
    rawFileName.includes('/') ||
    rawFileName.includes('\\') ||
    rawRelPath.includes('..')
  ) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Evidence identifier contains illegal path traversal characters.' },
    });
    return;
  }

  const cleanCamId = cameraId.trim();
  const cleanMallId = mallId.trim();

  try {
    // 3. Authoritative Mall and Camera Validation from Realtime Database
    const [mallSnap, cameraSnap] = await Promise.all([
      db.ref(`malls/${cleanMallId}/info`).once('value'),
      db.ref(`malls/${cleanMallId}/cameras/${cleanCamId}`).once('value'),
    ]);

    if (!mallSnap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'MALL_NOT_FOUND', message: `Mall with ID '${cleanMallId}' does not exist.` },
      });
      return;
    }

    const mallInfo = mallSnap.val() || {};
    if (mallInfo.isActive === false) {
      res.status(400).json({
        success: false,
        error: { code: 'MALL_INACTIVE', message: `Mall '${cleanMallId}' is currently inactive.` },
      });
      return;
    }

    if (!cameraSnap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'CAMERA_NOT_FOUND', message: `Camera with ID '${cleanCamId}' does not exist for mall '${cleanMallId}'.` },
      });
      return;
    }

    const cameraInfo = cameraSnap.val() || {};
    if (cameraInfo.mallId && cameraInfo.mallId !== cleanMallId) {
      res.status(400).json({
        success: false,
        error: { code: 'CAMERA_MALL_MISMATCH', message: `Camera '${cleanCamId}' does not belong to mall '${cleanMallId}'.` },
      });
      return;
    }

    if (cameraInfo.isActive === false) {
      res.status(400).json({
        success: false,
        error: { code: 'CAMERA_INACTIVE', message: `Camera '${cleanCamId}' is currently inactive.` },
      });
      return;
    }

    // Authoritative metadata
    const cameraName = cameraInfo.name || cleanCamId;
    const floorId = cameraInfo.floorId || 'floor_1';
    const roomId = cameraInfo.roomId || null;
    let roomName: string | null = null;

    if (roomId) {
      const roomSnap = await db.ref(`malls/${cleanMallId}/floorplans/${floorId}/rooms/${roomId}/name`).once('value');
      if (roomSnap.exists()) {
        roomName = roomSnap.val();
      }
    }

    const mallName = mallInfo.name || cleanMallId;
    const contactEmail = mallInfo.contactEmail || null;

    // 4. Adjacent-Frame Incident Logic (No Cooldown Period)
    const groupKey = `${cleanCamId}_${normType}`;
    const groupRef = db.ref(`malls/${cleanMallId}/incidentGroups/${groupKey}`);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const txContext = {
      isSameIncident: false,
      incidentId: '',
    };

    const txResult = await groupRef.transaction((current: IncidentGroupRecord | null) => {
      // CASE 1: Previous frame had fire AND current frame has fire -> SAME INCIDENT
      // Do NOT send a new mail, do NOT produce a new alert in website
      if (current && current.activeIncidentId && current.isFireActive === true) {
        txContext.isSameIncident = true;
        txContext.incidentId = current.activeIncidentId;
        return {
          ...current,
          frameCount: (current.frameCount || 1) + 1,
          lastDetectedAt: nowIso,
          isFireActive: true,
        };
      }

      // CASE 2: Previous frame had NO fire, but current frame has fire -> NEW INCIDENT
      // Register new incident, send email, produce new alert in website
      const newIncId = generateIncidentId();
      txContext.incidentId = newIncId;
      txContext.isSameIncident = false;
      return {
        groupKey,
        cameraId: cleanCamId,
        detectionType: normType,
        activeIncidentId: newIncId,
        firstDetectedAt: nowIso,
        lastDetectedAt: nowIso,
        frameCount: 1,
        isFireActive: true,
      };
    });

    if (!txResult.committed || !txResult.snapshot.exists()) {
      res.status(500).json({
        success: false,
        error: { code: 'DEDUPLICATION_TRANSACTION_FAILED', message: 'Failed to atomically record incident group.' },
      });
      return;
    }

    const finalGroup = txResult.snapshot.val() as IncidentGroupRecord;

    // Case 1 response: Same ongoing incident (No new mail, no new alert)
    if (txContext.isSameIncident) {
      // Update camera detection state to refresh heartbeat and active status
      const detectionState = {
        cameraId: cleanCamId,
        mallId: cleanMallId,
        isCurrentlyDetected: true,
        detectionType: normType,
        activeTypes: [normType],
        lastDetectedAt: timestamp || nowIso,
        updatedAt: nowIso,
        confidence: Math.round(numConfidence * 10000) / 10000,
        cameraStatus: 'running',
      };
      await db.ref(`malls/${cleanMallId}/cameraDetectionState/${cleanCamId}`).set(detectionState);

      res.status(200).json({
        success: true,
        data: {
          incidentId: finalGroup.activeIncidentId,
          created: false,
          deduplicated: true,
          frameCount: finalGroup.frameCount,
        },
      });
      return;
    }

    // CASE 2: Genuinely New Incident Creation (Fire detected, previous frame had no fire)
    const incidentId = finalGroup.activeIncidentId || txContext.incidentId;
    const rawEvidenceId = (evidenceId || eventId || '').toString().trim();
    const rawFileName = (evidenceFileName || '').toString().trim();
    const evidenceCheck = checkLocalEvidenceFile(cleanMallId, cleanCamId, rawEvidenceId, rawFileName);

    const initialObsId = generateObservationId();
    const initialObs: TimescaleObservation = {
      observationId: initialObsId,
      incidentId,
      observationIndex: 1,
      observedAt: timestamp || nowIso,
      timeFormatted: new Date(timestamp || nowIso).toLocaleTimeString(),
      confidence: Math.round(numConfidence * 10000) / 10000,
      detectionType: normType,
      evidenceId: rawEvidenceId || null,
      evidenceFileName: evidenceCheck.fileName,
      evidenceRelativePath: evidenceCheck.relativePath,
      evidenceAvailable: evidenceCheck.exists,
      boundingBoxes: parsedBoxes,
      emailSent: false,
    };

    const incidentRecord: IncidentRecord = {
      incidentId,
      mallId: cleanMallId,
      cameraId: cleanCamId,
      cameraName,
      floorId,
      roomId,
      roomName,
      detectionType: normType,
      confidence: Math.round(numConfidence * 10000) / 10000,
      detectedAt: timestamp,
      createdAt: nowIso,
      evidenceId: rawEvidenceId || null,
      evidenceFileName: evidenceCheck.fileName,
      evidenceRelativePath: evidenceCheck.relativePath,
      evidenceAvailable: evidenceCheck.exists,
      status: 'DETECTED',
      boundingBoxes: parsedBoxes,
      acknowledgedBy: null,
      acknowledgedAt: null,
      investigatedBy: null,
      investigatedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      emailNotificationSent: false,
      lastStatusChangedAt: nowIso,
      observationCount: 1,
      lastObservationAt: nowIso,
      isFireActive: true,
      observations: {
        [initialObsId]: initialObs,
      },
    };

    // Store incident metadata in Firebase Realtime Database
    await db.ref(`malls/${cleanMallId}/incidents/${incidentId}`).set(incidentRecord);

    // Sync global emergency head in RTDB (/emergency/status)
    await syncGlobalEmergencyStatus(db).catch(() => {});

    // Update real-time camera detection state
    const detectionState = {
      cameraId: cleanCamId,
      mallId: cleanMallId,
      isCurrentlyDetected: true,
      detectionType: normType,
      activeTypes: [normType],
      lastDetectedAt: timestamp || nowIso,
      updatedAt: nowIso,
      confidence: Math.round(numConfidence * 10000) / 10000,
      cameraStatus: 'running',
    };
    await db.ref(`malls/${cleanMallId}/cameraDetectionState/${cleanCamId}`).set(detectionState);

    // 6. Create in-app notification record
    const notificationId = generateNotificationId();
    const locText = roomName ? `in ${roomName}` : `near ${cameraName}`;
    const notificationRecord: NotificationRecord = {
      notificationId,
      type: 'incident_detected',
      incidentId,
      mallId: cleanMallId,
      message: `${normType.toUpperCase()} detected ${locText} by ${cameraName}.`,
      createdAt: nowIso,
      isRead: false,
    };

    await db.ref(`malls/${cleanMallId}/notifications/${notificationId}`).set(notificationRecord);

    // Increment platform stats counter
    db.ref('platformStats/totalIncidents')
      .transaction((current: number | null) => (current || 0) + 1)
      .catch(() => {});

    // 7. Dispatch Email Notification if confidence is sufficiently high
    let emailSent = false;
    const alertThreshold = env.emailAlertConfidenceThreshold;
    const isConfidenceSufficient = incidentRecord.confidence >= alertThreshold;

    if (!isConfidenceSufficient) {
      console.info(
        `[Detection Pipeline] Incident '${incidentId}' confidence (${Math.round(incidentRecord.confidence * 100)}%) is below auto-mail threshold (${Math.round(alertThreshold * 100)}%). Skipping automated email.`
      );
    } else {
      console.info(
        `[Detection Pipeline] High confidence hazard detected (${Math.round(incidentRecord.confidence * 100)}% >= ${Math.round(alertThreshold * 100)}%). Auto-triggering alert email for mall '${cleanMallId}'...`
      );
      try {
        // Strict Mall Isolation: Resolve recipient emails belonging ONLY to this specific mall (cleanMallId)
        const recipientSet = new Set<string>();

        // 1. Manager account email directly linked on the mall info node
        if (mallInfo.managementEmail && typeof mallInfo.managementEmail === 'string' && mallInfo.managementEmail.trim()) {
          recipientSet.add(mallInfo.managementEmail.trim());
        }

        // 2. Official contact email of this specific mall
        if (mallInfo.contactEmail && typeof mallInfo.contactEmail === 'string' && mallInfo.contactEmail.trim()) {
          recipientSet.add(mallInfo.contactEmail.trim());
        }

        // 3. Find any active mall_management accounts strictly assigned to this cleanMallId in /users
        const usersSnap = await db.ref('users').once('value');
        if (usersSnap.exists()) {
          const usersMap = usersSnap.val() || {};
          for (const u of Object.values<any>(usersMap)) {
            if (u?.mallId === cleanMallId && u?.email && u?.isActive !== false) {
              recipientSet.add(u.email.trim());
            }
          }
        }

        const targetEmails = Array.from(recipientSet);

        if (targetEmails.length === 0) {
          console.warn(
            `[Detection Pipeline] No managers or contact email configured for mall '${cleanMallId}' (${mallName}). Skipping email alert.`
          );
        } else {
          console.info(
            `[Detection Pipeline] Dispatching hazard alert strictly to managers of '${mallName}' (${cleanMallId}): [${targetEmails.join(', ')}]`
          );

          emailSent = await sendIncidentAlertEmail(mallName, targetEmails, incidentRecord);
          if (emailSent) {
            await db.ref(`malls/${cleanMallId}/incidents/${incidentId}/emailNotificationSent`).set(true);
            incidentRecord.emailNotificationSent = true;
          }
        }
      } catch (emailErr: any) {
        console.warn(`[Detection Pipeline] Email alert dispatch failed for incident '${incidentId}':`, emailErr.message);
      }
    }

    // 8. Return 201 Created Response
    res.status(201).json({
      success: true,
      data: {
        incidentId,
        created: true,
        deduplicated: false,
        evidenceAvailable: incidentRecord.evidenceAvailable,
        emailNotificationSent: incidentRecord.emailNotificationSent,
      },
    });
  } catch (error: any) {
    console.error('[Detection Ingestion] Error processing detection:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * POST /api/detection/state
 * Updates the real-time fire/smoke presence detection state for a camera.
 * Called by the AI service when detection starts, continues, or clears.
 * Authenticated via X-AI-Service-Key header.
 */
export async function updateDetectionState(req: Request, res: Response): Promise<void> {
  const serviceKey = req.headers['x-ai-service-key'];
  if (!serviceKey || serviceKey !== env.aiServiceKey) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid X-AI-Service-Key header.' },
    });
    return;
  }

  const {
    cameraId,
    mallId,
    isCurrentlyDetected,
    detectionType,
    activeTypes,
    lastDetectedAt,
    updatedAt,
    cameraStatus,
    confidence,
  } = req.body || {};

  if (!cameraId || typeof cameraId !== 'string' || !cameraId.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field "cameraId" must be a non-empty string.' },
    });
    return;
  }

  if (!mallId || typeof mallId !== 'string' || !mallId.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field "mallId" must be a non-empty string.' },
    });
    return;
  }

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  const cleanCamId = cameraId.trim();
  const cleanMallId = mallId.trim();
  const nowIso = new Date().toISOString();

  const isDetected = Boolean(isCurrentlyDetected);
  const rawFinalId = (req.body?.finalEvidenceId || '').toString().trim();
  const rawFinalName = (req.body?.finalEvidenceFileName || '').toString().trim();
  const rawFinalRel = (req.body?.finalEvidenceRelativePath || '').toString().trim();

  const finalCheck = rawFinalName
    ? checkLocalEvidenceFile(cleanMallId, cleanCamId, rawFinalId, rawFinalName)
    : null;

  const statePayload = {
    cameraId: cleanCamId,
    mallId: cleanMallId,
    isCurrentlyDetected: isDetected,
    detectionType: detectionType || null,
    activeTypes: Array.isArray(activeTypes) ? activeTypes : (detectionType ? [detectionType] : []),
    lastDetectedAt: lastDetectedAt || (isDetected ? nowIso : null),
    updatedAt: updatedAt || nowIso,
    cameraStatus: cameraStatus || 'running',
    confidence: typeof confidence === 'number' ? confidence : null,
    latestEvidenceFileName: finalCheck?.fileName || rawFinalName || null,
    latestEvidenceId: rawFinalId || null,
    latestEvidenceRelativePath: finalCheck?.relativePath || rawFinalRel || null,
    lastClearAt: !isDetected ? nowIso : null,
  };

  try {
    await db.ref(`malls/${cleanMallId}/cameraDetectionState/${cleanCamId}`).set(statePayload);

    // CASE 3: If camera detects NO fire -> INCIDENT IS OVER / NORMAL SURVEILLANCE
    // Auto-resolve any active incident alerts, restore normal blueprint markers, record concluding/clear snapshot
    if (!isDetected) {
      // 1. Check if this camera had active incidents in incidentGroups
      const groupSnap = await db.ref(`malls/${cleanMallId}/incidentGroups`).once('value');
      const groups = groupSnap.val() || {};
      const activeIncIdsToResolve: string[] = [];

      for (const [gKey, g] of Object.entries<any>(groups)) {
        if (gKey.startsWith(`${cleanCamId}_`) && g?.activeIncidentId) {
          activeIncIdsToResolve.push(g.activeIncidentId);
        }
      }

      // 2. Authoritative check: query malls/${cleanMallId}/incidents for ANY unresolved incidents for this camera
      const incSnap = await db.ref(`malls/${cleanMallId}/incidents`).once('value');
      const allIncidents: Record<string, IncidentRecord> = incSnap.exists() ? incSnap.val() : {};

      for (const [incId, inc] of Object.entries(allIncidents)) {
        if (
          inc.cameraId === cleanCamId &&
          inc.status !== 'RESOLVED' &&
          inc.status !== 'FALSE_ALARM'
        ) {
          if (!activeIncIdsToResolve.includes(incId)) {
            activeIncIdsToResolve.push(incId);
          }
        }
      }

      // 3. If no active incidents found to resolve, but a clear snapshot was provided,
      // attach it to the camera's most recent incident if it lacks a concluding normal snapshot
      if (activeIncIdsToResolve.length === 0 && (rawFinalName || rawFinalId)) {
        const camIncs = Object.values(allIncidents).filter((i) => i.cameraId === cleanCamId);
        camIncs.sort(
          (a, b) => new Date(b.detectedAt || b.createdAt).getTime() - new Date(a.detectedAt || a.createdAt).getTime()
        );
        const latestInc = camIncs[0];
        if (latestInc) {
          const existingObs: any[] = Object.values(latestInc.observations || {});
          const alreadyHasConcluded = existingObs.some(
            (o) => o.detectionType === 'normal' || (rawFinalName && o.evidenceFileName === rawFinalName)
          );
          if (!alreadyHasConcluded) {
            activeIncIdsToResolve.push(latestInc.incidentId);
          }
        }
      }

      const effectiveFinalRel = finalCheck?.relativePath || rawFinalRel || (rawFinalName ? `incidents/${cleanMallId}/${rawFinalName}` : null);
      const effectiveFinalName = finalCheck?.fileName || rawFinalName || null;
      const hasEvidence = Boolean(finalCheck?.exists || rawFinalName);

      // 4. Resolve identified incidents and append concluding observation snap to timeline
      if (activeIncIdsToResolve.length > 0) {
        const resolvePromises = activeIncIdsToResolve.map(async (incId) => {
          const incRef = db.ref(`malls/${cleanMallId}/incidents/${incId}`);
          const currentSnap = await incRef.once('value');
          const currentInc = currentSnap.val() || {};

          const concludingObsId = generateObservationId();
          const nextIndex = (currentInc.observationCount || 1) + 1;
          const concludingObs: any = {
            observationId: concludingObsId,
            incidentId: incId,
            observationIndex: nextIndex,
            observedAt: nowIso,
            timeFormatted: new Date(nowIso).toLocaleTimeString(),
            confidence: 0,
            detectionType: 'normal',
            evidenceId: rawFinalId || concludingObsId,
            evidenceFileName: effectiveFinalName,
            evidenceRelativePath: effectiveFinalRel,
            evidenceAvailable: hasEvidence,
            note: 'Final Concluding Snapshot: Fire extinguished. Normal conditions restored.',
          };

          const updatePayload: any = {
            status: 'RESOLVED',
            resolvedAt: nowIso,
            resolutionNote: 'Auto-resolved: Fire no longer detected in surveillance feed (incident concluded).',
            isFireActive: false,
            lastStatusChangedAt: nowIso,
            observationCount: nextIndex,
            lastObservationAt: nowIso,
            [`observations/${concludingObsId}`]: concludingObs,
          };

          if (effectiveFinalName) {
            updatePayload.finalEvidenceFileName = effectiveFinalName;
            updatePayload.finalEvidenceAvailable = hasEvidence;
            updatePayload.finalEvidenceRelativePath = effectiveFinalRel;
          }

          return incRef.update(updatePayload);
        });
        await Promise.all(resolvePromises);
      }

      // Reset activeIncidentId and mark isFireActive: false in incident groups so subsequent fire creates a NEW incident
      await Promise.all([
        db.ref(`malls/${cleanMallId}/incidentGroups/${cleanCamId}_fire`).update({ isFireActive: false, activeIncidentId: null }).catch(() => {}),
        db.ref(`malls/${cleanMallId}/incidentGroups/${cleanCamId}_smoke`).update({ isFireActive: false, activeIncidentId: null }).catch(() => {}),
        db.ref(`malls/${cleanMallId}/incidentGroups/${cleanCamId}_fire_and_smoke`).update({ isFireActive: false, activeIncidentId: null }).catch(() => {}),
      ]);
    } else {
      // Mark groups as actively detecting
      await Promise.all([
        db.ref(`malls/${cleanMallId}/incidentGroups/${cleanCamId}_fire`).update({ isFireActive: true }).catch(() => {}),
        db.ref(`malls/${cleanMallId}/incidentGroups/${cleanCamId}_smoke`).update({ isFireActive: true }).catch(() => {}),
        db.ref(`malls/${cleanMallId}/incidentGroups/${cleanCamId}_fire_and_smoke`).update({ isFireActive: true }).catch(() => {}),
      ]);
    }

    // Always keep camera health online and fresh in RTDB
    await db.ref(`malls/${cleanMallId}/cameraHealth/${cleanCamId}`).update({
      cameraId: cleanCamId,
      status: 'online',
      lastSeenAt: nowIso,
      lastFrameAt: nowIso,
      updatedAt: nowIso,
    }).catch(() => {});

    // Always synchronize global emergency status head (/emergency/status)
    await syncGlobalEmergencyStatus(db).catch(() => {});

    res.status(200).json({
      success: true,
      data: statePayload,
    });
  } catch (error: any) {
    console.error('[DetectionController] Error updating detection state:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * GET /api/detection/state/:mallId
 * Returns current real-time camera detection states for a shopping mall.
 */
export async function getDetectionState(req: Request, res: Response): Promise<void> {
  const mallId = req.params.mallId;
  const cameraId = req.query.cameraId as string | undefined;

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const path = cameraId
      ? `malls/${mallId}/cameraDetectionState/${cameraId}`
      : `malls/${mallId}/cameraDetectionState`;
    const snap = await db.ref(path).once('value');
    const val = snap.exists() ? snap.val() : {};

    res.status(200).json({
      success: true,
      data: val,
    });
  } catch (error: any) {
    console.error('[DetectionController] Error getting detection state:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * POST /api/detection/observation
 * Records a periodic 15-min timescale observation snapshot for an ongoing active incident.
 * Authenticated via X-AI-Service-Key header.
 */
export async function ingestObservation(req: Request, res: Response): Promise<void> {
  const serviceKey = req.headers['x-ai-service-key'];
  if (!serviceKey || serviceKey !== env.aiServiceKey) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid X-AI-Service-Key header.' },
    });
    return;
  }

  const {
    cameraId,
    mallId,
    detectionType,
    confidence,
    timestamp,
    boundingBoxes,
    evidenceId,
    evidenceFileName,
    observationIndex,
  } = req.body || {};

  if (!cameraId || !mallId) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Fields "cameraId" and "mallId" are required.' },
    });
    return;
  }

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  const cleanCamId = cameraId.trim();
  const cleanMallId = mallId.trim();
  const normType = String(detectionType || 'fire').toLowerCase().trim();
  const nowIso = new Date().toISOString();

  // Find active incident for this camera
  const groupSnap = await db.ref(`malls/${cleanMallId}/incidentGroups`).once('value');
  const groups = groupSnap.val() || {};
  let targetIncidentId: string | null = null;

  for (const [gKey, g] of Object.entries<any>(groups)) {
    if (gKey.startsWith(`${cleanCamId}_`) && g?.isFireActive && g?.activeIncidentId) {
      targetIncidentId = g.activeIncidentId;
      break;
    }
  }

  if (!targetIncidentId) {
    const incSnap = await db.ref(`malls/${cleanMallId}/incidents`).once('value');
    const allInc = incSnap.val() || {};
    for (const [incId, inc] of Object.entries<any>(allInc)) {
      if (inc?.cameraId === cleanCamId && inc?.status === 'DETECTED') {
        targetIncidentId = incId;
        break;
      }
    }
  }

  if (!targetIncidentId) {
    res.status(404).json({
      success: false,
      error: { code: 'NO_ACTIVE_INCIDENT', message: `No active incident found for camera ${cleanCamId}` },
    });
    return;
  }

  const rawEvidenceId = (evidenceId || '').toString().trim();
  const rawFileName = (evidenceFileName || '').toString().trim();
  const evidenceCheck = checkLocalEvidenceFile(cleanMallId, cleanCamId, rawEvidenceId, rawFileName);

  const parsedBoxes: BoundingBox[] = Array.isArray(boundingBoxes)
    ? boundingBoxes.map((b: any) => ({
        x: Number(b.x) || 0,
        y: Number(b.y) || 0,
        width: Number(b.width) || 0,
        height: Number(b.height) || 0,
        class_name: String(b.class_name || normType),
        confidence: Number(b.confidence) || 0.8,
        x_norm: b.x_norm !== undefined ? Number(b.x_norm) : undefined,
        y_norm: b.y_norm !== undefined ? Number(b.y_norm) : undefined,
        w_norm: b.w_norm !== undefined ? Number(b.w_norm) : undefined,
        h_norm: b.h_norm !== undefined ? Number(b.h_norm) : undefined,
      }))
    : [];

  const incRef = db.ref(`malls/${cleanMallId}/incidents/${targetIncidentId}`);
  const incSnap = await incRef.once('value');
  const currentInc = incSnap.val() || {};

  const obsId = generateObservationId();
  const obsIndex = observationIndex || ((currentInc.observationCount || 1) + 1);

  const observation: TimescaleObservation = {
    observationId: obsId,
    incidentId: targetIncidentId,
    observationIndex: obsIndex,
    observedAt: timestamp || nowIso,
    timeFormatted: new Date(timestamp || nowIso).toLocaleTimeString(),
    confidence: Number(confidence) || currentInc.confidence || 0.8,
    detectionType: normType,
    evidenceId: rawEvidenceId || null,
    evidenceFileName: evidenceCheck.fileName,
    evidenceRelativePath: evidenceCheck.relativePath,
    evidenceAvailable: evidenceCheck.exists,
    boundingBoxes: parsedBoxes,
    emailSent: false,
  };

  await Promise.all([
    db.ref(`malls/${cleanMallId}/incidents/${targetIncidentId}/observations/${obsId}`).set(observation),
    incRef.update({
      observationCount: obsIndex,
      lastObservationAt: timestamp || nowIso,
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      incidentId: targetIncidentId,
      observationId: obsId,
      observationIndex: obsIndex,
      evidenceAvailable: observation.evidenceAvailable,
    },
  });
}


