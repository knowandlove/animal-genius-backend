import { QuizSubmission } from "@shared/schema";

// Animal to genius type mapping
export const animalGeniusMap: Record<string, string> = {
  // Thinkers - analytical, logical
  'Owl': 'Thinker',
  'Cat': 'Thinker',
  'Fox': 'Thinker',
  
  // Feelers - empathetic, people-focused
  'Elephant': 'Feeler',
  'Dolphin': 'Feeler',
  'Deer': 'Feeler',
  'Horse': 'Feeler',
  'Koala': 'Feeler',
  'Rabbit': 'Feeler',
  'Panda': 'Feeler',
  
  // Doers - action-oriented, hands-on
  'Tiger': 'Doer',
  'Lion': 'Doer',
  'Otter': 'Doer',
  'Penguin': 'Doer',
  'Beaver': 'Doer',
  'Wolf': 'Doer',
  'Parrot': 'Doer',
  'Border Collie': 'Doer',
  'Meerkat': 'Doer'
};

// Dynamic duos - complementary pairs that work well together
const DYNAMIC_PAIRS = [
  { animals: ['Owl', 'Otter'], reason: 'Thinker + Doer complement each other perfectly' },
  { animals: ['Elephant', 'Parrot'], reason: 'Feeler + Doer create balanced collaboration' },
  { animals: ['Cat', 'Dolphin'], reason: 'Analytical thinking meets empathetic communication' },
  { animals: ['Fox', 'Horse'], reason: 'Strategic thinking with people-focused execution' },
  { animals: ['Beaver', 'Deer'], reason: 'Structured approach with considerate implementation' },
  { animals: ['Tiger', 'Koala'], reason: 'High energy balanced with calm reflection' },
  { animals: ['Lion', 'Rabbit'], reason: 'Leadership paired with thoughtful support' },
  { animals: ['Wolf', 'Penguin'], reason: 'Independent worker with social collaborator' },
  { animals: ['Panda', 'Border Collie'], reason: 'Calm reflection paired with energetic action' },
  { animals: ['Meerkat', 'Panda'], reason: 'Alert vigilance balanced with peaceful presence' },
  { animals: ['Owl', 'Border Collie'], reason: 'Analytical thinking with enthusiastic execution' },
  { animals: ['Beaver', 'Meerkat'], reason: 'Structured planning with keen observation' }
];

