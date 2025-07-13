#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

config();

const databaseUrl = process.env.DATABASE_URL;

async function investigateDataDisconnect() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔍 Investigating quiz data disconnect');
    console.log('═'.repeat(60));
    
    // 1. Check lookup tables population
    console.log('1. CHECKING LOOKUP TABLES:');
    console.log('─'.repeat(30));
    
    const animalTypesResult = await client.query('SELECT count(*), array_agg(name ORDER BY name) as names FROM animal_types');
    const geniusTypesResult = await client.query('SELECT count(*), array_agg(name ORDER BY name) as names FROM genius_types');
    
    console.log(`   Animal Types: ${animalTypesResult.rows[0].count} records`);
    console.log(`   → ${animalTypesResult.rows[0].names?.join(', ') || 'EMPTY!'}`);
    console.log(`   Genius Types: ${geniusTypesResult.rows[0].count} records`);
    console.log(`   → ${geniusTypesResult.rows[0].names?.join(', ') || 'EMPTY!'}`);
    
    // 2. Check quiz submissions vs student records
    console.log('\n2. CHECKING DATA RELATIONSHIPS:');
    console.log('─'.repeat(30));
    
    const relationshipQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT qs.id) as total_submissions,
        COUNT(DISTINCT CASE WHEN qs.id IS NOT NULL THEN s.id END) as students_with_submissions,
        COUNT(DISTINCT CASE WHEN s.animal_type_id IS NOT NULL THEN s.id END) as students_with_animal_id,
        COUNT(DISTINCT CASE WHEN qs.animal_type_id IS NOT NULL THEN qs.id END) as submissions_with_animal_id
      FROM students s
      LEFT JOIN quiz_submissions qs ON s.id = qs.student_id
    `;
    
    const relationshipResult = await client.query(relationshipQuery);
    const stats = relationshipResult.rows[0];
    
    console.log(`   Total Students: ${stats.total_students}`);
    console.log(`   Total Quiz Submissions: ${stats.total_submissions}`);
    console.log(`   Students with Submissions: ${stats.students_with_submissions}`);
    console.log(`   Students with Animal Type ID: ${stats.students_with_animal_id}`);
    console.log(`   Submissions with Animal Type ID: ${stats.submissions_with_animal_id}`);
    
    // 3. Check JOIN failures (the smoking gun!)
    console.log('\n3. CHECKING JOIN FAILURES:');
    console.log('─'.repeat(30));
    
    const joinFailureQuery = `
      SELECT 
        COUNT(*) as broken_joins,
        COUNT(CASE WHEN at.id IS NULL AND qs.animal_type_id IS NOT NULL THEN 1 END) as missing_animal_types,
        COUNT(CASE WHEN gt.id IS NULL AND qs.genius_type_id IS NOT NULL THEN 1 END) as missing_genius_types,
        array_agg(DISTINCT qs.animal_type_id) FILTER (WHERE at.id IS NULL AND qs.animal_type_id IS NOT NULL) as orphaned_animal_ids,
        array_agg(DISTINCT qs.genius_type_id) FILTER (WHERE gt.id IS NULL AND qs.genius_type_id IS NOT NULL) as orphaned_genius_ids
      FROM quiz_submissions qs
      LEFT JOIN animal_types at ON qs.animal_type_id = at.id
      LEFT JOIN genius_types gt ON qs.genius_type_id = gt.id
      WHERE qs.animal_type_id IS NOT NULL OR qs.genius_type_id IS NOT NULL
    `;
    
    const joinFailureResult = await client.query(joinFailureQuery);
    const failures = joinFailureResult.rows[0];
    
    console.log(`   Submissions with missing animal types: ${failures.missing_animal_types}`);
    console.log(`   Submissions with missing genius types: ${failures.missing_genius_types}`);
    
    if (failures.orphaned_animal_ids?.length > 0) {
      console.log(`   🚨 ORPHANED ANIMAL IDs: ${failures.orphaned_animal_ids.slice(0, 5).join(', ')}${failures.orphaned_animal_ids.length > 5 ? '...' : ''}`);
    }
    
    if (failures.orphaned_genius_ids?.length > 0) {
      console.log(`   🚨 ORPHANED GENIUS IDs: ${failures.orphaned_genius_ids.slice(0, 5).join(', ')}${failures.orphaned_genius_ids.length > 5 ? '...' : ''}`);
    }
    
    // 4. Sample the actual data that's causing problems
    console.log('\n4. SAMPLE PROBLEMATIC RECORDS:');
    console.log('─'.repeat(30));
    
    const sampleQuery = `
      SELECT 
        s.student_name,
        s.passport_code,
        qs.animal_type_id as qs_animal_id,
        qs.genius_type_id as qs_genius_id,
        at.name as animal_name,
        gt.name as genius_name,
        qs.completed_at
      FROM students s
      LEFT JOIN quiz_submissions qs ON s.id = qs.student_id
      LEFT JOIN animal_types at ON qs.animal_type_id = at.id
      LEFT JOIN genius_types gt ON qs.genius_type_id = gt.id
      WHERE qs.id IS NOT NULL
      ORDER BY qs.completed_at DESC
      LIMIT 5
    `;
    
    const sampleResult = await client.query(sampleQuery);
    
    if (sampleResult.rows.length > 0) {
      sampleResult.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.student_name} (${row.passport_code}):`);
        console.log(`      Quiz Animal ID: ${row.qs_animal_id}`);
        console.log(`      Resolved Animal: ${row.animal_name || '❌ NULL'}`);
        console.log(`      Quiz Genius ID: ${row.qs_genius_id}`);
        console.log(`      Resolved Genius: ${row.genius_name || '❌ NULL'}`);
        console.log(`      Completed: ${row.completed_at}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No quiz submissions found!');
    }
    
    // 5. Check which submission system is being used
    console.log('5. CHECKING SUBMISSION PATTERNS:');
    console.log('─'.repeat(30));
    
    const recentSubmissionsQuery = `
      SELECT 
        DATE_TRUNC('day', completed_at) as submission_date,
        COUNT(*) as submissions_count,
        COUNT(CASE WHEN animal_type_id IS NOT NULL THEN 1 END) as with_animal_ids,
        array_agg(DISTINCT animal_type_id) FILTER (WHERE animal_type_id IS NOT NULL) as unique_animal_ids
      FROM quiz_submissions 
      WHERE completed_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', completed_at)
      ORDER BY submission_date DESC
    `;
    
    const recentResult = await client.query(recentSubmissionsQuery);
    
    if (recentResult.rows.length > 0) {
      console.log('   Recent submissions:');
      recentResult.rows.forEach(row => {
        console.log(`   ${row.submission_date.toISOString().split('T')[0]}: ${row.submissions_count} submissions, ${row.with_animal_ids} with animal IDs`);
      });
    } else {
      console.log('   No recent submissions found');
    }
    
    console.log('\n═'.repeat(60));
    console.log('🎯 DIAGNOSIS COMPLETE');
    
  } catch (error) {
    console.log('❌ Investigation failed:', error.message);
  } finally {
    await client.end();
  }
}

investigateDataDisconnect().catch(console.error);