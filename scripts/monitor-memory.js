#!/usr/bin/env node

/**
 * Memory monitoring script to detect leaks
 * Logs memory usage every 10 seconds
 */

const formatBytes = (bytes) => {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
};

const getMemoryStats = () => {
  const usage = process.memoryUsage();
  const heapPercentage = (usage.heapUsed / usage.heapTotal) * 100;
  
  return {
    rss: formatBytes(usage.rss),
    heapTotal: formatBytes(usage.heapTotal),
    heapUsed: formatBytes(usage.heapUsed),
    heapPercentage: heapPercentage.toFixed(1) + '%',
    external: formatBytes(usage.external)
  };
};

console.log('🔍 Memory Monitor Started');
console.log('====================================');
console.log('Monitoring backend server memory usage...');
console.log('Press Ctrl+C to stop\n');

// Initial reading
console.log('Initial Memory Stats:');
console.table(getMemoryStats());

// Monitor every 10 seconds
setInterval(() => {
  const stats = getMemoryStats();
  const timestamp = new Date().toLocaleTimeString();
  
  console.log(`\n[${timestamp}] Memory Usage:`);
  console.table(stats);
  
  // Warn if heap usage is high
  const heapPercent = parseFloat(stats.heapPercentage);
  if (heapPercent > 90) {
    console.error('⚠️  CRITICAL: Heap usage above 90%!');
  } else if (heapPercent > 75) {
    console.warn('⚠️  WARNING: Heap usage above 75%');
  }
}, 10000);

// Also monitor the backend process if it's running
const { exec } = require('child_process');

setInterval(() => {
  exec('ps aux | grep "node.*server/index.js" | grep -v grep', (error, stdout) => {
    if (!error && stdout) {
      const lines = stdout.trim().split('\n');
      if (lines[0]) {
        const parts = lines[0].split(/\s+/);
        const cpu = parts[2];
        const mem = parts[3];
        const vsz = parts[4]; // Virtual memory size
        const rss = parts[5]; // Resident set size
        
        console.log(`\nBackend Process Stats:`);
        console.log(`CPU: ${cpu}%, MEM: ${mem}%, VSZ: ${vsz}KB, RSS: ${rss}KB`);
      }
    }
  });
}, 30000); // Every 30 seconds