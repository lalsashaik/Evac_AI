import { Router } from 'express';
import {
  ingestDetection,
  updateDetectionState,
  getDetectionState,
  ingestObservation,
} from '../controllers/detectionController';

const router = Router();

/**
 * POST /api/detection
 * Ingests a fire/smoke detection event from the AI service.
 * Authenticated via X-AI-Service-Key header.
 */
router.post('/', ingestDetection);

/**
 * POST /api/detection/observation
 * Ingests a periodic 15-min timescale observation snapshot.
 * Authenticated via X-AI-Service-Key header.
 */
router.post('/observation', ingestObservation);

/**
 * POST /api/detection/state
 * Updates real-time camera fire/smoke detection presence.
 * Authenticated via X-AI-Service-Key header.
 */
router.post('/state', updateDetectionState);

/**
 * GET /api/detection/state/:mallId
 * Retrieves current real-time camera detection state for a mall.
 */
router.get('/state/:mallId', getDetectionState);

export default router;

