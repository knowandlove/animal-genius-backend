#!/usr/bin/env tsx
/**
 * Script to test direct user creation in Supabase
 */

import { supabaseAdmin } from '../server/supabase-clients';

async function testDirectUserCreation() {
  console.log('🧪 Testing Direct User Creation in Supabase\n');
  
  const testUser = {
    email: 'primary@test.com',
    password: 'TestPass123!',
    email_confirm: true, // Skip email confirmation for testing
    user_metadata: {
      first_name: 'Primary',
      last_name: 'Teacher',
      school_organization: 'Test School'
    }
  };
  
  try {
    console.log('Creating user directly with admin client...');
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser(testUser);
    
    if (error) {
      console.error('❌ Failed to create user:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ User created successfully!');
      console.log('User ID:', data.user?.id);
      console.log('Email:', data.user?.email);
      console.log('Email confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No');
      
      // Now try to create a profile in our database
      console.log('\nCreating profile in our database...');
      
      const { db } = await import('../db');
      const { profiles } = await import('@shared/schema');
      
      const [newProfile] = await db
        .insert(profiles)
        .values({
          id: data.user!.id,
          email: testUser.email,
          firstName: testUser.user_metadata.first_name,
          lastName: testUser.user_metadata.last_name,
          schoolOrganization: testUser.user_metadata.school_organization,
          isAdmin: false
        })
        .returning();
        
      console.log('✅ Profile created successfully!');
      console.log('Profile ID:', newProfile.id);
      console.log('Profile email:', newProfile.email);
    }
    
  } catch (error) {
    console.error('❌ Error during user creation:', error);
  }
}

// Run the test
testDirectUserCreation();