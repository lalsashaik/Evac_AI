import { Router } from 'express';
import {
  getCurrentUser,
  verifyToken,
  testSuperadminAccess,
  testManagementAccess,
  testMallIsolation,
} from '../controllers/authController';
import {
  verifyFirebaseToken,
  requireRole,
  requireMallAccess,
} from '../middleware/authMiddleware';

const router = Router();

// Authenticated user identity endpoints
router.get('/me', verifyFirebaseToken, getCurrentUser);
router.post('/verify', verifyFirebaseToken, verifyToken);

// Role & Mall Isolation test endpoints (used for verification & M2 testing)
router.get('/test/superadmin', verifyFirebaseToken, requireRole('superadmin'), testSuperadminAccess);
router.get('/test/management', verifyFirebaseToken, requireRole('mall_management'), testManagementAccess);
router.get('/test/malls/:mallId', verifyFirebaseToken, requireMallAccess, testMallIsolation);

export default router;
