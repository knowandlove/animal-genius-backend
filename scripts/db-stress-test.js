#!/usr/bin/env node

/**
 * Database Connection Pool Stress Test
 * Tests how the database handles concurrent connections
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50, // Match your backend pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runConcurrentQueries(numQueries, queryType = 'simple') {
  console.log(`🔥 Running ${numQueries} concurrent ${queryType} queries...`);
  const startTime = Date.now();
  
  const queries = {
    simple: 'SELECT 1',
    medium: `
      SELECT s.*, c.name as class_name, c.code as class_code
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LIMIT 10
    `,
    complex: `
      SELECT 
        c.id, c.name, c.code,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE WHEN s.animal_type = 'Otter' THEN s.id END) as otters,
        COUNT(DISTINCT CASE WHEN s.animal_type = 'Beaver' THEN s.id END) as beavers,
        AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at))) as avg_time_spent
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      GROUP BY c.id, c.name, c.code
      ORDER BY total_students DESC
      LIMIT 20
    `
  };

  const promises = Array(numQueries).fill(0).map(async (_, i) => {
    try {
      const start = Date.now();
      const result = await pool.query(queries[queryType]);
      const duration = Date.now() - start;
      return { success: true, duration, index: i };
    } catch (error) {
      return { success: false, error: error.message, index: i };
    }
  });

  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
  
  console.log(`✅ Success: ${successful.length}/${numQueries}`);
  console.log(`❌ Failed: ${failed.length}/${numQueries}`);
  console.log(`⏱️  Total time: ${endTime - startTime}ms`);
  console.log(`📊 Avg query time: ${avgDuration.toFixed(2)}ms`);
  
  if (failed.length > 0) {
    console.log('\n❌ Errors:');
    failed.slice(0, 5).forEach(f => console.log(`  Query ${f.index}: ${f.error}`));
  }
  
  return results;
}

async function checkPoolStats() {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
  console.log(`📊 Pool Stats:`, stats);
  return stats;
}

async function runStressTest() {
  console.log('🚀 Starting Database Stress Test...');
  console.log(`📊 Pool Config: max=${pool.options.max}, idleTimeout=${pool.options.idleTimeoutMillis}ms`);
  console.log('');

  try {
    // Test 1: Simple queries
    console.log('=== Test 1: Simple Queries ===');
    await runConcurrentQueries(100, 'simple');
    await checkPoolStats();
    console.log('');

    // Test 2: Medium complexity
    console.log('=== Test 2: Medium Queries ===');
    await runConcurrentQueries(50, 'medium');
    await checkPoolStats();
    console.log('');

    // Test 3: Complex queries
    console.log('=== Test 3: Complex Queries ===');
    await runConcurrentQueries(25, 'complex');
    await checkPoolStats();
    console.log('');

    // Test 4: Burst test (simulate spike)
    console.log('=== Test 4: Burst Test (200 queries at once) ===');
    await runConcurrentQueries(200, 'medium');
    await checkPoolStats();
    console.log('');

    // Test 5: Sustained load
    console.log('=== Test 5: Sustained Load (10 rounds of 50 queries) ===');
    for (let i = 0; i < 10; i++) {
      console.log(`Round ${i + 1}/10...`);
      await runConcurrentQueries(50, 'medium');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    await checkPoolStats();

  } catch (error) {
    console.error('❌ Stress test failed:', error);
  } finally {
    await pool.end();
    console.log('\n✅ Test complete, pool closed');
  }
}

runStressTest().catch(console.error);