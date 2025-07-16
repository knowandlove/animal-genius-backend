const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteUser(email) {
  try {
    // First find the user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.log('User not found with email:', email);
      return;
    }
    
    console.log('Found user:', user.id);
    
    // Delete from profiles table first (if exists)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);
    
    if (profileError) {
      console.log('No profile found or error deleting profile:', profileError.message);
    } else {
      console.log('Profile deleted');
    }
    
    // Delete the auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.error('Error deleting user:', deleteError);
    } else {
      console.log('User deleted successfully');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Replace with the email you want to delete
const testEmail = process.argv[2];
if (!testEmail) {
  console.log('Usage: node delete-auth-user.js email@example.com');
  process.exit(1);
}

console.log('Attempting to delete user:', testEmail);
deleteUser(testEmail);