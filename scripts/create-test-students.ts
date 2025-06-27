import { db } from "../server/db";
import { students, quizSubmissions, currencyTransactions, classes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { uuidStorage } from "../server/storage-uuid";

// Test data for creating varied students
const testStudents = [
  { name: "Emma Johnson", grade: "7th Grade", mbti: "INFP", animal: "Meerkat", learningStyle: "visual" },
  { name: "Liam Smith", grade: "8th Grade", mbti: "ESTJ", animal: "Border Collie", learningStyle: "kinesthetic" },
  { name: "Olivia Brown", grade: "7th Grade", mbti: "ENFJ", animal: "Elephant", learningStyle: "auditory" },
  { name: "Noah Davis", grade: "6th Grade", mbti: "ISTP", animal: "Owl", learningStyle: "readingWriting" },
  { name: "Ava Wilson", grade: "8th Grade", mbti: "ESFP", animal: "Otter", learningStyle: "kinesthetic" },
  { name: "Ethan Moore", grade: "7th Grade", mbti: "INTJ", animal: "Panda", learningStyle: "visual" },
  { name: "Sophia Taylor", grade: "6th Grade", mbti: "ENFP", animal: "Parrot", learningStyle: "auditory" },
  { name: "Mason Anderson", grade: "8th Grade", mbti: "ISFJ", animal: "Beaver", learningStyle: "readingWriting" },
  { name: "Isabella Thomas", grade: "7th Grade", mbti: "ESTP", animal: "Otter", learningStyle: "kinesthetic" },
  { name: "William Jackson", grade: "6th Grade", mbti: "INFJ", animal: "Panda", learningStyle: "visual" },
  { name: "Mia White", grade: "8th Grade", mbti: "ENTP", animal: "Parrot", learningStyle: "auditory" },
  { name: "James Harris", grade: "7th Grade", mbti: "ISTJ", animal: "Beaver", learningStyle: "readingWriting" },
  { name: "Charlotte Martin", grade: "6th Grade", mbti: "ISFP", animal: "Meerkat", learningStyle: "visual" },
  { name: "Benjamin Garcia", grade: "8th Grade", mbti: "ENTJ", animal: "Border Collie", learningStyle: "kinesthetic" },
  { name: "Amelia Martinez", grade: "7th Grade", mbti: "ESFJ", animal: "Elephant", learningStyle: "auditory" },
  { name: "Lucas Rodriguez", grade: "6th Grade", mbti: "INTP", animal: "Owl", learningStyle: "readingWriting" },
  { name: "Harper Lee", grade: "8th Grade", mbti: "INFP", animal: "Meerkat", learningStyle: "visual" },
  { name: "Henry Lopez", grade: "7th Grade", mbti: "ESTJ", animal: "Border Collie", learningStyle: "kinesthetic" },
  { name: "Evelyn Gonzalez", grade: "6th Grade", mbti: "ENFJ", animal: "Elephant", learningStyle: "auditory" },
  { name: "Alexander Hernandez", grade: "8th Grade", mbti: "ISTP", animal: "Owl", learningStyle: "readingWriting" }
];

// Function to generate MBTI scores based on type
function generateScoresForMBTI(mbtiType: string) {
  const scores = {
    E: 5, I: 5,
    S: 5, N: 5,
    T: 5, F: 5,
    J: 5, P: 5
  };

  // Set scores based on MBTI type with some variation
  const variation = () => Math.floor(Math.random() * 3) + 1; // 1-3 variation

  if (mbtiType.includes('E')) {
    scores.E = 7 + variation();
    scores.I = 10 - scores.E;
  } else {
    scores.I = 7 + variation();
    scores.E = 10 - scores.I;
  }

  if (mbtiType.includes('S')) {
    scores.S = 7 + variation();
    scores.N = 10 - scores.S;
  } else {
    scores.N = 7 + variation();
    scores.S = 10 - scores.N;
  }

  if (mbtiType.includes('T')) {
    scores.T = 7 + variation();
    scores.F = 10 - scores.T;
  } else {
    scores.F = 7 + variation();
    scores.T = 10 - scores.F;
  }

  if (mbtiType.includes('J')) {
    scores.J = 7 + variation();
    scores.P = 10 - scores.J;
  } else {
    scores.P = 7 + variation();
    scores.J = 10 - scores.P;
  }

  return scores;
}

// Function to generate learning style scores
function generateLearningScores(primaryStyle: string) {
  const scores = {
    visual: 5,
    auditory: 5,
    kinesthetic: 5,
    readingWriting: 5
  };

  // Set primary learning style to be highest
  scores[primaryStyle as keyof typeof scores] = 8 + Math.floor(Math.random() * 3); // 8-10

  // Set other scores randomly between 3-7
  Object.keys(scores).forEach(style => {
    if (style !== primaryStyle) {
      scores[style as keyof typeof scores] = 3 + Math.floor(Math.random() * 5);
    }
  });

  return scores;
}

// Function to map animal to genius type
function getGeniusType(animal: string): string {
  const geniusMap: Record<string, string> = {
    "Meerkat": "Creative Genius",
    "Panda": "Strategic Genius",
    "Owl": "Analytical Genius",
    "Beaver": "Organizational Genius",
    "Elephant": "Social Genius",
    "Otter": "Action Genius",
    "Parrot": "Innovative Genius",
    "Border Collie": "Leadership Genius"
  };
  return geniusMap[animal] || "Unknown Genius";
}

async function createTestStudents() {
  try {
    console.log("🎓 Starting test student creation...");

    // First, get the first class (you mentioned you created one)
    const allClasses = await db.select().from(classes);
    
    if (allClasses.length === 0) {
      console.error("❌ No classes found! Please create a class first.");
      return;
    }

    const targetClass = allClasses[0]; // Use the first class
    console.log(`📚 Using class: ${targetClass.name} (${targetClass.passportCode})`);

    let successCount = 0;

    // Create each test student
    for (const testStudent of testStudents) {
      try {
        console.log(`Creating student: ${testStudent.name}...`);

        // Create student
        const student = await uuidStorage.createStudent({
          classId: targetClass.id,
          studentName: testStudent.name,
          gradeLevel: testStudent.grade,
          personalityType: testStudent.mbti,
          animalType: testStudent.animal,
          animalGenius: getGeniusType(testStudent.animal),
          learningStyle: testStudent.learningStyle
        });

        // Create quiz submission
        const scores = generateScoresForMBTI(testStudent.mbti);
        const learningScores = generateLearningScores(testStudent.learningStyle);

        const submission = await uuidStorage.submitQuizAndAwardCoins(
          {
            studentId: student.id,
            animalType: testStudent.animal,
            geniusType: getGeniusType(testStudent.animal),
            answers: {
              personalityType: testStudent.mbti,
              learningStyle: testStudent.learningStyle,
              learningScores: learningScores,
              scores: scores,
              gradeLevel: testStudent.grade,
              // Add some sample answers
              questions: Array(20).fill(null).map((_, i) => ({
                questionId: `q${i + 1}`,
                answer: Math.random() > 0.5 ? 'a' : 'b'
              }))
            },
            coinsEarned: 50,
          },
          {
            studentId: student.id,
            teacherId: targetClass.teacherId,
            amount: 50,
            transactionType: 'quiz_complete',
            description: 'Quiz completion reward',
          }
        );

        // Add some random bonus coins for variety (10-30% of students)
        if (Math.random() < 0.3) {
          const bonusAmount = Math.floor(Math.random() * 50) + 10; // 10-60 bonus coins
          await uuidStorage.createCurrencyTransaction({
            studentId: student.id,
            teacherId: targetClass.teacherId,
            amount: bonusAmount,
            transactionType: 'teacher_gift',
            description: 'Good behavior bonus',
          });
        }

        console.log(`✅ Created ${testStudent.name} - ${testStudent.animal} (${testStudent.mbti}) - Passport: ${student.passportCode}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to create ${testStudent.name}:`, error);
      }
    }

    console.log(`\n🎉 Successfully created ${successCount} out of ${testStudents.length} test students!`);
    console.log(`📊 Class "${targetClass.name}" now has ${successCount} students with varied personalities and learning styles.`);

  } catch (error) {
    console.error("❌ Error creating test students:", error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createTestStudents();
