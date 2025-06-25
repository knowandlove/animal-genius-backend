import { profiles } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Additional storage methods for Supabase auth integration

export async function getProfileById(userId: string): Promise<any> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  
  if (!profile) {
    throw new Error("Profile not found");
  }
  
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    schoolOrganization: profile.schoolOrganization,
    roleTitle: profile.roleTitle,
    howHeardAbout: profile.howHeardAbout,
    personalityAnimal: profile.personalityAnimal,
    isAdmin: profile.isAdmin,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    lastLoginAt: profile.lastLoginAt
  };
}

export async function updateLastLoginSupabase(userId: string): Promise<void> {
  await db
    .update(profiles)
    .set({ lastLoginAt: new Date() })
    .where(eq(profiles.id, userId));
}
