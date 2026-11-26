import { Request, Response } from 'express';
import { getFirebaseDatabase } from '../config/firebase';
import { env } from '../config/environment';
import {
  CameraRecord,
  CameraHealthRecord,
  CameraWithDetails,
  CreateCameraDto,
  UpdateCameraDto,
} from '../types/camera';

function notifyAiServiceCameraChange(action: 'start' | 'stop', payload: any): void {
  const url = action === 'start'
    ? `${env.aiServiceUrl}/cameras/${payload.cameraId}/start`
    : `${env.aiServiceUrl}/cameras/${payload.cameraId}/stop`;

  try {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Service-Key': env.aiServiceKey,
      },
      body: action === 'start' ? JSON.stringify(payload) : undefined,
    }).catch((err) => {
      console.debug(`[CameraController] AI service camera notification (${action}) non-blocking notice:`, err.message);
    });
  } catch (_) {}
}

function getParam(param: string | string[] | undefined, defaultVal = ''): string {
  if (Array.isArray(param)) return param[0] || defaultVal;
  return param || defaultVal;
}

function generateCameraId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `cam_${ts}_${rand}`;
}

/**
 * GET /api/malls/:mallId/cameras
 * Returns all registered cameras for the given mall, enriched with
 * spatial coordinates from floor plans and health/connectivity status.
 */
export async function listCameras(req: Request, res: Response): Promise<void> {
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
    // Read cameras, health, and floorplans in parallel
    const [camerasSnap, healthSnap, floorplansSnap] = await Promise.all([
      db.ref(`malls/${mallId}/cameras`).once('value'),
      db.ref(`malls/${mallId}/cameraHealth`).once('value'),
      db.ref(`malls/${mallId}/floorplans`).once('value'),
    ]);

    const camerasMap: Record<string, CameraRecord> = camerasSnap.exists() ? camerasSnap.val() : {};
    const healthMap: Record<string, CameraHealthRecord> = healthSnap.exists() ? healthSnap.val() : {};
    const floorplansMap: Record<string, any> = floorplansSnap.exists() ? floorplansSnap.val() : {};

    const enrichedCameras: CameraWithDetails[] = Object.values(camerasMap).map((camera) => {
      const floorId = camera.floorId || 'floor_1';
      const floorPlan = floorplansMap[floorId];
      const floorMarker = floorPlan?.cameras?.[camera.cameraId];
      let room = camera.roomId && floorPlan?.rooms ? floorPlan.rooms[camera.roomId] : null;

      // Auto-detect room from floor marker spatial coordinates if roomId is unlinked
      if (!room && floorPlan?.rooms && floorMarker && floorMarker.x !== undefined && floorMarker.y !== undefined) {
        const mx = floorMarker.x;
        const my = floorMarker.y;
        const allRooms: any[] = Object.values(floorPlan.rooms);
        const containing = allRooms.filter((r) => mx >= r.x && mx <= r.x + r.width && my >= r.y && my <= r.y + r.height);
        if (containing.length > 0) {
          room = containing.find((r) => r.type === 'room') || containing[0];
          if (room?.roomId && !camera.roomId) {
            db.ref(`malls/${mallId}/cameras/${camera.cameraId}/roomId`).set(room.roomId).catch(() => {});
          }
        }
      }

      const healthRecord = healthMap[camera.cameraId];
      const health: CameraHealthRecord = {
        cameraId: camera.cameraId,
        status: !camera.isActive ? 'inactive' : (healthRecord?.status || 'online'),
        lastSeenAt: healthRecord?.lastSeenAt || camera.updatedAt || camera.createdAt,
        lastFrameAt: healthRecord?.lastFrameAt || camera.updatedAt || camera.createdAt,
        updatedAt: healthRecord?.updatedAt || new Date().toISOString(),
      };

      return {
        ...camera,
        floorName: floorPlan?.floorName || (floorId === 'floor_1' ? 'Ground Floor' : floorId),
        roomName: room?.name || null,
        x: floorMarker?.x !== undefined ? floorMarker.x : null,
        y: floorMarker?.y !== undefined ? floorMarker.y : null,
        rotation: floorMarker?.rotation !== undefined ? floorMarker.rotation : 0,
        health,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        cameras: enrichedCameras,
        total: enrichedCameras.length,
      },
    });
  } catch (error: any) {
    console.error('[CameraController] Error listing cameras:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_CAMERAS_FAILED', message: error.message },
    });
  }
}

/**
 * GET /api/malls/:mallId/cameras/:cameraId
 * Returns details for a single camera.
 */
