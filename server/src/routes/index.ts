import { Router } from 'express';
import healthRoutes from './healthRoutes';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import floorplanRoutes from './floorplanRoutes';
import cameraRoutes from './cameraRoutes';
import mallRoutes from './mallRoutes';
import internalRoutes from './internalRoutes';
import detectionRoutes from './detectionRoutes';
import incidentRoutes from './incidentRoutes';
import notificationRoutes from './notificationRoutes';
import { getFirebaseDatabase } from '../config/firebase';

const router = Router();

// Health check endpoint mounted on /api/health as well as /health
router.use('/health', healthRoutes);

// Auth & Role verification endpoints
router.use('/auth', authRoutes);

// Superadmin Mall & Account Management endpoints
router.use('/admin', adminRoutes);

// AI Service Detection Ingestion endpoint (M7)
// Route: POST /api/detection
router.use('/detection', detectionRoutes);

// Mall Management — Incident Pipeline endpoints (M7)
// Routes are prefixed: /api/malls/:mallId/incidents
router.use('/malls/:mallId/incidents', incidentRoutes);

// Mall Management — Notification endpoints (M7)
// Routes are prefixed: /api/malls/:mallId/notifications
router.use('/malls/:mallId/notifications', notificationRoutes);

// Mall Management — Floor Plan endpoints (M4)
// Routes are prefixed: /api/malls/:mallId/floorplan
router.use('/malls/:mallId/floorplan', floorplanRoutes);

// Mall Management — Camera Management endpoints (M5)
// Routes are prefixed: /api/malls/:mallId/cameras
router.use('/malls/:mallId/cameras', cameraRoutes);

// Mall Management — Mall Details & Info endpoints
// Routes are prefixed: /api/malls/:mallId/info
router.use('/malls', mallRoutes);

// AI Service Internal endpoints (X-AI-Service-Key auth)
router.use('/internal', internalRoutes);

// Global Emergency Status endpoint (active / normal condition)
router.get('/emergency/status', async (_req, res) => {
  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({ success: false, error: 'Database unavailable' });
    return;
  }
  const snap = await db.ref('emergency').once('value');
  const val = snap.val() || {};
  res.status(200).json({
    success: true,
    data: {
      status: val.status || 'normal',
      updatedAt: val.updatedAt || new Date().toISOString(),
      activeCount: val.activeCount || 0,
      activeDetails: val.activeDetails || [],
    },
  });
});

export default router;
