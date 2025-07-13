import { db } from '../server/db';
import { classValuesSessions } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

async function cleanupSessions() {
  console.log('🧹 Cleaning up voting sessions...\n');

  try {
    // Get all active sessions
    const activeSessions = await db
      .select({
        id: classValuesSessions.id,
        classId: classValuesSessions.classId,
        status: classValuesSessions.status,
        expiresAt: classValuesSessions.expiresAt
      })
      .from(classValuesSessions)
      .where(eq(classValuesSessions.status, 'active'));

    if (activeSessions.length === 0) {
      console.log('✅ No active sessions to clean up');
      return;
    }

    console.log(`Found ${activeSessions.length} active session(s)`);

    // Cancel all active sessions
    const result = await db
      .update(classValuesSessions)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(classValuesSessions.status, 'active'));

    console.log(`\n✅ Cancelled ${activeSessions.length} active session(s)`);
    
    // Also check for expired sessions
    const expiredResult = await db
      .update(classValuesSessions)
      .set({
        status: 'expired',
        updatedAt: new Date()
      })
      .where(sql`${classValuesSessions.status} = 'active' AND ${classValuesSessions.expiresAt} < NOW()`);

    console.log('✅ Cleaned up any expired sessions');

  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
  } finally {
    process.exit(0);
  }
}

cleanupSessions();