export async function getCameraById(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const cameraId = getParam(req.params.cameraId);
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const [cameraSnap, healthSnap, floorplansSnap] = await Promise.all([
      db.ref(`malls/${mallId}/cameras/${cameraId}`).once('value'),
      db.ref(`malls/${mallId}/cameraHealth/${cameraId}`).once('value'),
      db.ref(`malls/${mallId}/floorplans`).once('value'),
    ]);

    if (!cameraSnap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'CAMERA_NOT_FOUND', message: `Camera with ID '${cameraId}' does not exist.` },
      });
      return;
    }

    const camera: CameraRecord = cameraSnap.val();
    const floorId = camera.floorId || 'floor_1';
    const floorplansMap: Record<string, any> = floorplansSnap.exists() ? floorplansSnap.val() : {};
    const floorPlan = floorplansMap[floorId];
    const floorMarker = floorPlan?.cameras?.[cameraId];
    let room = camera.roomId && floorPlan?.rooms ? floorPlan.rooms[camera.roomId] : null;

    // Auto-detect room from floor marker spatial coordinates if roomId is unlinked
    if (!room && floorPlan?.rooms && floorMarker && floorMarker.x !== undefined && floorMarker.y !== undefined) {
      const mx = floorMarker.x;
      const my = floorMarker.y;
      const allRooms: any[] = Object.values(floorPlan.rooms);
      const containing = allRooms.filter((r) => mx >= r.x && mx <= r.x + r.width && my >= r.y && my <= r.y + r.height);
      if (containing.length > 0) {
        room = containing.find((r) => r.type === 'room') || containing[0];
        if (room?.roomId && !camera.roomId) {
          db.ref(`malls/${mallId}/cameras/${cameraId}/roomId`).set(room.roomId).catch(() => {});
        }
      }
    }

    const healthRecord: CameraHealthRecord | null = healthSnap.exists() ? healthSnap.val() : null;
    const health: CameraHealthRecord = {
      cameraId,
      status: !camera.isActive ? 'inactive' : (healthRecord?.status || 'online'),
      lastSeenAt: healthRecord?.lastSeenAt || camera.updatedAt || camera.createdAt,
      lastFrameAt: healthRecord?.lastFrameAt || camera.updatedAt || camera.createdAt,
      updatedAt: healthRecord?.updatedAt || new Date().toISOString(),
    };

    const enriched: CameraWithDetails = {
      ...camera,
      floorName: floorPlan?.floorName || (floorId === 'floor_1' ? 'Ground Floor' : floorId),
      roomName: room?.name || null,
      x: floorMarker?.x !== undefined ? floorMarker.x : null,
      y: floorMarker?.y !== undefined ? floorMarker.y : null,
      rotation: floorMarker?.rotation !== undefined ? floorMarker.rotation : 0,
      health,
    };

    res.status(200).json({
      success: true,
      data: enriched,
    });
  } catch (error: any) {
    console.error('[CameraController] Error getting camera:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_CAMERA_FAILED', message: error.message },
    });
  }
}

/**
 * POST /api/malls/:mallId/cameras
 * Creates a new camera record and optional floor plan marker.
 */
