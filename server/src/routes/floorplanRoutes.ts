import { Router } from 'express';
import { getFloorPlan, saveFloorPlan, listFloorPlans } from '../controllers/floorplanController';
import { verifyFirebaseToken, requireRole, requireMallAccess } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

// All floor plan routes require:
// 1. Valid Firebase ID token
// 2. Role: mall_management (or superadmin for read operations)
// 3. Mall-level access isolation
router.use(verifyFirebaseToken);
router.use(requireRole('mall_management', 'superadmin'));
router.use(requireMallAccess);

// List all floors summary
router.get('/list/all', listFloorPlans);

// GET  /api/malls/:mallId/floorplan  or  /api/malls/:mallId/floorplan/:floorId
router.get('/', getFloorPlan);
router.get('/:floorId', getFloorPlan);

// PUT  /api/malls/:mallId/floorplan  or  /api/malls/:mallId/floorplan/:floorId
router.put('/', saveFloorPlan);
router.put('/:floorId', saveFloorPlan);

export default router;
