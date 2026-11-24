import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file (supports both server/ and root executions)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  aiServiceUrl: string;
  aiServiceKey: string;
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
  aiServiceKey: process.env.AI_SERVICE_KEY || 'dev_secret_key',
  firebase: {
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    databaseUrl: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  },
};