export async function createCamera(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const body: CreateCameraDto = req.body;
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  // Validation
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Camera name is required.' },
    });
    return;
  }

  if (!body.streamUrl || typeof body.streamUrl !== 'string' || !body.streamUrl.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Stream URL or video selection is required.' },
    });
    return;
  }

  const allowedTypes = ['simulated', 'mjpeg', 'esp32cam'];
  const streamType = body.streamType || 'simulated';
  if (!allowedTypes.includes(streamType)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid streamType '${streamType}'. Must be one of: simulated, mjpeg, esp32cam`,
      },
    });
    return;
  }

  try {
    const now = new Date().toISOString();
    const cameraId = (body.cameraId && body.cameraId.trim()) ? body.cameraId.trim().replace(/[^a-zA-Z0-9_-]/g, '') : generateCameraId();
    const floorId = (body.floorId && body.floorId.trim()) ? body.floorId.trim() : 'floor_1';
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

    // 1. Authoritative camera configuration
    const cameraRecord: CameraRecord = {
      cameraId,
      mallId,
      name: body.name.trim(),
      floorId,
      roomId: body.roomId || null,
      streamType,
      streamUrl: body.streamUrl.trim(),
      isActive,
      createdAt: now,
      updatedAt: now,
    };

    await db.ref(`malls/${mallId}/cameras/${cameraId}`).set(cameraRecord);

    // 2. Initialize camera health node
    const healthRecord: CameraHealthRecord = {
      cameraId,
      status: isActive ? 'online' : 'inactive',
      lastSeenAt: now,
      lastFrameAt: now,
      updatedAt: now,
    };
    await db.ref(`malls/${mallId}/cameraHealth/${cameraId}`).set(healthRecord);

    // 3. If spatial coordinates provided, create floor plan marker
    let x = body.x !== undefined ? Number(body.x) : null;
    let y = body.y !== undefined ? Number(body.y) : null;
    const rotation = body.rotation !== undefined ? Number(body.rotation) : 0;

    if (x !== null && y !== null) {
      await db.ref(`malls/${mallId}/floorplans/${floorId}/cameras/${cameraId}`).set({
        cameraId,
        name: cameraRecord.name,
        x,
        y,
        rotation,
      });
    }

    // Initialize clean cameraDetectionState in RTDB
    await db.ref(`malls/${mallId}/cameraDetectionState/${cameraId}`).set({
      cameraId,
      mallId,
      isCurrentlyDetected: false,
      detectionType: null,
      activeTypes: [],
      lastDetectedAt: null,
      updatedAt: now,
      confidence: 0,
      cameraStatus: isActive ? 'online' : 'inactive',
    });

    // Notify AI service to monitor new camera immediately if active
    if (isActive) {
      notifyAiServiceCameraChange('start', {
        cameraId,
        mallId,
        name: cameraRecord.name,
        streamType: cameraRecord.streamType,
        streamUrl: cameraRecord.streamUrl,
      });
    }

    console.log(`[CameraController] Created camera '${cameraId}' for mall '${mallId}' (floor: ${floorId})`);

    res.status(201).json({
      success: true,
      data: {
        ...cameraRecord,
        x,
        y,
        rotation,
        health: healthRecord,
      },
    });
  } catch (error: any) {
    console.error('[CameraController] Error creating camera:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_CAMERA_FAILED', message: error.message },
    });
  }
}

/**
 * PATCH /api/malls/:mallId/cameras/:cameraId
 * Updates camera details, stream configuration, active state, and floor marker.
 */
export async function updateCamera(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const cameraId = getParam(req.params.cameraId);
  const body: UpdateCameraDto = req.body;
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const cameraRef = db.ref(`malls/${mallId}/cameras/${cameraId}`);
    const existingSnap = await cameraRef.once('value');

    if (!existingSnap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'CAMERA_NOT_FOUND', message: `Camera with ID '${cameraId}' does not exist.` },
      });
      return;
    }

    const existingCamera: CameraRecord = existingSnap.val();
    const now = new Date().toISOString();

    const updatedCamera: CameraRecord = {
      ...existingCamera,
      name: body.name !== undefined ? body.name.trim() : existingCamera.name,
      floorId: body.floorId !== undefined ? body.floorId : existingCamera.floorId,
      roomId: body.roomId !== undefined ? body.roomId : existingCamera.roomId,
      streamType: body.streamType !== undefined ? body.streamType : existingCamera.streamType,
      streamUrl: body.streamUrl !== undefined ? body.streamUrl.trim() : existingCamera.streamUrl,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : existingCamera.isActive,
      updatedAt: now,
    };

    // Save authoritative camera configuration
    await cameraRef.set(updatedCamera);

    // Update health status if isActive changed
    if (body.isActive !== undefined) {
      await db.ref(`malls/${mallId}/cameraHealth/${cameraId}/status`).set(
        updatedCamera.isActive ? 'online' : 'inactive'
      );
    }

    // Handle floor marker update / move
    const oldFloorId = existingCamera.floorId || 'floor_1';
    const newFloorId = updatedCamera.floorId || 'floor_1';

    // If floor changed, remove from old floor
    if (oldFloorId !== newFloorId) {
      await db.ref(`malls/${mallId}/floorplans/${oldFloorId}/cameras/${cameraId}`).remove();
    }

    // Update or create marker on target floor if x, y, or name provided
    if (body.x !== undefined || body.y !== undefined || body.name !== undefined || body.rotation !== undefined) {
      const markerRef = db.ref(`malls/${mallId}/floorplans/${newFloorId}/cameras/${cameraId}`);
      const markerSnap = await markerRef.once('value');
      const existingMarker = markerSnap.exists() ? markerSnap.val() : {};

      await markerRef.set({
        cameraId,
        name: updatedCamera.name,
        x: body.x !== undefined ? Number(body.x) : (existingMarker.x ?? 0.5),
        y: body.y !== undefined ? Number(body.y) : (existingMarker.y ?? 0.5),
        rotation: body.rotation !== undefined ? Number(body.rotation) : (existingMarker.rotation ?? 0),
      });
    }

    // Immediately reset real-time detection presence in RTDB when camera config / stream changes
    await db.ref(`malls/${mallId}/cameraDetectionState/${cameraId}`).set({
      cameraId,
      mallId,
      isCurrentlyDetected: false,
      detectionType: null,
      activeTypes: [],
      lastDetectedAt: null,
      updatedAt: now,
      confidence: 0,
      cameraStatus: updatedCamera.isActive ? 'online' : 'inactive',
    });

    // Reset deduplication incident groups for this camera so past cooldowns do not lock out the new video feed
    await Promise.all([
      db.ref(`malls/${mallId}/incidentGroups/${cameraId}_fire`).remove().catch(() => {}),
      db.ref(`malls/${mallId}/incidentGroups/${cameraId}_smoke`).remove().catch(() => {}),
      db.ref(`malls/${mallId}/incidentGroups/${cameraId}_fire_and_smoke`).remove().catch(() => {}),
      db.ref(`malls/${mallId}/cameraDetectionState/${cameraId}`).set({
        cameraId,
        mallId,
        isCurrentlyDetected: false,
        detectionType: null,
        activeTypes: [],
        updatedAt: now,
        cameraStatus: updatedCamera.isActive ? 'running' : 'stopped',
        confidence: null,
      }).catch(() => {}),
    ]);

    // Notify AI service of camera update so worker restarts with the new streamUrl / active state
    if (updatedCamera.isActive) {
      notifyAiServiceCameraChange('start', {
        cameraId,
        mallId,
        name: updatedCamera.name,
        streamType: updatedCamera.streamType,
        streamUrl: updatedCamera.streamUrl,
      });
    } else {
      notifyAiServiceCameraChange('stop', { cameraId });
    }

    console.log(`[CameraController] Updated camera '${cameraId}' for mall '${mallId}'`);

    res.status(200).json({
      success: true,
      data: {
        ...updatedCamera,
        updatedAt: now,
      },
    });
  } catch (error: any) {
    console.error('[CameraController] Error updating camera:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_CAMERA_FAILED', message: error.message },
    });
  }
}

/**
 * DELETE /api/malls/:mallId/cameras/:cameraId
 * Deletes camera configuration, health record, and floor plan marker.
 * Strictly preserves rooms, doors, and historical incident records.
 */
export async function deleteCamera(req: Request, res: Response): Promise<void> {
  const mallId = getParam(req.params.mallId);
  const cameraId = getParam(req.params.cameraId);
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const cameraSnap = await db.ref(`malls/${mallId}/cameras/${cameraId}`).once('value');
    if (!cameraSnap.exists()) {
      res.status(404).json({
        success: false,
        error: { code: 'CAMERA_NOT_FOUND', message: `Camera with ID '${cameraId}' does not exist.` },
      });
      return;
    }

    const camera: CameraRecord = cameraSnap.val();
    const floorId = camera.floorId || 'floor_1';

    // 1. Delete camera configuration
    await db.ref(`malls/${mallId}/cameras/${cameraId}`).remove();

    // 2. Delete camera health
    await db.ref(`malls/${mallId}/cameraHealth/${cameraId}`).remove();

    // 3. Remove marker from floor plan (check all floors or camera's floorId)
    await db.ref(`malls/${mallId}/floorplans/${floorId}/cameras/${cameraId}`).remove();

    // 4. Remove cameraDetectionState and incident groups
    await Promise.all([
      db.ref(`malls/${mallId}/cameraDetectionState/${cameraId}`).remove().catch(() => {}),
      db.ref(`malls/${mallId}/incidentGroups/${cameraId}_fire`).remove().catch(() => {}),
      db.ref(`malls/${mallId}/incidentGroups/${cameraId}_smoke`).remove().catch(() => {}),
    ]);

    // 5. Notify AI service to stop worker for deleted camera
    notifyAiServiceCameraChange('stop', { cameraId });

    console.log(`[CameraController] Deleted camera '${cameraId}' from mall '${mallId}'`);

    res.status(200).json({
      success: true,
      data: {
        cameraId,
        deleted: true,
      },
    });
  } catch (error: any) {
    console.error('[CameraController] Error deleting camera:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_CAMERA_FAILED', message: error.message },
    });
  }
}
