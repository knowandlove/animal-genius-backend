import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function enableRealtime() {
  try {
    // Execute the SQL to enable realtime
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- Enable Realtime on quiz_submissions table
        ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS quiz_submissions;
        
        -- Also ensure students table is in realtime (for potential future use)
        ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS students;
        
        -- Return the list of tables with realtime enabled
        SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
      `
    });

    if (error) {
      console.error('Error enabling realtime:', error);
      return;
    }

    console.log('✅ Realtime enabled successfully!');
    console.log('Tables with realtime enabled:', data);
  } catch (err) {
    console.error('Failed to enable realtime:', err);
  }
}

enableRealtime();