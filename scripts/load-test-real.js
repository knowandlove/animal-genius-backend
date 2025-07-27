#!/usr/bin/env node

/**
 * REAL Load Testing Script for Animal Genius
 * Uses actual quiz format and animal types
 */

import axios from 'axios';
import { faker } from '@faker-js/faker';

const API_URL = process.env.API_URL || 'http://localhost:5001';
const EDGE_FUNCTION_URL = 'https://zqyvfnbwpagguutzdvpy.supabase.co/functions/v1';

// Test configuration
const CONFIG = {
  numStudents: parseInt(process.env.NUM_STUDENTS) || 10,
  classCode: (process.env.CLASS_CODE || 'YW6-DGH').toUpperCase(),
  delayBetweenActions: parseInt(process.env.DELAY_BETWEEN) || 1000,
};

// Generate realistic quiz answers
function generateQuizAnswers() {
  const answers = [];
  
  // MBTI Questions (1-40)
  for (let i = 1; i <= 40; i++) {
    answers.push({
      questionId: i,
      answer: faker.helpers.arrayElement(['A', 'B'])
    });
  }
  
  // VARK Learning Style Questions (41-48)
  for (let i = 41; i <= 48; i++) {
    answers.push({
      questionId: i,
      answer: faker.helpers.arrayElement(['A', 'B', 'C', 'D'])
    });
  }
  
  return answers;
}

// Simulate a single student journey
async function simulateStudent(studentId) {
  const firstName = faker.person.firstName();
  const lastInitial = faker.person.lastName()[0];
  const grade = faker.helpers.arrayElement(['4', '5', '6', '7']);
  
  console.log(`🎓 Student ${studentId}: ${firstName} ${lastInitial}. (Grade ${grade}) starting...`);

  try {
    // Step 1: Check eligibility
    const eligibilityCheck = await axios.post(`${API_URL}/api/quiz/check-eligibility`, {
      classCode: CONFIG.classCode,
      firstName,
      lastInitial,
      grade
    });
    
    if (!eligibilityCheck.data.eligible) {
      throw new Error(`Not eligible: ${eligibilityCheck.data.message}`);
    }
    console.log(`✅ Student ${studentId}: Eligible for ${eligibilityCheck.data.classInfo.name}`);

    // Step 2: Submit quiz via Edge Function (this is how the real frontend does it)
    const quizData = {
      classCode: CONFIG.classCode,
      firstName,
      lastInitial,
      grade,
      answers: generateQuizAnswers()
    };

    console.log(`📝 Student ${studentId}: Submitting quiz...`);
    const submission = await axios.post(
      `${EDGE_FUNCTION_URL}/submit-quiz`,
      quizData,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY || ''
        }
      }
    );
    
    const { passportCode, animalType } = submission.data.result;
    console.log(`🎯 Student ${studentId}: Got passport ${passportCode} - ${animalType}`);

    // Step 3: Validate passport
    await axios.post(`${API_URL}/api/student-passport/validate`, { passportCode });
    console.log(`✅ Student ${studentId}: Passport validated`);

    // Step 4: Access room
    await axios.get(`${API_URL}/api/room-page-data/${passportCode}`, {
      headers: { 'X-Passport-Code': passportCode }
    });
    console.log(`🏠 Student ${studentId}: Accessed room`);

    // Step 5: Browse around (simulate real usage)
    await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenActions));
    
    // Check store
    await axios.get(`${API_URL}/api/store/catalog`, {
      headers: { 'X-Passport-Code': passportCode }
    });
    
    console.log(`✨ Student ${studentId}: Completed journey!`);
    return { success: true, studentId, passportCode, animalType };

  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error(`❌ Student ${studentId}: Failed - ${errorMsg}`);
    return { success: false, studentId, error: errorMsg };
  }
}

// Main load test
async function runLoadTest() {
  console.log(`🚀 Starting REAL load test with ${CONFIG.numStudents} students...`);
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`🏫 Class Code: ${CONFIG.classCode}`);
  console.log('');
  
  // Verify Supabase key is set
  if (!process.env.SUPABASE_ANON_KEY) {
    console.error('❌ ERROR: SUPABASE_ANON_KEY environment variable is required!');
    console.error('   Run: export SUPABASE_ANON_KEY=your-anon-key');
    return;
  }
  
  // First verify the class
  console.log('🔍 Verifying class exists...');
  try {
    const testCheck = await axios.post(`${API_URL}/api/quiz/check-eligibility`, {
      classCode: CONFIG.classCode,
      firstName: 'Test',
      lastInitial: 'T',
      grade: '5'
    });
    if (!testCheck.data.eligible) {
      console.error(`❌ Class code '${CONFIG.classCode}' is not valid!`);
      return;
    }
    console.log(`✅ Class verified: ${testCheck.data.classInfo.name}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Failed to verify class: ${error.message}`);
    return;
  }

  const startTime = Date.now();
  const promises = [];

  // Launch students with staggered starts
  for (let i = 0; i < CONFIG.numStudents; i++) {
    promises.push(
      new Promise(resolve => {
        setTimeout(async () => {
          const result = await simulateStudent(i + 1);
          resolve(result);
        }, i * 2000); // Stagger by 2 seconds to avoid overwhelming the Edge Function
      })
    );
  }

  // Wait for all students
  const results = await Promise.all(promises);
  const endTime = Date.now();

  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const duration = (endTime - startTime) / 1000;

  console.log('\n📊 Load Test Results:');
  console.log(`✅ Successful: ${successful.length}/${CONFIG.numStudents}`);
  console.log(`❌ Failed: ${failed.length}/${CONFIG.numStudents}`);
  console.log(`⏱️  Duration: ${duration}s`);
  
  if (successful.length > 0) {
    // Count animal types
    const animalCounts = {};
    successful.forEach(r => {
      animalCounts[r.animalType] = (animalCounts[r.animalType] || 0) + 1;
    });
    
    console.log('\n🦁 Animal Distribution:');
    Object.entries(animalCounts).forEach(([animal, count]) => {
      console.log(`   ${animal}: ${count}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Errors:');
    failed.slice(0, 5).forEach(r => {
      console.log(`   Student ${r.studentId}: ${r.error}`);
    });
  }
}

// Run the test
runLoadTest().catch(console.error);