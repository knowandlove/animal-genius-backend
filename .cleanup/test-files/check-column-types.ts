import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkColumnTypes() {
  console.log('Checking column types in the database...\n');
  
  try {
    const result = await db.execute(sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_name IN ('profiles', 'classes', 'lesson_progress', 'currency_transactions', 'admin_logs', 'purchase_requests')
      AND column_name IN ('id', 'teacher_id', 'admin_id', 'target_user_id', 'processed_by')
      ORDER BY table_name, column_name;
    `);
    
    console.log('Current column types:');
    console.log('====================');
    result.rows.forEach((row: any) => {
      console.log(`${row.table_name}.${row.column_name}: ${row.data_type} (${row.udt_name})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking column types:', error);
    process.exit(1);
  }
}

checkColumnTypes();
