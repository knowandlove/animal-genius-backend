import { config } from 'dotenv';
import { db } from '../server/db';
import { profiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config();

async function createProfile() {
  const userId = process.argv[2];
  const email = process.argv[3];
  const firstName = process.argv[4] || 'Unknown';
  const lastName = process.argv[5] || 'User';
  
  if (!userId || !email) {
    console.error('Usage: npm run create-profile <userId> <email> [firstName] [lastName]');
    process.exit(1);
  }
  
  try {
    // Check if profile already exists
    const existing = await db.select().from(profiles).where(eq(profiles.id, userId));
    
    if (existing.length > 0) {
      console.log('Profile already exists:', existing[0]);
      return;
    }
    
    // Create new profile
    const [newProfile] = await db.insert(profiles).values({
      id: userId,
      email,
      firstName,
      lastName,
      schoolOrganization: 'Know and Love',
      isAdmin: email === 'jason@knowandlove.com' // Make you an admin
    }).returning();
    
    console.log('Profile created successfully:', newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
  } finally {
    process.exit(0);
  }
}

createProfile();
