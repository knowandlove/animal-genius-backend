#!/usr/bin/env node

/**
 * TypeScript baseline checker
 * 
 * This script runs TypeScript type checking and compares the error count
 * against a baseline to prevent regression while allowing gradual fixes.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, '..', '.typecheck-baseline.json');

function loadBaseline() {
  try {
    const baselineData = fs.readFileSync(BASELINE_FILE, 'utf8');
    return JSON.parse(baselineData);
  } catch (error) {
    console.error('❌ Could not load baseline file:', BASELINE_FILE);
    console.error('   Create it with: { "baselineErrorCount": 0, "baselineDate": "YYYY-MM-DD" }');
    process.exit(1);
  }
}

function runTypeCheck() {
  try {
    // Run TypeScript compiler with no emit to get error count
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return 0; // No errors
  } catch (error) {
    // TypeScript outputs errors to stderr
    const output = error.stderr ? error.stderr.toString() : error.stdout.toString();
    
    // Count errors by looking for lines that match TypeScript error format
    const errorLines = output.split('\n').filter(line => 
      line.includes(': error TS') || 
      line.match(/\(\d+,\d+\):\s*error\s*TS\d+/)
    );
    
    return errorLines.length;
  }
}

function main() {
  console.log('🔍 Running TypeScript baseline check...');
  
  const baseline = loadBaseline();
  const currentErrors = runTypeCheck();
  
  console.log(`📊 Current errors: ${currentErrors}`);
  console.log(`📏 Baseline: ${baseline.baselineErrorCount}`);
  
  if (currentErrors <= baseline.baselineErrorCount) {
    const improvement = baseline.baselineErrorCount - currentErrors;
    if (improvement > 0) {
      console.log(`🎉 GREAT! You fixed ${improvement} TypeScript error(s)!`);
      console.log('   Consider updating the baseline to lock in this improvement.');
    } else {
      console.log('✅ TypeScript errors within baseline limit.');
    }
    process.exit(0);
  } else {
    const regression = currentErrors - baseline.baselineErrorCount;
    console.error(`❌ REGRESSION: ${regression} new TypeScript error(s) introduced!`);
    console.error(`   Current: ${currentErrors}, Baseline: ${baseline.baselineErrorCount}`);
    console.error('   Fix the new errors or update the baseline if intentional.');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--update-baseline')) {
  const currentErrors = runTypeCheck();
  const baseline = loadBaseline();
  
  baseline.baselineErrorCount = currentErrors;
  baseline.lastUpdate = new Date().toISOString().split('T')[0];
  
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  console.log(`✅ Updated baseline to ${currentErrors} errors`);
  process.exit(0);
}

main();
