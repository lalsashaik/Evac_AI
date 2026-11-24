import { Router } from 'express';
import healthRoutes from './healthRoutes';

const router = Router();

// Health check endpoint mounted on /api/health as well as /health
router.use('/health', healthRoutes);

export default router;
