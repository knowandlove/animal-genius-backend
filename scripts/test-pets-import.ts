console.log('Testing pets router import...\n');

try {
  console.log('1. Attempting to import pets router...');
  const petsRouter = await import('../server/routes/pets.js');
  console.log('✅ Pets router imported successfully');
  console.log('   Router type:', typeof petsRouter.default);
  console.log('   Router methods:', Object.keys(petsRouter));
} catch (error) {
  console.error('❌ Failed to import pets router:', error);
}

try {
  console.log('\n2. Attempting to import pet service...');
  const petService = await import('../server/services/petService.js');
  console.log('✅ Pet service imported successfully');
  console.log('   Exported functions:', Object.keys(petService));
} catch (error) {
  console.error('❌ Failed to import pet service:', error);
}

process.exit(0);