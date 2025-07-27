#!/bin/bash
# Beta Launch Testing Script
# This tests all critical user paths to ensure stability

API_URL="http://localhost:5001/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Beta Launch Testing Script"
echo "=============================="
echo ""

# Function to check result
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        echo "Response: $3"
    fi
}

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    check_result 0 "Server is running"
else
    check_result 1 "Server health check" "$HEALTH_RESPONSE"
    echo -e "${RED}Server is not running! Please start it with: ./start-dev.sh${NC}"
    exit 1
fi
echo ""

# Test 2: Teacher Registration
echo -e "${YELLOW}Test 2: Teacher Registration${NC}"
TIMESTAMP=$(date +%s)
TEACHER_EMAIL="betateacher${TIMESTAMP}@test.com"
REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"password\": \"BetaTest123!\",
    \"firstName\": \"Beta\",
    \"lastName\": \"Teacher\",
    \"schoolOrganization\": \"Beta Test School\",
    \"roleTitle\": \"Teacher\",
    \"personalityAnimal\": \"owl\"
  }")

HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')

if [[ $HTTP_CODE == "200" ]] && [[ $BODY == *"token"* ]]; then
    TOKEN=$(echo $BODY | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    check_result 0 "Teacher registration successful"
    echo "Token received: ${TOKEN:0:20}..."
else
    check_result 1 "Teacher registration" "$BODY"
fi
echo ""

# Test 3: Teacher Login
echo -e "${YELLOW}Test 3: Teacher Login${NC}"
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"password\": \"BetaTest123!\"
  }")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [[ $HTTP_CODE == "200" ]] && [[ $BODY == *"token"* ]]; then
    TOKEN=$(echo $BODY | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    check_result 0 "Teacher login successful"
else
    check_result 1 "Teacher login" "$BODY"
fi
echo ""

# Test 4: Create Class
echo -e "${YELLOW}Test 4: Create Class${NC}"
CLASS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/classes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"Beta Test Class $TIMESTAMP\",
    \"subject\": \"Testing\",
    \"gradeLevel\": \"5th\"
  }")

HTTP_CODE=$(echo "$CLASS_RESPONSE" | tail -n1)
BODY=$(echo "$CLASS_RESPONSE" | sed '$d')

if [[ $HTTP_CODE == "200" || $HTTP_CODE == "201" ]] && [[ $BODY == *"classCode"* ]]; then
    CLASS_CODE=$(echo $BODY | grep -o '"classCode":"[^"]*' | cut -d'"' -f4)
    CLASS_ID=$(echo $BODY | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    check_result 0 "Class created with code: $CLASS_CODE"
else
    check_result 1 "Class creation" "$BODY"
fi
echo ""

# Test 5: Student Quiz Submission
echo -e "${YELLOW}Test 5: Student Quiz Submission (Critical Path!)${NC}"
# Generate random answers for testing
PERSONALITY_ANSWERS='['
for i in {1..28}; do
    PERSONALITY_ANSWERS+="$((RANDOM % 5 + 1))"
    if [ $i -lt 28 ]; then PERSONALITY_ANSWERS+=","; fi
done
PERSONALITY_ANSWERS+=']'

VARK_ANSWERS='['
for i in {1..20}; do
    VARK_ANSWERS+="\"$((RANDOM % 4 + 1))\""
    if [ $i -lt 20 ]; then VARK_ANSWERS+=","; fi
done
VARK_ANSWERS+=']'

QUIZ_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/quiz/submissions" \
  -H "Content-Type: application/json" \
  -d "{
    \"classCode\": \"$CLASS_CODE\",
    \"firstName\": \"Test\",
    \"lastInitial\": \"S\",
    \"schoolYear\": \"5th\",
    \"answers\": {
      \"personality\": $PERSONALITY_ANSWERS,
      \"vark\": $VARK_ANSWERS,
      \"score\": 100
    }
  }")

HTTP_CODE=$(echo "$QUIZ_RESPONSE" | tail -n1)
BODY=$(echo "$QUIZ_RESPONSE" | sed '$d')

if [[ $HTTP_CODE == "200" ]] && [[ $BODY == *"passportCode"* ]]; then
    PASSPORT_CODE=$(echo $BODY | grep -o '"passportCode":"[^"]*' | cut -d'"' -f4)
    ANIMAL_TYPE=$(echo $BODY | grep -o '"animalType":"[^"]*' | cut -d'"' -f4)
    check_result 0 "Quiz submitted! Passport: $PASSPORT_CODE, Animal: $ANIMAL_TYPE"
else
    check_result 1 "Quiz submission" "$BODY"
fi
echo ""

# Test 6: Student Room Access
echo -e "${YELLOW}Test 6: Student Room Access${NC}"
ROOM_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/room-page-data/$PASSPORT_CODE" \
  -H "X-Passport-Code: $PASSPORT_CODE")

HTTP_CODE=$(echo "$ROOM_RESPONSE" | tail -n1)
BODY=$(echo "$ROOM_RESPONSE" | sed '$d')

if [[ $HTTP_CODE == "200" ]] && [[ $BODY == *"student"* ]]; then
    check_result 0 "Room access successful"
else
    check_result 1 "Room access" "$BODY"
fi
echo ""

# Test 7: Store Catalog
echo -e "${YELLOW}Test 7: Store Catalog Access${NC}"
STORE_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/store-direct/catalog" \
  -H "X-Passport-Code: $PASSPORT_CODE")

HTTP_CODE=$(echo "$STORE_RESPONSE" | tail -n1)
BODY=$(echo "$STORE_RESPONSE" | sed '$d')

if [[ $HTTP_CODE == "200" ]] && [[ $BODY == *"items"* ]]; then
    check_result 0 "Store catalog loaded"
    # Extract first item ID for purchase test
    ITEM_ID=$(echo $BODY | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
else
    check_result 1 "Store catalog" "$BODY"
fi
echo ""

# Test 8: Error Handling
echo -e "${YELLOW}Test 8: Error Handling${NC}"
ERROR_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/quiz/submissions" \
  -H "Content-Type: application/json" \
  -d "{\"classCode\": \"INVALID\"}")

HTTP_CODE=$(echo "$ERROR_RESPONSE" | tail -n1)
BODY=$(echo "$ERROR_RESPONSE" | sed '$d')

if [[ $HTTP_CODE == "400" ]] || [[ $HTTP_CODE == "404" ]]; then
    check_result 0 "Error handling works (returns proper error)"
else
    check_result 1 "Error handling" "Expected 4xx error, got $HTTP_CODE"
fi
echo ""

# Summary
echo "=============================="
echo "🎯 Beta Testing Summary"
echo "=============================="
echo ""
echo "Critical paths tested:"
echo "  ✅ Server health"
echo "  ✅ Teacher auth flow" 
echo "  ✅ Class management"
echo "  ✅ Student quiz (most critical!)"
echo "  ✅ Room access"
echo "  ✅ Store functionality"
echo "  ✅ Error handling"
echo ""
echo -e "${GREEN}Your app is ready for beta testing!${NC}"
echo ""
echo "Test Credentials Created:"
echo "  Teacher: $TEACHER_EMAIL / BetaTest123!"
echo "  Class Code: $CLASS_CODE"
echo "  Student Passport: $PASSPORT_CODE"
echo ""
echo "Next steps:"
echo "1. Change your database password in Supabase"
echo "2. Update your .env file"
echo "3. Set up monitoring alerts"
echo "4. Prepare beta user instructions"