import { Router } from 'express';
import {
  createMall,
  listMalls,
  getMallDetails,
  updateMall,
  createManagementAccount,
  listManagementAccounts,
  getPlatformStats,
} from '../controllers/adminController';
import { verifyFirebaseToken, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Strictly enforce Firebase authentication & superadmin role across all admin routes
router.use(verifyFirebaseToken);
router.use(requireRole('superadmin'));

// Platform Stats
router.get('/stats', getPlatformStats);

// Mall Management Endpoints
router.post('/malls', createMall);
router.get('/malls', listMalls);
router.get('/malls/:mallId', getMallDetails);
router.put('/malls/:mallId', updateMall);
router.patch('/malls/:mallId', updateMall);
router.patch('/malls/:mallId/status', updateMall);

// Mall Management Account Creation Endpoints
router.post('/management-users', createManagementAccount);
router.post('/malls/:mallId/management-account', createManagementAccount);
router.get('/management-users', listManagementAccounts);

export default router;
