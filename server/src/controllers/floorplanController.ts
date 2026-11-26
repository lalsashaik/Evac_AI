import { Request, Response } from 'express';
import { getFirebaseDatabase } from '../config/firebase';
import { FloorPlan, SaveFloorPlanDto } from '../types/floorplan';

function getTargetFloorId(req: Request): string {
  const queryFloor = req.query.floorId as string | undefined;
  const paramFloor = req.params.floorId as string | undefined;
  const bodyFloor = (req.body && req.body.floorId) as string | undefined;
  const raw = queryFloor || paramFloor || bodyFloor || 'floor_1';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'floor_1';
}

function getFloorNumber(floorId: string): number {
  const match = floorId.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

/**
 * GET /api/malls/:mallId/floorplan
 * GET /api/malls/:mallId/floorplan/:floorId
 * Returns the saved floor plan for the authenticated manager's mall and floor.
 */
export async function getFloorPlan(req: Request, res: Response): Promise<void> {
  const { mallId } = req.params;
  const floorId = getTargetFloorId(req);
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const snapshot = await db.ref(`malls/${mallId}/floorplans/${floorId}`).once('value');

    if (!snapshot.exists()) {
      res.status(200).json({
        success: true,
        data: null,
      });
      return;
    }

    const floorPlan: FloorPlan = snapshot.val();

    res.status(200).json({
      success: true,
      data: floorPlan,
    });
  } catch (error: any) {
    console.error('[FloorPlan Controller] Error loading floor plan:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_FLOORPLAN_FAILED', message: error.message },
    });
  }
}

/**
 * GET /api/malls/:mallId/floorplan/all/list
 * Returns all saved floor plans for the authenticated manager's mall.
 */
export async function listFloorPlans(req: Request, res: Response): Promise<void> {
  const { mallId } = req.params;
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  try {
    const snapshot = await db.ref(`malls/${mallId}/floorplans`).once('value');
    const plans: Record<string, FloorPlan> = snapshot.exists() ? snapshot.val() : {};

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error: any) {
    console.error('[FloorPlan Controller] Error listing floor plans:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_FLOORPLANS_FAILED', message: error.message },
    });
  }
}

/**
 * PUT /api/malls/:mallId/floorplan
 * PUT /api/malls/:mallId/floorplan/:floorId
 * Saves (replaces) the floor plan for the specified floor of the authenticated manager's mall.
 */
export async function saveFloorPlan(req: Request, res: Response): Promise<void> {
  const { mallId } = req.params;
  const floorId = getTargetFloorId(req);
  const body: SaveFloorPlanDto = req.body;
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Firebase Realtime Database is not initialized.' },
    });
    return;
  }

  // Basic validation
  if (!body || typeof body !== 'object') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request body must be a valid floor plan object.' },
    });
    return;
  }

  if (body.rooms && typeof body.rooms !== 'object') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'rooms must be an object.' },
    });
    return;
  }

  if (body.doors && typeof body.doors !== 'object') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'doors must be an object.' },
    });
    return;
  }

  if (body.cameras && typeof body.cameras !== 'object') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'cameras must be an object.' },
    });
    return;
  }

  try {
    const now = new Date().toISOString();
    const floorRef = db.ref(`malls/${mallId}/floorplans/${floorId}`);

    // Check if existing floor plan has a createdAt — preserve it
    const existing = await floorRef.once('value');
    const createdAt = existing.exists() ? (existing.val().createdAt || now) : now;

    const floorNumber = body.floorNumber || getFloorNumber(floorId);
    const defaultFloorName = floorNumber === 1 ? 'Ground Floor' : `Floor ${floorNumber}`;

    const floorPlan: FloorPlan = {
      floorId,
      floorName: body.floorName || defaultFloorName,
      floorNumber,
      canvasWidth: body.canvasWidth || 1000,
      canvasHeight: body.canvasHeight || 660,
      createdAt,
      updatedAt: now,
      rooms: body.rooms || {},
      doors: body.doors || {},
      cameras: body.cameras || {},
    };

    // Full replace — set() overwrites cleanly
    await floorRef.set(floorPlan);

function findContainingRoom(x: number, y: number, rooms: Record<string, any>): any | null {
  if (!rooms || typeof rooms !== 'object') return null;
  const list = Object.values(rooms);
  const matches = list.filter((r: any) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
  if (matches.length === 0) return null;
  return matches.find((r: any) => r.type === 'room') || matches[0];
}

    // Sync authoritative camera records under malls/{mallId}/cameras/{cameraId}
    // Ensures cameras placed on floor plan have persistent configuration and room assignment
    if (floorPlan.cameras && typeof floorPlan.cameras === 'object') {
      const cameraEntries = Object.entries(floorPlan.cameras);
      for (const [camId, camMarker] of cameraEntries) {
        try {
          const containingRoom = camMarker.roomId && floorPlan.rooms[camMarker.roomId]
            ? floorPlan.rooms[camMarker.roomId]
            : findContainingRoom(camMarker.x, camMarker.y, floorPlan.rooms);
          const effectiveRoomId = containingRoom ? containingRoom.roomId : (camMarker.roomId || null);
          const defaultName = containingRoom ? `Camera - ${containingRoom.name}` : (camMarker.name || 'Camera');

          // Keep marker in floor plan aligned with room
          if (effectiveRoomId) {
            camMarker.roomId = effectiveRoomId;
          }

          const camRef = db.ref(`malls/${mallId}/cameras/${camId}`);
          const camSnap = await camRef.once('value');
          if (!camSnap.exists()) {
            await camRef.set({
              cameraId: camId,
              mallId,
              name: camMarker.name && camMarker.name !== 'Camera' ? camMarker.name : defaultName,
              floorId,
              roomId: effectiveRoomId,
              streamType: camMarker.streamType || 'simulated',
              streamUrl: camMarker.streamUrl || '',
              isActive: true,
              createdAt: now,
              updatedAt: now,
            });
            await db.ref(`malls/${mallId}/cameraHealth/${camId}`).set({
              cameraId: camId,
              status: 'online',
              lastSeenAt: now,
              lastFrameAt: now,
              updatedAt: now,
            });
          } else {
            const existing = camSnap.val();
            const updates: Record<string, any> = { updatedAt: now };
            if (camMarker.name && camMarker.name !== existing.name) {
              updates.name = camMarker.name;
            }
            if (effectiveRoomId !== existing.roomId) {
              updates.roomId = effectiveRoomId;
            }
            if (floorId !== existing.floorId) {
              updates.floorId = floorId;
            }
            await camRef.update(updates);
          }
        } catch (camErr) {
          console.warn(`[FloorPlan Controller] Note syncing camera '${camId}':`, camErr);
        }
      }
    }

    console.log(`[FloorPlan Controller] Saved floor plan for mall '${mallId}', floor '${floorId}' (${Object.keys(floorPlan.rooms).length} rooms/spaces, ${Object.keys(floorPlan.doors).length} doors, ${Object.keys(floorPlan.cameras).length} cameras)`);

    res.status(200).json({
      success: true,
      data: {
        floorId,
        mallId,
        floorName: floorPlan.floorName,
        floorNumber: floorPlan.floorNumber,
        updatedAt: now,
        roomCount: Object.keys(floorPlan.rooms).length,
        doorCount: Object.keys(floorPlan.doors).length,
        cameraCount: Object.keys(floorPlan.cameras).length,
      },
    });
  } catch (error: any) {
    console.error('[FloorPlan Controller] Error saving floor plan:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SAVE_FLOORPLAN_FAILED', message: error.message },
    });
  }
}
