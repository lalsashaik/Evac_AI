import { Router, Request, Response } from 'express';
import { getFirebaseDatabase } from '../config/firebase';

const router = Router();

/**
 * GET /api/internal/cameras
 * Called by AI service at startup or sync to retrieve all cameras across all malls.
 * Protected by X-AI-Service-Key header.
 */
router.get('/cameras', async (req: Request, res: Response): Promise<void> => {
  const serviceKey = req.headers['x-ai-service-key'];
  const expectedKey = process.env.AI_SERVICE_KEY || 'evacai_dev_secret_key_change_in_production';

  if (!serviceKey || serviceKey !== expectedKey) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-AI-Service-Key' },
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
    const mallsSnap = await db.ref('malls').once('value');
    const mallsData = mallsSnap.exists() ? mallsSnap.val() : {};
    const allCameras: any[] = [];

    for (const [mallId, mallRecord] of Object.entries<any>(mallsData)) {
      if (mallRecord?.cameras) {
        for (const [camId, cam] of Object.entries<any>(mallRecord.cameras)) {
          allCameras.push({
            cameraId: cam.cameraId || camId,
            mallId: cam.mallId || mallId,
            name: cam.name || '',
            streamType: cam.streamType || 'simulated',
            streamUrl: cam.streamUrl || '',
            isActive: cam.isActive !== undefined ? Boolean(cam.isActive) : true,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        cameras: allCameras,
        total: allCameras.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
