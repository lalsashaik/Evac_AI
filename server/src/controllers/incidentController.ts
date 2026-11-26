import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getFirebaseDatabase } from '../config/firebase';
import { env } from '../config/environment';
import { IncidentRecord, IncidentStatus, NotificationRecord } from '../types/incident';
import { sendIncidentAlertEmail } from '../services/emailService';
import { syncGlobalEmergencyStatus } from '../services/emergencyService';

function getParam(param: string | string[] | undefined, defaultVal = ''): string {
  if (Array.isArray(param)) return param[0] || defaultVal;
  return param || defaultVal;
}

/**
 * Valid lifecycle state transitions.
 * DETECTED -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED
 * Any active state can also transition to FALSE_ALARM.
 * Terminal states (RESOLVED, FALSE_ALARM) cannot transition backwards.
 */
const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  DETECTED: ['ACKNOWLEDGED', 'FALSE_ALARM'],
  ACKNOWLEDGED: ['INVESTIGATING', 'FALSE_ALARM'],
  INVESTIGATING: ['RESOLVED', 'FALSE_ALARM'],
  RESOLVED: [],
  FALSE_ALARM: [],
};

/**
 * GET /api/malls/:mallId/incidents
 * Lists incidents for the specified mall, with optional status/camera filters.
 * Returns most recent incidents first.
 */
