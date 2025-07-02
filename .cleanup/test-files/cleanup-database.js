import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDatabase() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // First, we need to delete in the correct order due to foreign key constraints
    
    // 1. Delete quiz_submissions (depends on students)
    console.log('Deleting quiz submissions...');
    const { data: submissions, error: submissionsError } = await supabase
      .from('quiz_submissions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (using a condition that's always true)
      .select();
    
    if (submissionsError) {
      console.error('Error deleting quiz submissions:', submissionsError);
    } else {
      console.log(`✅ Deleted ${submissions?.length || 0} quiz submissions`);
    }

    // 2. Delete purchase_history (depends on students)
    console.log('\nDeleting purchase history...');
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchase_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (purchasesError) {
      console.error('Error deleting purchase history:', purchasesError);
    } else {
      console.log(`✅ Deleted ${purchases?.length || 0} purchase history records`);
    }

    // 3. Delete currency_transactions (depends on students)
    console.log('\nDeleting currency transactions...');
    const { data: transactions, error: transactionsError } = await supabase
      .from('currency_transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (transactionsError) {
      console.error('Error deleting currency transactions:', transactionsError);
    } else {
      console.log(`✅ Deleted ${transactions?.length || 0} currency transactions`);
    }

    // 4. Delete student_inventory (depends on students)
    console.log('\nDeleting student inventory...');
    const { data: inventory, error: inventoryError } = await supabase
      .from('student_inventory')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (inventoryError) {
      console.error('Error deleting student inventory:', inventoryError);
    } else {
      console.log(`✅ Deleted ${inventory?.length || 0} student inventory items`);
    }

    // 5. Delete students (depends on classes)
    console.log('\nDeleting students...');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (studentsError) {
      console.error('Error deleting students:', studentsError);
    } else {
      console.log(`✅ Deleted ${students?.length || 0} students`);
    }

    // 6. Delete lesson_progress (depends on classes)
    console.log('\nDeleting lesson progress...');
    const { data: lessonProgress, error: lessonProgressError } = await supabase
      .from('lesson_progress')
      .delete()
      .neq('id', 0) // Using numeric ID comparison
      .select();
    
    if (lessonProgressError) {
      console.error('Error deleting lesson progress:', lessonProgressError);
    } else {
      console.log(`✅ Deleted ${lessonProgress?.length || 0} lesson progress records`);
    }

    // 7. Delete store_settings (depends on classes)
    console.log('\nDeleting store settings...');
    const { data: storeSettings, error: storeSettingsError } = await supabase
      .from('store_settings')
      .delete()
      .neq('id', 0)
      .select();
    
    if (storeSettingsError) {
      console.error('Error deleting store settings:', storeSettingsError);
    } else {
      console.log(`✅ Deleted ${storeSettings?.length || 0} store settings`);
    }

    // 8. Finally, delete classes
    console.log('\nDeleting classes...');
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (classesError) {
      console.error('Error deleting classes:', classesError);
    } else {
      console.log(`✅ Deleted ${classes?.length || 0} classes`);
    }

    console.log('\n✨ Database cleanup complete!');
    
    // Verify the cleanup
    console.log('\n📊 Verifying cleanup...');
    
    const { count: classCount } = await supabase
      .from('classes')
      .select('*', { count: 'exact', head: true });
    
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\nRemaining records:`);
    console.log(`- Classes: ${classCount || 0}`);
    console.log(`- Students: ${studentCount || 0}`);
    
  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
  }
}

// Run the cleanup
cleanupDatabase()
  .then(() => {
    console.log('\n🎉 Cleanup process finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });