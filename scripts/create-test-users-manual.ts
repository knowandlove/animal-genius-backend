#!/usr/bin/env tsx
/**
 * Script to create test users manually for testing co-teacher system
 */

import { db } from '../server/db';
import { profiles, classes } from '@shared/schema';
import { randomUUID } from 'crypto';

async function createTestUsers() {
  console.log('👥 Creating Test Users for Co-Teacher Testing\n');
  
  // Generate UUIDs for our test users
  const primaryTeacherId = randomUUID();
  const coTeacherId = randomUUID();
  
  try {
    // Create Primary Teacher
    console.log('1. Creating Primary Teacher...');
    const [primaryTeacher] = await db
      .insert(profiles)
      .values({
        id: primaryTeacherId,
        email: 'primary@test.com',
        firstName: 'Primary',
        lastName: 'Teacher',
        schoolOrganization: 'Test School',
        roleTitle: 'Lead Teacher',
        isAdmin: false
      })
      .returning();
    
    console.log(`✅ Primary Teacher created: ${primaryTeacher.email} (${primaryTeacher.id})`);
    
    // Create Co-Teacher
    console.log('\n2. Creating Co-Teacher...');
    const [coTeacher] = await db
      .insert(profiles)
      .values({
        id: coTeacherId,
        email: 'coteacher@test.com',
        firstName: 'Co',
        lastName: 'Teacher',
        schoolOrganization: 'Test School',
        roleTitle: 'Co-Teacher',
        isAdmin: false
      })
      .returning();
    
    console.log(`✅ Co-Teacher created: ${coTeacher.email} (${coTeacher.id})`);
    
    // Create a test class for the primary teacher
    console.log('\n3. Creating Test Class...');
    const [testClass] = await db
      .insert(classes)
      .values({
        teacherId: primaryTeacherId,
        name: 'Test Class 2025',
        subject: 'General',
        gradeLevel: '3rd Grade',
        classCode: 'TST001',
        schoolName: 'Test School'
      })
      .returning();
    
    console.log(`✅ Test Class created: ${testClass.name} (${testClass.id})`);
    
    console.log('\n🎉 Test setup complete!');
    console.log('\n📋 Test User Details:');
    console.log(`Primary Teacher: ${primaryTeacher.email} (${primaryTeacher.id})`);
    console.log(`Co-Teacher: ${coTeacher.email} (${coTeacher.id})`);
    console.log(`Test Class: ${testClass.name} (${testClass.id})`);
    console.log(`Class Code: ${testClass.classCode}`);
    
    console.log('\n💡 Next Steps:');
    console.log('1. Use these user IDs to test API endpoints directly');
    console.log('2. Create JWT tokens manually for authentication');
    console.log('3. Test the co-teacher invitation flow');
    
    console.log('\n🔧 Manual Login Notes:');
    console.log('Since Supabase auth is having issues, you can:');
    console.log('- Use these user IDs directly in API calls');
    console.log('- Skip frontend auth and test backend endpoints');
    console.log('- Mock authentication for testing purposes');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  }
}

// Run the script
createTestUsers();