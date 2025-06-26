import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getProfileById } from '../storage-supabase';
import { db } from '../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../supabase-clients';

const router = Router();

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    // req.user is set by the requireAuth middleware
    const userId = req.user.userId;
    
    // Get the user's profile from the database
    const profile = await getProfileById(userId);
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: { message: "User profile not found" } 
      });
    }
    
    // Return only the necessary user data
    // NEVER include sensitive data like passwords or internal IDs
    const userData = {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      personalityAnimal: profile.personalityAnimal,
      isAdmin: profile.isAdmin || false,
      schoolOrganization: profile.schoolOrganization,
      roleTitle: profile.roleTitle
    };
    
    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: "Failed to fetch user profile" } 
    });
  }
});

// Update current user profile (only allowed fields)
router.put('/me/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      personalityAnimal, 
      firstName, 
      lastName,
      schoolOrganization,
      roleTitle,
      howHeardAbout 
    } = req.body;
    
    // Only allow updating certain fields
    const updates: any = {};
    if (personalityAnimal !== undefined) updates.personalityAnimal = personalityAnimal;
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (schoolOrganization !== undefined) updates.schoolOrganization = schoolOrganization;
    if (roleTitle !== undefined) updates.roleTitle = roleTitle;
    if (howHeardAbout !== undefined) updates.howHeardAbout = howHeardAbout;
    
    // Add updatedAt timestamp
    updates.updatedAt = new Date();
    
    // Update the profile in the database
    await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, userId));
    
    // Fetch the updated profile
    const updatedProfile = await getProfileById(userId);
    
    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updatedProfile.id,
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        email: updatedProfile.email,
        personalityAnimal: updatedProfile.personalityAnimal,
        isAdmin: updatedProfile.isAdmin || false,
        schoolOrganization: updatedProfile.schoolOrganization,
        roleTitle: updatedProfile.roleTitle
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: "Failed to update profile" } 
    });
  }
});

// Update password
router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { message: "Current password and new password are required" }
      });
    }
    
    // For Supabase Auth, we need to use the Supabase Admin API
    // to update the password
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );
    
    if (error) {
      console.error('Error updating password:', error);
      return res.status(400).json({
        success: false,
        error: { message: error.message || "Failed to update password" }
      });
    }
    
    res.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: "Failed to update password" } 
    });
  }
});

export default router;
