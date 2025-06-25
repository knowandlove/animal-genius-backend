import { Router } from 'express';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// TEMPORARY: Emergency login for old accounts during migration
router.post('/emergency-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Emergency login attempt for:', email);
    
    // Try old system
    const user = await storage.validateUserPassword(email, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Generate old-style token
    const token = jwt.sign(
      { userId: user.id, email: user.email, is_admin: user.isAdmin }, 
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('Emergency login successful for:', email);
    
    res.json({ 
      token,
      refreshToken,
      user: { 
        id: user.id, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        email: user.email,
        personalityAnimal: user.personalityAnimal,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error("Emergency login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
