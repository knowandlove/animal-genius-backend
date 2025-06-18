import { questions } from './quiz-questions';
import { calculateLearningStyle, type LearningStyleScores, type LearningStyleType } from './learning-styles';

export interface QuizAnswer {
  questionId: number;
  answer: 'A' | 'B' | 'C' | 'D';
}

export interface QuizResults {
  // MBTI scoring
  scores: {
    E: number;
    I: number;
    S: number;
    N: number;
    T: number;
    F: number;
    J: number;
    P: number;
  };
  mbtiType: string;
  animal: string;
  animalGenius: string;
  // Learning style scoring
  learningScores: LearningStyleScores;
  learningStyle: LearningStyleType;
}

// MBTI to Animal mapping - Your Original 8 Animals
export const animalMap: Record<string, string> = {
  INFP: "Meerkat",
  ISFP: "Meerkat",
  INFJ: "Panda",
  INTJ: "Panda",
  ISTP: "Owl",
  INTP: "Owl",
  ISFJ: "Beaver",
  ISTJ: "Beaver",
  ESFJ: "Elephant",
  ENFJ: "Elephant",
  ESFP: "Otter",
  ESTP: "Otter",
  ENFP: "Parrot",
  ENTP: "Parrot",
  ESTJ: "Border Collie",
  ENTJ: "Border Collie"
};

export const animalGeniusMap: Record<string, string> = {
  'Owl': 'Thinker',
  'Parrot': 'Thinker',
  'Meerkat': 'Feeler',
  'Elephant': 'Feeler',
  'Panda': 'Feeler',
  'Beaver': 'Doer',
  'Otter': 'Doer',
  'Border Collie': 'Doer'
};

export const animalGeniusDetails = {
  'Thinker': {
    name: 'Thinker',
    description: 'Strategic minds who excel at creative thinking and problem-solving',
    strengths: ['Creative Thinking', 'Originality', 'Critical Thinking & Ethical Reasoning', 'Vision and Strategic Foresight'],
    color: '#8B5CF6'
  },
  'Feeler': {
    name: 'Feeler', 
    description: 'Emotionally intelligent leaders who build strong relationships',
    strengths: ['Emotional Intelligence', 'Empathy', 'Relationship Building', 'Communication', 'Inclusion and Moral Courage'],
    color: '#10B981'
  },
  'Doer': {
    name: 'Doer',
    description: 'Action-oriented individuals who drive results and adapt quickly',
    strengths: ['Resilience', 'Flexibility', 'Growth Mindset', 'Learning Agility', 'Leadership and Team Motivation'],
    color: '#F59E0B'
  }
};

export function calculateResults(answers: QuizAnswer[]): QuizResults {
  // Initialize MBTI scores
  const scores = {
    E: 0, I: 0,
    S: 0, N: 0, 
    T: 0, F: 0,
    J: 0, P: 0
  };

  // Calculate MBTI scores
  answers.forEach(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    if (question) {
      const dimension = question.mapping[answer.answer];
      if (dimension in scores) {
        scores[dimension as keyof typeof scores]++;
      }
    }
  });

  // Determine MBTI type
  const mbtiType = 
    (scores.E > scores.I ? 'E' : 'I') +
    (scores.S > scores.N ? 'S' : 'N') +
    (scores.T > scores.F ? 'T' : 'F') +
    (scores.J > scores.P ? 'J' : 'P');

  // Get animal for MBTI type
  const animal = animalMap[mbtiType] || 'Unknown';

  // Calculate learning style from VARK questions (41-48)
  const varkAnswers = answers.filter(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    return question?.dimension === 'VARK';
  });
  
  const learningScores: LearningStyleScores = {
    visual: 0,
    auditory: 0,
    kinesthetic: 0,
    readingWriting: 0
  };

  // Score VARK questions
  varkAnswers.forEach(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    if (question?.dimension === 'VARK') {
      const style = question.mapping[answer.answer] as LearningStyleType;
      if (style in learningScores) {
        learningScores[style]++;
      }
    }
  });

  // Determine primary learning style
  let primaryStyle: LearningStyleType = 'visual';
  let maxScore = learningScores.visual;
  
  (Object.keys(learningScores) as LearningStyleType[]).forEach(style => {
    if (learningScores[style] > maxScore) {
      maxScore = learningScores[style];
      primaryStyle = style;
    }
  });

  const learningResult = {
    scores: learningScores,
    primaryStyle
  };

  // Get Animal Genius category
  const animalGenius = animalGeniusMap[animal] || 'Thinker';

  return {
    scores,
    mbtiType,
    animal,
    animalGenius,
    learningScores: learningResult.scores,
    learningStyle: learningResult.primaryStyle
  };
}