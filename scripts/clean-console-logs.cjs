const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run');

// Find all TypeScript files
const files = execSync('find server -name "*.ts" -not -path "*/node_modules/*" -not -path "*/.test.ts" -not -path "*/tests/*"', {
  cwd: path.resolve(__dirname, '..'),
  encoding: 'utf-8'
}).trim().split('\n').filter(Boolean);

console.log(`Found ${files.length} TypeScript files to check`);

let totalRemoved = 0;
let filesModified = 0;

files.forEach(file => {
  const filePath = path.resolve(__dirname, '..', file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Count console.logs before
  const consoleLogCount = (content.match(/console\.log/g) || []).length;
  
  if (consoleLogCount > 0) {
    // Remove console.log statements (simple single-line for now)
    const newContent = content
      .split('\n')
      .filter(line => {
        // Skip lines that are just console.log
        if (line.trim().startsWith('console.log(')) {
          totalRemoved++;
          return false;
        }
        return true;
      })
      .join('\n');
    
    if (newContent !== content) {
      filesModified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✓ ${file}: Removed console.log statements`);
      } else {
        console.log(`[DRY RUN] Would modify ${file}`);
      }
    }
  }
});

console.log(`\n📊 Summary:`);
console.log(`Files checked: ${files.length}`);
console.log(`Files to modify: ${filesModified}`);
console.log(`Console.log lines removed: ${totalRemoved}`);

if (DRY_RUN) {
  console.log('\n⚠️  This was a dry run. Run without --dry-run to actually remove console.logs');
}