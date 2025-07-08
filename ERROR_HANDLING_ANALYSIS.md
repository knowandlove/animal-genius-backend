# Error Handling Analysis - Animal Genius Backend

## Executive Summary

This analysis identifies inconsistent error handling patterns across the Animal Genius backend codebase that pose risks to security, maintainability, and user experience. Key issues include:

1. **Inconsistent error response formats** (using both `message` and `error` keys)
2. **Sensitive information leakage** through exposed error messages
3. **Lack of centralized error handling** leading to duplicated code
4. **Missing standardized error types** for different error scenarios
5. **Inconsistent HTTP status codes** for similar error conditions

## Current Error Response Formats

### Format 1: `message` key
```json
{ "message": "Error description" }
```
Used in: auth.ts, classes.ts, currency.ts

### Format 2: `error` key
```json
{ "error": "Error description" }
```
Used in: store.ts, pets.ts, analytics.ts

### Format 3: Detailed validation errors
```json
{
  "message": "Validation error",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```
Used in: auth.ts (Zod validation), validation middleware

### Format 4: Mixed formats with additional fields
```json
{ "error": "Invalid pet name", "details": "Reason for invalidity" }
{ "success": false, "error": "Error message" }
```
Used in: pets.ts, various service responses

## Critical Security Issues

### 1. Direct Error Message Exposure

**Location**: Multiple routes directly expose internal error messages
```typescript
// auth.ts:61
return res.status(400).json({ message: authError.message });

// auth.ts:130
res.status(500).json({ message: "Registration failed: " + (error.message || "Unknown error") });

// classes.ts:241
error: error instanceof Error ? error.message : String(error)
```

**Risk**: Exposes internal system details, database schema, and potential attack vectors.

### 2. Console Error Logging with Sensitive Data

**Location**: Extensive console.error usage throughout routes
```typescript
// auth.ts:56
console.error('Supabase auth error:', authError);
console.error('Full error details:', JSON.stringify(authError, null, 2));

// pets.ts:84-87
console.log('🐾 Pet purchase request:', {
  studentId: req.studentId,
  body: req.body,
  cookies: req.cookies  // Potential sensitive data
});
```

**Risk**: Sensitive user data and authentication tokens may be logged.

## Inconsistent Error Handling Patterns

### 1. Try-Catch Block Variations

**Pattern A**: Generic 500 errors
```typescript
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ message: "Failed to perform action" });
}
```

**Pattern B**: Exposing error details
```typescript
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ message: error.message });
}
```

**Pattern C**: Type-specific handling
```typescript
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      message: "Validation error", 
      errors: error.errors 
    });
  }
  res.status(500).json({ message: "Internal error" });
}
```

### 2. Service Layer Error Propagation

Services return inconsistent error formats:
```typescript
// petService.ts
return { success: false, error: "Student already has a pet" };
return { success: false, error: "Insufficient balance" };
```

Routes then directly expose these messages:
```typescript
// pets.ts:110
if (!result.success) {
  return res.status(400).json({ error: result.error });
}
```

## Missing Error Handling Infrastructure

### 1. No Global Error Handler
The application has a basic global error handler in `index.ts`:
```typescript
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${message}`);
  res.status(status).json({ message });
});
```

However, this is rarely utilized as most errors are caught and handled within individual routes.

### 2. Limited Custom Error Classes
Only basic error classes exist in `errors.ts`:
- ValidationError
- NotFoundError
- AuthenticationError
- AuthorizationError

These are not consistently used throughout the codebase.

### 3. No Error Transformation Layer
Missing middleware to:
- Sanitize error messages before sending to clients
- Log detailed errors internally while sending generic messages externally
- Transform different error types into consistent response formats

## Specific Problem Areas

### 1. Authentication Routes (`auth.ts`)
- Exposes Supabase error messages directly (line 61)
- Inconsistent handling of profile lookup failures
- Logout always returns success even on failure

### 2. Pet Routes (`pets.ts`)
- Mixes `error` and `details` in responses
- Console logs include sensitive request data
- Service errors passed through without sanitization

### 3. Currency Routes (`currency.ts`)
- Nested try-catch blocks with different error formats
- Specific error messages ("Insufficient funds") mixed with generic ones

### 4. Class Routes (`classes.ts`)
- Good: Handles specific database errors (foreign key violations)
- Bad: Still exposes error.message in analytics endpoint

## Recommendations

### 1. Immediate Actions (High Priority)
1. **Standardize error response format** to use only `error` key
2. **Remove all `error.message` exposures** in 500 responses
3. **Sanitize service layer error messages** before sending to clients
4. **Remove sensitive data from console logs**

### 2. Short-term Improvements
1. **Implement error transformation middleware**
2. **Create comprehensive error type enum**
3. **Use custom error classes consistently**
4. **Add request ID tracking for error correlation**

### 3. Long-term Architecture
1. **Centralized error handling service**
2. **Structured logging with log levels**
3. **Error monitoring integration** (Sentry, etc.)
4. **API error documentation**

## Proposed Error Response Standard

```typescript
interface StandardErrorResponse {
  error: {
    code: string;        // e.g., "AUTH_001", "VALIDATION_002"
    message: string;     // User-friendly message
    details?: any;       // Optional additional context (for 4xx only)
    requestId?: string;  // For tracking/debugging
  };
}
```

## Implementation Priority

1. **Critical**: Fix information leakage (1-2 days)
2. **High**: Standardize error formats (2-3 days)
3. **Medium**: Implement error middleware (3-5 days)
4. **Low**: Complete architectural improvements (1-2 weeks)

## Conclusion

The current error handling approach creates security vulnerabilities and maintenance challenges. Implementing a standardized, centralized error handling system will improve security, debugging capabilities, and API consistency. The immediate priority should be preventing sensitive information leakage while working toward a comprehensive error handling architecture.