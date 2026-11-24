import { Request, Response } from 'express';
import { getFirebaseAdminStatus } from '../config/firebase';
import { env } from '../config/environment';

export function getHealth(req: Request, res: Response) {
  const firebaseStatus = getFirebaseAdminStatus();

  return res.status(200).json({
    service: 'evacai-backend',
    status: 'ok',
    environment: env.nodeEnv,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    firebase: {
      initialized: firebaseStatus.initialized,
      message: firebaseStatus.message,
      ...(firebaseStatus.projectId ? { projectId: firebaseStatus.projectId } : {}),
    },
  });
}
