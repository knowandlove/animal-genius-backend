import { Request, Response } from "express";
import { db } from "../db";
import { quizSubmissions, classes } from "../../shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  }
});

// Personality to Animal mapping
const PERSONALITY_TO_ANIMAL: Record<string, string> = {
  "ESTJ": "Meerkat",
  "ISFJ": "Panda", 
  "INTJ": "Owl",
  "ISTJ": "Beaver",
  "ESFJ": "Elephant",
  "ENFP": "Otter",
  "ESFP": "Parrot",
  "ENFJ": "Border Collie"
};

const ANIMAL_GENIUS_TYPES = ["Feeler", "Thinker", "Intuitive", "Sensor"];

interface StudentData {
  firstName: string;
  lastInitial: string;
  gradeLevel?: string;
  personalityType: string;
}

/**
 * Parse CSV content
 */
function parseCSV(csvContent: string): StudentData[] {
  const lines = csvContent.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error("CSV file must have at least a header row and one data row");
  }
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const students: StudentData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    
    if (values.length !== headers.length) {
      continue; // Skip invalid rows
    }
    
    const student: StudentData = {
      firstName: values[headers.indexOf('firstName')],
      lastInitial: values[headers.indexOf('lastInitial')],
      gradeLevel: values[headers.indexOf('gradeLevel')] || '5th Grade',
      personalityType: values[headers.indexOf('personalityType')]
    };
    
    // Validate personality type
    if (!PERSONALITY_TO_ANIMAL[student.personalityType]) {
      continue; // Skip invalid personality types
    }
    
    students.push(student);
  }
  
  return students;
}

/**
 * Generate random VARK learning style scores
 */
function generateRandomVARKScores() {
  const scores = {
    Visual: Math.floor(Math.random() * 16) + 1,
    Auditory: Math.floor(Math.random() * 16) + 1,
    "Reading/Writing": Math.floor(Math.random() * 16) + 1,
    Kinesthetic: Math.floor(Math.random() * 16) + 1
  };
  
  const primaryStyle = Object.entries(scores)
    .reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
  
  return { scores, primaryStyle };
}

/**
 * Generate random MBTI scores based on personality type
 */
function generateMBTIScores(personalityType: string) {
  const [ei, sn, tf, jp] = personalityType.split('');
  
  return {
    "E/I": ei === 'E' ? Math.floor(Math.random() * 10) + 11 : Math.floor(Math.random() * 10) + 1,
    "S/N": sn === 'S' ? Math.floor(Math.random() * 10) + 11 : Math.floor(Math.random() * 10) + 1,
    "T/F": tf === 'T' ? Math.floor(Math.random() * 10) + 11 : Math.floor(Math.random() * 10) + 1,
    "J/P": jp === 'J' ? Math.floor(Math.random() * 10) + 11 : Math.floor(Math.random() * 10) + 1
  };
}

/**
 * Generate sample answers array (16 questions)
 */
function generateSampleAnswers(personalityType: string) {
  const answers = [];
  const [ei, sn, tf, jp] = personalityType.split('');
  
  for (let i = 1; i <= 16; i++) {
    let answer;
    
    if (i <= 4) answer = ei === 'E' ? 'a' : 'b';
    else if (i <= 8) answer = sn === 'S' ? 'a' : 'b';
    else if (i <= 12) answer = tf === 'T' ? 'a' : 'b';
    else answer = jp === 'J' ? 'a' : 'b';
    
    // Add some randomness (20% chance to pick opposite)
    if (Math.random() < 0.2) {
      answer = answer === 'a' ? 'b' : 'a';
    }
    
    answers.push({
      questionId: i,
      answer: answer,
      timestamp: new Date().toISOString()
    });
  }
  
  return answers;
}

/**
 * Handle CSV import endpoint
 */
export async function handleImportStudents(req: Request, res: Response) {
  try {
    const classId = req.params.id;
    
    // Verify the class exists and belongs to the teacher
    const classResult = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);
    
    if (classResult.length === 0) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    const classData = classResult[0];
    
    // Check if teacher owns this class
    const userId = (req as any).user?.userId;
    if (classData.teacherId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    
    // Parse CSV from uploaded file
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const csvContent = req.file.buffer.toString('utf-8');
    const students = parseCSV(csvContent);
    
    if (students.length === 0) {
      return res.status(400).json({ message: "No valid students found in CSV" });
    }
    
    // Import each student
    const importedStudents = [];
    
    for (const student of students) {
      const varkResults = generateRandomVARKScores();
      const mbtiScores = generateMBTIScores(student.personalityType);
      const answers = generateSampleAnswers(student.personalityType);
      const animalType = PERSONALITY_TO_ANIMAL[student.personalityType];
      const animalGenius = ANIMAL_GENIUS_TYPES[Math.floor(Math.random() * ANIMAL_GENIUS_TYPES.length)];
      
      const studentName = `${student.firstName} ${student.lastInitial}`;
      
      const submission = {
        classId: classId,
        studentName: studentName,
        gradeLevel: student.gradeLevel || "5th Grade",
        answers: answers,
        personalityType: student.personalityType,
        animalType: animalType,
        animalGenius: animalGenius,
        scores: mbtiScores,
        learningStyle: varkResults.primaryStyle,
        learningScores: varkResults.scores,
        completedAt: new Date()
      };
      
      await db.insert(quizSubmissions).values(submission);
      
      importedStudents.push({
        name: studentName,
        personalityType: student.personalityType,
        animalType: animalType,
        learningStyle: varkResults.primaryStyle
      });
    }
    
    res.json({
      message: `Successfully imported ${importedStudents.length} students`,
      students: importedStudents
    });
    
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ 
      message: "Failed to import students",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Export the configured multer middleware
export const uploadCSV = upload.single('csvFile');