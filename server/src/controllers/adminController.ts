import { Request, Response } from 'express';
import { getFirebaseAuth, getFirebaseDatabase } from '../config/firebase';
import { MallInfo, CreateMallDto, UpdateMallDto, CreateManagementAccountDto, PlatformStats } from '../types/mall';
import { UserProfile } from '../types/auth';

/**
 * Generate a clean, direct, URL-friendly Mall ID directly from the name
 * e.g. "Phoenix Marketcity" -> "phoenix_marketcity"
 * Direct names without forced prefixes or random gibberish suffixes.
 */
function generateMallId(name: string, customId?: string): string {
  if (customId && typeof customId === 'string' && customId.trim()) {
    return customId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  const cleanSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleanSlug || `mall_${Date.now()}`;
}

/**
 * POST /api/admin/malls
 * Create a new shopping mall
 */
export async function createMall(req: Request, res: Response): Promise<void> {
  const { name, address, contactEmail, contactPhone, contactPerson }: CreateMallDto = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Mall name is required and cannot be empty.',
      },
    });
    return;
  }

  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Firebase Realtime Database is not initialized.',
      },
    });
    return;
  }

  try {
    const customId = req.body.mallId as string | undefined;
    let mallId = generateMallId(name, customId);

    // If ID already exists, ensure uniqueness cleanly
    const existingCheck = await db.ref(`malls/${mallId}/info`).once('value');
    if (existingCheck.exists()) {
      let counter = 2;
      while ((await db.ref(`malls/${mallId}_${counter}/info`).once('value')).exists()) {
        counter++;
      }
      mallId = `${mallId}_${counter}`;
    }

    const now = new Date().toISOString();

    const totalFloors = Math.max(1, Math.min(10, Number(req.body.totalFloors) || 2));

    const mallData: MallInfo = {
      mallId,
      name: name.trim(),
      address: address?.trim() || '',
      contactEmail: contactEmail?.trim() || '',
      contactPhone: contactPhone?.trim() || '',
      contactPerson: contactPerson?.trim() || '',
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.uid || 'superadmin',
      isActive: true,
      totalFloors,
      managementUid: null,
      managementEmail: null,
      managementName: null,
    };

    // Save only under /malls/{mallId}/info to preserve future floor plans/cameras
    await db.ref(`malls/${mallId}/info`).set(mallData);

    console.log(`[Admin Controller] Created mall '${name}' with ID: ${mallId}`);
    res.status(201).json({
      success: true,
      data: mallData,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error creating mall:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_MALL_FAILED',
        message: `Failed to create mall: ${error.message}`,
      },
    });
  }
}

/**
 * GET /api/admin/malls
 * List all registered malls with assigned management summary
 */
export async function listMalls(req: Request, res: Response): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Firebase Realtime Database is not initialized.',
      },
    });
    return;
  }

  try {
    const [mallsSnapshot, usersSnapshot] = await Promise.all([
      db.ref('malls').once('value'),
      db.ref('users').once('value'),
    ]);

    const usersMap: Record<string, UserProfile> = {};
    if (usersSnapshot.exists()) {
      const rawUsers = usersSnapshot.val();
      for (const [uid, u] of Object.entries<any>(rawUsers)) {
        usersMap[uid] = u;
      }
    }

    const malls: MallInfo[] = [];

    if (mallsSnapshot.exists()) {
      const rawMalls = mallsSnapshot.val();
      for (const [mallId, mallNode] of Object.entries<any>(rawMalls)) {
        const info = mallNode.info || mallNode;
        if (info && (info.name || info.mallId)) {
          const item: MallInfo = {
            mallId: info.mallId || mallId,
            name: info.name || 'Unnamed Mall',
            address: info.address || '',
            contactEmail: info.contactEmail || '',
            contactPhone: info.contactPhone || '',
            contactPerson: info.contactPerson || '',
            createdAt: info.createdAt || new Date().toISOString(),
            updatedAt: info.updatedAt,
            createdBy: info.createdBy || '',
            isActive: info.isActive !== false,
            totalFloors: info.totalFloors !== undefined ? Number(info.totalFloors) : 1,
            managementUid: info.managementUid || null,
            managementEmail: info.managementEmail || (info.managementUid && usersMap[info.managementUid]?.email) || null,
            managementName: info.managementName || (info.managementUid && usersMap[info.managementUid]?.displayName) || null,
          };
          malls.push(item);
        }
      }
    }

    // Sort by createdAt descending (newest first)
    malls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      success: true,
      data: {
        malls,
        count: malls.length,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error listing malls:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_MALLS_FAILED',
        message: `Failed to retrieve malls: ${error.message}`,
      },
    });
  }
}

/**
 * GET /api/admin/malls/:mallId
 * Get detailed information for a single mall
 */
