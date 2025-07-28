import { QuizSubmission } from "@shared/schema";

// Animal to genius type mapping - updated to match current system
export const animalGeniusMap: Record<string, string> = {
  // Thinkers - analytical, logical (ISTP, INTP)
  'Owl': 'Thinker',
  
  // Feelers - empathetic, people-focused (INFP, ISFP, INFJ, INTJ, ISFJ, ISTJ, ESFJ, ENFJ)
  'Meerkat': 'Feeler',      // INFP, ISFP - creative, empathetic
  'Panda': 'Feeler',        // INFJ, INTJ - reflective, strategic  
  'Beaver': 'Feeler',       // ISFJ, ISTJ - reliable, supportive
  'Elephant': 'Feeler',     // ESFJ, ENFJ - caring, nurturing
  
  // Doers - action-oriented, hands-on (ESFP, ESTP, ENFP, ENTP, ESTJ, ENTJ)
  'Otter': 'Doer',          // ESFP, ESTP - playful, energetic
  'Parrot': 'Doer',         // ENFP, ENTP - enthusiastic, creative
  'Border Collie': 'Doer'   // ESTJ, ENTJ - leadership, goal-oriented
};

// Dynamic duos - complementary pairs that work well together
const DYNAMIC_PAIRS = [
  { animals: ['Owl', 'Otter'], reason: 'Thinker + Doer complement each other perfectly' },
  { animals: ['Owl', 'Parrot'], reason: 'Analytical thinking with creative enthusiasm' },
  { animals: ['Owl', 'Border Collie'], reason: 'Analytical thinking with goal-oriented execution' },
  { animals: ['Meerkat', 'Otter'], reason: 'Creative empathy with energetic action' },
  { animals: ['Meerkat', 'Parrot'], reason: 'Imaginative souls with enthusiastic communication' },
  { animals: ['Panda', 'Border Collie'], reason: 'Strategic reflection with decisive leadership' },
  { animals: ['Panda', 'Otter'], reason: 'Thoughtful planning with spontaneous energy' },
  { animals: ['Beaver', 'Parrot'], reason: 'Organized structure with creative inspiration' },
  { animals: ['Beaver', 'Border Collie'], reason: 'Reliable support with strong leadership' },
  { animals: ['Elephant', 'Otter'], reason: 'Nurturing care with playful energy' },
  { animals: ['Elephant', 'Parrot'], reason: 'Social harmony with creative communication' },
  { animals: ['Elephant', 'Border Collie'], reason: 'People-focused care with goal achievement' }
];

// Puzzle pairings - combinations that need extra support
const PUZZLE_PAIRS = [
  { 
    animals: ['Owl', 'Elephant'], 
    issue: 'Communication style differences - analytical vs people-focused' 
  },
  { 
    animals: ['Meerkat', 'Border Collie'], 
    issue: 'Pace differences - creative process vs goal-driven urgency' 
  },
  { 
    animals: ['Panda', 'Parrot'], 
    issue: 'Energy mismatch - calm reflection vs enthusiastic action' 
  },
  { 
    animals: ['Beaver', 'Otter'], 
    issue: 'Structure vs flexibility - organized approach vs spontaneous style' 
  },
  { 
    animals: ['Owl', 'Meerkat'], 
    issue: 'Different processing styles - logical analysis vs emotional intuition' 
  },
  { 
    animals: ['Elephant', 'Panda'], 
    issue: 'Social needs differences - group harmony vs independent reflection' 
  }
];

export interface StudentPairing {
  student1: { name: string; animal: string; submissionId: number };
  student2: { name: string; animal: string; submissionId: number };
  reason?: string;
  issue?: string;
}

export interface ClassInsights {
  mayGetOverlooked: Array<{ name: string; animal: string; submissionId: number }>;
  needConnection: Array<{ name: string; animal: string; submissionId: number }>;
  needChangeWarnings: Array<{ name: string; animal: string; submissionId: number }>;
  needThinkTime: Array<{ name: string; animal: string; submissionId: number }>;
}

export interface PairingAnalysis {
  dynamicDuos: StudentPairing[];
  puzzlePairings: StudentPairing[];
  soloWorkers: Array<{ name: string; animal: string; submissionId: number; note: string }>;
}

export function calculateGeniusDistribution(submissions: QuizSubmission[]) {
  // TODO: This function needs to be updated to work with animalTypeId instead of animalType
  // For now, return empty distribution
  const distribution = { Thinker: 0, Feeler: 0, Doer: 0 };
  
  // submissions.forEach(submission => {
  //   const geniusType = animalGeniusMap[submission.animalType];
  //   if (geniusType && geniusType in distribution) {
  //     distribution[geniusType as keyof typeof distribution]++;
  //   }
  // });
  
  return distribution;
}


