import { Router } from 'express';
import {
  listIncidents,
  getIncident,
  updateIncidentStatus,
  getEvidence,
  triggerIncidentEmail,
} from '../controllers/incidentController';
import { verifyFirebaseToken, requireRole, requireMallAccess } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

// All incident endpoints require Firebase authentication + mall management role + mall isolation
router.use(verifyFirebaseToken);
router.use(requireRole('mall_management', 'superadmin'));
router.use(requireMallAccess);

// GET /api/malls/:mallId/incidents
router.get('/', listIncidents);

// GET /api/malls/:mallId/incidents/:incidentId
router.get('/:incidentId', getIncident);

// PATCH /api/malls/:mallId/incidents/:incidentId/status
router.patch('/:incidentId/status', updateIncidentStatus);

// GET /api/malls/:mallId/incidents/:incidentId/evidence
router.get('/:incidentId/evidence', getEvidence);

// POST /api/malls/:mallId/incidents/:incidentId/email
router.post('/:incidentId/email', triggerIncidentEmail);

export default router;