export async function getMallDetails(req: Request, res: Response): Promise<void> {
  const { mallId } = req.params;
  const db = getFirebaseDatabase();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database not initialized.' },
    });
    return;
  }

  try {
    const snapshot = await db.ref(`malls/${mallId}/info`).once('value');

    if (!snapshot.exists()) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MALL_NOT_FOUND',
          message: `Mall with ID '${mallId}' does not exist.`,
        },
      });
      return;
    }

    const mallData: MallInfo = {
      ...snapshot.val(),
      totalFloors: snapshot.val().totalFloors !== undefined ? Number(snapshot.val().totalFloors) : 1,
    };

    // If managementUid is present, enrich with user profile
    if (mallData.managementUid) {
      const userSnapshot = await db.ref(`users/${mallData.managementUid}`).once('value');
      if (userSnapshot.exists()) {
        const u = userSnapshot.val();
        mallData.managementEmail = u.email;
        mallData.managementName = u.displayName;
      }
    }

    res.status(200).json({
      success: true,
      data: mallData,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error retrieving mall details:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_MALL_FAILED', message: error.message },
    });
  }
}

/**
 * PUT / PATCH /api/admin/malls/:mallId
 * Update mall basic details without overwriting floorplans, cameras, etc.
 */
export async function updateMall(req: Request, res: Response): Promise<void> {
  const { mallId } = req.params;
  const updates: UpdateMallDto = req.body;
  const db = getFirebaseDatabase();
  const auth = getFirebaseAuth();

  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database not initialized.' },
    });
    return;
  }

  try {
    const mallRef = db.ref(`malls/${mallId}/info`);
    const snapshot = await mallRef.once('value');

    if (!snapshot.exists()) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MALL_NOT_FOUND',
          message: `Mall with ID '${mallId}' not found.`,
        },
      });
      return;
    }

    const currentMall: MallInfo = snapshot.val();
    const now = new Date().toISOString();

    const allowedFields: Partial<MallInfo> = {
      updatedAt: now,
    };

    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Mall name cannot be empty.' },
        });
        return;
      }
      allowedFields.name = updates.name.trim();
    }

    if (updates.address !== undefined) allowedFields.address = updates.address.trim();
    if (updates.contactEmail !== undefined) allowedFields.contactEmail = updates.contactEmail.trim();
    if (updates.contactPhone !== undefined) allowedFields.contactPhone = updates.contactPhone.trim();
    if (updates.contactPerson !== undefined) allowedFields.contactPerson = updates.contactPerson.trim();

    if (updates.totalFloors !== undefined) {
      const parsed = parseInt(String(updates.totalFloors), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        allowedFields.totalFloors = parsed;
      }
    }

    // Handle Active/Inactive status toggle
    if (updates.isActive !== undefined && updates.isActive !== currentMall.isActive) {
      allowedFields.isActive = Boolean(updates.isActive);

      // If active status changed and there is an associated management user, sync disabled state
      if (currentMall.managementUid && auth) {
        try {
          await auth.updateUser(currentMall.managementUid, {
            disabled: !allowedFields.isActive,
          });
          await db.ref(`users/${currentMall.managementUid}`).update({
            isActive: allowedFields.isActive,
          });
          console.log(`[Admin Controller] Updated auth account status for user '${currentMall.managementUid}' to disabled=${!allowedFields.isActive}`);
        } catch (authErr: any) {
          console.warn('[Admin Controller] Could not update associated user disabled state:', authErr.message);
        }
      }
    }

    // Atomic update on info node only: guarantees floorplans/cameras are never touched
    await mallRef.update(allowedFields);

    res.status(200).json({
      success: true,
      data: {
        ...currentMall,
        ...allowedFields,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error updating mall:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_MALL_FAILED', message: error.message },
    });
  }
}

/**
 * POST /api/admin/management-users
 * Also handles POST /api/admin/malls/:mallId/management-account
 * Create a new mall management account for a specified mall
 */
