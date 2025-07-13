# Comprehensive Testing Plan for Anonymous Authentication

## Pre-Deployment Testing

### 1. Database Migration Test
```bash
# Test migration in a development branch
supabase db push --dry-run

# Check for any errors or warnings
# Verify all functions are created
```

### 2. Edge Function Local Testing
```bash
# Test functions locally before deployment
supabase functions serve

# In another terminal, test each function:
# Test eligibility check
curl -i http://localhost:54321/functions/v1/quiz-check-eligibility \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"classCode": "TEST123", "firstName": "Test", "lastInitial": "S", "grade": "5th"}'

# Test quiz submission
curl -i http://localhost:54321/functions/v1/quiz-submit \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "classCode": "TEST123",
    "firstName": "Test",
    "lastInitial": "S",
    "grade": "5th",
    "answers": [
      {"questionId": 1, "answer": "a"},
      {"questionId": 2, "answer": "b"},
      {"questionId": 3, "answer": "a"},
      {"questionId": 4, "answer": "b"},
      {"questionId": 5, "answer": "a"},
      {"questionId": 6, "answer": "b"},
      {"questionId": 7, "answer": "a"},
      {"questionId": 8, "answer": "b"},
      {"questionId": 9, "answer": "a"},
      {"questionId": 10, "answer": "b"},
      {"questionId": 11, "answer": "a"},
      {"questionId": 12, "answer": "b"},
      {"questionId": 13, "answer": "a"},
      {"questionId": 14, "answer": "b"},
      {"questionId": 15, "answer": "a"},
      {"questionId": 16, "answer": "b"}
    ]
  }'

# Test student login
curl -i http://localhost:54321/functions/v1/student-login \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"passportCode": "OWL-ABC"}'
```

## Post-Deployment Testing

### 1. Happy Path Testing

#### Test Case 1: Complete Student Journey
1. **Create Test Class**
   ```bash
   # As teacher, create a class via API or UI
   # Note the class code (e.g., MATH2025)
   ```

2. **Test Quiz Flow**
   ```bash
   # Check eligibility
   curl -X POST https://your-project.supabase.co/functions/v1/quiz-check-eligibility \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"classCode": "MATH2025", "firstName": "Alice", "lastInitial": "S", "grade": "5th"}'
   
   # Expected: eligible: true
   ```

3. **Submit Quiz**
   ```bash
   # Submit quiz with all 16 answers
   curl -X POST https://your-project.supabase.co/functions/v1/quiz-submit \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "classCode": "MATH2025",
       "firstName": "Alice",
       "lastInitial": "S",
       "grade": "5th",
       "answers": [/* 16 question answers */]
     }'
   
   # Expected: passport code returned (e.g., "OWL-X9Y")
   ```

4. **Test Login**
   ```bash
   # Use the passport code from previous step
   curl -X POST https://your-project.supabase.co/functions/v1/student-login \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"passportCode": "OWL-X9Y"}'
   
   # Expected: JWT tokens returned
   ```

5. **Test Authenticated API Calls**
   ```bash
   # Use the access_token from login
   TOKEN="eyJ..."
   
   # Test room access
   curl -H "Authorization: Bearer $TOKEN" \
     https://your-backend.com/api/room-page-data/OWL-X9Y
   
   # Test store catalog
   curl -H "Authorization: Bearer $TOKEN" \
     https://your-backend.com/api/store/catalog
   ```

### 2. Error Handling Testing

#### Test Case 2: Invalid Class Code
```bash
curl -X POST https://your-project.supabase.co/functions/v1/quiz-check-eligibility \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"classCode": "INVALID", "firstName": "Bob", "lastInitial": "J"}'

# Expected: eligible: false, reason: "INVALID_CLASS"
```

#### Test Case 3: Class Full
1. Set class limit to 1
2. Create one student
3. Try to create another
```bash
# Expected: eligible: false, reason: "CLASS_FULL"
```

#### Test Case 4: Name Collision
```bash
# Submit same name twice
# Expected: error: "This name is already taken"
```

#### Test Case 5: Invalid Passport Code
```bash
curl -X POST https://your-project.supabase.co/functions/v1/student-login \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"passportCode": "INVALID"}'

# Expected: error: "Invalid passport code format"
```

### 3. Rate Limiting Testing

#### Test Case 6: Login Rate Limits
```bash
# Script to test rate limiting
for i in {1..10}; do
  echo "Attempt $i:"
  curl -X POST https://your-project.supabase.co/functions/v1/student-login \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"passportCode": "XXX-999"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.5
done

# Expected: After 5 attempts, get 429 status
```

