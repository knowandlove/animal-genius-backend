
/**
 * Script to remove console.log statements from production code
 * Preserves important logging that uses proper logger
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Patterns to preserve (important logs)
const PRESERVE_PATTERNS = [
  /console\.error/,
  /console\.warn/,
  /logger\./,
  /log\(/,  // Our custom log function
];

// Files/directories to skip
const SKIP_PATTERNS = [
  '**/node_modules/**',
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/tests/**',
  '**/scripts/**',
  '**/_old_migrations/**',
];

async function removeConsoleLogs() {
  const files = await glob('server/**/*.ts', {
    ignore: SKIP_PATTERNS,
    cwd: path.resolve(__dirname, '..'),
  });

  console.log(`Found ${files.length} TypeScript files to check`);
  
  let totalRemoved = 0;
  let filesModified = 0;

  for (const file of files) {
    const filePath = path.resolve(__dirname, '..', file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let modified = false;
    let removedInFile = 0;
    const newLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line contains console.log
      if (line.includes('console.log')) {
        // Check if it should be preserved
        const shouldPreserve = PRESERVE_PATTERNS.some(pattern => pattern.test(line));
        
        if (!shouldPreserve) {
          // Check if it's a multi-line console.log
          if (line.trim().endsWith(',') || !line.includes(');')) {
            // Find the end of the console.log statement
            let j = i + 1;
            let braceCount = 0;
            let parenCount = line.split('(').length - line.split(')').length;
            
            while (j < lines.length && parenCount > 0) {
              const nextLine = lines[j];
              parenCount += nextLine.split('(').length - nextLine.split(')').length;
              j++;
            }
            
            if (VERBOSE) {
              console.log(`Removing multi-line console.log in ${file}:${i + 1}-${j}`);
            }
            
            // Skip all lines of the console.log
            i = j - 1;
            removedInFile++;
            modified = true;
            continue;
          } else {
            // Single line console.log
            if (VERBOSE) {
              console.log(`Removing console.log in ${file}:${i + 1}`);
            }
            removedInFile++;
            modified = true;
            continue;
          }
        }
      }
      
      newLines.push(line);
    }
    
    if (modified && !DRY_RUN) {
      fs.writeFileSync(filePath, newLines.join('\n'));
      filesModified++;
      totalRemoved += removedInFile;
      console.log(`✓ ${file}: Removed ${removedInFile} console.log statements`);
    } else if (modified && DRY_RUN) {
      filesModified++;
      totalRemoved += removedInFile;
      console.log(`[DRY RUN] Would remove ${removedInFile} console.log statements from ${file}`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`Files checked: ${files.length}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Console.log statements removed: ${totalRemoved}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a dry run. Use without --dry-run to actually remove console.logs');
  }
}

// Run the script
removeConsoleLogs().catch(console.error);