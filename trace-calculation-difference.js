#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

config();

async function traceCalculationDifference() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔍 Tracing calculation difference');
    console.log('═'.repeat(60));
    
    // Get the actual quiz data
    const result = await client.query(`
      SELECT qs.answers 
      FROM quiz_submissions qs 
      ORDER BY qs.created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No quiz submissions found');
      return;
    }
    
    const rawAnswers = result.rows[0].answers;
    console.log('📊 Quiz analysis:');
    console.log(`   Total questions: ${Array.isArray(rawAnswers) ? rawAnswers.length : 'Not an array'}`);
    
    if (!Array.isArray(rawAnswers)) {
      console.log('❌ Answers are not an array');
      return;
    }
    
    // Show first 16 questions (what backend uses for MBTI)
    console.log('\n1. First 16 questions (MBTI calculation):');
    const mbtiAnswers = rawAnswers.slice(0, 16);
    mbtiAnswers.forEach((answer, index) => {
      console.log(`   Q${answer.questionId}: ${answer.answer.toUpperCase()}`);
    });
    
    // Test backend calculation with these answers
    console.log('\n2. Backend calculation with these 16 answers:');
    const backendResult = await client.query('SELECT public.calculate_animal_type($1) as animal_type', [JSON.stringify(mbtiAnswers)]);
    const backendAnimal = backendResult.rows[0].animal_type;
    console.log(`   Backend result: ${backendAnimal}`);
    
    // Manual MBTI calculation
    console.log('\n3. Manual MBTI calculation:');
    
    // Map the first 16 answers based on quiz-questions.ts
    const mbtiScores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    
    // Based on quiz-questions.ts mappings for first 16 questions
    const questionMappings = [
      {A: 'I', B: 'E'},  // Q1: E/I
      {A: 'S', B: 'N'},  // Q2: S/N  
      {A: 'T', B: 'F'},  // Q3: T/F
      {A: 'P', B: 'J'},  // Q4: J/P
      {A: 'E', B: 'I'},  // Q5: E/I
      {A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic'}, // Q6: VARK
      {A: 'T', B: 'F'},  // Q7: T/F
      {A: 'P', B: 'J'},  // Q8: J/P
      {A: 'I', B: 'E'},  // Q9: E/I
      {A: 'N', B: 'S'},  // Q10: S/N
      {A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic'}, // Q11: VARK
      {A: 'J', B: 'P'},  // Q12: J/P
      {A: 'E', B: 'I'},  // Q13: E/I
      {A: 'S', B: 'N'},  // Q14: S/N
      {A: 'T', B: 'F'},  // Q15: T/F
      {A: 'J', B: 'P'}   // Q16: J/P
    ];
    
    mbtiAnswers.forEach((answer, index) => {
      const mapping = questionMappings[index];
      const result = mapping[answer.answer.toUpperCase()];
      
      if (result && ['E', 'I', 'S', 'N', 'T', 'F', 'J', 'P'].includes(result)) {
        mbtiScores[result]++;
        console.log(`   Q${answer.questionId}: ${answer.answer.toUpperCase()} → ${result}`);
      } else {
        console.log(`   Q${answer.questionId}: ${answer.answer.toUpperCase()} → ${result} (VARK - skipped)`);
      }
    });
    
    console.log('\n   Score totals:');
    console.log(`   E: ${mbtiScores.E}, I: ${mbtiScores.I}`);
    console.log(`   S: ${mbtiScores.S}, N: ${mbtiScores.N}`);
    console.log(`   T: ${mbtiScores.T}, F: ${mbtiScores.F}`);
    console.log(`   J: ${mbtiScores.J}, P: ${mbtiScores.P}`);
    
    // Apply tie-breaking rules
    const mbti_type = 
      (mbtiScores.E >= mbtiScores.I ? 'E' : 'I') +  // Ties go to E
      (mbtiScores.S > mbtiScores.N ? 'S' : 'N') +   // Ties go to N  
      (mbtiScores.T >= mbtiScores.F ? 'T' : 'F') +  // Ties go to T
      (mbtiScores.J > mbtiScores.P ? 'J' : 'P');    // Ties go to P
    
    console.log(`   MBTI result: ${mbti_type}`);
    
    // Map to animal
    const animalMap = {
      INFP: "Meerkat", ISFP: "Meerkat",
      INFJ: "Panda", INTJ: "Panda",
      ISTP: "Owl", INTP: "Owl",
      ISFJ: "Beaver", ISTJ: "Beaver", 
      ESFJ: "Elephant", ENFJ: "Elephant",
      ESFP: "Otter", ESTP: "Otter",
      ENFP: "Parrot", ENTP: "Parrot",
      ESTJ: "Border Collie", ENTJ: "Border Collie"
    };
    
    const manualAnimal = animalMap[mbti_type] || 'Unknown';
    console.log(`   Manual animal: ${manualAnimal}`);
    
    // Check if frontend might be using different questions
    console.log('\n4. Possible frontend vs backend mismatch:');
    console.log(`   Frontend showed: Panda`);
    console.log(`   Backend calculated: ${backendAnimal}`);
    console.log(`   Manual calculation: ${manualAnimal}`);
    
    if (backendAnimal !== manualAnimal) {
      console.log('\n❌ Backend function has different logic than expected!');
    } else if (manualAnimal !== 'Panda') {
      console.log('\n❌ Frontend is using different questions or calculation logic!');
      console.log('   The frontend might be:');
      console.log('   - Using different question mappings');
      console.log('   - Using different questions for MBTI calculation');
      console.log('   - Having a bug in its calculation');
    } else {
      console.log('\n✅ Calculations should match - investigating further...');
    }
    
    // Show additional questions to see if frontend uses them
    if (rawAnswers.length > 16) {
      console.log(`\n5. Additional questions - ${rawAnswers.length - 16} more:`);
      rawAnswers.slice(16, 24).forEach(answer => {
        console.log(`   Q${answer.questionId}: ${answer.answer.toUpperCase()}`);
      });
      console.log('   ...');
      console.log('   Frontend might be using these for MBTI calculation');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

traceCalculationDifference().catch(console.error);