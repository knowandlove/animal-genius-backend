#!/usr/bin/env node

/**
 * Health Monitoring Script
 * Continuously monitors your app's health metrics
 */

import dotenv from 'dotenv';
import axios from 'axios';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const API_URL = process.env.API_URL || 'http://localhost:5001';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Metrics storage
const metrics = {
  apiResponseTimes: [],
  dbQueryTimes: [],
  errors: [],
  checkCount: 0
};

// Health checks
async function checkAPIHealth() {
  const start = Date.now();
  try {
    const response = await axios.get(`${API_URL}/api/health`);
    const duration = Date.now() - start;
    metrics.apiResponseTimes.push(duration);
    return { success: true, duration, data: response.data };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    metrics.errors.push({ type: 'api', error: errorMessage, time: new Date() });
    return { success: false, error: errorMessage };
  }
}

async function checkDatabaseHealth() {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT NOW() as time, COUNT(*) as student_count FROM students');
    const duration = Date.now() - start;
    metrics.dbQueryTimes.push(duration);
    return { success: true, duration, data: result.rows[0] };
  } catch (error) {
    const errorMessage = error.message || 'Unknown database error';
    metrics.errors.push({ type: 'db', error: errorMessage, time: new Date() });
    return { success: false, error: errorMessage };
  }
}

async function checkAuthPerformance() {
  // Auth metrics endpoint removed - returning mock data
  return null;
}

function calculateStats(times) {
  if (times.length === 0) return { avg: 0, p95: 0, p99: 0 };
  
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  
  return { avg: avg.toFixed(2), p95, p99 };
}

async function displayMetrics() {
  console.clear();
  console.log('🏥 Animal Genius Health Monitor');
  console.log('================================');
  console.log(`📊 Checks performed: ${metrics.checkCount}`);
  console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
  console.log('');

  // API Stats
  const apiStats = calculateStats(metrics.apiResponseTimes.slice(-100));
  console.log('🌐 API Performance:');
  console.log(`   Average: ${apiStats.avg}ms`);
  console.log(`   P95: ${apiStats.p95}ms`);
  console.log(`   P99: ${apiStats.p99}ms`);
  console.log('');

  // DB Stats
  const dbStats = calculateStats(metrics.dbQueryTimes.slice(-100));
  console.log('🗄️  Database Performance:');
  console.log(`   Average: ${dbStats.avg}ms`);
  console.log(`   P95: ${dbStats.p95}ms`);
  console.log(`   P99: ${dbStats.p99}ms`);
  console.log('');

  // Pool Stats
  console.log('🔗 Connection Pool:');
  console.log(`   Total: ${pool.totalCount}`);
  console.log(`   Idle: ${pool.idleCount}`);
  console.log(`   Waiting: ${pool.waitingCount}`);
  console.log('');

  // Recent Errors
  const validErrors = metrics.errors.filter(err => err.error && err.error.trim() !== '');
  if (validErrors.length > 0) {
    console.log('❌ Recent Errors:');
    validErrors.slice(-5).forEach(err => {
      console.log(`   [${err.type}] ${err.error}`);
    });
    console.log('');
  }

  // Auth Metrics (disabled - endpoint removed)
  // const authMetrics = await checkAuthPerformance();
  // if (authMetrics) {
  //   console.log('🔐 Auth Performance:');
  //   console.log(`   Success Rate: ${authMetrics.successRate}%`);
  //   console.log(`   Avg Response: ${authMetrics.avgResponseTime}ms`);
  //   console.log('');
  // }

  console.log('Press Ctrl+C to stop monitoring');
}

async function runHealthCheck() {
  metrics.checkCount++;
  
  // Run checks in parallel
  await Promise.all([
    checkAPIHealth(),
    checkDatabaseHealth()
  ]);

  // Keep only last 1000 measurements
  if (metrics.apiResponseTimes.length > 1000) {
    metrics.apiResponseTimes = metrics.apiResponseTimes.slice(-1000);
  }
  if (metrics.dbQueryTimes.length > 1000) {
    metrics.dbQueryTimes = metrics.dbQueryTimes.slice(-1000);
  }
  if (metrics.errors.length > 100) {
    metrics.errors = metrics.errors.slice(-100);
  }
}

// Main monitoring loop
async function startMonitoring() {
  console.log('🚀 Starting health monitoring...');
  
  // Run checks every 5 seconds
  setInterval(runHealthCheck, 5000);
  
  // Update display every 2 seconds
  setInterval(displayMetrics, 2000);
  
  // Initial check
  await runHealthCheck();
  await displayMetrics();
}

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down monitor...');
  await pool.end();
  process.exit(0);
});

startMonitoring().catch(console.error);