#### Test Case 7: Quiz Submission Rate Limits
```bash
# Similar test for quiz submissions
# Expected: After 10 attempts per minute, get 429
```

### 4. Performance Testing

#### Test Case 8: Concurrent Quiz Submissions
```bash
# Simulate 50 students submitting quiz at once
for i in {1..50}; do
  curl -X POST https://your-project.supabase.co/functions/v1/quiz-submit \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"classCode\": \"PERF001\",
      \"firstName\": \"Student\",
      \"lastInitial\": \"$i\",
      \"grade\": \"5th\",
      \"answers\": [/* answers */]
    }" &
done
wait

# Monitor:
# - Response times
# - Success rate
# - Database locks
```

### 5. Security Testing

#### Test Case 9: SQL Injection
```bash
# Try SQL injection in various fields
curl -X POST https://your-project.supabase.co/functions/v1/quiz-check-eligibility \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"classCode": "TEST\"; DROP TABLE students; --", "firstName": "Test", "lastInitial": "S"}'

# Expected: Normal error response, no SQL execution
```

#### Test Case 10: XSS Prevention
```bash
# Try XSS in student name
curl -X POST https://your-project.supabase.co/functions/v1/quiz-submit \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"classCode": "TEST123", "firstName": "<script>alert(1)</script>", "lastInitial": "X", "grade": "5th", "answers": [...]}'

# Expected: Name stored safely, no script execution
```

### 6. Integration Testing

#### Test Case 11: Full Student Flow
1. Student completes quiz → Gets passport code
2. Student logs in → Gets JWT
3. Student views room → Data loads correctly
4. Student purchases item → Currency deducted
5. Student feeds pet → Pet stats update
6. Teacher views class → Sees new student

#### Test Case 12: Teacher Management
1. Teacher creates class
2. Teacher sets seat limit
3. Students fill class
4. Additional students blocked
5. Teacher increases limit
6. More students can join

### 7. Edge Cases

#### Test Case 13: Special Characters in Names
```bash
# Test names with apostrophes, hyphens
"firstName": "Mary-Jane", "lastInitial": "O"
"firstName": "D'Angelo", "lastInitial": "S"
```

#### Test Case 14: Session Expiry
1. Login as student
2. Wait 8+ hours
3. Try API call
4. Expected: 401 error, need to re-login

#### Test Case 15: Database Rollback
1. Submit quiz that triggers error mid-transaction
2. Verify no partial data created
3. Student can retry successfully

## Monitoring Checklist

During testing, monitor:

- [ ] Supabase Edge Function logs
- [ ] Database query performance
- [ ] Redis hit/miss rates
- [ ] Error rates by type
- [ ] Response time percentiles
- [ ] Memory usage
- [ ] Concurrent connection count

## Rollback Testing

### Test Rollback Procedure
1. Deploy new version
2. Identify issue
3. Rollback Edge Functions: `supabase functions deploy --version previous`
4. Verify old version working
5. Fix issue
6. Redeploy

## Load Testing Script

```javascript
// load-test.js
const classCode = 'LOAD001';
const concurrentStudents = 100;

async function submitQuiz(studentNum) {
  const start = Date.now();
  try {
    const response = await fetch('https://your-project.supabase.co/functions/v1/quiz-submit', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        classCode,
        firstName: `LoadTest${studentNum}`,
        lastInitial: 'T',
        grade: '5th',
        answers: generateAnswers()
      })
    });
    
    const data = await response.json();
    const duration = Date.now() - start;
    
    console.log(`Student ${studentNum}: ${response.status} in ${duration}ms`);
    return { success: response.ok, duration, data };
  } catch (error) {
    console.error(`Student ${studentNum} failed:`, error);
    return { success: false, duration: Date.now() - start };
  }
}

// Run load test
async function runLoadTest() {
  const promises = [];
  for (let i = 1; i <= concurrentStudents; i++) {
    promises.push(submitQuiz(i));
  }
  
  const results = await Promise.all(promises);
  
  // Analyze results
  const successful = results.filter(r => r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`\nResults:`);
  console.log(`Success rate: ${successful}/${concurrentStudents} (${(successful/concurrentStudents*100).toFixed(1)}%)`);
  console.log(`Average response time: ${avgDuration.toFixed(0)}ms`);
}
```

## Success Criteria

The system is ready for production when:

- ✅ All happy path tests pass
- ✅ Rate limiting prevents abuse
- ✅ 95%+ success rate under load
- ✅ Average response time < 500ms
- ✅ No security vulnerabilities found
- ✅ Rollback procedure tested
- ✅ Monitoring shows stable metrics