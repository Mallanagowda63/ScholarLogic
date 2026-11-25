import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

/**
 * Resume AI (Google Gemini): read an uploaded resume into editable sections, and review a resume.
 * PDFs go to Gemini as the file itself (it reads layout and scans); Word files are turned into text first.
 */

const str = z.preprocess((v) => (v == null ? '' : String(v)), z.string());
const strList = z.preprocess((v) => (Array.isArray(v) ? v.map((x) => String(x ?? '')).filter((x) => x.trim()) : []), z.array(z.string()));

export const ResumeDataSchema = z.object({
  fullName: str,
  headline: str, // target role under the name, e.g. "Data Analyst"
  email: str,
  phone: str,
  location: str,
  linkedInUrl: str,
  githubUrl: str,
  portfolioUrl: str,
  summary: str,
  skills: strList,
  experience: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.object({ company: str, role: str, startDate: str, endDate: str, description: str, highlights: strList }))
  ),
  education: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.object({ institution: str, degree: str, fieldOfStudy: str, startDate: str, endDate: str, grade: str }))
  ),
  projects: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.object({ title: str, description: str, technologies: strList, link: str }))
  ),
  certifications: strList,
});
export type ResumeDataInput = z.infer<typeof ResumeDataSchema>;

const ReviewSchema = z.object({
  score: z.preprocess((v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0))), z.number()),
  verdict: str,
  sections: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.object({ name: str, score: z.preprocess((x) => Math.max(0, Math.min(100, Math.round(Number(x) || 0))), z.number()), comment: str }))
  ),
  strengths: strList,
  improvements: strList,
  missingSections: strList,
  suggestedSkills: strList,
  improvedSummary: str,
  bulletRewrites: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.object({ before: str, after: str }))),
});
export type ResumeReview = z.infer<typeof ReviewSchema>;

const RESUME_JSON_SHAPE = `{
  "fullName": string, "headline": string, "email": string, "phone": string, "location": string,
  "linkedInUrl": string, "githubUrl": string, "portfolioUrl": string, "summary": string,
  "skills": string[],
  "experience": [{ "company": string, "role": string, "startDate": string, "endDate": string, "description": string, "highlights": string[] }],
  "education": [{ "institution": string, "degree": string, "fieldOfStudy": string, "startDate": string, "endDate": string, "grade": string }],
  "projects": [{ "title": string, "description": string, "technologies": string[], "link": string }],
  "certifications": string[]
}`;

let client: GoogleGenAI | null = null;
const ai = () => {
  if (!env.GEMINI_API_KEY) throw new AppError('The AI is not set up on the server (GEMINI_API_KEY)', 503, 'AI_NOT_CONFIGURED');
  client = client || new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
};
// Models tried in order: when one is overloaded (503), rate-limited (429), missing (404) or slow, the next one answers.
// Two rounds with a short pause, all within ~55 s so the page (and nginx) never time out.
const MODELS = () =>
  [env.GEMINI_MODEL, ...String(process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3.7-flash,gemini-3.8-flash,gemini-flash-latest,gemini-pro-latest').split(',')]
    .map((m) => String(m || '').trim())
    .filter((m, i, arr) => m && arr.indexOf(m) === i);

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`no answer within ${Math.round(ms / 1000)}s`)), ms))]);

async function askJson(parts: any[]): Promise<any> {
  const deadline = Date.now() + 55000;
  const errors: string[] = [];
  for (let round = 1; round <= 2; round++) {
    for (const model of MODELS()) {
      const left = deadline - Date.now();
      if (left < 4000) break;
      try {
        const res: any = await withTimeout(
          ai().models.generateContent({ model, contents: [{ role: 'user', parts }], config: { responseMimeType: 'application/json', temperature: 0.2 } }),
          Math.min(25000, left)
        );
        const json = String(res.text || '').match(/\{[\s\S]*\}/)?.[0];
        if (json) return JSON.parse(json);
        errors.push(`${model}: empty answer`);
      } catch (err: any) {
        const msg = String(err?.message || err);
        errors.push(`${model}: ${msg.slice(0, 70)}`);
        // A bad request (e.g. the file itself) fails the same on every model: stop early
        if (/\b400\b|INVALID_ARGUMENT/i.test(msg) && !/model/i.test(msg)) round = 3;
        if (round === 3) break;
      }
    }
    if (round < 2 && deadline - Date.now() > 8000) await new Promise((r) => setTimeout(r, 3000));
  }
  console.warn('⚠️ Resume AI failed on every model:', errors.join(' | '));
  throw new AppError('Google’s AI is very busy right now. Please try again in a few minutes.', 503, 'AI_BUSY');
}

