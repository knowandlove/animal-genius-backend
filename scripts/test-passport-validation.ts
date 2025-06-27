import { isValidPassportCode } from "@shared/currency-types";

console.log("🔍 Testing passport code validation...\n");

const testCases = [
  // Legacy format
  "BEA-123",
  "OWL-ABC",
  "PAN-XY12",
  
  // New format
  "253-C5D",
  "123-ABC",
  "456-X1Y2Z3",
  "1-A",
  "999-ZZZZZ",
  
  // Invalid
  "INVALID",
  "123456",
  "ABC-",
  "-ABC",
  "abc-123",
  "123-abc"
];

testCases.forEach(code => {
  const isValid = isValidPassportCode(code);
  console.log(`${isValid ? '✅' : '❌'} "${code}" - ${isValid ? 'Valid' : 'Invalid'}`);
});
