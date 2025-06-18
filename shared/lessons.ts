export interface Lesson {
  id: number;
  title: string;
  duration: string;
  description: string;
  objectives: string[];
  materialsNeeded: string[];
  sections: {
    overview: LessonSection;
    engage: LessonSection;
    explore: LessonSection;
    explain: LessonSection;
    elaborate: LessonSection;
  };
}

export interface LessonSection {
  title: string;
  content: string[];
  sayStatements: string[];
  activities: string[];
}

export const lessons: Lesson[] = [
  {
    id: 1,
    title: "Self-Awareness Pre-Assessment",
    duration: "20 minutes",
    description: "Students complete a printed pre-assessment worksheet to establish their current level of self-awareness before beginning the personality journey.",
    objectives: [
      "Students will reflect on their current understanding of self-awareness",
      "Students will complete a baseline assessment for future comparison",
      "Students will be introduced to the concept of personal growth"
    ],
    materialsNeeded: [
      "Printed pre-assessment worksheets (one per student)",
      "Pencils or pens",
      "Quiet classroom environment",
      "Timer for activities"
    ],
    sections: {
      overview: {
        title: "Lesson Overview",
        content: [
          "This lesson serves as the foundation for the entire self-discovery journey.",
          "Students will take a pre-assessment to measure their current self-awareness levels.",
          "The results will be used to track growth throughout the program."
        ],
        sayStatements: [
          "Today we're starting an exciting journey of self-discovery!",
          "We'll begin by taking a quick assessment to see where you are right now.",
          "This isn't a test with right or wrong answers - it's about understanding yourself better."
        ],
        activities: [
          "Introduction to self-awareness concepts",
          "Pre-assessment completion",
          "Brief reflection discussion"
        ]
      },
      engage: {
        title: "Engage",
        content: [
          "Begin with a warm-up discussion about what students already know about themselves.",
          "Introduce the concept of self-awareness in kid-friendly terms.",
          "Create excitement about the learning journey ahead."
        ],
        sayStatements: [
          "Raise your hand if you think you know yourself pretty well!",
          "Self-awareness means understanding your feelings, thoughts, and actions.",
          "Today we're going to discover just how much you already know about yourself."
        ],
        activities: [
          "Circle discussion about personal strengths",
          "Quick partner share about favorite activities",
          "Introduction to the Animal Genius journey"
        ]
      },
      explore: {
        title: "Explore",
        content: [
          "Students complete the pre-assessment independently.",
          "Encourage honest, thoughtful responses.",
          "Provide support for students who need help reading questions."
        ],
        sayStatements: [
          "Answer as honestly as you can - there are no wrong answers.",
          "Take your time and think about each question carefully.",
          "If you need help understanding a question, please raise your hand."
        ],
        activities: [
          "Individual pre-assessment completion",
          "Quiet reflection time",
          "Teacher circulation for support"
        ]
      },
      explain: {
        title: "Explain",
        content: [
          "After completion, explain that this assessment helps us understand starting points.",
          "Discuss how everyone has different strengths and areas for growth.",
          "Introduce the upcoming Animal Genius Quiz as the next step."
        ],
        sayStatements: [
          "This assessment shows us where you are right now in your self-awareness journey.",
          "Everyone has different strengths - that's what makes our class special!",
          "Next time, we'll take the Animal Genius Quiz to discover your personality animal."
        ],
        activities: [
          "Brief explanation of assessment purpose",
          "Preview of upcoming lessons",
          "Excitement building for animal discovery"
        ]
      },
      elaborate: {
        title: "Elaborate",
        content: [
          "Students reflect on the assessment experience.",
          "Discuss any questions or thoughts that came up.",
          "Set intentions for the learning journey ahead."
        ],
        sayStatements: [
          "How did it feel to think about yourself in this way?",
          "What question made you think the hardest?",
          "I'm excited to see how much you'll learn about yourselves!"
        ],
        activities: [
          "Group reflection on assessment experience",
          "Goal setting for personal growth",
          "Anticipation building for next lesson"
        ]
      }
    }
  },
  {
    id: 2,
    title: "Taking the Animal Genius Quiz®",
    duration: "60 minutes",
    description: "Students take the interactive Animal Genius Quiz to discover their personality animal and begin understanding their unique traits.",
    objectives: [
      "Students will complete the Animal Genius Personality Quiz",
      "Students will discover their personality animal",
      "Students will begin to understand personality differences"
    ],
    materialsNeeded: [
      "Computers/tablets for quiz access",
      "Class code for quiz access",
      "Celebration materials for results"
    ],
    sections: {
      overview: {
        title: "Lesson Overview",
        content: [
          "Students take the comprehensive personality quiz to discover their animal type.",
          "Each student receives personalized results showing their unique personality traits.",
          "The lesson culminates in celebrating each student's individual animal personality."
        ],
        sayStatements: [
          "Today is the big day - you'll discover your personality animal!",
          "Remember, every animal has amazing qualities and strengths.",
          "Your animal doesn't limit you - it helps you understand yourself better."
        ],
        activities: [
          "Quiz instruction and setup",
          "Individual quiz completion",
          "Results celebration and sharing"
        ]
      },
      engage: {
        title: "Engage",
        content: [
          "Build excitement about discovering their personality animal.",
          "Review the 16 different animal possibilities briefly.",
          "Address any concerns about quiz-taking or results."
        ],
        sayStatements: [
          "Are you ready to meet your personality animal?",
          "There are 16 amazing animals you could be - each one is special!",
          "Remember, this quiz helps us understand how we naturally think and act."
        ],
        activities: [
          "Animal preview discussion",
          "Quiz expectations setting",
          "Excitement building activities"
        ]
      },
      explore: {
        title: "Explore",
        content: [
          "Students log into the quiz using the class code.",
          "Provide guidance on answering questions honestly.",
          "Circulate to offer technical and emotional support."
        ],
        sayStatements: [
          "Choose the answer that feels most true to you most of the time.",
          "Don't think too hard - go with your first instinct.",
          "Take your time, but don't overthink each question."
        ],
        activities: [
          "Quiz login and setup",
          "Individual question completion",
          "Progress monitoring and support"
        ]
      },
      explain: {
        title: "Explain",
        content: [
          "Students receive their animal results with detailed descriptions.",
          "Explain that their animal represents their natural preferences.",
          "Emphasize that all animals have valuable contributions to make."
        ],
        sayStatements: [
          "Your animal shows how you naturally prefer to think and act.",
          "Every animal brings something important to our classroom community.",
          "This is just the beginning of understanding your amazing personality!"
        ],
        activities: [
          "Results review and explanation",
          "Animal trait discussion",
          "Questions and clarification time"
        ]
      },
      elaborate: {
        title: "Elaborate",
        content: [
          "Students share their animals with the class if comfortable.",
          "Begin noticing personality diversity in the classroom.",
          "Start thinking about how different animals work together."
        ],
        sayStatements: [
          "Who would like to share their animal with the class?",
          "Look at all the different animals in our classroom zoo!",
          "How might different animals help each other and work together?"
        ],
        activities: [
          "Voluntary animal sharing circle",
          "Classroom diversity celebration",
          "Teamwork and collaboration discussion"
        ]
      }
    }
  }
];

export function getLessonById(id: number): Lesson | undefined {
  return lessons.find(lesson => lesson.id === id);
}

export function getAllLessons(): Lesson[] {
  return lessons;
}