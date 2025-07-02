const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  // Create a simple test image (1x1 PNG)
  const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  
  const form = new FormData();
  form.append('image', testImageBuffer, {
    filename: 'test.png',
    contentType: 'image/png'
  });
  form.append('type', 'avatar_hat');
  
  try {
    const response = await fetch('http://localhost:5001/api/admin/assets/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token', // Replace with actual token
        ...form.getHeaders()
      },
      body: form
    });
    
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testUpload();