#!/usr/bin/env node

/**
 * Test script to verify WebSocket connection limits
 */

import { WebSocket } from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:5001/ws/game';
const MAX_CONNECTIONS = 510; // Try to exceed the 500 limit

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWebSocketLimits() {
  console.log('🧪 Testing WebSocket Connection Limits');
  console.log('=====================================\n');
  console.log(`Attempting to create ${MAX_CONNECTIONS} connections to ${WS_URL}\n`);

  const connections = [];
  let successCount = 0;
  let rejectCount = 0;
  const rejectionReasons = new Map();

  for (let i = 0; i < MAX_CONNECTIONS; i++) {
    try {
      const ws = new WebSocket(WS_URL);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          successCount++;
          if (successCount % 50 === 0) {
            console.log(`✅ ${successCount} connections established`);
          }
          connections.push(ws);
          resolve();
        });

        ws.on('error', (error) => {
          reject(error);
        });

        ws.on('close', (code, reason) => {
          const reasonStr = reason.toString() || `Code ${code}`;
          rejectCount++;
          
          // Track rejection reasons
          const count = rejectionReasons.get(reasonStr) || 0;
          rejectionReasons.set(reasonStr, count + 1);
          
          if (rejectCount === 1) {
            console.log(`\n❌ Connection rejected at #${i + 1}: ${reasonStr}`);
          }
          reject(new Error(reasonStr));
        });

        // Timeout after 2 seconds
        setTimeout(() => reject(new Error('Connection timeout')), 2000);
      });

      // Small delay between connections
      await sleep(10);

    } catch (error) {
      // Connection failed, continue to next
      if (error.message === 'Connection timeout') {
        console.log(`⏱️  Connection ${i + 1} timed out`);
      }
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Successful connections: ${successCount}`);
  console.log(`❌ Rejected connections: ${rejectCount}`);
  
  if (rejectionReasons.size > 0) {
    console.log('\n📋 Rejection reasons:');
    for (const [reason, count] of rejectionReasons) {
      console.log(`  - "${reason}": ${count} times`);
    }
  }

  // Test per-IP limit by closing and reconnecting
  if (successCount > 0) {
    console.log('\n🧪 Testing per-IP limit (should be 10)...');
    
    // Close all connections
    connections.forEach(ws => ws.close());
    await sleep(1000);

    // Try to open 15 connections quickly
    const quickConnections = [];
    let quickSuccess = 0;
    let quickReject = 0;

    for (let i = 0; i < 15; i++) {
      try {
        const ws = new WebSocket(WS_URL);
        
        await new Promise((resolve, reject) => {
          ws.on('open', () => {
            quickSuccess++;
            quickConnections.push(ws);
            resolve();
          });

          ws.on('close', (code, reason) => {
            quickReject++;
            reject(new Error(reason.toString()));
          });

          setTimeout(() => reject(new Error('timeout')), 1000);
        });

      } catch (error) {
        // Expected for connections over the limit
      }
    }

    console.log(`✅ Quick connections succeeded: ${quickSuccess}`);
    console.log(`❌ Quick connections rejected: ${quickReject}`);
    
    // Cleanup
    quickConnections.forEach(ws => ws.close());
  }

  // Cleanup remaining connections
  console.log('\n🧹 Cleaning up connections...');
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  console.log('✅ Test complete!');
  
  // Summary
  console.log('\n📌 Summary:');
  if (successCount <= 500 && successCount >= 490) {
    console.log('✅ Global connection limit (500) is working correctly!');
  } else if (successCount > 500) {
    console.log('⚠️  Global connection limit may not be working (got ' + successCount + ' connections)');
  }
  
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run the test
console.log('Starting WebSocket limit test...\n');
testWebSocketLimits().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});