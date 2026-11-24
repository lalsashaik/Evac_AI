import { Router } from 'express';
import {
  listCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
} from '../controllers/cameraController';
import { verifyFirebaseToken, requireRole, requireMallAccess } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

// All camera routes require:
// 1. Valid Firebase ID token
// 2. Role: mall_management (strictly tenant isolated)
// 3. Mall-level access verification
router.use(verifyFirebaseToken);
router.use(requireRole('mall_management'));
router.use(requireMallAccess);

// GET    /api/malls/:mallId/cameras
router.get('/', listCameras);

// POST   /api/malls/:mallId/cameras
router.post('/', createCamera);

// GET    /api/malls/:mallId/cameras/:cameraId
router.get('/:cameraId', getCameraById);

// PATCH  /api/malls/:mallId/cameras/:cameraId
router.patch('/:cameraId', updateCamera);

// DELETE /api/malls/:mallId/cameras/:cameraId
router.delete('/:cameraId', deleteCamera);

export default router;
