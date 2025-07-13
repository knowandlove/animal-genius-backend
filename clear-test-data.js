#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

config();

const databaseUrl = process.env.DATABASE_URL;

async function clearTestData() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🧹 Clearing test data');
    console.log('─'.repeat(40));
    
    // Clear in order to respect foreign keys
    console.log('1. Clearing currency_transactions...');
    const currencyResult = await client.query('DELETE FROM currency_transactions');
    console.log(`   ✅ Deleted ${currencyResult.rowCount} currency transactions`);
    
    console.log('2. Clearing quiz_submissions...');
    const submissionsResult = await client.query('DELETE FROM quiz_submissions');
    console.log(`   ✅ Deleted ${submissionsResult.rowCount} quiz submissions`);
    
    console.log('3. Clearing students...');
    const studentsResult = await client.query('DELETE FROM students');
    console.log(`   ✅ Deleted ${studentsResult.rowCount} students`);
    
    console.log('4. Clearing classes...');
    const classesResult = await client.query('DELETE FROM classes');
    console.log(`   ✅ Deleted ${classesResult.rowCount} classes`);
    
    console.log('5. Clearing auth users...');
    const authResult = await client.query('DELETE FROM auth.users WHERE email LIKE \'%@anonymous.local\'');
    console.log(`   ✅ Deleted ${authResult.rowCount} auth users`);
    
    console.log('\n🎯 Test data cleared successfully!');
    console.log('Ready for fresh quiz submission test.');
    
  } catch (error) {
    console.log('❌ Error clearing data:', error.message);
  } finally {
    await client.end();
  }
}

clearTestData().catch(console.error);