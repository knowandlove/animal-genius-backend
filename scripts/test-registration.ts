#!/usr/bin/env tsx
/**
 * Script to test user registration
 */

async function testRegistration() {
  console.log('🧪 Testing Registration Endpoint\n');
  
  const testUser = {
    email: 'primary@test.com',
    password: 'TestPass123', // Meets requirements: 8+ chars, upper, lower, number
    firstName: 'Primary',
    lastName: 'Teacher',
    schoolOrganization: 'Test School'
  };
  
  try {
    console.log('Testing registration with:', { 
      ...testUser, 
      password: '***hidden***' 
    });
    
    const response = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });
    
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Registration test successful!');
    } else {
      console.log('❌ Registration test failed');
      console.log('Status:', response.status);
      console.log('Error:', data);
    }
    
  } catch (error) {
    console.error('❌ Registration test error:', error);
  }
}

// Run the test
testRegistration();