export interface Lesson {
  id: number;
  title: string;
  duration: string;
  description: string;
  objectives: string[];
  materialsNeeded: string[];
  activities: {
    activity1: Activity;
    activity2: Activity;
    activity3: Activity;
    activity4: Activity;
  };
}

export interface Activity {
  title: string;
  optional?: boolean;
  steps: ActivityStep[];
}

export interface ActivityStep {
  instruction: string;
  tips?: string[];
  guidingQuestions?: string[];
}

export const lessons: Lesson[] = [
  {
    id: 1,
    title: "Taking the Animal Genius Quiz®",
    duration: "60 minutes",
    description: "Students take the interactive Animal Genius Quiz® to discover their personality animal and begin understanding their unique traits.",
    objectives: [
      "Students will complete the Animal Genius Personality Quiz®",
      "Students will discover their personality animal",
      "Students will begin to understand personality differences",
      "Students will create visual representations of their animal identity"
    ],
    materialsNeeded: [
      "Computers/tablets for quiz access",
      "Class code for quiz access",
      "Table tent templates",
      "Markers, colored pencils, crayons",
      "Knowing and Loving, Me! worksheet (optional)",
      "Parent letter and Family Zoo worksheet (optional)"
    ],
    activities: {
      activity1: {
        title: "Take the Animal Genius Quiz®",
        steps: [
          {
            instruction: "Play Student-facing video [LINK TO A POP UP VIDEO TEACHERS CAN DRAG TO PROJECTOR SCREEN TO SHOW KIDS]"
          },
          {
            instruction: "Open the Quiz Results Live View to display real-time quiz results on your projector screen",
            tips: [
              "Click the 'Quiz Results Live View' button to open in a new tab",
              "Drag the tab to your projector screen for students to see",
              "Watch as student results appear in real-time as they complete the quiz"
            ]
          },
          {
            instruction: "Students take the Animal Genius Quiz® individually (15-20 min)",
            tips: [
              "Remind students: there are no wrong answers, just be honest about their answers. Do not answer based on what their parents, friends or teacher would want them to say"
            ]
          },
          {
            instruction: "Students receive their animal type + results description"
          },
          {
            instruction: "Prompt students to read and reflect",
            guidingQuestions: [
              "What part feels most true?",
              "What parts can you relate to?",
              "What parts are not true for you?"
            ]
          }
        ]
      },
      activity2: {
        title: "Decorate Table Tents",
        steps: [
          {
            instruction: "Pass out Table Tent templates"
          },
          {
            instruction: "Offer supplies: markers, colored pencils, crayons, etc.",
            tips: [
              "Encourage creativity and design"
            ]
          },
          {
            instruction: "Let students decorate their Table Tents"
          },
          {
            instruction: "Optional: Do a classroom gallery walk or table group discussions"
          }
        ]
      },
      activity3: {
        title: "Knowing and Loving, Me! Worksheet",
        optional: true,
        steps: [
          {
            instruction: "Hand out the 'Knowing and Loving, Me!' worksheet"
          },
          {
            instruction: "Invite students to thoughtfully respond to the prompts, using insights from their Animal Genius Quiz® results",
            tips: [
              "If you'd prefer a printed version of each Animal Genius animal profile for students to reference while they work, downloadable PDFs are available in the Resource tab"
            ]
          }
        ]
      },
      activity4: {
        title: "Take Home Activity - Who's in My Family Zoo?",
        optional: true,
        steps: [
          {
            instruction: "Send home a Parent Letter introducing the Animal Genius Quiz and explaining how it supports self-awareness and classroom culture. A ready-to-use example letter is available in the Resource tab—just download, customize if desired, and print or send digitally."
          },
          {
            instruction: "Include the \"Who's in My Family Zoo?\" worksheet for students to complete at home with their family."
          },
          {
            instruction: "When students return the worksheet, invite them to share one insight or fun reflection they discovered about their \"family zoo.\" This simple share-out strengthens classroom connection and reinforces the language of personality and self-awareness."
          }
        ]
      }
    }
  },
  {
    id: 2,
    title: "Building Our Classroom Community",
    duration: "45 minutes",
    description: "Students work together to create classroom norms and build a supportive community that values all personality types.",
    objectives: [
      "Students will contribute to creating classroom norms",
      "Students will understand how to support different personality types",
      "Students will practice inclusive communication"
    ],
    materialsNeeded: [
      "Poster board for classroom norms",
      "Markers and art supplies",
      "Sticky notes"
    ],
    activities: {
      activity1: {
        title: "Activity 1",
        steps: [{ instruction: "Coming soon" }]
      },
      activity2: {
        title: "Activity 2",
        steps: [{ instruction: "Coming soon" }]
      },
      activity3: {
        title: "Activity 3",
        steps: [{ instruction: "Coming soon" }]
      },
      activity4: {
        title: "Activity 4",
        steps: [{ instruction: "Coming soon" }]
      }
    }
  },
  {
    id: 3,
    title: "Understanding Your Animal Personality",
    duration: "45 minutes",
    description: "Students explore their animal personalities in depth, learning about their unique strengths and how to work with others.",
    objectives: [
      "Students will understand the characteristics of their personality animal",
      "Students will identify their personal strengths and growth areas",
      "Students will learn how different animals work together"
    ],
    materialsNeeded: [
      "Animal personality cards or printouts",
      "Strength identification worksheet",
      "Team building activity materials"
    ],
    activities: {
      activity1: {
        title: "Activity 1",
        steps: [{ instruction: "Coming soon" }]
      },
      activity2: {
        title: "Activity 2",
        steps: [{ instruction: "Coming soon" }]
      },
      activity3: {
        title: "Activity 3",
        steps: [{ instruction: "Coming soon" }]
      },
      activity4: {
        title: "Activity 4",
        steps: [{ instruction: "Coming soon" }]
      }
    }
  },
  {
    id: 4,
    title: "Leadership and Teamwork",
    duration: "40 minutes",
    description: "Students learn how different personality types contribute to leadership and teamwork in unique ways.",
    objectives: [
      "Students will recognize different leadership styles",
      "Students will practice collaborative problem-solving",
      "Students will appreciate diverse contributions to team success"
    ],
    materialsNeeded: [
      "Team challenge materials",
      "Leadership style cards",
      "Reflection journals"
    ],
    activities: {
      activity1: {
        title: "Activity 1",
        steps: [{ instruction: "Coming soon" }]
      },
      activity2: {
        title: "Activity 2",
        steps: [{ instruction: "Coming soon" }]
      },
      activity3: {
        title: "Activity 3",
        steps: [{ instruction: "Coming soon" }]
      },
      activity4: {
        title: "Activity 4",
        steps: [{ instruction: "Coming soon" }]
      }
    }
  },
  {
    id: 5,
    title: "Discovering Your Genius Type",
    duration: "50 minutes",
    description: "Students explore their genius types and learn how different types of intelligence contribute to problem-solving and creativity.",
    objectives: [
      "Students will understand the concept of multiple intelligences",
      "Students will identify their genius type and its characteristics",
      "Students will explore careers and activities that match their genius type"
    ],
    materialsNeeded: [
      "Genius type descriptions and cards",
      "Intelligence exploration stations",
      "Career connection worksheets"
    ],
    activities: {
      activity1: {
        title: "Activity 1",
        steps: [{ instruction: "Coming soon" }]
      },
      activity2: {
        title: "Activity 2",
        steps: [{ instruction: "Coming soon" }]
      },
      activity3: {
        title: "Activity 3",
        steps: [{ instruction: "Coming soon" }]
      },
      activity4: {
        title: "Activity 4",
        steps: [{ instruction: "Coming soon" }]
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
