import { Router } from 'express';
import healthRoutes from './healthRoutes';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import floorplanRoutes from './floorplanRoutes';
import cameraRoutes from './cameraRoutes';
import mallRoutes from './mallRoutes';

const router = Router();

// Health check endpoint mounted on /api/health as well as /health
router.use('/health', healthRoutes);

// Auth & Role verification endpoints
router.use('/auth', authRoutes);

// Superadmin Mall & Account Management endpoints
router.use('/admin', adminRoutes);

// Mall Management — Floor Plan endpoints (M4)
// Routes are prefixed: /api/malls/:mallId/floorplan
router.use('/malls/:mallId/floorplan', floorplanRoutes);

// Mall Management — Camera Management endpoints (M5)
// Routes are prefixed: /api/malls/:mallId/cameras
router.use('/malls/:mallId/cameras', cameraRoutes);

// Mall Management — Mall Details & Info endpoints
// Routes are prefixed: /api/malls/:mallId/info
router.use('/malls', mallRoutes);

export default router;
