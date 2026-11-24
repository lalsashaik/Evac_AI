import { Router } from 'express';
import { getMallInfo } from '../controllers/mallController';
import { verifyFirebaseToken, requireRole, requireMallAccess } from '../middleware/authMiddleware';

const router = Router();

// Enforce authentication & manager/superadmin access
router.use(verifyFirebaseToken);
router.use(requireRole('mall_management', 'superadmin'));

// GET /api/malls/:mallId/info
router.get('/:mallId/info', requireMallAccess, getMallInfo);
router.get('/:mallId', requireMallAccess, getMallInfo);

export default router;
