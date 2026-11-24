import { Request, Response } from 'express';
import { getFirebaseDatabase } from '../config/firebase';
import { MallInfo } from '../types/mall';

/**
 * GET /api/malls/:mallId/info
 * Returns mall information for the authenticated user's mall.
 */
export async function getMallInfo(req: Request, res: Response): Promise<void> {
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
    let data: any = null;
    const snapshot = await db.ref(`malls/${mallId}/info`).once('value');

    if (snapshot.exists()) {
      data = snapshot.val();
    } else {
      const mallSnapshot = await db.ref(`malls/${mallId}`).once('value');
      if (mallSnapshot.exists()) {
        const raw = mallSnapshot.val();
        data = raw.info || raw;
      }
    }

    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'MALL_NOT_FOUND', message: `Mall '${mallId}' not found.` },
      });
      return;
    }

    const mall: MallInfo = {
      ...data,
      mallId: data.mallId || mallId,
      name: data.name || mallId,
      totalFloors: data.totalFloors !== undefined ? Number(data.totalFloors) : 1,
    };

    res.status(200).json({
      success: true,
      data: mall,
    });
  } catch (error: any) {
    console.error('[Mall Controller] Error fetching mall info:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_MALL_FAILED', message: error.message },
    });
  }
}
