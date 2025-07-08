#!/usr/bin/env node

/**
 * Test script to verify student dashboard caching
 */

import axios from 'axios';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:5001';
const STUDENT_TOKEN = process.env.STUDENT_TOKEN || 'YOUR_STUDENT_SESSION_TOKEN';

async function testDashboardCache() {
  console.log('🧪 Testing Student Dashboard Caching');
  console.log('===================================\n');

  if (STUDENT_TOKEN === 'YOUR_STUDENT_SESSION_TOKEN') {
    console.log('⚠️  Please set environment variables:');
    console.log('   STUDENT_TOKEN=your_student_session_token');
    console.log('\nExample:');
    console.log('   STUDENT_TOKEN=xxx node test-dashboard-cache.js\n');
    process.exit(1);
  }

  try {
    console.log(`Testing endpoint: ${API_URL}/api/student/dashboard`);
    console.log('Making 5 requests to test caching...\n');

    const times = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      
      const response = await axios.get(`${API_URL}/api/student/dashboard`, {
        headers: {
          'Authorization': `Bearer ${STUDENT_TOKEN}`
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      times.push(duration);

      const cacheStatus = i === 0 ? '(First request - no cache)' : '(Should be cached)';
      console.log(`Request ${i + 1}: ${duration}ms ${cacheStatus}`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 Cache Performance:');
    
    const firstRequestTime = times[0];
    const cachedRequestsAvg = times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1);
    
    console.log(`First request: ${firstRequestTime}ms`);
    console.log(`Cached requests average: ${cachedRequestsAvg.toFixed(0)}ms`);
    console.log(`Speed improvement: ${((firstRequestTime / cachedRequestsAvg - 1) * 100).toFixed(0)}%`);

    console.log('\n📋 Assessment:');
    if (cachedRequestsAvg < firstRequestTime * 0.5) {
      console.log('✅ Excellent! Cache is working effectively (>50% improvement)');
    } else if (cachedRequestsAvg < firstRequestTime * 0.8) {
      console.log('⚠️  Cache is working but improvement is modest');
      console.log('   Check server logs for "Cache hit" messages');
    } else {
      console.log('❌ Cache might not be working properly');
      console.log('   Cached requests should be significantly faster');
    }

    // Test cache expiration
    console.log('\n🧪 Testing cache expiration (5 minute TTL)...');
    console.log('Cache should expire after 5 minutes (300 seconds)');
    console.log('To test expiration, wait 5 minutes and run this script again.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

// Run the test
testDashboardCache().catch(console.error);