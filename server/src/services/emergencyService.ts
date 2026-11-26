import admin from 'firebase-admin';

/**
 * Service to manage the global emergency status across all facilities.
 * Head in Firebase Realtime Database: /emergency/status
 * - "active" indicates an active fire/smoke emergency in at least one room/mall.
 * - "normal" indicates all facilities are in safe, normal operating condition.
 */
export async function syncGlobalEmergencyStatus(
  db: admin.database.Database
): Promise<'active' | 'normal'> {
  try {
    const mallsSnap = await db.ref('malls').once('value');
    const malls = mallsSnap.val() || {};
    let activeEmergenciesCount = 0;
    const activeDetails: Array<{ mallId: string; cameraId?: string; detectionType?: string }> = [];

    for (const [mId, mallData] of Object.entries<any>(malls)) {
      if (!mallData) continue;

      // 1. Check incidents with status === 'DETECTED'
      if (mallData.incidents) {
        for (const inc of Object.values<any>(mallData.incidents)) {
          if (inc && inc.status === 'DETECTED') {
            activeEmergenciesCount++;
            activeDetails.push({
              mallId: mId,
              cameraId: inc.cameraId,
              detectionType: inc.detectionType || 'fire',
            });
          }
        }
      }

      // 2. Check cameraDetectionState for active detection (isCurrentlyDetected: true)
      if (mallData.cameraDetectionState) {
        for (const [camId, state] of Object.entries<any>(mallData.cameraDetectionState)) {
          if (state && state.isCurrentlyDetected === true) {
            // Only add if not already captured in incidents
            const alreadyLogged = activeDetails.some((d) => d.mallId === mId && d.cameraId === camId);
            if (!alreadyLogged) {
              activeEmergenciesCount++;
              activeDetails.push({
                mallId: mId,
                cameraId: camId,
                detectionType: state.detectionType || 'fire',
              });
            }
          }
        }
      }
    }

    const statusValue: 'active' | 'normal' = activeEmergenciesCount > 0 ? 'active' : 'normal';
    const nowIso = new Date().toISOString();

    // Set /emergency/status directly as requested: "active" means emergency and "normal" means normal condition
    await Promise.all([
      db.ref('emergency/status').set(statusValue),
      db.ref('emergency/updatedAt').set(nowIso),
      db.ref('emergency/activeCount').set(activeEmergenciesCount),
      db.ref('emergency/activeDetails').set(activeDetails),
    ]);

    console.info(`[EmergencyService] Global emergency status synced -> ${statusValue.toUpperCase()} (active: ${activeEmergenciesCount})`);
    return statusValue;
  } catch (error: any) {
    console.warn('[EmergencyService] Failed to sync global emergency status:', error.message);
    return 'normal';
  }
}
