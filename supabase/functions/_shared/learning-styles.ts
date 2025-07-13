export interface LearningStyleAnswer {
  questionId: number;
  answer: 'A' | 'B' | 'C' | 'D';
}

export interface LearningStyleScores {
  visual: number;
  auditory: number;
  kinesthetic: number;
  readingWriting: number;
}

export type LearningStyleType = 'visual' | 'auditory' | 'kinesthetic' | 'readingWriting';

export const learningStyleDetails = {
  visual: {
    name: "Visual Learner",
    description: "You learn best through seeing and visual aids",
    characteristics: [
      "Prefers charts, diagrams, and pictures",
      "Likes colorful and organized materials",
      "Remembers faces better than names",
      "Benefits from highlighting and color-coding"
    ],
    tips: [
      "Use mind maps and graphic organizers",
      "Watch educational videos",
      "Draw diagrams to understand concepts",
      "Use flashcards with images"
    ],
    emoji: "👁️",
    color: "#4F46E5"
  },
  auditory: {
    name: "Auditory Learner", 
    description: "You learn best through listening and discussion",
    characteristics: [
      "Enjoys listening to lectures and discussions",
      "Learns well through verbal instructions",
      "Likes to talk through problems",
      "Remembers information heard aloud"
    ],
    tips: [
      "Read materials out loud",
      "Join study groups for discussion",
      "Use music and rhymes to memorize",
      "Record lessons to listen later"
    ],
    emoji: "👂",
    color: "#059669"
  },
  kinesthetic: {
    name: "Kinesthetic Learner",
    description: "You learn best through hands-on activities and movement",
    characteristics: [
      "Prefers hands-on activities",
      "Likes to move while learning",
      "Learns by doing and experimenting",
      "Enjoys building and creating"
    ],
    tips: [
      "Use manipulatives and models",
      "Take frequent breaks to move",
      "Act out concepts when possible",
      "Use gestures while studying"
    ],
    emoji: "🤲",
    color: "#DC2626"
  },
  readingWriting: {
    name: "Reading/Writing Learner",
    description: "You learn best through reading and writing activities",
    characteristics: [
      "Enjoys reading and writing",
      "Prefers text-based information",
      "Likes taking detailed notes",
      "Learns well from books and articles"
    ],
    tips: [
      "Take comprehensive notes",
      "Rewrite information in your own words",
      "Use lists and written summaries",
      "Read multiple sources on topics"
    ],
    emoji: "📚",
    color: "#7C2D12"
  }
};

export function calculateLearningStyle(answers: LearningStyleAnswer[], questions: any[]): {
  scores: LearningStyleScores;
  primaryStyle: LearningStyleType;
} {
  const scores: LearningStyleScores = {
    visual: 0,
    auditory: 0,
    kinesthetic: 0,
    readingWriting: 0
  };

  // Calculate scores based on learning style questions
  answers.forEach(answer => {
    const question = questions.find((q: any) => q.id === answer.questionId);
    if (question?.learningStyle) {
      const styleChoice = question.learningStyle[answer.answer] as LearningStyleType;
      scores[styleChoice]++;
    }
  });

  // Determine primary learning style (highest score)
  let primaryStyle: LearningStyleType = 'visual';
  let highestScore = scores.visual;

  if (scores.auditory > highestScore) {
    primaryStyle = 'auditory';
    highestScore = scores.auditory;
  }
  if (scores.kinesthetic > highestScore) {
    primaryStyle = 'kinesthetic';
    highestScore = scores.kinesthetic;
  }
  if (scores.readingWriting > highestScore) {
    primaryStyle = 'readingWriting';
    highestScore = scores.readingWriting;
  }

  return {
    scores,
    primaryStyle
  };
}

export function getLearningStyleByType(type: LearningStyleType) {
  return learningStyleDetails[type];
}

export function getAllLearningStyles(): LearningStyleType[] {
  return ['visual', 'auditory', 'kinesthetic', 'readingWriting'];
}