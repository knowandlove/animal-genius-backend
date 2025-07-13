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
    text: "A teacher assigns a group project. How do you want the info explained?",
    options: {
      A: "Seeing an example",
      B: "Talk me through it in a voice message or video",
      C: "Share a doc or written checklist I can follow",
      D: "Just trying it and figuring it out as I go"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
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
    text: "You need to study for a test. What's your ideal study method?",
    options: {
      A: "Picture it in your head",
      B: "Play review games with sound or listen to a recap",
      C: "Write it down or read over your notes",
      D: "Practice it or act it out"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
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
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q12.mp3'
  },
  {
    id: 13,
    text: "When you work on projects, which do you prefer?",
    options: {
      A: "Having input and help from others.",
      B: "Doing it all by yourself."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q13.mp3'
  },
  {
    id: 14,
    text: "What sounds more like you?",
    options: {
      A: "I notice things other people miss—like sounds, faces, or little changes.",
      B: "I come up with ideas and possibilities really fast."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q14.mp3'
  },
  {
    id: 15,
    text: "Which do you like more?",
    options: {
      A: "Competing against others.",
      B: "Working together with others."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q15.mp3'
  },
  {
    id: 16,
    text: "When you have a list of things to do, do you:",
    options: {
      A: "Follow a specific order like first 1, then 2, then 3.",
      B: "Do them in a more random order like 2, 5, 1, and sometimes get distracted by other things."
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q16.mp3'
  },
  {
    id: 17,
    text: "You want to learn how to code or use a new app. What do you prefer?",
    options: {
      A: "Watch a screen recording or demo",
      B: "Listen to a tutorial podcast or explainer",
      C: "Read a guide or step-by-step instructions",
      D: "Try coding right away and learn as you go"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q17.mp3'
  },
  {
    id: 18,
    text: "When you think about things, do you usually think:",
    options: {
      A: "In a factual and literal way?",
      B: "In a creative and imaginative way?"
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q18.mp3'
  },
  {
    id: 19,
    text: "If you saw another child being bullied, what would you likely do first?",
    options: {
      A: "Stand up against the bully and address their hurtful behavior.",
      B: "Check on the victim to make sure they're okay."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q19.mp3'
  },
  {
    id: 20,
    text: "When it comes to your room, do you tend to:",
    options: {
      A: "Keep it tidy and put things away where they belong.",
      B: "Keep things out where you can easily see and locate them."
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q20.mp3'
  },
  {
    id: 21,
    text: "Do you have...",
    options: {
      A: "A few close friends?",
      B: "Lots of friends?"
    },
    dimension: 'E/I',
    mapping: { A: 'I', B: 'E' },
    audioFile: 'q21.mp3'
  },
  {
    id: 22,
    text: "You're trying to learn how to fix something on your device. What's your first move?",
    options: {
      A: "Watch a quick how-to video",
      B: "Ask someone to explain it to you",
      C: "Google it and read the steps",
      D: "Start clicking around to figure it out"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q22.mp3'
  },
  {
    id: 23,
    text: "If a friend you care about is feeling sad, what would you be more likely to do?",
    options: {
      A: "Distract them through fun activities or jokes that would help them feel happier.",
      B: "Spend time listening and asking about the reasons behind their sadness and offer advice or solutions to help them deal with it."
    },
    dimension: 'T/F',
    mapping: { A: 'F', B: 'T' },
    audioFile: 'q23.mp3'
  },
  {
    id: 24,
    text: "When it comes to doing things, do you:",
    options: {
      A: "Like having a plan in place?",
      B: "Prefer the excitement of creating a plan on the spot as you go along?"
    },
    dimension: 'J/P',
    mapping: { A: 'J', B: 'P' },
    audioFile: 'q24.mp3'
  },
  {
    id: 25,
    text: "Choose the option that best describes you:",
    options: {
      A: "Talkative",
      B: "Quiet"
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q25.mp3'
  },
  {
    id: 26,
    text: "If someone changed all the family photos in your living room, would you notice right away?",
    options: {
      A: "Yes",
      B: "No"
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q26.mp3'
  },
  {
    id: 27,
    text: "When you're stuck on homework, how do you prefer to get help?",
    options: {
      A: "Watch a video that shows you how to do it",
      B: "Call or message someone who can explain it",
      C: "Read an example or search for written answers",
      D: "Try different ways until you figure it out"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q27.mp3'
  },
  {
    id: 28,
    text: "Do you tend to make decisions",
    options: {
      A: "Quickly?",
      B: "Thoughtfully?"
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q28.mp3'
  },
  {
    id: 29,
    text: "Pick the one that sounds more like you:",
    options: {
      A: "I usually take a moment to think before I do things.",
      B: "I usually just start doing things without thinking too much."
    },
    dimension: 'E/I',
    mapping: { A: 'I', B: 'E' },
    audioFile: 'q29.mp3'
  },
  {
    id: 30,
    text: "Which do you tend to do most often?",
    options: {
      A: "Daydream.",
      B: "Pay attention to the present moment."
    },
    dimension: 'S/N',
    mapping: { A: 'N', B: 'S' },
    audioFile: 'q30.mp3'
  },
  {
    id: 31,
    text: "How do you usually handle disagreements?",
    options: {
      A: "I prefer having a conversation to work out the problem.",
      B: "I prefer to avoid talking about it and just move on because it's uncomfortable."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q31.mp3'
  },
  {
    id: 32,
    text: "You join student council and are helping plan an event. What role sounds most fun to you?",
    options: {
      A: "Designing posters, slides, or the event setup so it looks amazing",
      B: "Making announcements or leading a discussion to get people excited",
      C: "Writing the schedule, budget, or checklist to keep everything organized",
      D: "Setting up the events, organizing supplies, or helping with hands-on stuff"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q32.mp3'
  },
  {
    id: 33,
    text: "If you had a $50 gift card to your favorite store, would you...",
    options: {
      A: "Choose what to buy quickly.",
      B: "Choose what to buy carefully."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q33.mp3'
  },
  {
    id: 34,
    text: "Which one is more like you?",
    options: {
      A: "I am talkative.",
      B: "I am soft-spoken."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q34.mp3'
  },
  {
    id: 35,
    text: "Which sounds more like you?",
    options: {
      A: "My brain jumps around with ideas—even when I'm not trying to.",
      B: "I stay aware of what's happening around me, like noises or people's moods."
    },
    dimension: 'S/N',
    mapping: { A: 'N', B: 'S' },
    audioFile: 'q35.mp3'
  },
  {
    id: 36,
    text: "If you are upset with a friend, would you...",
    options: {
      A: "Be direct and talk to your friend?",
      B: "Keep your feelings to yourself?"
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q36.mp3'
  },
  {
    id: 37,
    text: "In science class, what do you look forward to most?",
    options: {
      A: "Watching experiments",
      B: "Listening to the teacher explain interesting facts",
      C: "Reading about discoveries and taking notes",
      D: "Doing hands-on labs and experiments"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q37.mp3'
  },
  {
    id: 38,
    text: "When you're taking a test with a time limit and you start feeling pressured, do you...",
    options: {
      A: "Concentrate and push yourself to keep going.",
      B: "Find it hard to concentrate because you're feeling too stressed or flustered."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q38.mp3'
  },
  {
    id: 39,
    text: "At a party, are you more likely to:",
    options: {
      A: "Stay later and enjoy being with lots of people.",
      B: "Leave early because too many people make you tired."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q39.mp3'
  },
  {
    id: 40,
    text: "When you learn something new, do you prefer to:",
    options: {
      A: "Focus on the details and get them right.",
      B: "Understand the big picture first."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q40.mp3'
  },
  {
    id: 41,
    text: "When making decisions, what matters more to you?",
    options: {
      A: "What makes logical sense.",
      B: "How people will feel about it."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q41.mp3'
  },
  {
    id: 42,
    text: "Do you prefer to:",
    options: {
      A: "Keep your options open as long as possible.",
      B: "Make decisions quickly and stick with them."
    },
    dimension: 'J/P',
    mapping: { A: 'P', B: 'J' },
    audioFile: 'q42.mp3'
  },
  {
    id: 43,
    text: "You're learning about volcanoes. What sounds like the best way to learn?",
    options: {
      A: "Watching a video or seeing pictures",
      B: "Listening to someone explain it",
      C: "Reading an article or doing a worksheet",
      D: "Building a model and making it erupt"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q43.mp3'
  },
  {
    id: 44,
    text: "In social situations, do you:",
    options: {
      A: "Jump right into conversations.",
      B: "Wait for others to start talking to you."
    },
    dimension: 'E/I',
    mapping: { A: 'E', B: 'I' },
    audioFile: 'q44.mp3'
  },
  {
    id: 45,
    text: "When working on projects, you prefer:",
    options: {
      A: "Step-by-step instructions.",
      B: "Creative freedom to figure it out yourself."
    },
    dimension: 'S/N',
    mapping: { A: 'S', B: 'N' },
    audioFile: 'q45.mp3'
  },
  {
    id: 46,
    text: "What's more important to you?",
    options: {
      A: "Being honest, even if it might hurt someone's feelings.",
      B: "Being kind, even if it means not telling the whole truth."
    },
    dimension: 'T/F',
    mapping: { A: 'T', B: 'F' },
    audioFile: 'q46.mp3'
  },
  {
    id: 47,
    text: "You're learning about a big event in history. What helps it come alive for you?",
    options: {
      A: "Seeing maps, timelines, or photos from that time",
      B: "Listening to a story or watching a documentary",
      C: "Reading a textbook, article, or newspaper",
      D: "Reenacting it, building a model, or doing a simulation"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q47.mp3'
  },
  {
    id: 48,
    text: "You have to make a presentation for a class. What do you want to do?",
    options: {
      A: "Make a slideshow with pictures and graphics",
      B: "Talk about your topic or make a short video or podcast",
      C: "Write a report or design a handout with all the details",
      D: "Create something to show like a prototype, model, or interactive demo"
    },
    dimension: 'VARK',
    mapping: { A: 'visual', B: 'auditory', C: 'readingWriting', D: 'kinesthetic' },
    audioFile: 'q48.mp3'
  }
];

export const getQuestionsByDimension = (dimension: 'E/I' | 'S/N' | 'T/F' | 'J/P' | 'VARK'): Question[] => {
  return questions.filter(q => q.dimension === dimension);
};

export const getTotalQuestions = (): number => {
  return questions.length;
};

export const validateQuestionBalance = () => {
  const dimensions = ['E/I', 'S/N', 'T/F', 'J/P', 'VARK'] as const;
  const counts = dimensions.map(dim => ({
    dimension: dim,
    count: getQuestionsByDimension(dim).length
  }));
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Question distribution by dimension:', counts);
  }
  return counts;
};

export const getLearningStyleQuestions = (): Question[] => {
  return questions.filter(q => q.dimension === 'VARK');
};