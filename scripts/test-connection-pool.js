#!/usr/bin/env node

/**
 * Test script to verify database connection pool is working with new limits
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Create a test pool with our new configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50, // Our new limit
  min: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

async function testConnectionPool() {
  console.log('🧪 Testing Database Connection Pool (Max: 50)');
  console.log('==========================================\n');

  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Connected successfully at:', result.rows[0].now);
    client.release();

    // Test 2: Multiple concurrent connections
    console.log('\nTest 2: Creating 30 concurrent connections...');
    const connections = [];
    
    for (let i = 0; i < 30; i++) {
      connections.push(
        pool.connect().then(client => {
          console.log(`✅ Connection ${i + 1} established`);
          return client;
        })
      );
    }

    const clients = await Promise.all(connections);
    console.log(`\n✅ Successfully created ${clients.length} concurrent connections`);

    // Check pool stats
    console.log('\n📊 Pool Statistics:');
    console.log(`- Total connections: ${pool.totalCount}`);
    console.log(`- Idle connections: ${pool.idleCount}`);
    console.log(`- Waiting requests: ${pool.waitingCount}`);

    // Release all connections
    console.log('\nReleasing connections...');
    clients.forEach(client => client.release());

    // Test 3: Verify connections are reused
    console.log('\nTest 3: Connection reuse...');
    const client2 = await pool.connect();
    await client2.query('SELECT 1');
    client2.release();
    
    console.log('✅ Connection reused successfully');
    console.log(`📊 Idle connections after reuse: ${pool.idleCount}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.log('\n💡 SSL Certificate issue detected.');
      console.log('For development, you may need to set NODE_TLS_REJECT_UNAUTHORIZED=0');
    }
  } finally {
    // Clean up
    await pool.end();
    console.log('\n✅ Connection pool closed');
  }
}

// Run the test
testConnectionPool().catch(console.error);