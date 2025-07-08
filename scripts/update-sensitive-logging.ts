#!/usr/bin/env ts-node
/**
 * Script to find and report sensitive logging patterns
 * Run this to identify places that need secure logging
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const SENSITIVE_PATTERNS = [
  // Logging full objects that might contain secrets
  /console\.(log|error)\s*\([^)]*JSON\.stringify\s*\([^)]*\)/g,
  
  // Logging request/response bodies
  /console\.(log|error)\s*\([^)]*req\.body/g,
  /console\.(log|error)\s*\([^)]*res\.(json|send|body)/g,
  
  // Logging auth-related data
  /console\.(log|error)\s*\([^)]*token[^)]*\)/g,
  /console\.(log|error)\s*\([^)]*password[^)]*\)/g,
  /console\.(log|error)\s*\([^)]*secret[^)]*\)/g,
  /console\.(log|error)\s*\([^)]*key[^)]*\)/g,
  /console\.(log|error)\s*\([^)]*authorization[^)]*\)/g,
  
  // Logging user data
  /console\.(log|error)\s*\([^)]*email[^)]*\)/g,
  /console\.(log|error)\s*\([^)]*user[^)]*\)/g,
  /console\.(log|error)\s*\([^)]*profile[^)]*\)/g,
];

async function findSensitiveLogging() {
  console.log('🔍 Searching for sensitive logging patterns...\n');
  
  const files = glob.sync('server/**/*.ts', {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.ts',
      '**/secure-logger.ts' // Don't check our own secure logger
    ]
  });
  
  const findings: { file: string; line: number; content: string; pattern: string }[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(line)) {
          findings.push({
            file,
            line: index + 1,
            content: line.trim(),
            pattern: pattern.source
          });
        }
        // Reset the regex state
        pattern.lastIndex = 0;
      }
    });
  }
  
  if (findings.length === 0) {
    console.log('✅ No sensitive logging patterns found!');
    return;
  }
  
  console.log(`❌ Found ${findings.length} potential sensitive logging issues:\n`);
  
  // Group by file
  const byFile = findings.reduce((acc, finding) => {
    if (!acc[finding.file]) acc[finding.file] = [];
    acc[finding.file].push(finding);
    return acc;
  }, {} as Record<string, typeof findings>);
  
  for (const [file, fileFindings] of Object.entries(byFile)) {
    console.log(`\n📄 ${file}:`);
    for (const finding of fileFindings) {
      console.log(`   Line ${finding.line}: ${finding.content.substring(0, 80)}...`);
    }
  }
  
  console.log('\n💡 Recommendations:');
  console.log('1. Import secure logger: import { createSecureLogger } from "./utils/secure-logger"');
  console.log('2. Create logger instance: const logger = createSecureLogger("ModuleName")');
  console.log('3. Replace console.log with logger.log or logger.debug');
  console.log('4. Replace console.error with logger.error');
  console.log('5. Wrap errors with sanitizeError() before logging');
}

findSensitiveLogging().catch(console.error);