/** Uploaded resume (PDF / DOCX / TXT) → the editable resume sections */
export async function extractResume(buffer: Buffer, mimeType: string, fileName: string): Promise<ResumeDataInput> {
  const lower = `${mimeType} ${fileName}`.toLowerCase();
  const instructions = `You read resumes. Extract everything in this resume into JSON with exactly this shape:
${RESUME_JSON_SHAPE}
Rules: copy the candidate's own words; do not invent anything. Use "" or [] when something is not in the resume.
"headline" is the job title or role the resume targets (or the current role). Dates as written (e.g. "Jun 2024", "2022").
Put each bullet point of a job into "highlights". Return only the JSON.`;
  let parts: any[];
  if (lower.includes('pdf')) {
    parts = [{ inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }, { text: instructions }];
  } else if (lower.includes('word') || lower.includes('officedocument') || lower.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    if (!value.trim()) throw new AppError('No text could be read from this Word file', 400, 'EMPTY_FILE');
    parts = [{ text: `${instructions}\n\nRESUME:\n${value.slice(0, 30000)}` }];
  } else if (lower.includes('text') || lower.endsWith('.txt')) {
    parts = [{ text: `${instructions}\n\nRESUME:\n${buffer.toString('utf8').slice(0, 30000)}` }];
  } else {
    throw new AppError('Upload a PDF or a Word (.docx) file', 400, 'UNSUPPORTED_FILE');
  }
  return ResumeDataSchema.parse(await askJson(parts));
}

/** Plain-text version of a resume, for the AI and for the job-description match */
export function resumeToText(d: Partial<ResumeDataInput>): string {
  const lines: string[] = [];
  lines.push([d.fullName, d.headline].filter(Boolean).join(' — '));
  lines.push([d.email, d.phone, d.location, d.linkedInUrl, d.githubUrl, d.portfolioUrl].filter(Boolean).join(' | '));
  if (d.summary) lines.push(`SUMMARY\n${d.summary}`);
  if (d.skills?.length) lines.push(`SKILLS\n${d.skills.join(', ')}`);
  if (d.experience?.length)
    lines.push(`EXPERIENCE\n${d.experience.map((e) => `${e.role} at ${e.company} (${e.startDate} - ${e.endDate})\n${e.description}\n${(e.highlights || []).map((h) => `- ${h}`).join('\n')}`).join('\n')}`);
  if (d.projects?.length) lines.push(`PROJECTS\n${d.projects.map((p) => `${p.title} [${(p.technologies || []).join(', ')}]\n${p.description}`).join('\n')}`);
  if (d.education?.length) lines.push(`EDUCATION\n${d.education.map((e) => `${e.degree} ${e.fieldOfStudy}, ${e.institution} (${e.startDate} - ${e.endDate}) ${e.grade}`).join('\n')}`);
  if (d.certifications?.length) lines.push(`CERTIFICATIONS\n${d.certifications.join(', ')}`);
  return lines.filter((l) => l.trim()).join('\n\n');
}

/** Honest review of a fresher's resume, with changes the student can apply in one click */
export async function reviewResume(d: Partial<ResumeDataInput>, targetRole: string): Promise<ResumeReview> {
  const text = resumeToText(d);
  if (text.length < 80) throw new AppError('The resume is almost empty. Add some details (or upload your resume) first.', 400, 'EMPTY_RESUME');
  const prompt = `You are a senior recruiter in India reviewing a resume from a student or fresher${targetRole ? ` applying for "${targetRole}" roles` : ''}.
Be specific and honest; refer to what is actually written. Return JSON with exactly this shape:
{
  "score": number 0-100 (overall quality and ATS-readiness),
  "verdict": string (one sentence),
  "sections": [{ "name": "Contact" | "Summary" | "Skills" | "Experience" | "Projects" | "Education" | "Certifications", "score": number 0-100, "comment": string }],
  "strengths": string[] (2-5),
  "improvements": string[] (3-7 concrete actions),
  "missingSections": string[],
  "suggestedSkills": string[] (skills worth adding for the target role, not already listed),
  "improvedSummary": string (a better 2-3 sentence summary using only facts from the resume),
  "bulletRewrites": [{ "before": string (an existing line copied exactly), "after": string (stronger: action verb, impact, numbers only if present) }] (up to 5)
}
Return only the JSON.

RESUME:
${text.slice(0, 30000)}`;
  return ReviewSchema.parse(await askJson([{ text: prompt }]));
}
