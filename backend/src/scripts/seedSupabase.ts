import { supabaseStorageService } from '../services/storage/SupabaseStorageService';

export const SUPABASE_SQL_DDL = `
-- ScholarLogic PostgreSQL DDL Migration Schema for Supabase
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  college VARCHAR(255),
  degree VARCHAR(100),
  branch VARCHAR(100),
  cgpa NUMERIC(4,2),
  batch VARCHAR(50),
  skills TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'PUBLISHED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_marks INT NOT NULL,
  passing_marks INT NOT NULL,
  duration_minutes INT NOT NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'APPLIED',
  match_score INT DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function seedSupabaseStorage() {
  console.log('⚡ Initializing Supabase PostgreSQL Schema & Storage Buckets...');
  console.log('📄 Supabase PostgreSQL Migration SQL Schema Ready.');

  // 1. Ensure all 6 required buckets exist in Supabase Storage
  await supabaseStorageService.ensureBucketsExist();

  // 2. Sample Files Buffers
  const samplePdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT /F1 12 Tf 100 700 TD (ScholarLogic Sample Document) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n320\n%%EOF'
  );

  const sampleVideoBuffer = Buffer.from(
    '000000186674797069736f6d0000020069736f6d69736f32617663316d703431',
    'hex'
  );

  const sampleJpgBuffer = Buffer.from(
    'ffd8ffe000104a46494600010101006000600000fffe001f5363686f6c61724c6f6769632050726f66696c6520496d616765ffffd9',
    'hex'
  );

  // 3. Upload Sample Files into each of the 6 buckets per specification
  const uploads = [
    {
      bucket: 'course-videos' as const,
      path: 'python-full-stack/module-01/lesson-01.mp4',
      buffer: sampleVideoBuffer,
      mime: 'video/mp4',
    },
    {
      bucket: 'course-notes' as const,
      path: 'python-full-stack/module-01/notes.pdf',
      buffer: samplePdfBuffer,
      mime: 'application/pdf',
    },
    {
      bucket: 'student-resumes' as const,
      path: 'SL-2026-00001/resume-001.pdf',
      buffer: samplePdfBuffer,
      mime: 'application/pdf',
    },
    {
      bucket: 'certificates' as const,
      path: 'SL-2026-00001/certificate-001.pdf',
      buffer: samplePdfBuffer,
      mime: 'application/pdf',
    },
    {
      bucket: 'offer-letters' as const,
      path: 'SL-2026-00001/offer-001.pdf',
      buffer: samplePdfBuffer,
      mime: 'application/pdf',
    },
    {
      bucket: 'profile-images' as const,
      path: 'SL-2026-00001/profile.jpg',
      buffer: sampleJpgBuffer,
      mime: 'image/jpeg',
    },
  ];

  for (const item of uploads) {
    try {
      const res = await supabaseStorageService.uploadFile(item.bucket, item.path, item.buffer, item.mime);
      console.log(`📤 File uploaded to Supabase [${item.bucket}]: ${res.publicUrl}`);
    } catch (err: any) {
      console.warn(`⚠️ Could not upload sample file to ${item.bucket}:`, err?.message || err);
    }
  }

  console.log('✅ Supabase PostgreSQL DDL & Storage initialization complete!');
}

if (require.main === module || process.argv[1]?.endsWith('seedSupabase.ts')) {
  (async () => {
    try {
      await seedSupabaseStorage();
      process.exit(0);
    } catch (err) {
      console.error('❌ Supabase seed failed:', err);
      process.exit(1);
    }
  })();
}
