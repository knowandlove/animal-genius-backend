import { db } from './server/db';
import { discussions, replies } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

async function listAllDiscussions() {
  try {
    // Get all active discussions
    const allDiscussions = await db.select({
      id: discussions.id,
      title: discussions.title,
      status: discussions.status,
      createdAt: discussions.createdAt,
      replyCount: sql<number>`(
        SELECT COUNT(*)::int 
        FROM ${replies} 
        WHERE ${replies.discussionId} = ${discussions.id}
      )`
    })
    .from(discussions)
    .where(eq(discussions.status, 'active'))
    .orderBy(desc(discussions.createdAt));
    
    console.log('All Active Discussions:\n');
    console.log('='.repeat(80));
    
    allDiscussions.forEach(d => {
      console.log(`📝 ${d.title}`);
      console.log(`   ID: ${d.id}`);
      console.log(`   Replies: ${d.replyCount}`);
      console.log(`   URL: /community/discussion/${d.id}`);
      console.log(`   Created: ${d.createdAt}`);
      console.log('-'.repeat(80));
    });
    
    // Also get raw reply counts
    console.log('\nDirect Reply Counts:\n');
    for (const d of allDiscussions) {
      const [count] = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(replies)
        .where(eq(replies.discussionId, d.id));
      
      if (count.count > 0) {
        console.log(`${d.title}: ${count.count} replies`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listAllDiscussions();