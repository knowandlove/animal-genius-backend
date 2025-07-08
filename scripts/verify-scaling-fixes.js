#!/usr/bin/env node

/**
 * Verify scaling fixes are applied without requiring running server
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying Scaling Fixes Implementation');
console.log('========================================\n');

const results = [];

// Check 1: Database Pool Configuration
console.log('1️⃣ Checking Database Pool Configuration...');
try {
  const constantsPath = path.join(__dirname, '../server/config/constants.ts');
  const constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  const poolMaxMatch = constantsContent.match(/POOL_MAX:\s*(\d+)/);
  const poolMinMatch = constantsContent.match(/POOL_MIN:\s*(\d+)/);
  
  if (poolMaxMatch && poolMaxMatch[1] === '50') {
    console.log('✅ Database pool max connections: 50');
    results.push({ test: 'DB Pool Max', status: 'PASS', value: '50' });
  } else {
    console.log(`❌ Database pool max connections: ${poolMaxMatch?.[1] || 'not found'} (expected 50)`);
    results.push({ test: 'DB Pool Max', status: 'FAIL', value: poolMaxMatch?.[1] || 'not found' });
  }
  
  if (poolMinMatch && poolMinMatch[1] === '10') {
    console.log('✅ Database pool min connections: 10');
    results.push({ test: 'DB Pool Min', status: 'PASS', value: '10' });
  } else {
    console.log(`⚠️  Database pool min connections: ${poolMinMatch?.[1] || 'not found'} (expected 10)`);
    results.push({ test: 'DB Pool Min', status: 'WARN', value: poolMinMatch?.[1] || 'not found' });
  }
} catch (error) {
  console.log('❌ Could not read constants.ts:', error.message);
  results.push({ test: 'DB Pool Config', status: 'ERROR', value: error.message });
}

// Check 2: WebSocket Connection Limits
console.log('\n2️⃣ Checking WebSocket Connection Limits...');
try {
  const wsServerPath = path.join(__dirname, '../server/websocket-server.ts');
  const wsContent = fs.readFileSync(wsServerPath, 'utf8');
  
  const maxTotalMatch = wsContent.match(/MAX_TOTAL_CONNECTIONS\s*=\s*(\d+)/);
  const maxPerIpMatch = wsContent.match(/MAX_CONNECTIONS_PER_IP\s*=\s*(\d+)/);
  
  if (maxTotalMatch && maxTotalMatch[1] === '500') {
    console.log('✅ WebSocket max total connections: 500');
    results.push({ test: 'WS Total Limit', status: 'PASS', value: '500' });
  } else {
    console.log(`❌ WebSocket max total connections: ${maxTotalMatch?.[1] || 'not found'} (expected 500)`);
    results.push({ test: 'WS Total Limit', status: 'FAIL', value: maxTotalMatch?.[1] || 'not found' });
  }
  
  if (maxPerIpMatch && maxPerIpMatch[1] === '10') {
    console.log('✅ WebSocket max connections per IP: 10');
    results.push({ test: 'WS Per-IP Limit', status: 'PASS', value: '10' });
  } else {
    console.log(`❌ WebSocket max connections per IP: ${maxPerIpMatch?.[1] || 'not found'} (expected 10)`);
    results.push({ test: 'WS Per-IP Limit', status: 'FAIL', value: maxPerIpMatch?.[1] || 'not found' });
  }
  
  // Check if connection tracking is implemented
  if (wsContent.includes('connectionsByIP') && wsContent.includes('activeConnections')) {
    console.log('✅ WebSocket connection tracking implemented');
    results.push({ test: 'WS Tracking', status: 'PASS', value: 'implemented' });
  } else {
    console.log('❌ WebSocket connection tracking not found');
    results.push({ test: 'WS Tracking', status: 'FAIL', value: 'not found' });
  }
} catch (error) {
  console.log('❌ Could not read websocket-server.ts:', error.message);
  results.push({ test: 'WS Config', status: 'ERROR', value: error.message });
}

// Check 3: Class Analytics Optimization
console.log('\n3️⃣ Checking Class Analytics Optimization...');
try {
  const storageUuidPath = path.join(__dirname, '../server/storage-uuid.ts');
  const storageContent = fs.readFileSync(storageUuidPath, 'utf8');
  
  if (storageContent.includes('getClassAnalyticsOptimized')) {
    console.log('✅ Optimized getClassAnalytics function imported');
    results.push({ test: 'Analytics Import', status: 'PASS', value: 'imported' });
    
    if (storageContent.includes('return getClassAnalyticsOptimized(classId)')) {
      console.log('✅ getClassAnalytics uses optimized version');
      results.push({ test: 'Analytics Usage', status: 'PASS', value: 'using optimized' });
    } else {
      console.log('⚠️  getClassAnalytics might not be using optimized version');
      results.push({ test: 'Analytics Usage', status: 'WARN', value: 'check implementation' });
    }
  } else {
    console.log('❌ Optimized analytics function not imported');
    results.push({ test: 'Analytics Optimization', status: 'FAIL', value: 'not imported' });
  }
} catch (error) {
  console.log('❌ Could not read storage-uuid.ts:', error.message);
  results.push({ test: 'Analytics Check', status: 'ERROR', value: error.message });
}

// Check 4: Student Dashboard Caching
console.log('\n4️⃣ Checking Student Dashboard Caching...');
try {
  const studentApiPath = path.join(__dirname, '../server/routes/student-api.ts');
  const studentApiContent = fs.readFileSync(studentApiPath, 'utf8');
  
  if (studentApiContent.includes('cache.get(cacheKey)') && studentApiContent.includes('cache.set(cacheKey')) {
    console.log('✅ Student dashboard caching implemented');
    results.push({ test: 'Dashboard Cache', status: 'PASS', value: 'implemented' });
    
    if (studentApiContent.includes('cache.set(cacheKey, response, 300)')) {
      console.log('✅ Cache TTL set to 5 minutes (300 seconds)');
      results.push({ test: 'Cache TTL', status: 'PASS', value: '300s' });
    } else {
      console.log('⚠️  Cache TTL might not be 5 minutes');
      results.push({ test: 'Cache TTL', status: 'WARN', value: 'check TTL' });
    }
  } else {
    console.log('❌ Student dashboard caching not found');
    results.push({ test: 'Dashboard Cache', status: 'FAIL', value: 'not found' });
  }
} catch (error) {
  console.log('❌ Could not read student-api.ts:', error.message);
  results.push({ test: 'Cache Check', status: 'ERROR', value: error.message });
}

// Check 5: Error Tracking
console.log('\n5️⃣ Checking Error Tracking Implementation...');
try {
  const errorHandlerPath = path.join(__dirname, '../server/middleware/error-handler.ts');
  const errorHandlerContent = fs.readFileSync(errorHandlerPath, 'utf8');
  
  if (errorHandlerContent.includes('errorTracker.trackError')) {
    console.log('✅ Error tracking integrated in error handler');
    results.push({ test: 'Error Tracking', status: 'PASS', value: 'integrated' });
  } else {
    console.log('⚠️  Error tracking might not be integrated');
    results.push({ test: 'Error Tracking', status: 'WARN', value: 'check integration' });
  }
} catch (error) {
  console.log('❌ Could not read error-handler.ts:', error.message);
  results.push({ test: 'Error Tracking', status: 'ERROR', value: error.message });
}

// Summary
console.log('\n📊 Summary');
console.log('==========');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const warnings = results.filter(r => r.status === 'WARN').length;
const errors = results.filter(r => r.status === 'ERROR').length;

console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`🚨 Errors: ${errors}`);

console.log('\n📋 Detailed Results:');
console.table(results);

if (failed === 0 && errors === 0) {
  console.log('\n🎉 All critical scaling fixes are properly implemented!');
} else {
  console.log('\n⚠️  Some scaling fixes need attention. Check the failed items above.');
}

// Check for database indexes SQL file
console.log('\n📝 Additional Files:');
if (fs.existsSync(path.join(__dirname, '../database/create-indexes.sql'))) {
  console.log('✅ Database indexes SQL file found');
  console.log('   Run this in Supabase SQL editor to create indexes');
} else {
  console.log('⚠️  Database indexes SQL file not found');
}

console.log('\n✨ Next Steps:');
console.log('1. Start your server with: NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev');
console.log('2. Run database indexes in Supabase SQL editor');
console.log('3. Test with real requests to verify performance improvements');
console.log('4. Monitor /api/admin/quick-stats for metrics');