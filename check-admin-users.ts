import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';

config();

async function checkAdminUsers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('=== CHECKING ADMIN USERS ===\n');
  
  // Get all users
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
    isAdmin: users.isAdmin
  }).from(users);
  
  console.log(`Found ${allUsers.length} total users:\n`);
  
  allUsers.forEach(user => {
    console.log(`${user.firstName} ${user.lastName}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Admin: ${user.isAdmin ? '✅ YES' : '❌ NO'}`);
    console.log('');
  });
  
  const adminCount = allUsers.filter(u => u.isAdmin).length;
  console.log(`\nTotal admins: ${adminCount}`);
  
  if (adminCount === 0) {
    console.log('\n⚠️  No admin users found!');
    console.log('You need to make yourself an admin in the database.');
    
    if (allUsers.length > 0) {
      console.log('\nTo make the first user an admin, run this SQL in Supabase:');
      console.log(`UPDATE users SET is_admin = true WHERE id = ${allUsers[0].id};`);
    }
  }
  
  await pool.end();
}

checkAdminUsers();
