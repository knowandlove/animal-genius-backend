import { db } from '../server/db';
import { classes, classValuesSessions, classValuesVotes, classValuesResults } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

async function resetClassValues() {
  try {
    console.log('🔄 Starting Class Values Reset...\n');

    // First, let's find classes that have values set
    const classesWithValues = await db
      .select({
        id: classes.id,
        name: classes.name,
        code: classes.classCode,
        hasValuesSet: classes.hasValuesSet,
      })
      .from(classes)
      .where(eq(classes.hasValuesSet, true));

    if (classesWithValues.length === 0) {
      console.log('❌ No classes found with values set.');
      
      // Let's also check for active sessions
      const activeSessions = await db
        .select({
          session: classValuesSessions,
          className: classes.name,
          classCode: classes.classCode,
        })
        .from(classValuesSessions)
        .innerJoin(classes, eq(classValuesSessions.classId, classes.id))
        .where(eq(classValuesSessions.status, 'active'));

      if (activeSessions.length > 0) {
        console.log('\n📋 Found active sessions:');
        activeSessions.forEach((s, i) => {
          console.log(`${i + 1}. ${s.className} (${s.classCode})`);
        });
        
        console.log('\n✅ Cleaning up active sessions...');
        await db
          .update(classValuesSessions)
          .set({ 
            status: 'cancelled',
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(classValuesSessions.status, 'active'));
        
        console.log('✅ Active sessions cleaned up!');
      } else {
        console.log('No active sessions found either.');
      }
      
      process.exit(0);
    }

    console.log('📋 Classes with values set:');
    classesWithValues.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (Code: ${c.code})`);
    });

    // For simplicity, let's reset all of them
    console.log('\n🧹 Resetting all class values...\n');

    for (const classItem of classesWithValues) {
      console.log(`Processing ${classItem.name}...`);

      // 1. Find all sessions for this class
      const sessions = await db
        .select()
        .from(classValuesSessions)
        .where(eq(classValuesSessions.classId, classItem.id));

      if (sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        
        // 2. Delete all votes for these sessions
        const deletedVotes = await db
          .delete(classValuesVotes)
          .where(and(
            ...sessionIds.map(id => eq(classValuesVotes.sessionId, id))
          ))
          .returning();
        
        console.log(`  - Deleted ${deletedVotes.length} votes`);

        // 3. Delete all results
        const deletedResults = await db
          .delete(classValuesResults)
          .where(eq(classValuesResults.classId, classItem.id))
          .returning();
        
        console.log(`  - Deleted ${deletedResults.length} results`);

        // 4. Delete all sessions
        const deletedSessions = await db
          .delete(classValuesSessions)
          .where(eq(classValuesSessions.classId, classItem.id))
          .returning();
        
        console.log(`  - Deleted ${deletedSessions.length} sessions`);
      }

      // 5. Update the class to reset values
      await db
        .update(classes)
        .set({
          hasValuesSet: false,
          valuesSetAt: null,
          updatedAt: new Date(),
        })
        .where(eq(classes.id, classItem.id));

      console.log(`  ✅ ${classItem.name} has been reset!\n`);
    }

    // Also clean up any orphaned active sessions
    const remainingActiveSessions = await db
      .update(classValuesSessions)
      .set({ 
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(classValuesSessions.status, 'active'))
      .returning();

    if (remainingActiveSessions.length > 0) {
      console.log(`🧹 Cleaned up ${remainingActiveSessions.length} orphaned active sessions\n`);
    }

    console.log('✨ All class values have been reset!');
    console.log('You can now test the voting feature from scratch.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting class values:', error);
    process.exit(1);
  }
}

// Run the reset
resetClassValues();
