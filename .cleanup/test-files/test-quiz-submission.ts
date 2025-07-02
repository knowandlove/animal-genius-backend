/**
 * Test script to simulate thundering herd scenario
 * Run with: npx tsx test-quiz-submission.ts
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:5000';
const CLASS_CODE = process.env.CLASS_CODE || 'TEST01'; // Replace with your test class code

// Animal types for variety
const animals = ['meerkat', 'panda', 'owl', 'beaver', 'elephant', 'otter', 'parrot', 'border-collie'];
const personalityTypes = ['INTJ', 'ENFP', 'ISTP', 'ESFJ', 'INFP', 'ESTP', 'ISFJ', 'ENFJ'];

// Generate test submission data
function generateTestSubmission(index: number, classId: number) {
  return {
    classId,
    studentName: `Test Student ${index}`,
    gradeLevel: '7th Grade',
    answers: Array(40).fill(null).map((_, i) => ({
      questionId: i + 1,
      answer: Math.random() > 0.5 ? 'A' : 'B'
    })),
    personalityType: personalityTypes[index % personalityTypes.length],
    animalType: animals[index % animals.length],
    animalGenius: 'Feeler',
    scores: {
      E: Math.floor(Math.random() * 10),
      I: Math.floor(Math.random() * 10),
      S: Math.floor(Math.random() * 10),
      N: Math.floor(Math.random() * 10),
      T: Math.floor(Math.random() * 10),
      F: Math.floor(Math.random() * 10),
      J: Math.floor(Math.random() * 10),
      P: Math.floor(Math.random() * 10)
    },
    learningStyle: 'visual',
    learningScores: {
      visual: 8,
      auditory: 6,
      kinesthetic: 7,
      readingWriting: 5
    }
  };
}

async function getClassInfo(classCode: string) {
  try {
    const response = await axios.get(`${API_URL}/api/classes/code/${classCode}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get class info:', error.message);
    throw error;
  }
}

async function simulateThunderingHerd(classSize: number = 30) {
  console.log(`🏃 Simulating ${classSize} students submitting simultaneously...`);
  
  try {
    // First, get the class info
    const classInfo = await getClassInfo(CLASS_CODE);
    console.log(`📚 Using class: ${classInfo.name} (ID: ${classInfo.id})`);
    
    // Create all submission promises
    const promises = [];
    const startTime = Date.now();
    
    for (let i = 0; i < classSize; i++) {
      const submission = generateTestSubmission(i + 1, classInfo.id);
      
      const promise = axios.post(`${API_URL}/api/quiz-submissions`, submission)
        .then(response => ({
          success: true,
          studentName: submission.studentName,
          submissionId: response.data.id,
          passportCode: response.data.passportCode,
          responseTime: Date.now() - startTime
        }))
        .catch(error => ({
          success: false,
          studentName: submission.studentName,
          error: error.response?.data?.message || error.message,
          responseTime: Date.now() - startTime
        }));
      
      promises.push(promise);
    }
    
    // Execute all submissions simultaneously
    console.log('⚡ Sending all requests...');
    const results = await Promise.all(promises);
    
    // Analyze results
    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log('\n📊 Results:');
    console.log(`✅ Successful: ${successful.length}/${classSize}`);
    console.log(`❌ Failed: ${failed.length}/${classSize}`);
    console.log(`⏱️  Total time: ${totalTime}ms`);
    console.log(`⚡ Average response time: ${Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)}ms`);
    
    if (successful.length > 0) {
      console.log(`\n🎯 Fastest response: ${Math.min(...successful.map(r => r.responseTime))}ms`);
      console.log(`🐌 Slowest response: ${Math.max(...successful.map(r => r.responseTime))}ms`);
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failures:');
      failed.forEach(f => {
        console.log(`  - ${f.studentName}: ${f.error}`);
      });
    }
    
    // Show some passport codes
    if (successful.length > 0) {
      console.log('\n🎫 Sample passport codes:');
      successful.slice(0, 5).forEach(s => {
        console.log(`  - ${s.studentName}: ${s.passportCode}`);
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
const classSize = parseInt(process.argv[2]) || 30;
simulateThunderingHerd(classSize)
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
