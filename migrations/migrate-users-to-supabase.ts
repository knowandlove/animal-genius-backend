import { createClient } from '@supabase/supabase-js';
import { db } from '../server/db';
import { users } from '../shared/schema';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';

// This script migrates existing users from the old system to Supabase Auth

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface UserMapping {
  oldId: number;
  newUuid: string;
}

async function migrateUsers() {
  console.log('Starting user migration to Supabase Auth...');
  
  try {
    // Get all existing users
    const existingUsers = await db.select().from(users);
    console.log(`Found ${existingUsers.length} users to migrate`);
    
    const mappings: UserMapping[] = [];
    
    // Create temporary mapping table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_id_mapping (
        old_id INTEGER PRIMARY KEY,
        new_uuid UUID NOT NULL
      )
    `);
    
    for (const user of existingUsers) {
      console.log(`Migrating user: ${user.email}`);
      
      try {
        // Generate a temporary password for the user
        // They'll need to reset it via email
        const tempPassword = `Temp${Math.random().toString(36).substring(2, 15)}!`;
        
        // Create user in Supabase Auth
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            first_name: user.firstName,
            last_name: user.lastName,
            school_organization: user.schoolOrganization,
            role_title: user.roleTitle,
            how_heard_about: user.howHeardAbout,
            personality_animal: user.personalityAnimal
          }
        });
        
        if (error) {
          if (error.message.includes('already exists')) {
            // User already exists, try to get their ID
            const { data: existingUser } = await supabase.auth.admin.listUsers({
              filter: `email.eq.${user.email}`
            });
            
            if (existingUser?.users?.[0]) {
              mappings.push({
                oldId: user.id,
                newUuid: existingUser.users[0].id
              });
              console.log(`User already exists in Supabase: ${user.email}`);
            }
          } else {
            console.error(`Failed to create user ${user.email}:`, error);
          }
          continue;
        }
        
        if (data.user) {
          mappings.push({
            oldId: user.id,
            newUuid: data.user.id
          });
          
          // The profile will be created automatically by the trigger
          // But we need to update it with the admin flag if needed
          if (user.isAdmin) {
            await supabase
              .from('profiles')
              .update({ is_admin: true })
              .eq('id', data.user.id);
          }
          
          console.log(`Successfully migrated user: ${user.email}`);
          
          // Send password reset email
          await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${process.env.FRONTEND_URL}/reset-password`
          });
          console.log(`Password reset email sent to: ${user.email}`);
        }
      } catch (err) {
        console.error(`Error migrating user ${user.email}:`, err);
      }
    }
    
    // Store mappings in the database
    for (const mapping of mappings) {
      await db.execute(sql`
        INSERT INTO user_id_mapping (old_id, new_uuid)
        VALUES (${mapping.oldId}, ${mapping.newUuid})
        ON CONFLICT (old_id) DO UPDATE
        SET new_uuid = ${mapping.newUuid}
      `);
    }
    
    console.log(`Migration complete! Migrated ${mappings.length} users.`);
    console.log('\nNext steps:');
    console.log('1. Run the migrate_to_uuid_keys.sql script to update foreign keys');
    console.log('2. Update your backend code to use the new auth system');
    console.log('3. Have users reset their passwords via email');
    
    // Show the mapping for reference
    console.log('\nUser ID Mappings:');
    mappings.forEach(m => {
      const user = existingUsers.find(u => u.id === m.oldId);
      console.log(`${m.oldId} (${user?.email}) -> ${m.newUuid}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateUsers().then(() => {
  console.log('Migration script completed');
  process.exit(0);
}).catch(err => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
