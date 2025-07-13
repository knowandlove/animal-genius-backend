import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RateLimiter, RATE_LIMITS, setRateLimitHeaders, rateLimitErrorResponse } from '../_shared/rate-limit.ts'
import { calculateResults, animalMap, animalGeniusMap } from '../_shared/scoring.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const rateLimiter = new RateLimiter()
  const clientIp = RateLimiter.getClientIp(req)

  try {
    const { classCode, firstName, lastInitial, grade, answers } = await req.json()

    // Validate inputs
    if (!classCode || !firstName || !lastInitial || !answers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate name format
    if (!/^[a-zA-Z\s\-']+$/.test(firstName) || !/^[A-Z]$/.test(lastInitial)) {
      return new Response(
        JSON.stringify({ error: 'Invalid name format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform answers format based on what we receive
    let transformedAnswers
    
    // Check if answers is an array (expected format)
    if (Array.isArray(answers)) {
      // Validate array format
      const isValidArray = answers.every(
        (item) => 
          typeof item === 'object' && 
          'questionId' in item && 
          'answer' in item
      )
      
      if (isValidArray) {
        transformedAnswers = answers
      } else {
        // Try to transform array items to correct format
        transformedAnswers = answers.map((item, index) => {
          if (typeof item === 'string') {
            // If array of strings, assume they're in order
            return {
              questionId: index + 1,
              answer: item.toLowerCase()
            }
          }
          return item
        })
      }
    } else if (typeof answers === 'object') {
      // Transform object format {q1: "A", q2: "B", ...} to array format
      transformedAnswers = Object.entries(answers).map(([key, value]) => {
        // Extract question number from key (q1 -> 1, question1 -> 1, etc.)
        const questionNumber = parseInt(key.replace(/\D/g, ''))
        
        return {
          questionId: questionNumber || parseInt(key),
          answer: (value as string).toLowerCase()
        }
      }).sort((a, b) => a.questionId - b.questionId) // Sort by question ID
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid answers format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate we have enough answers (at least 16 for MBTI calculation)
    if (transformedAnswers.length < 16) {
      return new Response(
        JSON.stringify({ error: 'Incomplete quiz: minimum 16 answers required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit by IP address
    const ipLimit = await rateLimiter.checkLimit(clientIp, RATE_LIMITS.quizSubmit.perIp)
    if (!ipLimit.allowed) {
      return rateLimitErrorResponse(ipLimit, 'Too many quiz submissions. Please wait a minute.')
    }

    // Rate limit by class code (to prevent spam submissions to a class)
    const classLimit = await rateLimiter.checkLimit(
      classCode.toUpperCase(), 
      RATE_LIMITS.quizSubmit.perClass
    )
    if (!classLimit.allowed) {
      return rateLimitErrorResponse(
        classLimit, 
        'This class has received too many submissions. Please try again later or contact your teacher.'
      )
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // Admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Anon client for anonymous sign-in
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create anonymous auth user using admin API (bypasses RLS/permission issues)
    console.log('Creating anonymous auth user for student:', `${firstName} ${lastInitial}`)
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: `anon-${Date.now()}-${Math.random().toString(36).substring(2)}@example.com`,
      password: `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_initial: lastInitial,
        is_anonymous: true
      },
      app_metadata: {
        provider: 'anonymous',
        providers: ['anonymous']
      }
    })

    if (authError || !authData.user) {
      console.error('Failed to create anonymous user:', authError)
      console.error('Auth error details:', {
        message: authError?.message,
        status: authError?.status,
        name: authError?.name
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user account',
          details: authError?.message || 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authUser = authData // Keep same variable name for compatibility

    // Calculate quiz results using shared frontend logic
    console.log('Calculating quiz results for:', `${firstName} ${lastInitial}`)
    const quizResults = calculateResults(transformedAnswers.map(a => ({
      questionId: a.questionId,
      answer: a.answer.toUpperCase() as 'A' | 'B' | 'C' | 'D'
    })))
    
    console.log('Quiz calculation results:', {
      mbtiType: quizResults.mbtiType,
      animal: quizResults.animal,
      animalGenius: quizResults.animalGenius
    })

    // Call simplified database function with user_id and calculated results
    console.log('Creating student record for:', `${firstName} ${lastInitial}`)
    const { data: result, error } = await supabaseAdmin.rpc('create_student_from_quiz_with_results', {
      p_class_code: classCode,
      first_name: firstName,
      last_initial: lastInitial,
      grade: grade || '5',
      quiz_answers: transformedAnswers,
      p_user_id: authUser.user.id,
      calculated_animal: quizResults.animal,
      calculated_genius: quizResults.animalGenius,
      calculated_mbti: quizResults.mbtiType,
      calculated_learning_style: quizResults.learningStyle
    })

    // If student creation failed, clean up the auth user (compensating transaction)
    if (error) {
      console.error('Student creation failed, cleaning up auth user:', error)
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        console.log('Auth user cleaned up successfully')
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }
    }

    if (error) {
      console.error('Quiz submission error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details
      })
      
      // Add rate limit headers to error responses
      const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
      setRateLimitHeaders(headers, ipLimit)
      
      // Parse specific error types
      if (error.message.includes('Class code') || error.message.includes('not found')) {
        return new Response(
          JSON.stringify({ error: 'Invalid class code' }),
          { status: 400, headers }
        )
      }
      
      if (error.message.includes('reached its capacity') || error.message.includes('CLASS_FULL')) {
        return new Response(
          JSON.stringify({ error: 'This class is full. Please contact your teacher.' }),
          { status: 400, headers }
        )
      }
      
      if (error.message.includes('already exists') || error.message.includes('NAME_COLLISION')) {
        return new Response(
          JSON.stringify({ 
            error: 'This name is already taken in the class. Try adding your middle initial.' 
          }),
          { status: 400, headers }
        )
      }

      // Generic error with details for debugging
      return new Response(
        JSON.stringify({ 
          error: 'Failed to submit quiz. Please try again.',
          debug: error.message
        }),
        { status: 500, headers }
      )
    }

    // Map animal type to display name
    const animalDisplayNames: Record<string, string> = {
      'meerkat': 'Meerkat',
      'panda': 'Panda',
      'owl': 'Owl',
      'beaver': 'Beaver',
      'elephant': 'Elephant',
      'otter': 'Otter',
      'parrot': 'Parrot',
      'border_collie': 'Border Collie'
    }

    // Success! Add rate limit headers
    const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
    setRateLimitHeaders(headers, ipLimit)

    // Return success response with passport code
    return new Response(
      JSON.stringify({
        success: true,
        passportCode: result.passport_code,
        animalType: animalDisplayNames[result.animal_type] || result.animal_type,
        firstName: result.first_name,
        message: `Welcome ${result.first_name}! Your passport code is ${result.passport_code}`
      }),
      { status: 200, headers }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