export async function listIncidents(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const statusFilter = req.query.status as string | undefined;
  const cameraFilter = req.query.cameraId as string | undefined;
  const limitParam = parseInt(req.query.limit as string || '50', 10);
  const limit = Math.max(1, Math.min(200, isNaN(limitParam) ? 50 : limitParam));

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const snap = await db.ref(`malls/${mallId}/incidents`).once('value');
    if (!snap.exists()) {
      res.status(200).json({
        success: true,
        data: { incidents: [], total: 0 },
      });
      return;
    }

    const incidentsMap = snap.val() as Record<string, IncidentRecord>;
    let incidentsList = Object.values(incidentsMap || {}).filter(
      (inc): inc is IncidentRecord => Boolean(inc && typeof inc === 'object' && inc.incidentId)
    );

    // Filter by status if provided (and not 'ALL')
    if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
      incidentsList = incidentsList.filter(
        (inc) => (inc.status || '').toUpperCase() === statusFilter.toUpperCase()
      );
    }

    // Filter by camera if provided
    if (cameraFilter) {
      incidentsList = incidentsList.filter((inc) => inc.cameraId === cameraFilter);
    }

    // Sort most recent first by detectedAt (fallback to createdAt)
    incidentsList.sort((a, b) => {
      const timeA = new Date(a.detectedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.detectedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    // Apply pagination limit
    const paged = incidentsList.slice(0, limit);

    // Enrich with authenticated evidence endpoint reference
    const enriched = paged.map((inc) => ({
      ...inc,
      evidenceEndpoint: inc.evidenceAvailable
        ? `/api/malls/${mallId}/incidents/${inc.incidentId}/evidence`
        : null,
    }));

    res.status(200).json({
      success: true,
      data: {
        incidents: enriched,
        total: incidentsList.length,
      },
    });
  } catch (error: any) {
    console.error('[IncidentController] Error listing incidents:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * GET /api/malls/:mallId/incidents/:incidentId
 * Returns full metadata for a single incident.
 */
export async function getIncident(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const incidentId = getParam(req.params.incidentId);

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const snap = await db.ref(`malls/${mallId}/incidents/${incidentId}`).once('value');
    if (!snap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'INCIDENT_NOT_FOUND', message: `Incident '${incidentId}' not found.` },
      });
      return;
    }

    const incident = snap.val() as IncidentRecord;
    if (incident.mallId !== mallId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Incident does not belong to the requested mall.' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...incident,
        evidenceEndpoint: incident.evidenceAvailable
          ? `/api/malls/${mallId}/incidents/${incident.incidentId}/evidence`
          : null,
      },
    });
  } catch (error: any) {
    console.error('[IncidentController] Error getting incident:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * PATCH /api/malls/:mallId/incidents/:incidentId/status
 * Updates the lifecycle status of an incident.
 * Enforces valid lifecycle transitions and attributes user identity from verified token.
 */
export async function updateIncidentStatus(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const incidentId = getParam(req.params.incidentId);
  const { status, resolutionNote } = req.body || {};

  if (!status || typeof status !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Field "status" is required.' },
    });
    return;
  }

  const targetStatus = status.toUpperCase().trim() as IncidentStatus;
  const validStatuses: IncidentStatus[] = ['DETECTED', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_ALARM'];

  if (!validStatuses.includes(targetStatus)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid status "${status}". Allowed values: ${validStatuses.join(', ')}.`,
      },
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

  try {
    const incRef = db.ref(`malls/${mallId}/incidents/${incidentId}`);
    const snap = await incRef.once('value');

    if (!snap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'INCIDENT_NOT_FOUND', message: `Incident '${incidentId}' not found.` },
      });
      return;
    }

    const currentIncident = snap.val() as IncidentRecord;
    if (currentIncident.mallId !== mallId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Incident does not belong to the requested mall.' },
      });
      return;
    }

    const currentStatus = currentIncident.status as IncidentStatus;

    // Check transition rules
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition incident from "${currentStatus}" to "${targetStatus}". Allowed next states: ${
            allowedNext.length > 0 ? allowedNext.join(', ') : 'none (terminal state)'
          }.`,
        },
      });
      return;
    }

    // Determine user attribution from verified token
    const userUid = req.user?.uid || 'user_authenticated';
    const nowIso = new Date().toISOString();

    const updates: Partial<IncidentRecord> = {
      status: targetStatus,
      lastStatusChangedAt: nowIso,
    };

    if (targetStatus === 'ACKNOWLEDGED') {
      updates.acknowledgedBy = userUid;
      updates.acknowledgedAt = nowIso;
    } else if (targetStatus === 'INVESTIGATING') {
      updates.investigatedBy = userUid;
      updates.investigatedAt = nowIso;
    } else if (targetStatus === 'RESOLVED') {
      updates.resolvedBy = userUid;
      updates.resolvedAt = nowIso;
      updates.resolutionNote = resolutionNote || 'Incident resolved.';
    } else if (targetStatus === 'FALSE_ALARM') {
      updates.resolvedBy = userUid;
      updates.resolvedAt = nowIso;
      updates.resolutionNote = resolutionNote || 'Verified as false alarm.';
    }

    await incRef.update(updates);

    if (targetStatus === 'RESOLVED' || targetStatus === 'FALSE_ALARM') {
      updates.isFireActive = false;
      await incRef.child('isFireActive').set(false).catch(() => {});
      // Clear active detection state on camera so dashboard and floor plan update to normal immediately
      await db.ref(`malls/${mallId}/cameraDetectionState/${currentIncident.cameraId}`).update({
        isCurrentlyDetected: false,
        detectionType: null,
        activeTypes: [],
        updatedAt: nowIso,
      }).catch(() => {});
      // Mark group inactive so subsequent fire outbreak creates a fresh event
      await Promise.all([
        db.ref(`malls/${mallId}/incidentGroups/${currentIncident.cameraId}_fire`).update({ isFireActive: false }).catch(() => {}),
        db.ref(`malls/${mallId}/incidentGroups/${currentIncident.cameraId}_smoke`).update({ isFireActive: false }).catch(() => {}),
        db.ref(`malls/${mallId}/incidentGroups/${currentIncident.cameraId}_fire_and_smoke`).update({ isFireActive: false }).catch(() => {}),
      ]);
    }

    // Synchronize global emergency status head (/emergency/status)
    await syncGlobalEmergencyStatus(db).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        ...currentIncident,
        ...updates,
      },
    });
  } catch (error: any) {
    console.error('[IncidentController] Error updating incident status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * GET /api/malls/:mallId/incidents/:incidentId/evidence
 * Protected endpoint to retrieve the annotated evidence JPEG for an incident.
 * Strict path traversal prevention: verifies the file resides strictly within EVACAI_EVIDENCE_DIR.
 */
export async function getEvidence(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const incidentId = getParam(req.params.incidentId);

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const snap = await db.ref(`malls/${mallId}/incidents/${incidentId}`).once('value');
    if (!snap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'INCIDENT_NOT_FOUND', message: `Incident '${incidentId}' not found.` },
      });
      return;
    }

    const incident = snap.val() as IncidentRecord;
    if (incident.mallId !== mallId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Incident does not belong to the requested mall.' },
      });
      return;
    }

    const queryFile = (req.query.file as string) || (req.query.filename as string);
    const rawFile = queryFile || incident.evidenceFileName || (incident.evidenceId ? `${incident.evidenceId}.jpg` : '');
    const cleanFileName = path.basename(rawFile);
    const cleanMall = path.basename(mallId);
    const cleanCam = path.basename(incident.cameraId || '');

    if (!cleanFileName) {
      res.status(404).json({
        success: false,
        error: { code: 'EVIDENCE_NOT_FOUND', message: 'No evidence filename recorded for this incident.' },
      });
      return;
    }

    const baseEvidenceDir = path.resolve(env.evidenceDir);

    // Candidates to inspect safely
    const candidatePaths = [
      path.resolve(baseEvidenceDir, 'incidents', cleanMall, cleanFileName),
      path.resolve(baseEvidenceDir, cleanMall, cleanCam, cleanFileName),
      path.resolve(baseEvidenceDir, cleanFileName),
    ];

    if (incident.evidenceRelativePath) {
      const relCandidate = path.resolve(baseEvidenceDir, incident.evidenceRelativePath);
      candidatePaths.unshift(relCandidate);
    }

    if ((incident as any).finalEvidenceRelativePath) {
      candidatePaths.unshift(path.resolve(baseEvidenceDir, (incident as any).finalEvidenceRelativePath));
    }

    // Also inspect observations for specific evidenceRelativePath if requested
    const rawObs = incident.observations || {};
    const obsList: any[] = Array.isArray(rawObs) ? rawObs : Object.values(rawObs);
    const matchedObs = obsList.find(
      (o) => o?.evidenceFileName === cleanFileName || (o?.evidenceId && `${o.evidenceId}.jpg` === cleanFileName)
    );
    if (matchedObs?.evidenceRelativePath) {
      candidatePaths.unshift(path.resolve(baseEvidenceDir, matchedObs.evidenceRelativePath));
    }

    let foundPath: string | null = null;
    for (const cand of candidatePaths) {
      // Path traversal security check: candidate MUST reside strictly inside baseEvidenceDir
      if (!cand.startsWith(baseEvidenceDir)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Illegal evidence path traversal attempt.' },
        });
        return;
      }

      if (fs.existsSync(cand)) {
        foundPath = cand;
        break;
      }
    }

    if (!foundPath) {
      res.status(404).json({
        success: false,
        error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence snapshot image file is not found on disk.' },
      });
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(foundPath);
  } catch (error: any) {
    console.error('[IncidentController] Error retrieving evidence:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * GET /api/malls/:mallId/notifications
 * Lists in-app notifications for the mall.
 */
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const snap = await db.ref(`malls/${mallId}/notifications`).once('value');
    if (!snap.exists()) {
      res.status(200).json({
        success: true,
        data: { notifications: [], unreadCount: 0 },
      });
      return;
    }

    const notifsMap = snap.val() as Record<string, NotificationRecord>;
    const notifications = Object.values(notifsMap);

    // Sort most recent first
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: any) {
    console.error('[IncidentController] Error listing notifications:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * PATCH /api/malls/:mallId/notifications/:notificationId/read
 * Marks an in-app notification as read.
 */
export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const notificationId = getParam(req.params.notificationId);

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const notifRef = db.ref(`malls/${mallId}/notifications/${notificationId}`);
    const snap = await notifRef.once('value');

    if (!snap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: `Notification '${notificationId}' not found.` },
      });
      return;
    }

    const notif = snap.val() as NotificationRecord;
    if (notif.mallId !== mallId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Notification does not belong to the requested mall.' },
      });
      return;
    }

    await notifRef.update({ isRead: true });

    res.status(200).json({
      success: true,
      data: {
        notificationId,
        isRead: true,
      },
    });
  } catch (error: any) {
    console.error('[IncidentController] Error marking notification read:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}

/**
 * POST /api/malls/:mallId/incidents/:incidentId/email
 * Manually trigger or resend an alert email for an incident.
 */
export async function triggerIncidentEmail(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const incidentId = getParam(req.params.incidentId);

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const [incSnap, mallSnap] = await Promise.all([
      db.ref(`malls/${mallId}/incidents/${incidentId}`).once('value'),
      db.ref(`malls/${mallId}/info`).once('value'),
    ]);

    if (!incSnap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'INCIDENT_NOT_FOUND', message: `Incident '${incidentId}' not found.` },
      });
      return;
    }

    const incident = incSnap.val() as IncidentRecord;
    const mallInfo = mallSnap.val() || {};
    const mallName = mallInfo.name || mallId;

    const recipientSet = new Set<string>();

    if (req.body?.recipientEmail && typeof req.body.recipientEmail === 'string' && req.body.recipientEmail.trim()) {
      recipientSet.add(req.body.recipientEmail.trim());
    } else {
      if (mallInfo.managementEmail && typeof mallInfo.managementEmail === 'string' && mallInfo.managementEmail.trim()) {
        recipientSet.add(mallInfo.managementEmail.trim());
      }
      if (mallInfo.contactEmail && typeof mallInfo.contactEmail === 'string' && mallInfo.contactEmail.trim()) {
        recipientSet.add(mallInfo.contactEmail.trim());
      }
      const usersSnap = await db.ref('users').once('value');
      if (usersSnap.exists()) {
        const usersMap = usersSnap.val() || {};
        for (const u of Object.values<any>(usersMap)) {
          if (u?.mallId === mallId && u?.email && u?.isActive !== false) {
            recipientSet.add(u.email.trim());
          }
        }
      }
    }

    const targetEmails = Array.from(recipientSet);

    if (targetEmails.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_RECIPIENT_EMAIL', message: `No managers or contact email configured for mall '${mallId}'.` },
      });
      return;
    }

    const sent = await sendIncidentAlertEmail(mallName, targetEmails, incident);
    if (sent) {
      await db.ref(`malls/${mallId}/incidents/${incidentId}/emailNotificationSent`).set(true);
      res.status(200).json({
        success: true,
        data: {
          incidentId,
          emailSent: true,
          recipient: targetEmails.join(', '),
          message: `Alert email dispatched to ${targetEmails.join(', ')}`,
        },
      });
    } else {
      res.status(502).json({
        success: false,
        error: { code: 'EMAIL_SEND_FAILED', message: 'Failed to deliver email through mail transport.' },
      });
    }
  } catch (error: any) {
    console.error('[IncidentController] Error triggering incident email:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
}