export function generateClassInsights(submissions: any[]): ClassInsights {
  const insights: ClassInsights = {
    mayGetOverlooked: [],
    needConnection: [],
    needChangeWarnings: [],
    needThinkTime: []
  };

  submissions.forEach(submission => {
    try {
      const studentInfo = {
        name: submission.studentName || 'Unknown Student',
        animal: submission.animalType || 'Unknown',
        submissionId: submission.id || 0
      };

      // Base insights on animal personality types instead of scores
      const animalType = submission.animalType;

      // May Get Overlooked - quiet, introverted types
      if (['Meerkat', 'Panda', 'Beaver'].includes(animalType)) {
        insights.mayGetOverlooked.push(studentInfo);
      }

      // Need Connection - feeling-based animals
      if (['Meerkat', 'Elephant', 'Beaver'].includes(animalType)) {
        insights.needConnection.push(studentInfo);
      }

      // Need Change Warnings - structured, planning animals
      if (['Beaver', 'Panda', 'Border Collie'].includes(animalType)) {
        insights.needChangeWarnings.push(studentInfo);
      }

      // Need Think Time - analytical and introverted types
      if (['Owl', 'Panda', 'Meerkat', 'Beaver'].includes(animalType)) {
        insights.needThinkTime.push(studentInfo);
      }
    } catch (error) {
      console.error('Error processing submission for insights:', error, submission);
      // Skip this submission but continue with others
    }
  });

  return insights;
}

export function generatePairings(submissions: any[]): PairingAnalysis {
  console.log(`[Pairings] Starting pairing generation with ${submissions.length} submissions`);
  
  const dynamicDuos: StudentPairing[] = [];
  const puzzlePairings: StudentPairing[] = [];
  const soloWorkers: Array<{ name: string; animal: string; submissionId: number; note: string }> = [];
  
  // Create student lookup for easier pairing
  interface StudentData {
    name: string;
    animalType: string;
    submissionId: number;
  }
  
  const students: StudentData[] = submissions
    .filter(s => s.animalType && s.studentName) // Only need animal type and name
    .map(s => ({
      name: s.studentName,
      animalType: s.animalType,
      submissionId: s.id
    }));
    
  console.log(`[Pairings] Filtered to ${students.length} students`);
  console.log('[Pairings] Student animals:', students.map(s => `${s.name}: ${s.animalType}`));
  
  // Log available pairing patterns
  console.log('[Pairings] Available dynamic duo patterns:', DYNAMIC_PAIRS.map(p => p.animals.join(' + ')));

  // Find dynamic duos
  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      const student1 = students[i];
      const student2 = students[j];
      
      console.log(`[Pairings] Checking pair: ${student1.animalType} + ${student2.animalType}`);
      
      // Check if this pair matches any dynamic duo patterns
      const matchingPair = DYNAMIC_PAIRS.find(pair => 
        (pair.animals.includes(student1.animalType) && pair.animals.includes(student2.animalType)) &&
        student1.animalType !== student2.animalType
      );
      
      if (matchingPair) {
        console.log(`[Pairings] Found dynamic duo: ${student1.name} (${student1.animalType}) + ${student2.name} (${student2.animalType})`);
        dynamicDuos.push({
          student1: { name: student1.name, animal: student1.animalType, submissionId: student1.submissionId },
          student2: { name: student2.name, animal: student2.animalType, submissionId: student2.submissionId },
          reason: matchingPair.reason
        });
      }
    }
  }

  // Find puzzle pairings
  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      const student1 = students[i];
      const student2 = students[j];
      
      // Check if this pair matches any puzzle patterns
      const matchingPuzzle = PUZZLE_PAIRS.find(pair => 
        (pair.animals.includes(student1.animalType) && pair.animals.includes(student2.animalType)) &&
        student1.animalType !== student2.animalType
      );
      
      if (matchingPuzzle) {
        puzzlePairings.push({
          student1: { name: student1.name, animal: student1.animalType, submissionId: student1.submissionId },
          student2: { name: student2.name, animal: student2.animalType, submissionId: student2.submissionId },
          issue: matchingPuzzle.issue
        });
      }
    }
  }

  // Identify solo workers based on animal personality types (introverted animals)
  students.forEach(student => {
    // Introverted animal types: Owl, Panda, Beaver, Meerkat (some)
    const introvertedAnimals = ['Owl', 'Panda', 'Beaver', 'Meerkat'];
    
    if (introvertedAnimals.includes(student.animalType)) {
      let note = "Works best with minimal distractions";
      
      if (student.animalType === 'Owl') {
        note = "Excels in independent analytical projects";
      } else if (student.animalType === 'Panda') {
        note = "Prefers individual strategic planning tasks";
      } else if (student.animalType === 'Beaver') {
        note = "Thrives on structured individual assignments";
      } else if (student.animalType === 'Meerkat') {
        note = "Works well independently with focused creative attention";
      }
      
      soloWorkers.push({
        name: student.name,
        animal: student.animalType,
        submissionId: student.submissionId,
        note
      });
    }
  });

  console.log(`[Pairings] Results: ${dynamicDuos.length} duos, ${puzzlePairings.length} puzzles, ${soloWorkers.length} solo workers`);
  
  // Limit results to prevent overwhelming display
  const result = {
    dynamicDuos: dynamicDuos.slice(0, 8), // Top 8 dynamic duos
    puzzlePairings: puzzlePairings.slice(0, 6), // Top 6 puzzle pairings  
    soloWorkers: soloWorkers.slice(0, 6) // Top 6 solo workers
  };
  
  console.log('[Pairings] Final result:', JSON.stringify(result, null, 2));
  return result;
}