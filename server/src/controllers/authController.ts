import { Request, Response } from 'express';
import { getFirebaseDatabase } from '../config/firebase';
import { UserProfile } from '../types/auth';

/**
 * GET /api/auth/me
 * Returns profile and verified role for the authenticated user.
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User is not authenticated',
      },
    });
    return;
  }

  try {
    let profile: UserProfile | null = null;
    let mallName: string | null = null;
    let mallInfo: any = null;
    try {
      const db = getFirebaseDatabase();
      if (db) {
        const snapshot = await db.ref(`users/${user.uid}`).once('value');
        if (snapshot.exists()) {
          profile = snapshot.val() as UserProfile;
        }

        // If user has an assigned mallId, load full mall info from malls/{mallId}/info
        const effectiveMallId = user.mallId || profile?.mallId;
        if (effectiveMallId) {
          const mallSnapshot = await db.ref(`malls/${effectiveMallId}/info`).once('value');
          if (mallSnapshot.exists()) {
            const m = mallSnapshot.val();
            mallName = m.name || null;
            mallInfo = {
              mallId: effectiveMallId,
              name: m.name,
              address: m.address || '',
              contactEmail: m.contactEmail || '',
              contactPhone: m.contactPhone || '',
              contactPerson: m.contactPerson || '',
              totalFloors: m.totalFloors !== undefined ? m.totalFloors : 1,
            };
          }
        }
      }
    } catch (dbErr: any) {
      console.warn('[Auth Controller] Profile lookup notice:', dbErr.message);
    }

    res.status(200).json({
      success: true,
      data: {
        uid: user.uid,
        email: profile?.email || user.email || '',
        displayName: profile?.displayName || user.email?.split('@')[0] || 'User',
        role: user.role || 'unassigned',
        mallId: user.mallId ?? profile?.mallId ?? null,
        mallName: mallName ?? null,
        mallInfo: mallInfo ?? null,
        isActive: profile?.isActive ?? user.isActive ?? true,
      },
    });
  } catch (error: any) {
    console.error('[Auth Controller] Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve user profile',
      },
    });
  }
}

/**
 * POST /api/auth/verify
 * Verifies ID token claims and returns decoded payload.
 */
export async function verifyToken(req: Request, res: Response): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token verification failed or missing token',
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      uid: user.uid,
      email: user.email,
      role: user.role,
      mallId: user.mallId ?? null,
      isActive: user.isActive ?? true,
    },
  });
}

/**
 * GET /api/auth/test/superadmin
 * Test endpoint accessible strictly by superadmin.
 */
export function testSuperadminAccess(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      message: 'Access granted: Superadmin authorization verified.',
      user: req.user,
    },
  });
}

/**
 * GET /api/auth/test/management
 * Test endpoint accessible strictly by mall_management.
 */
export function testManagementAccess(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      message: 'Access granted: Mall management authorization verified.',
      user: req.user,
    },
  });
}

/**
 * GET /api/auth/test/malls/:mallId
 * Test endpoint verifying mall-specific isolation (superadmin or matching mall_management).
 */
export function testMallIsolation(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      message: `Access granted: Authorized for mall '${req.params.mallId}'.`,
      mallId: req.params.mallId,
      user: req.user,
    },
  });
}