export async function createManagementAccount(req: Request, res: Response): Promise<void> {
  const mallId = req.params.mallId || req.body.mallId;
  const email: string = req.body.email;
  const password: string = req.body.password || req.body.temporaryPassword;
  const displayName: string = req.body.displayName || req.body.fullName;

  // 1. Validate inputs
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' },
    });
    return;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters long.' },
    });
    return;
  }

  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Full name is required.' },
    });
    return;
  }

  if (!mallId || typeof mallId !== 'string' || !mallId.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'A target mall must be selected.' },
    });
    return;
  }

  const auth = getFirebaseAuth();
  const db = getFirebaseDatabase();

  if (!auth || !db) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Firebase services not initialized.' },
    });
    return;
  }

  try {
    // 2. Validate that the target mall exists and is active
    const mallSnapshot = await db.ref(`malls/${mallId}/info`).once('value');
    if (!mallSnapshot.exists()) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MALL_NOT_FOUND',
          message: `The selected mall '${mallId}' does not exist.`,
        },
      });
      return;
    }

    const mallData: MallInfo = mallSnapshot.val();
    if (mallData.isActive === false) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MALL_INACTIVE',
          message: `Cannot assign management account to inactive mall '${mallData.name}'. Please activate the mall first.`,
        },
      });
      return;
    }

    // 3. Check for duplicate email in Firebase Auth
    try {
      await auth.getUserByEmail(email.trim());
      // If found, reject gracefully
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: `An account with email '${email.trim()}' already exists. Please use a different email address.`,
        },
      });
      return;
    } catch (checkErr: any) {
      if (checkErr.code !== 'auth/user-not-found') {
        throw checkErr;
      }
      // User not found - proceed with creation
    }

    // 4. Create user in Firebase Authentication
    const newUser = await auth.createUser({
      email: email.trim(),
      password,
      displayName: displayName.trim(),
      emailVerified: true,
    });

    const uid = newUser.uid;

    try {
      // 5. Assign Custom Claims: { role: 'mall_management', mallId }
      await auth.setCustomUserClaims(uid, {
        role: 'mall_management',
        mallId,
      });

      // 6. Create user record in Realtime Database under /users/{uid}
      const now = new Date().toISOString();
      const userProfile: UserProfile = {
        uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'mall_management',
        mallId,
        isActive: true,
        createdBy: req.user?.uid || 'superadmin',
        createdAt: now,
      };

      await db.ref(`users/${uid}`).set(userProfile);

      // 7. Update mall record with assigned management user
      await db.ref(`malls/${mallId}/info`).update({
        managementUid: uid,
        managementEmail: email.trim(),
        managementName: displayName.trim(),
        updatedAt: now,
      });

      console.log(`[Admin Controller] Created management account '${email}' for mall '${mallId}' (UID: ${uid})`);

      res.status(201).json({
        success: true,
        data: {
          uid,
          email: email.trim(),
          displayName: displayName.trim(),
          role: 'mall_management',
          mallId,
          mallName: mallData.name,
          createdAt: now,
        },
      });
    } catch (innerError: any) {
      // Rollback auth user creation if database write fails to prevent dangling records
      console.error('[Admin Controller] Error writing user profile, rolling back auth account:', innerError);
      try {
        await auth.deleteUser(uid);
      } catch (delErr) {
        console.error('[Admin Controller] Rollback failed:', delErr);
      }
      throw innerError;
    }
  } catch (error: any) {
    console.error('[Admin Controller] Error creating management user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_USER_FAILED',
        message: `Failed to create management account: ${error.message}`,
      },
    });
  }
}

/**
 * GET /api/admin/management-users
 * List all mall management accounts with their assigned mall details
 */
export async function listManagementAccounts(req: Request, res: Response): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database not initialized.' },
    });
    return;
  }

  try {
    const [usersSnapshot, mallsSnapshot] = await Promise.all([
      db.ref('users').once('value'),
      db.ref('malls').once('value'),
    ]);

    const mallsMap: Record<string, string> = {};
    if (mallsSnapshot.exists()) {
      const rawMalls = mallsSnapshot.val();
      for (const [mid, node] of Object.entries<any>(rawMalls)) {
        mallsMap[mid] = node?.info?.name || node?.name || mid;
      }
    }

    const managementUsers: Array<UserProfile & { mallName: string }> = [];

    if (usersSnapshot.exists()) {
      const rawUsers = usersSnapshot.val();
      for (const [uid, user] of Object.entries<any>(rawUsers)) {
        if (user.role === 'mall_management') {
          managementUsers.push({
            uid: user.uid || uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Manager',
            role: 'mall_management',
            mallId: user.mallId || null,
            mallName: user.mallId ? (mallsMap[user.mallId] || user.mallId) : 'Unassigned',
            isActive: user.isActive !== false,
            createdAt: user.createdAt || new Date().toISOString(),
            createdBy: user.createdBy || '',
          });
        }
      }
    }

    managementUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      success: true,
      data: {
        users: managementUsers,
        count: managementUsers.length,
      },
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error listing management accounts:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_USERS_FAILED', message: error.message },
    });
  }
}

/**
 * GET /api/admin/stats
 * Basic platform statistics for Superadmin overview
 */
export async function getPlatformStats(req: Request, res: Response): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database not initialized.' },
    });
    return;
  }

  try {
    const [mallsSnapshot, usersSnapshot] = await Promise.all([
      db.ref('malls').once('value'),
      db.ref('users').once('value'),
    ]);

    let totalMalls = 0;
    let activeMalls = 0;
    let totalManagementAccounts = 0;

    if (mallsSnapshot.exists()) {
      const rawMalls = mallsSnapshot.val();
      for (const [, node] of Object.entries<any>(rawMalls)) {
        const info = node.info || node;
        if (info && (info.name || info.mallId)) {
          totalMalls++;
          if (info.isActive !== false) {
            activeMalls++;
          }
        }
      }
    }

    if (usersSnapshot.exists()) {
      const rawUsers = usersSnapshot.val();
      for (const [, user] of Object.entries<any>(rawUsers)) {
        if (user.role === 'mall_management') {
          totalManagementAccounts++;
        }
      }
    }

    const stats: PlatformStats = {
      totalMalls,
      activeMalls,
      totalManagementAccounts,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[Admin Controller] Error retrieving platform stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_STATS_FAILED', message: error.message },
    });
  }
}
