#!/usr/bin/env node

/**
 * Load Testing Script for Animal Genius
 * Simulates multiple students taking quizzes simultaneously
 */

import axios from 'axios';
import { faker } from '@faker-js/faker';

const API_URL = process.env.API_URL || 'http://localhost:5001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Test configuration
const CONFIG = {
  numStudents: parseInt(process.env.NUM_STUDENTS) || 50,  // Number of concurrent students
  classCodes: process.env.CLASS_CODES 
    ? process.env.CLASS_CODES.split(',').map(c => c.toUpperCase()) 
    : ['PR3-HVY', 'DEH-EQE', 'W09-BI4'],  // Support multiple class codes
  delayBetweenActions: parseInt(process.env.DELAY_BETWEEN) || 1000, // ms between actions
  testDuration: 60000,    // Total test duration in ms
};

// Generate quiz answers (48 questions total - 38 MBTI + 10 VARK)
function generateQuizAnswers() {
  const personalityAnswers = Array(38).fill(0).map(() => 
    faker.helpers.arrayElement(['A', 'B'])
  );
  const varkAnswers = Array(10).fill(0).map(() => 
    faker.helpers.arrayElement(['A', 'B', 'C', 'D'])
  );
  return [...personalityAnswers, ...varkAnswers];
}

// Simulate a single student journey
async function simulateStudent(studentId) {
  const firstName = faker.person.firstName();
  const lastInitial = faker.person.lastName()[0];
  const studentName = `${firstName} ${lastInitial}`; // Format: "John D" not "John Doe"
  
  // Randomly select a class for this student
  const classCode = faker.helpers.arrayElement(CONFIG.classCodes);
  console.log(`🎓 Student ${studentId}: ${studentName} starting... (Class: ${classCode})`);

  try {
    // Step 1: Check quiz eligibility (new endpoint)
    const eligibilityCheck = await axios.post(`${API_URL}/api/quiz/check-eligibility`, {
      classCode: classCode,
      firstName: firstName,
      lastInitial: lastInitial,
      grade: faker.helpers.arrayElement(['4th', '5th', '6th', '7th'])
    });
    
    if (!eligibilityCheck.data.eligible) {
      console.log(`❌ Student ${studentId}: ${eligibilityCheck.data.message}`);
      console.log(`   Tried class code: ${classCode}`);
      throw new Error(`Not eligible: ${eligibilityCheck.data.message}`);
    }
    console.log(`✅ Student ${studentId}: Eligible for class ${eligibilityCheck.data.classInfo?.name || CONFIG.classCode}`);

    // Step 2: Submit quiz
    // The quiz submission expects specific format based on the backend
    const gradeLevel = faker.helpers.arrayElement(['4th Grade', '5th Grade', '6th Grade', '7th Grade']);
    const answers = generateQuizAnswers();
    
    // Calculate scores based on answers (simulate quiz processing)
    const personalityScores = {
      E: faker.number.int({ min: 0, max: 14 }),
      I: faker.number.int({ min: 0, max: 14 }),
      S: faker.number.int({ min: 0, max: 14 }),
      N: faker.number.int({ min: 0, max: 14 }),
      T: faker.number.int({ min: 0, max: 14 }),
      F: faker.number.int({ min: 0, max: 14 }),
      J: faker.number.int({ min: 0, max: 14 }),
      P: faker.number.int({ min: 0, max: 14 })
    };
    
    const learningScores = {
      visual: faker.number.int({ min: 0, max: 5 }),
      auditory: faker.number.int({ min: 0, max: 5 }),
      readingWriting: faker.number.int({ min: 0, max: 5 }),
      kinesthetic: faker.number.int({ min: 0, max: 5 })
    };
    
    // Determine MBTI type
    const mbtiType = 
      (personalityScores.E > personalityScores.I ? 'E' : 'I') +
      (personalityScores.S > personalityScores.N ? 'S' : 'N') +
      (personalityScores.T > personalityScores.F ? 'T' : 'F') +
      (personalityScores.J > personalityScores.P ? 'J' : 'P');
    
    // Map to ACTUAL animal types from the system
    const animalMapping = {
      'INFP': 'Meerkat', 'ISFP': 'Meerkat',
      'INFJ': 'Panda', 'INTJ': 'Panda',
      'ISTP': 'Owl', 'INTP': 'Owl',
      'ISFJ': 'Beaver', 'ISTJ': 'Beaver',
      'ESFJ': 'Elephant', 'ENFJ': 'Elephant',
      'ESFP': 'Otter', 'ESTP': 'Otter',
      'ENFP': 'Parrot', 'ENTP': 'Parrot',
      'ESTJ': 'Border Collie', 'ENTJ': 'Border Collie'
    };
    
    const animalType = animalMapping[mbtiType] || 'Otter';
    
    // The quiz submission expects lowercase animal codes
    const animalCode = animalType.toLowerCase().replace(' ', '-'); // e.g. "Border Collie" -> "border-collie"
    
    // These genius types will be determined by the service based on animal type
    const geniusType = ''; // Let the service determine this
    const learningStyle = ['visual', 'auditory', 'readingWriting', 'kinesthetic'].reduce((a, b) => 
      learningScores[a] > learningScores[b] ? a : b
    );
    
    const quizData = {
      studentName,
      gradeLevel,
      classId: eligibilityCheck.data.classInfo?.id || CONFIG.classCode,
      animalType: animalCode,  // Use the lowercase code
      geniusType,
      personalityType: mbtiType,
      learningStyle,
      answers: {
        personalityAnswers: answers.slice(0, 38),
        learningAnswers: answers.slice(38)
      },
      scores: personalityScores,
      learningScores
    };

    const submission = await axios.post(`${API_URL}/api/quiz/submissions`, quizData);
    const { passportCode, animalType: assignedAnimal } = submission.data;
    console.log(`🎯 Student ${studentId}: Got passport ${passportCode} - ${assignedAnimal || animalType}`);

    // Step 3: Validate passport
    await axios.post(`${API_URL}/api/student-passport/validate`, { passportCode });
    console.log(`✅ Student ${studentId}: Passport validated`);

    // Step 4: Access room (with passport auth)
    await axios.get(`${API_URL}/api/room-page-data/${passportCode}`, {
      headers: { 'X-Passport-Code': passportCode }
    });
    console.log(`🏠 Student ${studentId}: Accessed room`);

    // Step 5: Browse store
    await axios.get(`${API_URL}/api/store/catalog`, {
      headers: { 'X-Passport-Code': passportCode }
    });

    // Step 6: Random actions (simulate real usage)
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenActions));
      
      const action = faker.helpers.arrayElement(['room', 'room-save', 'store', 'achievements']);
      switch(action) {
        case 'room':
          // Just check room data
          await axios.get(`${API_URL}/api/room-page-data/${passportCode}`, {
            headers: { 'X-Passport-Code': passportCode }
          });
          break;
        case 'room-save':
          // Simulate saving room data (POST request)
          try {
            const roomUpdate = {
              wallColor: faker.helpers.arrayElement(['#FFB6C1', '#87CEEB', '#98FB98', '#DDA0DD']),
              floorPattern: faker.helpers.arrayElement(['checkered', 'striped', 'solid', 'dots']),
              items: []
            };
            await axios.post(`${API_URL}/api/room/${passportCode}/room`, roomUpdate, {
              headers: { 'X-Passport-Code': passportCode }
            });
          } catch (err) {
            console.log(`⚠️  Student ${studentId}: Room save error (non-fatal)`);
          }
          break;
        case 'store':
          await axios.get(`${API_URL}/api/store/catalog`, {
            headers: { 'X-Passport-Code': passportCode }
          });
          break;
        case 'achievements':
          // Try to get achievements now that we've improved error handling
          try {
            await axios.get(`${API_URL}/api/student-achievements/my-achievements`, {
              headers: { 'X-Passport-Code': passportCode }
            });
          } catch (err) {
            console.log(`⚠️  Student ${studentId}: Achievements error (non-fatal)`);
          }
          break;
      }
    }

    console.log(`✨ Student ${studentId}: Completed journey`);
    return { success: true, studentId, passportCode: submission.data.passportCode };

  } catch (error) {
    const errorDetails = error.response ? 
      `${error.response.status} - ${error.response.data?.message || error.response.statusText}` : 
      error.message;
    console.error(`❌ Student ${studentId}: Failed - ${errorDetails}`);
    if (error.config) {
      console.error(`   URL: ${error.config.url}`);
    }
    return { success: false, studentId, error: errorDetails };
  }
}

