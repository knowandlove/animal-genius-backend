import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { classValuesSessions } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

async function cleanupActiveSessions() {
  const connection = postgres(process.env.DATABASE_URL);
  const db = drizzle(connection);

  try {
    console.log('Checking for active sessions...');
    
    // First, let's see what's there
    const activeSessions = await db
      .select()
      .from(classValuesSessions)
      .where(eq(classValuesSessions.status, 'active'));
    
    console.log(`Found ${activeSessions.length} active sessions:`);
    activeSessions.forEach(session => {
      console.log(`- ID: ${session.id}, Class: ${session.classId}, Started: ${session.startedAt}`);
    });

    if (activeSessions.length > 0) {
      console.log('\nCleaning up active sessions...');
      
      // Update active sessions to completed
      const result = await db
        .update(classValuesSessions)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(classValuesSessions.status, 'active'))
        .returning();

      console.log(`✅ Cleaned up ${result.length} sessions`);
    } else {
      console.log('✅ No active sessions to clean up');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

cleanupActiveSessions();