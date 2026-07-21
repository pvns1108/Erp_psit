// One-time setup script: creates the first admin account and a few sample students.
// Run with:  npm run seed
require('dotenv').config();
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const Student = require('./models/Student');
const { generateStudentId, generateTempPassword } = require('./utils/helpers');

async function seed() {
  await connectDB();

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@psit.ac.in').toLowerCase();
  let admin = await Admin.findOne({ email: adminEmail });
  if (!admin) {
    admin = await Admin.create({
      name: process.env.SEED_ADMIN_NAME || 'Super Admin',
      email: adminEmail,
      password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123'
    });
    console.log('Created admin account:');
    console.log('  email:', adminEmail);
    console.log('  password:', process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123');
  } else {
    console.log('Admin account already exists:', adminEmail);
  }

  const sampleCount = await Student.countDocuments();
  if (sampleCount === 0) {
    const samples = [
      { name: 'Aarav Mehta', email: 'aarav.mehta@psit.ac.in', department: 'CSE', year: 3, section: 'A', rollNumber: 'CSE22045' },
      { name: 'Diya Sharma', email: 'diya.sharma@psit.ac.in', department: 'ECE', year: 2, section: 'B', rollNumber: 'ECE23012' },
      { name: 'Kabir Singh', email: 'kabir.singh@psit.ac.in', department: 'ME', year: 4, section: 'A', rollNumber: 'ME21098' }
    ];
    console.log('\nCreating sample student accounts:');
    for (const s of samples) {
      const tempPassword = generateTempPassword();
      const studentId = generateStudentId(s.department, s.year + 2022);
      await Student.create({ ...s, studentId, password: tempPassword });
      console.log(`  ${s.name} — ID: ${studentId} — login: ${s.email} / ${tempPassword}`);
    }
  } else {
    console.log(`\n${sampleCount} student account(s) already exist — skipping sample creation.`);
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
