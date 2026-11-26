import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file (supports both server/ and root executions)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function resolveEvidenceDir(): string {
  const envVal = process.env.EVACAI_EVIDENCE_DIR || process.env.EVIDENCE_DIR;
  let resolved: string;
  if (envVal) {
    if (path.isAbsolute(envVal)) {
      resolved = path.normalize(envVal);
    } else {
      const candCwd = path.resolve(process.cwd(), envVal);
      const candServer = path.resolve(__dirname, '../../', envVal);
      resolved = fs.existsSync(candCwd) ? candCwd : (fs.existsSync(candServer) ? candServer : candCwd);
    }
  } else {
    const rootEvidence = path.resolve(__dirname, '../../../evidence');
    resolved = fs.existsSync(rootEvidence) ? rootEvidence : path.resolve(process.cwd(), 'evidence');
  }

  // Ensure base evidence directory and incidents directory exist
  try {
    fs.mkdirSync(path.join(resolved, 'incidents'), { recursive: true });
  } catch (_) {}

  return resolved;
}

export interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  aiServiceUrl: string;
  aiServiceKey: string;
  evidenceDir: string;
  cooldownSeconds: number;
  emailAlertConfidenceThreshold: number;
  smtp: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  };
  firebase: {
    serviceAccountPath?: string;
    serviceAccountKey?: string;
    databaseUrl?: string;
    storageBucket?: string;
  };
}

export const env: EnvironmentConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiServiceKey: process.env.AI_SERVICE_KEY || 'evacai_dev_secret_key_change_in_production',
  evidenceDir: resolveEvidenceDir(),
  cooldownSeconds: parseInt(process.env.INCIDENT_COOLDOWN_SECONDS || '900', 10),
  emailAlertConfidenceThreshold: parseFloat(process.env.EMAIL_ALERT_CONFIDENCE_THRESHOLD || '0.65'),
  smtp: {
    host: process.env.SMTP_HOST || undefined,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || 'EvacAI Alerts <alerts@evacai.com>',
  },
  firebase: {
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    databaseUrl: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  },
};
