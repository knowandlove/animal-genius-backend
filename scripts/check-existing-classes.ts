#!/usr/bin/env tsx
/**
 * Script to check existing classes and their ID types
 */

import { db } from '../server/db';
import { classes, profiles } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function checkExistingClasses() {
  console.log('🔍 Checking existing classes and their data types\n');
  
  try {
    // Get all classes with their teacher info
    const allClasses = await db
      .select({
        id: classes.id,
        name: classes.name,
        teacherId: classes.teacherId,
        classCode: classes.classCode,
        teacherEmail: profiles.email
      })
      .from(classes)
      .leftJoin(profiles, sql`${classes.teacherId} = ${profiles.id}`)
      .limit(10);
    
    console.log('📋 Found Classes:');
    allClasses.forEach((cls, index) => {
      console.log(`${index + 1}. ID: ${cls.id} (${typeof cls.id})`);
      console.log(`   Name: ${cls.name}`);
      console.log(`   Code: ${cls.classCode}`);
      console.log(`   Teacher ID: ${cls.teacherId}`);
      console.log(`   Teacher Email: ${cls.teacherEmail || 'Not found'}`);
      console.log('');
    });
    
    // Check if there are any integer-type IDs that need cleanup
    const integerLikeIds = allClasses.filter(cls => 
      typeof cls.id === 'string' && /^\d+$/.test(cls.id)
    );
    
    if (integerLikeIds.length > 0) {
      console.log('⚠️  Found classes with integer-like IDs:');
      integerLikeIds.forEach(cls => {
        console.log(`   - Class "${cls.name}" has ID: ${cls.id}`);
      });
      console.log('\nThese might be from before UUID migration.');
    }
    
    // Get the current user's profile to help match
    console.log('\n👤 Looking for your user profile:');
    const userProfiles = await db
      .select()
      .from(profiles)
      .where(sql`${profiles.email} LIKE '%jason%' OR ${profiles.email} LIKE '%test%'`)
      .limit(5);
    
    userProfiles.forEach(profile => {
      console.log(`   - ${profile.email} (ID: ${profile.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking classes:', error);
  }
}

// Run the check
checkExistingClasses();