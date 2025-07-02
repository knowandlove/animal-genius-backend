#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baselinePath = path.join(__dirname, '..', '.typecheck-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

try {
  // Run typecheck and capture output
  execSync('npm run typecheck', { stdio: 'pipe' });
  console.log('✅ No TypeScript errors!');
  process.exit(0);
} catch (error) {
  // Count errors in output
  const output = error.stdout?.toString() || '';
  const errorMatches = output.match(/error TS\d+:/g) || [];
  const currentErrorCount = errorMatches.length;
  
  console.log(`\n📊 TypeScript Error Summary:`);
  console.log(`   Current errors: ${currentErrorCount}`);
  console.log(`   Baseline errors: ${baseline.baselineErrorCount}`);
  console.log(`   Baseline date: ${baseline.baselineDate}\n`);
  
  if (currentErrorCount > baseline.baselineErrorCount) {
    console.error(`❌ FAILED: ${currentErrorCount - baseline.baselineErrorCount} new TypeScript errors introduced!`);
    console.error(`   Please fix the new errors before committing.\n`);
    process.exit(1);
  } else if (currentErrorCount < baseline.baselineErrorCount) {
    console.log(`✅ Great work! You've reduced errors by ${baseline.baselineErrorCount - currentErrorCount}`);
    console.log(`   Consider updating the baseline in .typecheck-baseline.json\n`);
    process.exit(0);
  } else {
    console.log(`⚠️  Error count unchanged. While no new errors were added, consider fixing some existing ones.\n`);
    process.exit(0);
  }
}