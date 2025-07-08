#!/usr/bin/env node

/**
 * Test script to measure class analytics performance
 */

import axios from 'axios';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:5001';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'YOUR_JWT_TOKEN';
const CLASS_ID = process.env.CLASS_ID || 'YOUR_CLASS_ID';

async function testClassAnalytics() {
  console.log('🧪 Testing Class Analytics Performance');
  console.log('=====================================\n');

  if (AUTH_TOKEN === 'YOUR_JWT_TOKEN' || CLASS_ID === 'YOUR_CLASS_ID') {
    console.log('⚠️  Please set environment variables:');
    console.log('   AUTH_TOKEN=your_jwt_token');
    console.log('   CLASS_ID=your_class_id');
    console.log('\nExample:');
    console.log('   AUTH_TOKEN=xxx CLASS_ID=yyy node test-class-analytics.js\n');
    process.exit(1);
  }

  try {
    console.log(`Testing endpoint: ${API_URL}/api/classes/${CLASS_ID}/analytics`);
    console.log('Running 5 sequential requests to measure performance...\n');

    const times = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      
      const response = await axios.get(`${API_URL}/api/classes/${CLASS_ID}/analytics`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      times.push(duration);

      console.log(`Request ${i + 1}: ${duration}ms - ${response.data.submissions?.length || 0} students`);
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Calculate statistics
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log('\n📊 Performance Results:');
    console.log(`Average: ${avgTime.toFixed(0)}ms`);
    console.log(`Min: ${minTime}ms`);
    console.log(`Max: ${maxTime}ms`);

    // Performance assessment
    console.log('\n📋 Assessment:');
    if (avgTime < 500) {
      console.log('✅ Excellent! Average response time is under 500ms');
    } else if (avgTime < 1000) {
      console.log('⚠️  Good, but could be optimized. Average is under 1 second');
    } else {
      console.log('❌ Needs optimization! Average response time exceeds 1 second');
      console.log('   The optimized query should help bring this down significantly');
    }

    // Check if first request was slower (cold cache)
    if (times[0] > times[1] * 1.5) {
      console.log('\n💡 First request was significantly slower - likely a cold cache');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

// Run the test
testClassAnalytics().catch(console.error);