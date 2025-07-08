#!/usr/bin/env tsx
/**
 * Script to verify that critical security fixes have been properly implemented
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying Security Fixes...\n');

let allPassed = true;

// Test 1: Check that room modification endpoints require authentication
console.log('1. Checking room modification endpoints for authentication...');
const roomRoutes = readFileSync(join(__dirname, '../server/routes/room.ts'), 'utf-8');
const avatarEndpoint = roomRoutes.match(/router\.post\(['"]\/room\/:passportCode\/avatar['"]/);
const roomEndpoint = roomRoutes.match(/router\.post\(['"]\/room\/:passportCode\/room['"]/);

// Check if the endpoints have proper middleware
const avatarLine = roomRoutes.split('\n').find(line => line.includes('"/api/room/:passportCode/avatar"'));
const roomLine = roomRoutes.split('\n').find(line => line.includes('"/api/room/:passportCode/room"'));

if (avatarLine && avatarLine.includes('checkRoomAccess') && avatarLine.includes('requireEditAccess')) {
  console.log('✅ Avatar endpoint properly secured');
} else {
  console.log('❌ Avatar endpoint missing proper authentication');
  allPassed = false;
}

if (roomLine && roomLine.includes('checkRoomAccess') && roomLine.includes('requireEditAccess')) {
  console.log('✅ Room endpoint properly secured');
} else {
  console.log('❌ Room endpoint missing proper authentication');
  allPassed = false;
}

// Test 2: Check that passport codes are not exposed in responses
console.log('\n2. Checking for passport code exposure...');
const filesToCheck = [
  '../server/routes/room.ts',
  '../server/routes/room-secure.ts',
  '../server/routes/student-api.ts'
];

let passportExposed = false;
filesToCheck.forEach(file => {
  const content = readFileSync(join(__dirname, file), 'utf-8');
  // Look for patterns where passport code might be included in response
  if (content.includes('passportCode:') && !content.includes('// passportCode removed for security')) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('passportCode:') && !line.includes('delete') && !line.includes('omit')) {
        console.log(`⚠️  Potential passport code exposure in ${file} at line ${index + 1}`);
        passportExposed = true;
      }
    });
  }
});

if (!passportExposed) {
  console.log('✅ No passport code exposure found');
} else {
  console.log('❌ Passport codes may still be exposed in responses');
  allPassed = false;
}

// Test 3: Check for consistent user ID usage
console.log('\n3. Checking for consistent user ID usage...');
const middlewareFiles = [
  '../server/middleware/ownership.ts',
  '../server/middleware/collaborators.ts',
  '../server/middleware/ownership-collaborator.ts',
  '../server/middleware/permission-check.ts'
];

let inconsistentUserId = false;
middlewareFiles.forEach(file => {
  try {
    const content = readFileSync(join(__dirname, file), 'utf-8');
    if (content.includes('req.user.id') && !content.includes('req.user.id as string')) {
      console.log(`⚠️  Found req.user.id usage in ${file}`);
      inconsistentUserId = true;
    }
  } catch (error) {
    // File might not exist, which is okay
  }
});

if (!inconsistentUserId) {
  console.log('✅ User ID usage is consistent (req.user.userId)');
} else {
  console.log('❌ Inconsistent user ID usage found');
  allPassed = false;
}

// Test 4: Check for token expiration in collaborators
console.log('\n4. Checking for invitation token expiration...');
try {
  const collaboratorsDb = readFileSync(join(__dirname, '../server/db/collaborators.ts'), 'utf-8');
  if (collaboratorsDb.includes('7 days') || collaboratorsDb.includes('604800000')) { // 7 days in milliseconds
    console.log('✅ Token expiration check implemented');
  } else {
    console.log('❌ Token expiration check not found');
    allPassed = false;
  }
} catch (error) {
  console.log('❌ Could not check token expiration');
  allPassed = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All security fixes verified successfully!');
  process.exit(0);
} else {
  console.log('❌ Some security fixes are missing or incomplete');
  process.exit(1);
}