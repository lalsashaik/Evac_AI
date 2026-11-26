import { Router } from 'express';
import {
  listNotifications,
  markNotificationRead,
} from '../controllers/incidentController';
import { verifyFirebaseToken, requireRole, requireMallAccess } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

// All notification endpoints require Firebase authentication + mall management role + mall isolation
router.use(verifyFirebaseToken);
router.use(requireRole('mall_management', 'superadmin'));
router.use(requireMallAccess);

// GET /api/malls/:mallId/notifications
router.get('/', listNotifications);

// PATCH /api/malls/:mallId/notifications/:notificationId/read
router.patch('/:notificationId/read', markNotificationRead);

export default router;
