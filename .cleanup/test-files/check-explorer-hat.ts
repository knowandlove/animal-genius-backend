import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { storeItems } from './shared/schema';
import { eq } from 'drizzle-orm';

config();

async function checkExplorerHat() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const item = await db.select().from(storeItems).where(eq(storeItems.id, 'e1dc735e-b896-4700-854f-5941bf51eef2'));
  console.log('Explorer Hat in DB:', JSON.stringify(item[0], null, 2));
  
  await pool.end();
}

checkExplorerHat();
