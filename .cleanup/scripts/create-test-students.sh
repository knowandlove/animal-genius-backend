#!/bin/bash

echo "🎓 Creating test students for your class..."
echo "This will add 20 students with varied personalities and quiz results."
echo ""

cd /Users/jasonlackey/Desktop/KALPRO/animal-genius-backend

# Run the TypeScript file directly with tsx
npx tsx scripts/create-test-students.ts
