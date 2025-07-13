import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// This script will update the 'code' column to match 'class_code' for existing classes

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixClassCodes() {
  console.log('Fixing class codes...\n');

  // First, let's try to read what we can see
  try {
    // Try to get a test to see what columns exist
    const { data: testData, error: testError } = await supabase
      .from('classes')
      .select('*')
      .limit(1);

    if (testError) {
      console.log('Cannot read directly from classes table:', testError.message);
      console.log('\nYou will need to run this SQL directly in Supabase SQL Editor:');
      console.log('─'.repeat(60));
      console.log(`
-- Update the 'code' column to match 'class_code' where class_code exists
UPDATE classes 
SET code = class_code 
WHERE class_code IS NOT NULL 
  AND class_code != ''
  AND class_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$';

-- Verify the update
SELECT id, name, class_code, code, is_active, expires_at 
FROM classes 
WHERE class_code IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
      `);
      console.log('─'.repeat(60));
      console.log('\nAfter running this SQL, your Edge Functions should work with codes like "LT0-33B"');
      return;
    }

    // If we can read, show current state
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name, class_code, code')
      .not('class_code', 'is', null)
      .limit(10);

    if (!classesError && classes) {
      console.log('Current classes with class_code:');
      classes.forEach(c => {
        console.log(`- ${c.name}: class_code="${c.class_code}", code="${c.code}"`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixClassCodes();