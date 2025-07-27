import { db } from './dist/server/db.js';
import { replies, discussions, profiles } from './dist/shared/schema.js';
import { eq, sql } from 'drizzle-orm';

const discussionId = '8af34da8-a548-4929-9b0e-2dafc4155a07';

async function testDirect() {
  try {
    console.log('Testing direct database access...\n');
    
    // 1. Check if discussion exists
    const discussion = await db.select()
      .from(discussions)
      .where(eq(discussions.id, discussionId))
      .limit(1);
    
    console.log('Discussion found:', discussion.length > 0);
    if (discussion.length > 0) {
      console.log('Discussion title:', discussion[0].title);
      console.log('Discussion status:', discussion[0].status);
    }
    
    // 2. Count replies
    const replyCount = await db.select({ count: sql`COUNT(*)::int` })
      .from(replies)
      .where(eq(replies.discussionId, discussionId));
    
    console.log('\nReply count:', replyCount[0].count);
    
    // 3. Get replies without joins
    const simpleReplies = await db.select()
      .from(replies)
      .where(eq(replies.discussionId, discussionId));
    
    console.log('\nSimple replies found:', simpleReplies.length);
    simpleReplies.forEach((reply, i) => {
      console.log(`\nReply ${i + 1}:`);
      console.log('  ID:', reply.id);
      console.log('  Teacher ID:', reply.teacherId);
      console.log('  Body:', reply.body?.substring(0, 100));
      console.log('  Created:', reply.createdAt);
    });
    
    // 4. Get replies with teacher join
    const repliesWithTeacher = await db.select({
      reply: replies,
      teacher: profiles
    })
    .from(replies)
    .leftJoin(profiles, eq(replies.teacherId, profiles.id))
    .where(eq(replies.discussionId, discussionId));
    
    console.log('\n\nReplies with teacher join:', repliesWithTeacher.length);
    repliesWithTeacher.forEach((item, i) => {
      console.log(`\nJoined Reply ${i + 1}:`);
      console.log('  Reply ID:', item.reply.id);
      console.log('  Teacher:', item.teacher?.firstName, item.teacher?.lastName);
      console.log('  Teacher ID match:', item.reply.teacherId === item.teacher?.id);
    });
    
    // 5. Check if any teacher IDs are missing from profiles
    if (simpleReplies.length > 0) {
      const teacherIds = [...new Set(simpleReplies.map(r => r.teacherId))];
      console.log('\n\nUnique teacher IDs in replies:', teacherIds);
      
      for (const teacherId of teacherIds) {
        const teacher = await db.select()
          .from(profiles)
          .where(eq(profiles.id, teacherId))
          .limit(1);
        
        console.log(`Teacher ${teacherId} exists:`, teacher.length > 0);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testDirect();