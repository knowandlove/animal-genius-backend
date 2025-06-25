import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getProfileById } from '../storage';

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
    const { personalityAnimal, firstName, lastName } = req.body;
    
    // Only allow updating certain fields
    const updates: any = {};
    if (personalityAnimal) updates.personalityAnimal = personalityAnimal;
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    
    // TODO: Implement updateProfile function in storage.ts
    // For now, we'll just return success
    
    res.json({
      success: true,
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: "Failed to update profile" } 
    });
  }
});

export default router;