// Puzzle pairings - combinations that need extra support
const PUZZLE_PAIRS = [
  { 
    animals: ['Beaver', 'Parrot'], 
    issue: 'Different pace preferences - Beaver likes structure, Parrot prefers flexibility' 
  },
  { 
    animals: ['Owl', 'Penguin'], 
    issue: 'Communication style differences - detail-focused vs social-focused' 
  },
  { 
    animals: ['Tiger', 'Deer'], 
    issue: 'Energy level mismatch - high intensity vs gentle approach' 
  },
  { 
    animals: ['Cat', 'Horse'], 
    issue: 'Different social needs - independent vs collaborative preferences' 
  },
  { 
    animals: ['Fox', 'Elephant'], 
    issue: 'Decision-making differences - quick analysis vs careful consideration' 
  },
  { 
    animals: ['Border Collie', 'Panda'], 
    issue: 'Energy mismatch - high activity vs calm, steady approach' 
  },
  { 
    animals: ['Meerkat', 'Otter'], 
    issue: 'Different focus styles - vigilant attention vs spontaneous action' 
  },
  { 
    animals: ['Border Collie', 'Owl'], 
    issue: 'Different processing speeds - quick action vs thorough analysis' 
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
  const distribution = { Thinker: 0, Feeler: 0, Doer: 0 };
  
  submissions.forEach(submission => {
    const geniusType = animalGeniusMap[submission.animalType];
    if (geniusType && geniusType in distribution) {
      distribution[geniusType as keyof typeof distribution]++;
    }
  });
  
  return distribution;
}

// Helper function to parse scores from the stored format
function parseScores(scores: any) {
  // Handle both old format (E, I, S, N, etc.) and new format (E/I, S/N, etc.)
  if (scores['E/I'] !== undefined) {
    // New format - calculate individual scores
    const ei = scores['E/I'];
    const sn = scores['S/N']; 
    const tf = scores['T/F'];
    const jp = scores['J/P'];
    
    return {
      E: ei > 10 ? ei - 10 : 0,
      I: ei <= 10 ? 10 - ei : 0,
      S: sn > 10 ? sn - 10 : 0,
      N: sn <= 10 ? 10 - sn : 0,
      T: tf > 10 ? tf - 10 : 0,
      F: tf <= 10 ? 10 - tf : 0,
      J: jp > 10 ? jp - 10 : 0,
      P: jp <= 10 ? 10 - jp : 0
    };
  }
  
  // Old format - return as-is
  return scores;
}

export function generateClassInsights(submissions: QuizSubmission[]): ClassInsights {
  const insights: ClassInsights = {
    mayGetOverlooked: [],
    needConnection: [],
    needChangeWarnings: [],
    needThinkTime: []
  };

  submissions.forEach(submission => {
    const rawScores = submission.scores as any;
    
    // Skip if no scores available
    if (!rawScores) {
      return;
    }
    
    const scores = parseScores(rawScores);
    const studentInfo = {
      name: submission.studentName,
      animal: submission.animalType,
      submissionId: submission.id
    };

    // May Get Overlooked - introverted + feeling types
    if (scores.I > scores.E && ['Elephant', 'Deer', 'Koala', 'Rabbit', 'Panda'].includes(submission.animalType)) {
      insights.mayGetOverlooked.push(studentInfo);
    }

    // Need Connection - high feeling score
    if (scores.F > scores.T && scores.F >= 7) {
      insights.needConnection.push(studentInfo);
    }

    // Need Change Warnings - high judging score
    if (scores.J > scores.P && scores.J >= 7) {
      insights.needChangeWarnings.push(studentInfo);
    }

    // Need Think Time - introverted
    if (scores.I > scores.E && scores.I >= 6) {
      insights.needThinkTime.push(studentInfo);
    }
  });

  return insights;
}

export function generatePairings(submissions: QuizSubmission[]): PairingAnalysis {
  const dynamicDuos: StudentPairing[] = [];
  const puzzlePairings: StudentPairing[] = [];
  const soloWorkers: Array<{ name: string; animal: string; submissionId: number; note: string }> = [];
  
  // Create student lookup for easier pairing
  interface StudentData {
    name: string;
    animalType: string;
    submissionId: number;
    scores: any;
  }
  
  const students: StudentData[] = submissions
    .filter(s => s.scores) // Only include submissions with scores
    .map(s => ({
      name: s.studentName,
      animalType: s.animalType,
      submissionId: s.id,
      scores: parseScores(s.scores as any)
    }));

  // Find dynamic duos
  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      const student1 = students[i];
      const student2 = students[j];
      
      // Check if this pair matches any dynamic duo patterns
      const matchingPair = DYNAMIC_PAIRS.find(pair => 
        (pair.animals.includes(student1.animalType) && pair.animals.includes(student2.animalType)) &&
        student1.animalType !== student2.animalType
      );
      
      if (matchingPair) {
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

  // Identify solo workers (typically introverted types)
  students.forEach(student => {
    if (student.scores && student.scores.I > student.scores.E) {
      let note = "Works best with minimal distractions";
      
      if (['Owl', 'Cat'].includes(student.animalType)) {
        note = "Excels in independent analytical projects";
      } else if (['Deer', 'Koala', 'Rabbit', 'Panda'].includes(student.animalType)) {
        note = "Prefers individual creative or research tasks";
      } else if (student.animalType === 'Beaver') {
        note = "Thrives on structured individual assignments";
      } else if (['Meerkat'].includes(student.animalType)) {
        note = "Works well independently with focused attention";
      } else if (['Border Collie'].includes(student.animalType)) {
        note = "Can work solo when given clear structure and goals";
      }
      
      soloWorkers.push({
        name: student.name,
        animal: student.animalType,
        submissionId: student.submissionId,
        note
      });
    }
  });

  // Limit results to prevent overwhelming display
  return {
    dynamicDuos: dynamicDuos.slice(0, 8), // Top 8 dynamic duos
    puzzlePairings: puzzlePairings.slice(0, 6), // Top 6 puzzle pairings  
    soloWorkers: soloWorkers.slice(0, 6) // Top 6 solo workers
  };
}