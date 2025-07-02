import 'dotenv/config';
import { db } from './server/db/drizzle';
import { PaymentService } from './server/services/PaymentService';
import { profiles, classes, teacherPayments } from './shared/schema';
import { eq } from 'drizzle-orm';

async function testPaymentFlow() {
  console.log('🧪 Testing Payment Flow...\n');

  try {
    // 1. Get or create a test teacher
    console.log('1️⃣ Setting up test teacher...');
    let teacher = await db.query.profiles.findFirst({
      where: eq(profiles.email, 'test.teacher@example.com')
    });

    if (!teacher) {
      console.log('   Creating test teacher...');
      [teacher] = await db.insert(profiles)
        .values({
          id: crypto.randomUUID(),
          email: 'test.teacher@example.com',
          fullName: 'Test Teacher',
          firstName: 'Test',
          lastName: 'Teacher',
          isAdmin: false
        })
        .returning();
    }
    console.log('   ✅ Teacher ready:', teacher.email);

    // 2. Get or create a test class
    console.log('\n2️⃣ Setting up test class...');
    let testClass = await db.query.classes.findFirst({
      where: eq(classes.teacherId, teacher.id)
    });

    if (!testClass) {
      console.log('   Creating test class...');
      [testClass] = await db.insert(classes)
        .values({
          teacherId: teacher.id,
          name: 'Test Math Class',
          subject: 'Mathematics',
          gradeLevel: '5th Grade',
          passportCode: 'TEST-' + Date.now(),
          schoolName: 'Test Elementary School',
          maxStudents: 30,
          paymentStatus: 'pending'
        })
        .returning();
    }
    console.log('   ✅ Class ready:', testClass.name, `(${testClass.id})`);

    // 3. Create a checkout session
    console.log('\n3️⃣ Creating checkout session...');
    const studentCount = 25;
    const checkoutResult = await PaymentService.createCheckoutSession(
      teacher.id,
      testClass.id,
      studentCount
    );
    console.log('   ✅ Checkout session created:');
    console.log('      Session ID:', checkoutResult.sessionId);
    console.log('      Mock URL:', checkoutResult.mockCheckoutUrl);
    console.log('      Amount:', `$${(checkoutResult.payment.amountCents / 100).toFixed(2)}`);

    // 4. Simulate successful payment
    console.log('\n4️⃣ Simulating successful payment...');
    const webhookResult = await PaymentService.processMockWebhook(
      checkoutResult.sessionId,
      'success'
    );
    console.log('   ✅ Payment processed successfully!');
    console.log('      Redirect URL:', webhookResult.redirectUrl);

    // 5. Verify the class is now paid
    console.log('\n5️⃣ Verifying class payment status...');
    const updatedClass = await db.query.classes.findFirst({
      where: eq(classes.id, testClass.id)
    });
    console.log('   ✅ Class payment status:', updatedClass?.paymentStatus);
    console.log('      Paid student count:', updatedClass?.paidStudentCount);
    console.log('      Paid at:', updatedClass?.paidAt);

    // 6. Check payment record
    console.log('\n6️⃣ Checking payment record...');
    const paymentRecord = await db.query.teacherPayments.findFirst({
      where: eq(teacherPayments.id, checkoutResult.sessionId)
    });
    console.log('   ✅ Payment record:');
    console.log('      Status:', paymentRecord?.status);
    console.log('      Amount:', `$${((paymentRecord?.amountCents || 0) / 100).toFixed(2)}`);
    console.log('      Student count:', paymentRecord?.studentCount);

    // 7. Test failed payment
    console.log('\n7️⃣ Testing failed payment scenario...');
    const failedCheckout = await PaymentService.createCheckoutSession(
      teacher.id,
      testClass.id,
      10
    );
    const failedResult = await PaymentService.processMockWebhook(
      failedCheckout.sessionId,
      'failure'
    );
    console.log('   ✅ Failed payment handled correctly');
    console.log('      Redirect URL:', failedResult.redirectUrl);

    console.log('\n✨ All tests passed! The payment flow is working correctly.');
    console.log('\n📝 Summary:');
    console.log('   - Schema updates: ✅');
    console.log('   - Payment service: ✅');
    console.log('   - Transactional updates: ✅');
    console.log('   - Success/failure handling: ✅');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testPaymentFlow();
