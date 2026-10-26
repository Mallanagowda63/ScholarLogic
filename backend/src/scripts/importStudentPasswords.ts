/**
 * One-off: stores the passwords from a student-logins sheet (columns "Login ID (machine code)" and "Password")
 * so Admin → Students can show them. A password is kept only if it still opens that student's login.
 * Usage: tsx src/scripts/importStudentPasswords.ts <file.xlsx> [--dry-run]
 */
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { connectDB } from '../config/db';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { sealPassword } from '../utils/credentialVault';

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!file) throw new Error('Pass the .xlsx file path');

  const wb = XLSX.readFile(file);
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  await connectDB();

  const tally = { saved: 0, alreadyStored: 0, noStudent: 0, passwordChanged: 0 };
  for (const row of rows) {
    const code = String(row['Login ID (machine code)'] || '').trim().toUpperCase();
    const password = String(row['Password'] || '');
    if (!code || !password) continue;
    const student = await Student.findOne({ $or: [{ biometricId: code }, { studentId: code }] }).select('+loginPassword userId');
    const user = student && (await User.findById(student.userId));
    if (!student || !user) {
      tally.noStudent++;
      continue;
    }
    if (student.loginPassword) {
      tally.alreadyStored++;
      continue;
    }
    if (!(await user.comparePassword(password))) {
      tally.passwordChanged++;
      continue;
    }
    if (!dryRun) await Student.updateOne({ _id: student._id }, { $set: { loginPassword: sealPassword(password) } });
    tally.saved++;
  }

  console.log(`${dryRun ? '[dry run] ' : ''}${rows.length} rows:`, tally);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
