import { db } from '../server/db';
import { patterns } from '@shared/schema';

async function checkPatterns() {
  const existingPatterns = await db.select().from(patterns).limit(10);
  console.log('Existing patterns:', existingPatterns);
  process.exit(0);
}

checkPatterns().catch(console.error);