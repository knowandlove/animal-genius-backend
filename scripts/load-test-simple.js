#!/usr/bin/env node

/**
 * Simplified Load Testing Script - Just creates students
 */

import axios from 'axios';
import { faker } from '@faker-js/faker';

const API_URL = process.env.API_URL || 'http://localhost:5001';

// Test configuration
const CONFIG = {
  numStudents: parseInt(process.env.NUM_STUDENTS) || 50,
  classCode: (process.env.CLASS_CODE || 'YW6-DGH').toUpperCase(),
  delayBetweenStudents: parseInt(process.env.DELAY) || 500,
};

// Generate quiz answers (48 questions total - 40 MBTI + 8 VARK)
function generateQuizAnswers() {
  const personalityAnswers = Array(40).fill(0).map(() => 
    faker.helpers.arrayElement(['A', 'B'])
  );
  const varkAnswers = Array(8).fill(0).map(() => 
    faker.helpers.arrayElement(['V', 'A', 'R', 'K'])
  );
  return [...personalityAnswers, ...varkAnswers];
}

// Simulate a single student
async function createStudent(studentId) {
  const firstName = faker.person.firstName();
  const lastInitial = faker.person.lastName()[0];
  const studentName = `${firstName} ${lastInitial}`;
  const gradeLevel = faker.helpers.arrayElement(['4th Grade', '5th Grade', '6th Grade', '7th Grade']);
  
  try {
    // Step 1: Check eligibility
    const eligibilityCheck = await axios.post(`${API_URL}/api/quiz/check-eligibility`, {
      classCode: CONFIG.classCode,
      firstName,
      lastInitial,
      grade: gradeLevel.split(' ')[0] // "5th Grade" -> "5th"
    });
    
    if (!eligibilityCheck.data.eligible) {
      throw new Error(`Not eligible: ${eligibilityCheck.data.message}`);
    }

    // Step 2: Submit quiz
    const answers = generateQuizAnswers();
    
    // Calculate scores
    const personalityScores = {
      E: faker.number.int({ min: 0, max: 10 }),
      I: faker.number.int({ min: 0, max: 10 }),
      S: faker.number.int({ min: 0, max: 10 }),
      N: faker.number.int({ min: 0, max: 10 }),
      T: faker.number.int({ min: 0, max: 10 }),
      F: faker.number.int({ min: 0, max: 10 }),
      J: faker.number.int({ min: 0, max: 10 }),
      P: faker.number.int({ min: 0, max: 10 })
    };
    
    const learningScores = {
      V: faker.number.int({ min: 0, max: 5 }),
      A: faker.number.int({ min: 0, max: 5 }),
      R: faker.number.int({ min: 0, max: 5 }),
      K: faker.number.int({ min: 0, max: 5 })
    };
    
    // Determine MBTI type
    const mbtiType = 
      (personalityScores.E > personalityScores.I ? 'E' : 'I') +
      (personalityScores.S > personalityScores.N ? 'S' : 'N') +
      (personalityScores.T > personalityScores.F ? 'T' : 'F') +
      (personalityScores.J > personalityScores.P ? 'J' : 'P');
    
    // Map to actual animals
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
    const animalCode = animalType.toLowerCase().replace(' ', '-');
    
    const learningStyle = ['V', 'A', 'R', 'K'].reduce((a, b) => 
      learningScores[a] > learningScores[b] ? a : b
    );
    
    const learningStyleMap = {
      'V': 'visual',
      'A': 'auditory',
      'R': 'reading',
      'K': 'kinesthetic'
    };
    
    const quizData = {
      studentName,
      gradeLevel,
      classId: eligibilityCheck.data.classInfo.id,
      animalType: animalCode,
      geniusType: '', // Let service determine
      personalityType: mbtiType,
      learningStyle: learningStyleMap[learningStyle],
      answers: {
        personalityAnswers: answers.slice(0, 40),
        learningAnswers: answers.slice(40)
      },
      scores: personalityScores,
      learningScores
    };

    const submission = await axios.post(`${API_URL}/api/quiz/submissions`, quizData);
    const { passportCode } = submission.data;
    
    console.log(`✅ ${studentId}. ${studentName} - ${animalType} - ${passportCode}`);
    return { success: true, studentId, passportCode, animalType };

  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error(`❌ ${studentId}. ${studentName} - Failed: ${errorMsg}`);
    return { success: false, studentId, error: errorMsg };
  }
}

// Main test
async function runLoadTest() {
  console.log(`🚀 Creating ${CONFIG.numStudents} students in class ${CONFIG.classCode}...`);
  console.log('');
  
  const startTime = Date.now();
  const promises = [];

  // Create students with staggered starts
  for (let i = 0; i < CONFIG.numStudents; i++) {
    promises.push(
      new Promise(resolve => {
        setTimeout(async () => {
          const result = await createStudent(i + 1);
          resolve(result);
        }, i * CONFIG.delayBetweenStudents);
      })
    );
  }

  const results = await Promise.all(promises);
  const duration = (Date.now() - startTime) / 1000;

  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('\n📊 Results:');
  console.log(`✅ Created: ${successful.length}/${CONFIG.numStudents} students`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏱️  Time: ${duration.toFixed(1)}s`);
  console.log(`📈 Rate: ${(successful.length / duration).toFixed(1)} students/sec`);
  
  if (successful.length > 0) {
    const animalCounts = {};
    successful.forEach(r => {
      animalCounts[r.animalType] = (animalCounts[r.animalType] || 0) + 1;
    });
    
    console.log('\n🦁 Animals:');
    Object.entries(animalCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([animal, count]) => {
        console.log(`   ${animal}: ${count}`);
      });
  }
}

runLoadTest().catch(console.error);