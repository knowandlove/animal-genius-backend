// Fixed implementations for N+1 query problems in storage.ts

// Fix for getAllTeachers() - lines 371-396
async getAllTeachers(): Promise<(User & { classCount: number; submissionCount: number })[]> {
  // Single query to get teachers with both class count and submission count
  const teachersWithStats = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      password: users.password,
      schoolOrganization: users.schoolOrganization,
      roleTitle: users.roleTitle,
      howHeardAbout: users.howHeardAbout,
      personalityAnimal: users.personalityAnimal,
      isAdmin: users.isAdmin,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      classCount: sql<number>`COUNT(DISTINCT ${classes.id})`.as('classCount'),
      submissionCount: sql<number>`COUNT(DISTINCT ${quizSubmissions.id})`.as('submissionCount')
    })
    .from(users)
    .leftJoin(classes, eq(users.id, classes.teacherId))
    .leftJoin(quizSubmissions, eq(classes.id, quizSubmissions.classId))
    .groupBy(
      users.id, 
      users.firstName, 
      users.lastName, 
      users.email, 
      users.password,
      users.schoolOrganization, 
      users.roleTitle, 
      users.howHeardAbout,
      users.personalityAnimal, 
      users.isAdmin, 
      users.lastLoginAt, 
      users.createdAt
    );

  return teachersWithStats;
}

// Fix for getAllClassesWithStats() - lines 462-493
async getAllClassesWithStats(): Promise<(Class & { teacherName: string; submissionCount: number })[]> {
  // Single query to get classes with teacher info and submission count
  const classesWithStats = await db
    .select({
      id: classes.id,
      name: classes.name,
      code: classes.code,
      teacherId: classes.teacherId,
      iconEmoji: classes.iconEmoji,
      iconColor: classes.iconColor,
      createdAt: classes.createdAt,
      teacherName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`.as('teacherName'),
      submissionCount: sql<number>`COUNT(${quizSubmissions.id})`.as('submissionCount')
    })
    .from(classes)
    .innerJoin(users, eq(classes.teacherId, users.id))
    .leftJoin(quizSubmissions, eq(classes.id, quizSubmissions.classId))
    .groupBy(
      classes.id,
      classes.name,
      classes.code,
      classes.teacherId,
      classes.iconEmoji,
      classes.iconColor,
      classes.createdAt,
      users.firstName,
      users.lastName
    );

  return classesWithStats;
}
