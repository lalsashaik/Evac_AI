import express from 'express';
import cors from 'cors';
import { env } from './config/environment';
import { initializeFirebaseAdmin } from './config/firebase';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getHealth } from './controllers/healthController';
import apiRoutes from './routes';

const app = express();

// Initialize Firebase Admin SDK (logs status if unconfigured)
initializeFirebaseAdmin();

// Middleware
app.use(cors({
  origin: env.corsOrigin === '*' ? '*' : env.corsOrigin.split(','),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Primary health check at root /health
app.get('/health', getHealth);

// API Routes
app.use('/api', apiRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server (only when not running under test runner)
if (process.env.NODE_ENV !== 'test' && !process.argv.some(arg => arg.includes('test'))) {
  app.listen(env.port, () => {
    console.log(`[EvacAI Server] Running on http://localhost:${env.port}`);
    console.log(`[EvacAI Server] Health endpoint: http://localhost:${env.port}/health`);
  });
}

export default app;
