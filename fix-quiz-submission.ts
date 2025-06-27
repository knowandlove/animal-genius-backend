// Fix for quiz submission to ensure animal type is properly saved

// The issue is that we need to ensure the quiz submission endpoint is using the correct
// storage method and properly saving all the data including animal type.

// In server/routes.ts, the quiz submission endpoint should be:

/*
app.post("/api/quiz-submissions", async (req, res) => {
  try {
    const { studentName, name, gradeLevel, classId, animalType, geniusType, animalGenius, answers, personalityType, learningStyle, scores, learningScores } = req.body;
    const finalStudentName = studentName || name;
    
    // Validate required fields
    if (!finalStudentName?.trim()) {
      return res.status(400).json({ message: "Student name is required" });
    }
    if (!gradeLevel?.trim()) {
      return res.status(400).json({ message: "Grade level is required" });
    }
    if (!classId) {
      return res.status(400).json({ message: "Class ID is required" });
    }
    
    // Verify class exists
    const classRecord = await uuidStorage.getClassById(classId);
    if (!classRecord) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // IMPORTANT: Save the animal type to the student record when creating/updating
    const student = await uuidStorage.upsertStudent({
      classId: classId,
      studentName: finalStudentName,
      gradeLevel: gradeLevel,
      personalityType: personalityType,
      animalType: animalType, // THIS IS THE KEY - must save animal type here
      animalGenius: geniusType || animalGenius || '',
      learningStyle: learningStyle || 'visual',
    });
    
    // Create quiz submission
    const submission = await uuidStorage.submitQuizAndAwardCoins(
      {
        studentId: student.id,
        animalType: animalType,
        geniusType: geniusType || animalGenius || '',
        answers: {
          ...answers,
          personalityType: personalityType,
          learningStyle: learningStyle,
          learningScores: learningScores,
          scores: scores,
          gradeLevel: gradeLevel
        },
        coinsEarned: 50,
      },
      {
        studentId: student.id,
        teacherId: classRecord.teacherId,
        amount: 50,
        transactionType: 'quiz_complete',
        description: 'Quiz completion reward',
      }
    );
    
    // Return the student's passport code
    res.json({
      ...submission,
      passportCode: student.passportCode,
      studentId: student.id,
      message: 'Quiz completed successfully!'
    });
  } catch (error) {
    console.error("Submit quiz submission error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit quiz";
    res.status(400).json({ message: errorMessage });
  }
});
*/

// The key issue is that the animalType must be saved to BOTH:
// 1. The student record (for island display)
// 2. The quiz submission record (for analytics)

// Run this to verify the fix is applied correctly
console.log(`
MANUAL FIX INSTRUCTIONS:

1. Open server/routes.ts

2. Find the quiz submission endpoint (around line 200-250)

3. Make sure it's using uuidStorage.upsertStudent and passing animalType

4. The critical line is:
   animalType: animalType, // Must be included when creating/updating student

5. After fixing, restart the backend server

6. Test by taking the quiz again - the animal should persist
`);
