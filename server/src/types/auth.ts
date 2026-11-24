export type UserRole = 'superadmin' | 'mall_management';

export interface AuthTokenPayload {
  uid: string;
  email?: string;
  role?: UserRole;
  mallId?: string | null;
  isActive?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  mallId: string | null;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

// Extend Express Request to include authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}
