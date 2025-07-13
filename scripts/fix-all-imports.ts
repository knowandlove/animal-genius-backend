#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';

/**
 * Script to fix all TypeScript imports in the backend project
 * Removes .js extensions from local imports since tsx handles the resolution
 */

const BACKEND_ROOT = join(process.cwd());
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'migrations'];

async function* walkDirectory(dir: string): AsyncGenerator<string> {
  const files = await readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const path = join(dir, file.name);
    
    if (file.isDirectory()) {
      if (!IGNORE_DIRS.includes(file.name)) {
        yield* walkDirectory(path);
      }
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      yield path;
    }
  }
}

async function fixImportsInFile(filePath: string): Promise<number> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  let fixCount = 0;
  
  const updatedLines = lines.map(line => {
    // Match import statements with .js extensions for local files
    const importMatch = line.match(/^(import\s+.*\s+from\s+['"])(\.[^'"]+)(\.js)(['"];?)$/);
    const exportMatch = line.match(/^(export\s+.*\s+from\s+['"])(\.[^'"]+)(\.js)(['"];?)$/);
    
    if (importMatch) {
      fixCount++;
      return importMatch[1] + importMatch[2] + importMatch[4];
    }
    
    if (exportMatch) {
      fixCount++;
      return exportMatch[1] + exportMatch[2] + exportMatch[4];
    }
    
    return line;
  });
  
  if (fixCount > 0) {
    await writeFile(filePath, updatedLines.join('\n'));
    console.log(`✓ Fixed ${fixCount} imports in ${relative(BACKEND_ROOT, filePath)}`);
  }
  
  return fixCount;
}

async function main() {
  console.log('🔍 Scanning for TypeScript files with .js imports...\n');
  
  let totalFiles = 0;
  let totalFixes = 0;
  
  try {
    for await (const filePath of walkDirectory(BACKEND_ROOT)) {
      totalFiles++;
      const fixes = await fixImportsInFile(filePath);
      totalFixes += fixes;
    }
    
    console.log('\n✅ Import fix complete!');
    console.log(`   Files scanned: ${totalFiles}`);
    console.log(`   Imports fixed: ${totalFixes}`);
    
    if (totalFixes > 0) {
      console.log('\n📝 Next steps:');
      console.log('   1. Run npm run typecheck to verify no TypeScript errors');
      console.log('   2. Start the server with npm run dev');
      console.log('   3. Run tests to ensure everything works');
    }
  } catch (error) {
    console.error('❌ Error during import fix:', error);
    process.exit(1);
  }
}

main();