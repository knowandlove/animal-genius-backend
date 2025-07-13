// Example middleware for your Express backend
// This replaces JWT token validation with passport code validation

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function authenticateStudent(req, res, next) {
  try {
    // Get passport code from header
    const passportCode = req.headers['x-passport-code']
    
    if (\!passportCode) {
      return res.status(401).json({ 
        error: 'Authentication required. Please provide passport code.' 
      })
    }

    // Validate passport code format
    if (\!/^[A-Z]{3}-[A-Z0-9]{3}$/.test(passportCode)) {
      return res.status(401).json({ 
        error: 'Invalid passport code format' 
      })
    }

    // Validate passport code against database using the same RPC function
    const { data: studentData, error } = await supabase
      .rpc('validate_student_login', { p_passport_code: passportCode })
      .single()

    if (error || \!studentData) {
      return res.status(401).json({ 
        error: 'Invalid passport code' 
      })
    }

    // Add student data to request object for use in route handlers
    req.student = {
      id: studentData.student_id,
      name: studentData.student_name,
      classId: studentData.class_id,
      schoolYear: studentData.school_year,
      passportCode: passportCode
    }

    next() // Continue to the actual route handler
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(500).json({ 
      error: 'Authentication service unavailable' 
    })
  }
}

// Usage in your Express routes:
// app.get('/api/student/progress', authenticateStudent, (req, res) => {
//   // req.student is now available with authenticated student data
//   res.json({
//     message: `Hello ${req.student.name}\!`,
//     progress: getStudentProgress(req.student.id)
//   })
// })

module.exports = { authenticateStudent }
EOF < /dev/null