// Main load test
async function runLoadTest() {
  console.log(`🚀 Starting load test with ${CONFIG.numStudents} students...`);
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`🏫 Class Codes: ${CONFIG.classCodes.join(', ')}`);
  console.log(`📊 Students per class: ~${Math.ceil(CONFIG.numStudents / CONFIG.classCodes.length)}`);
  console.log('');
  
  // First, let's verify all classes exist
  console.log('🔍 Verifying classes exist...');
  for (const classCode of CONFIG.classCodes) {
    try {
      const testCheck = await axios.post(`${API_URL}/api/quiz/check-eligibility`, {
        classCode: classCode,
        firstName: 'Test',
        lastInitial: 'T',
        grade: '5th'
      });
      if (!testCheck.data.eligible) {
        console.error(`❌ Class code '${classCode}' is not valid!`);
        console.error(`   Message: ${testCheck.data.message}`);
        console.error(`   Please check your database for active class codes.`);
        return;
      }
      console.log(`✅ Class verified: ${classCode} - ${testCheck.data.classInfo?.name || classCode}`);
    } catch (error) {
      console.error(`❌ Failed to verify class ${classCode}: ${error.message}`);
      return;
    }
  }
  console.log('');

  const startTime = Date.now();
  const promises = [];

  // Launch students with staggered starts
  for (let i = 0; i < CONFIG.numStudents; i++) {
    promises.push(
      new Promise(resolve => {
        setTimeout(async () => {
          const result = await simulateStudent(i + 1);
          resolve(result);
        }, i * 500); // Stagger by 500ms
      })
    );
  }

  // Wait for all students to complete
  const results = await Promise.all(promises);
  const endTime = Date.now();

  // Analyze results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const duration = (endTime - startTime) / 1000;

  console.log('\n📊 Load Test Results:');
  console.log(`✅ Successful: ${successful}/${CONFIG.numStudents}`);
  console.log(`❌ Failed: ${failed}/${CONFIG.numStudents}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📈 Requests/sec: ${(successful * 6 / duration).toFixed(2)}`);

  // Show errors if any
  if (failed > 0) {
    console.log('\n❌ Errors:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  Student ${r.studentId}: ${r.error}`);
    });
  }
}

// Run the test
runLoadTest().catch(console.error);