export interface Question {
  id: number;
  text: string;
  options: {
    A: string;
    B: string;
    C?: string;  // Optional for VARK questions
    D?: string;  // Optional for VARK questions
  };
  dimension: 'E/I' | 'S/N' | 'T/F' | 'J/P' | 'VARK';
  mapping: Record<string, string>;
  audioFile?: string; // Optional audio narration file
}

export const questions: Question[] = [
  {
    id: 1,
    text: "When you come across something new, what do you usually like to do?",
    options: {
      A: "Watch and observe for a moment.",
      B: "Jump right in and figure it out as you go along."
    },
    dimension: 'E/I',
    mapping: { A: 'I', B: 'E' },
    audioFile: 'q1.mp3'
  },
  {
    id: 2,
    text: "When you hear a new idea, what do you do first?",
    options: {
      A: "Try it out and see what happens.",
      B: "Think of how it connects to other things you know."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q2.mp3'
  },
  {
    id: 3,
    text: "What do you usually care about more?",
    options: {
      A: "People telling the truth.",
      B: "Everyone getting along."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q3.mp3'
  },
  {
    id: 4,
    text: "Which do you prefer?",
    options: {
      A: "Going on adventures and being flexible.",
      B: "Having a set plan and knowing what will happen next."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q4.mp3'
  },
  {
    id: 5,
    text: "Which one sounds more fun to you?",
    options: {
      A: "Taking part in activities that are happening around you.",
      B: "Using your imagination to come up with creative ideas in your mind."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q5.mp3'
  },
  {
    id: 6,
    text: "If your parent gave you a to-do list, would you",
    options: {
      A: "Do them in order, like first, second, third...",
      B: "Jump around the list and do the things you feel like doing first."
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q6.mp3'
  },
  {
    id: 7,
    text: "What type of teachers do you usually prefer?",
    options: {
      A: "Teachers who are fair and always do things the same way.",
      B: "Teachers who are caring and friendly."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q7.mp3'
  },
  {
    id: 8,
    text: "When you have a project or homework, do you usually start it:",
    options: {
      A: "At the last minute or just before the deadline.",
      B: "Right away."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q8.mp3'
  },
  {
    id: 9,
    text: "When you hang out, do you prefer to be with:",
    options: {
      A: "One friend at a time?",
      B: "Several friends together?"
    },
    dimension: 'E/I',
    mapping: { A: 'I', B: 'E' },
    audioFile: 'q9.mp3'
  },
  {
    id: 10,
    text: "Do you usually:",
    options: {
      A: "Imagine things you might do in the future.",
      B: "Discuss things you can do right now."
    },
    dimension: 'S/N',
    mapping: { A: 'N', B: 'S' },
    audioFile: 'q10.mp3'
  },
  {
    id: 11,
    text: "If a classmate was caught cheating on a test, what do you think would be better?",
    options: {
      A: "Giving them a consequence like a punishment.",
      B: "Talking to them about what happened."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q11.mp3'
  },
  {
    id: 12,
    text: "Do you usually:",
    options: {
      A: "Start a new project before completing your current one.",
      B: "Finish a project before starting a new one."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q12.mp3'
  },
  {
    id: 13,
    text: "When you meet a new person, do you prefer to:",
    options: {
      A: "Ask what they like to do and share things about yourself.",
      B: "Hang back a little to see what they're like first."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q13.mp3'
  },
  {
    id: 14,
    text: "If you had to solve a problem, would you rather:",
    options: {
      A: "Try a lot of different ways to solve it.",
      B: "Use a way that worked well for you before."
    },
    dimension: 'S/N',
    mapping: { A: 'N', B: 'S' },
    audioFile: 'q14.mp3'
  },
  {
    id: 15,
    text: "You usually make choices because:",
    options: {
      A: "It just feels right to you.",
      B: "It makes the most sense."
    },
    dimension: 'T/F',
    mapping: { A: 'F', B: 'T' },
    audioFile: 'q15.mp3'
  },
  {
    id: 16,
    text: "When you're playing or doing an activity, do you prefer:",
    options: {
      A: "To see what happens and go with the flow.",
      B: "To have some rules or guidelines to follow."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q16.mp3'
  },
  {
    id: 17,
    text: "At a party or gathering, would you rather:",
    options: {
      A: "Have deep conversations with one or two people.",
      B: "Meet lots of different people and chat with many."
    },
    dimension: 'E/I',
    mapping: { A: 'I', B: 'E' },
    audioFile: 'q17.mp3'
  },
  {
    id: 18,
    text: "If you could only have one, would you choose:",
    options: {
      A: "A detailed instruction manual for everything.",
      B: "The freedom to figure things out on your own."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q18.mp3'
  },
  {
    id: 19,
    text: "When someone you care about is upset, what's your first thought?",
    options: {
      A: "How can I help them feel better?",
      B: "What can we do to fix this problem?"
    },
    dimension: 'T/F',
    mapping: { A: 'F', B: 'T' },
    audioFile: 'q19.mp3'
  },
  {
    id: 20,
    text: "On weekends, do you prefer to:",
    options: {
      A: "Make plans and stick to them.",
      B: "See what you feel like doing when the time comes."
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q20.mp3'
  },
  {
    id: 21,
    text: "Would you rather spend time:",
    options: {
      A: "In a quiet place where you can think.",
      B: "In a busy place with lots of people around."
    },
    dimension: 'E/I',
    mapping: { A: 'I', B: 'E' },
    audioFile: 'q21.mp3'
  },
  {
    id: 22,
    text: "When learning something new, do you prefer:",
    options: {
      A: "Learning the basics first, then building on them.",
      B: "Getting the big picture first, then filling in the details."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q22.mp3'
  },
  {
    id: 23,
    text: "What's more important to you when making a decision?",
    options: {
      A: "Being fair and treating everyone equally.",
      B: "Being kind and considering people's feelings."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q23.mp3'
  },
  {
    id: 24,
    text: "When you're working on something, do you prefer to:",
    options: {
      A: "Take breaks and come back to it later.",
      B: "Work on it until it's completely finished."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q24.mp3'
  },
  {
    id: 25,
    text: "Do you get more energy from:",
    options: {
      A: "Being around people and doing things together.",
      B: "Having time alone to think and recharge."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q25.mp3'
  },
  {
    id: 26,
    text: "When you read a story, do you prefer:",
    options: {
      A: "Stories about real life and things that could actually happen.",
      B: "Fantasy stories with magic and imaginary worlds."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q26.mp3'
  },
  {
    id: 27,
    text: "Which would bother you more?",
    options: {
      A: "Someone being mean or unkind to others.",
      B: "Someone not following the rules or being unfair."
    },
    dimension: 'T/F',
    mapping: { A: 'F', B: 'T' },
    audioFile: 'q27.mp3'
  },
  {
    id: 28,
    text: "When you clean your room, do you:",
    options: {
      A: "Put everything in its specific place.",
      B: "Get it \"clean enough\" and move on to something else."
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q28.mp3'
  },
  {
    id: 29,
    text: "At school, would you rather:",
    options: {
      A: "Work quietly by yourself.",
      B: "Work with a group or partner."
    },
    dimension: 'E/I',
    mapping: { A: 'I', B: 'E' },
    audioFile: 'q29.mp3'
  },
  {
    id: 30,
    text: "If you could invent something, would you create:",
    options: {
      A: "Something useful that solves a real problem.",
      B: "Something completely new that no one has thought of before."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q30.mp3'
  },
  {
    id: 31,
    text: "What matters more to you?",
    options: {
      A: "Being honest, even if it might hurt someone's feelings.",
      B: "Being gentle and kind, even if you can't say everything you think."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q31.mp3'
  },
  {
    id: 32,
    text: "Do you prefer teachers who:",
    options: {
      A: "Give you exact instructions and clear expectations.",
      B: "Let you be creative and find your own way to do things."
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q32.mp3'
  },
  {
    id: 33,
    text: "After school, would you rather:",
    options: {
      A: "Hang out with friends or family.",
      B: "Have some alone time to do your own thing."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q33.mp3'
  },
  {
    id: 34,
    text: "When someone explains something to you, do you prefer they:",
    options: {
      A: "Give you step-by-step details.",
      B: "Give you the main idea and let you figure out the details."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q34.mp3'
  },
  {
    id: 35,
    text: "What's more important when solving a problem with friends?",
    options: {
      A: "Finding the right answer.",
      B: "Making sure everyone feels heard and included."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q35.mp3'
  },
  {
    id: 36,
    text: "Do you prefer activities that:",
    options: {
      A: "Have clear start and end times.",
      B: "You can start and stop whenever you want."
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q36.mp3'
  },
  {
    id: 37,
    text: "Which sounds more appealing to you?",
    options: {
      A: "Going to a big party with lots of people.",
      B: "Having a quiet movie night with your best friend."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q37.mp3'
  },
  {
    id: 38,
    text: "When you daydream, do you usually think about:",
    options: {
      A: "Things you want to do or places you want to go.",
      B: "Imaginary worlds or creative ideas."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q38.mp3'
  },
  {
    id: 39,
    text: "If your friend did something wrong, would you:",
    options: {
      A: "Tell them what they did and why it was wrong.",
      B: "Try to understand why they did it and help them feel better."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q39.mp3'
  },
  {
    id: 40,
    text: "When you're working on a long project, do you prefer to:",
    options: {
      A: "Work on it a little bit at a time as you feel like it.",
      B: "Make a schedule and stick to it."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q40.mp3'
  }
];

export const getQuestionsByDimension = (dimension: 'E/I' | 'S/N' | 'T/F' | 'J/P' | 'VARK'): Question[] => {
  return questions.filter(q => q.dimension === dimension);
};

export const getTotalQuestions = (): number => {
  return questions.length;
};

export const validateQuestionBalance = () => {
  const dimensions = ['E/I', 'S/N', 'T/F', 'J/P'] as const;
  const counts = dimensions.map(dim => ({
    dimension: dim,
    count: getQuestionsByDimension(dim).length
  }));
  
  console.log('Question distribution by dimension:', counts);
  return counts;
};

export const getLearningStyleQuestions = (): Question[] => {
  return questions.filter(q => q.dimension === 'VARK');
};