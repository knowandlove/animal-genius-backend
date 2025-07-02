import { 
  generateUniqueFunCode, 
  generateActivationCode, 
  generateSessionCode,
  isValidFunCode,
  isValidActivationCode,
  isValidSessionCode,
  adjectives,
  nouns
} from './server/lib/auth/funCodeGenerator';

console.log('🧪 Testing Fun Code Generator\n');
console.log('=====================================\n');

// Test word list stats
console.log('📊 Word List Statistics:');
console.log(`- Adjectives: ${adjectives.length} words`);
console.log(`- Nouns: ${nouns.length} words`);
console.log(`- Total possible combinations: ${adjectives.length * nouns.length}\n`);

// Test code generation
console.log('🎲 Sample Generated Codes:\n');

console.log('Fun Codes (for students):');
for (let i = 0; i < 5; i++) {
  // Note: generateUniqueFunCode requires DB connection, so we'll use generateSessionCode for testing
  const code = generateSessionCode();
  console.log(`  ${i + 1}. ${code}`);
}

console.log('\nActivation Codes (for parents):');
for (let i = 0; i < 5; i++) {
  const code = generateActivationCode();
  console.log(`  ${i + 1}. ${code}`);
}

console.log('\nSession Codes (for classrooms):');
for (let i = 0; i < 5; i++) {
  const code = generateSessionCode();
  console.log(`  ${i + 1}. ${code}`);
}

// Test validation
console.log('\n✅ Validation Tests:\n');

const testCases = [
  { code: 'HAPPY-LION', type: 'fun', validator: isValidFunCode },
  { code: 'BRAVE-STAR-7X9', type: 'activation', validator: isValidActivationCode },
  { code: 'MIGHTY-EAGLE', type: 'session', validator: isValidSessionCode },
  { code: 'happy-lion', type: 'fun (lowercase)', validator: isValidFunCode },
  { code: 'TOOSHORT', type: 'invalid', validator: isValidFunCode },
  { code: 'MISSING-DASH', type: 'invalid', validator: isValidSessionCode },
];

testCases.forEach(({ code, type, validator }) => {
  const isValid = validator(code);
  console.log(`  ${code} (${type}): ${isValid ? '✅ Valid' : '❌ Invalid'}`);
});

console.log('\n🎯 Fun Code Examples for Visual Picker:\n');
// Show some fun combinations that kids would enjoy
const funExamples = [
  'MIGHTY-LION',
  'BRAVE-DRAGON',
  'CLEVER-FOX',
  'HAPPY-PANDA',
  'SWIFT-EAGLE',
  'GENTLE-DOLPHIN',
  'WISE-OWL',
  'BOLD-TIGER'
];

funExamples.forEach((example, i) => {
  console.log(`  ${i + 1}. ${example} 🎨`);
});

console.log('\n✨ Generator test complete!');