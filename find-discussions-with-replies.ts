import { db } from './server/db';
import { replies, discussions } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

async function findDiscussionsWithReplies() {
  try {
    // Get all discussions with reply counts
    const discussionsWithCounts = await db.select({
      discussion: discussions,
      replyCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${replies}
        WHERE ${replies.discussionId} = ${discussions.id}
      )`
    })
    .from(discussions)
    .where(eq(discussions.status, 'active'))
    .orderBy(desc(discussions.createdAt))
    .limit(10);
    
    console.log('Recent discussions with reply counts:\n');
    
    discussionsWithCounts.forEach(({ discussion, replyCount }) => {
      if (replyCount > 0) {
        console.log(`📝 ${discussion.title}`);
        console.log(`   ID: ${discussion.id}`);
        console.log(`   Replies: ${replyCount}`);
        console.log(`   Created: ${discussion.createdAt}\n`);
      }
    });
    
    // Also show the specific discussion we've been testing
    const testDiscussionId = '8af34da8-a548-4929-9b0e-2dafc4155a07';
    const [testDiscussion] = await db.select({
      discussion: discussions,
      replyCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${replies}
        WHERE ${replies.discussionId} = ${discussions.id}
      )`
    })
    .from(discussions)
    .where(eq(discussions.id, testDiscussionId));
    
    if (testDiscussion) {
      console.log('\n🔍 Test discussion:');
      console.log(`   Title: ${testDiscussion.discussion.title}`);
      console.log(`   ID: ${testDiscussion.discussion.id}`);
      console.log(`   Status: ${testDiscussion.discussion.status}`);
      console.log(`   Replies: ${testDiscussion.replyCount}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findDiscussionsWithReplies();