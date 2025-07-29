// Class Island routes - shows all students in a class
import type { Express } from "express";
import { db } from "../db";
import { students, classes, animalTypes, geniusTypes, quizSubmissions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireUnifiedAuth, requireStudent } from "../middleware/unified-auth";
import { getCache } from "../lib/cache-factory";

const cache = getCache();

interface ClassIslandStudent {
  id: string;
  passportCode: string;
  studentName: string;
  animalType: string;
  animalTypeId: string;
  geniusType: string;
  avatarData: any;
  roomVisibility: string;
  isOnline?: boolean;
  lastActive?: Date | null;
}

export function registerClassIslandRoutes(app: Express) {
  console.log('Registering class island routes...');
  
  // Test endpoint
  app.get("/api/test/class-island", (req, res) => {
    res.json({ message: "Class island routes are working!" });
  });
  
  // Public class island view - no auth required
  app.get("/api/class/:classCode/island", async (_req, res) => {
    try {
      const { classCode } = req.params;
      console.log('Class island request for code:', classCode);
      
      // Check cache first
      const cacheKey = `public-class-island:${classCode.toUpperCase()}`;
      // Temporarily disable cache for debugging
      // const cached = cache.get(cacheKey);
      // if (cached) {
      //   return res.json(cached);
      // }
      
      // Find class by code
      const [classData] = await db
        .select()
        .from(classes)
        .where(eq(classes.classCode, classCode.toUpperCase()))
        .limit(1);
      
      if (!classData) {
        console.log('Class not found for code:', classCode.toUpperCase());
        return res.status(404).json({ 
          message: "Class not found",
          suggestion: "Please check the class code your teacher provided" 
        });
      }
      
      console.log('Found class:', classData.name, 'with ID:', classData.id);
      
      // Get all students in the class (public info only)
      const studentsData = await db
        .select({
          id: students.id,
          passportCode: students.passportCode,
          studentName: students.studentName,
          animalTypeId: students.animalTypeId,
          animalType: animalTypes.name,
          geniusType: geniusTypes.name,
          avatarData: students.avatarData,
          roomVisibility: students.roomVisibility
        })
        .from(students)
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.classId, classData.id))
        .orderBy(students.studentName);
      
      console.log('Found students:', studentsData.length);
      
      // Format response - public view
      const island: ClassIslandStudent[] = studentsData.map(student => ({
        id: student.id,
        passportCode: student.passportCode,
        studentName: student.studentName || 'Unknown',
        animalType: student.animalType || 'Unknown',
        animalTypeId: student.animalTypeId || '',
        geniusType: student.geniusType || 'Unknown',
        avatarData: student.avatarData || {},
        roomVisibility: student.roomVisibility || 'class'
      }));
      
      const response = {
        classId: classData.id,
        className: classData.name,
        classCode: classData.classCode,
        students: island,
        stats: {
          totalStudents: island.length,
          visibleRooms: island.filter(s => s.roomVisibility === 'class').length
        },
        isPublicView: true
      };
      
      // Cache for 2 minutes
      cache.set(cacheKey, response, 120);
      
      console.log('Sending response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error("Get public class island error:", error);
      res.status(500).json({ message: "Failed to load class island" });
    }
  });
  
  // Get class island for teachers
  app.get("/api/classes/:classId/island", requireAuth, async (_req, res) => {
    try {
      const { classId } = req.params;
      const teacherId = req.user?.userId;
      
      // Verify teacher owns this class
      const [classData] = await db
        .select()
        .from(classes)
        .where(and(
          eq(classes.id, classId),
          eq(classes.teacherId, teacherId!)
        ))
        .limit(1);
      
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }
      
      // Get all students in the class
      const studentsData = await db
        .select({
          id: students.id,
          passportCode: students.passportCode,
          studentName: students.studentName,
          animalTypeId: students.animalTypeId,
          animalType: animalTypes.name,
          geniusTypeId: students.geniusTypeId,
          geniusType: geniusTypes.name,
          avatarData: students.avatarData,
          roomVisibility: students.roomVisibility,
          createdAt: students.createdAt,
          updatedAt: students.updatedAt
        })
        .from(students)
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.classId, classId))
        .orderBy(students.studentName);
      
      // Format response
      const island: ClassIslandStudent[] = studentsData.map(student => ({
        id: student.id,
        passportCode: student.passportCode,
        studentName: student.studentName || 'Unknown',
        animalType: student.animalType || 'Unknown',
        animalTypeId: student.animalTypeId || '',
        geniusType: student.geniusType || 'Unknown',
        avatarData: student.avatarData || {},
        roomVisibility: student.roomVisibility || 'class',
        // Could add online status based on recent activity
        lastActive: student.updatedAt
      }));
      
      res.json({
        classId: classData.id,
        className: classData.name,
        students: island,
        stats: {
          totalStudents: island.length,
          publicRooms: island.filter(s => s.roomVisibility === 'class').length,
          privateRooms: island.filter(s => s.roomVisibility === 'private').length
        }
      });
    } catch (error) {
      console.error("Get class island error:", error);
      res.status(500).json({ message: "Failed to load class island" });
    }
  });
  
  // Get class island for students (limited view)
  app.get("/api/room/my-class-island", requireUnifiedAuth, requireStudent, async (_req, res) => {
    try {
      const studentId = req.student?.id!;
      
      // Get the student's class info
      const [studentInfo] = await db
        .select({
          classId: students.classId,
          className: classes.name,
          studentPassportCode: students.passportCode
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(eq(students.id, studentId))
        .limit(1);
      
      if (!studentInfo) {
        return res.status(404).json({ message: "Class not found" });
      }
      
      // Cache key for this class
      const cacheKey = `class-island:${studentInfo.classId}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          currentStudent: studentInfo.studentPassportCode
        });
      }
      
      // Get all students in the same class
      const classmates = await db
        .select({
          id: students.id,
          passportCode: students.passportCode,
          studentName: students.studentName,
          animalTypeId: students.animalTypeId,
          animalType: animalTypes.name,
          geniusType: geniusTypes.name,
          avatarData: students.avatarData,
          roomVisibility: students.roomVisibility
        })
        .from(students)
        .leftJoin(animalTypes, eq(students.animalTypeId, animalTypes.id))
        .leftJoin(geniusTypes, eq(students.geniusTypeId, geniusTypes.id))
        .where(eq(students.classId, studentInfo.classId))
        .orderBy(students.studentName);
      
      // Format for student view (less data than teacher view)
      const island: ClassIslandStudent[] = classmates.map(student => ({
        id: student.id,
        passportCode: student.passportCode,
        studentName: student.studentName || 'Unknown',
        animalType: student.animalType || 'Unknown',
        animalTypeId: student.animalTypeId || '',
        geniusType: student.geniusType || 'Unknown',
        avatarData: student.avatarData || {},
        roomVisibility: student.roomVisibility || 'class'
      }));
      
      const response = {
        classId: studentInfo.classId,
        className: studentInfo.className,
        students: island,
        stats: {
          totalStudents: island.length,
          visibleRooms: island.filter(s => s.roomVisibility === 'class').length
        }
      };
      
      // Cache for 2 minutes
      cache.set(cacheKey, response, 120);
      
      res.json({
        ...response,
        currentStudent: studentInfo.studentPassportCode
      });
    } catch (error) {
      console.error("Get student class island error:", error);
      res.status(500).json({ message: "Failed to load class island" });
    }
  });
}