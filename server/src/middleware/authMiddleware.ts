import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth, getFirebaseDatabase } from '../config/firebase';
import { UserRole } from '../types/auth';

/**
 * Middleware: Verifies Firebase ID Token from Authorization header
 * and attaches verified claims to req.user.
 */
export async function verifyFirebaseToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header is missing or malformed (expected Bearer <token>)',
      },
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Bearer token not provided',
      },
    });
    return;
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_SERVICE_UNAVAILABLE',
        message: 'Authentication service is not configured on the server',
      },
    });
    return;
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role as UserRole | undefined,
      mallId: (decodedToken.mallId as string | undefined) ?? null,
      isActive: (decodedToken.isActive as boolean | undefined) ?? true,
    };

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Token verification failed:', error.message);
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token',
      },
    });
  }
}

/**
 * Middleware: Enforces that the authenticated user possesses one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User must be authenticated',
        },
      });
      return;
    }

    if (!req.user.role) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'User has no role assigned',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied: role '${req.user.role}' is not authorized for this resource`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Enforces mall-level isolation.
 * - Superadmin has platform-level access to any mall.
 * - Mall management is strictly limited to their assigned mallId.
 */
export async function requireMallAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User must be authenticated',
      },
    });
    return;
  }

  // Superadmin has platform-wide access
  if (req.user.role === 'superadmin') {
    next();
    return;
  }

  // Mall management users are restricted to their assigned mall
  if (req.user.role === 'mall_management') {
    const targetMallId = req.params.mallId;

    if (!targetMallId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Target mallId parameter is required in route',
        },
      });
      return;
    }

    let userMallId = req.user.mallId;
    if (!userMallId) {
      const db = getFirebaseDatabase();
      if (db) {
        try {
          const userSnap = await db.ref(`users/${req.user.uid}/mallId`).once('value');
          if (userSnap.exists()) {
            userMallId = userSnap.val();
            req.user.mallId = userMallId;
          }
        } catch (_) {}
      }
    }

    if (!userMallId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Mall management account has no associated mallId assigned',
        },
      });
      return;
    }

    if (userMallId !== targetMallId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied: cannot access data for mall '${targetMallId}'. Account is assigned to mall '${userMallId}'`,
        },
      });
      return;
    }

    next();
    return;
  }

  // Unknown or unhandled role
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Access denied: insufficient permissions',
    },
  });
}
