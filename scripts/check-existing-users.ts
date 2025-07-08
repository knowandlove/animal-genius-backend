#!/usr/bin/env tsx
/**
 * Script to check if test users already exist
 */

import { supabaseAdmin } from '../server/supabase-clients';

async function checkExistingUsers() {
  console.log('🔍 Checking for existing users\n');
  
  const testEmails = ['primary@test.com', 'coteacher@test.com'];
  
  for (const email of testEmails) {
    try {
      // Check if user exists in Supabase Auth
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      
      if (error) {
        console.error('Error listing users:', error);
        continue;
      }
      
      const existingUser = users.find(user => user.email === email);
      
      if (existingUser) {
        console.log(`❌ User ${email} already exists in Supabase Auth:`);
        console.log(`   - ID: ${existingUser.id}`);
        console.log(`   - Created: ${existingUser.created_at}`);
        console.log(`   - Email confirmed: ${existingUser.email_confirmed_at ? 'Yes' : 'No'}`);
        
        // Try to delete the user
        console.log(`🗑️  Attempting to delete ${email}...`);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        
        if (deleteError) {
          console.log(`   ❌ Failed to delete: ${deleteError.message}`);
        } else {
          console.log(`   ✅ User deleted successfully`);
        }
      } else {
        console.log(`✅ User ${email} does not exist`);
      }
      
    } catch (error) {
      console.error(`Error checking ${email}:`, error);
    }
    
    console.log('');
  }
}

// Run the check
checkExistingUsers();