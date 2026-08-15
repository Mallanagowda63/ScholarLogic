import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env';

// Zod Schema for strict validation of Gemini ATS output
export const GeminiATSAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100),
  keywordMatch: z.number().min(0).max(100),
  skillsMatch: z.number().min(0).max(100),
  experienceMatch: z.number().min(0).max(100),
  educationMatch: z.number().min(0).max(100),
  projectRelevance: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  recommendedKeywords: z.array(z.string()),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
});

export type GeminiATSAnalysisOutput = z.infer<typeof GeminiATSAnalysisSchema>;

export interface ATSAnalysisResult {
  atsScore: number;
  breakdown: {
    keywordMatch: number;
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    projectRelevance: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  recommendedKeywords: string[];
  formattingIssues: string[];
  contentImprovements: string[];
  potentialConcerns: string[];
}

export class AIService {
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      } catch (err) {
        console.warn('⚠️ GoogleGenAI SDK client initialization warning:', err);
      }
    }
  }

  /**
   * Analyzes Resume text against Job Description text using Google Gemini API
   */
  async analyzeResume(
    resumeText: string,
    jobDescriptionText: string,
    studentSkills: string[]
  ): Promise<ATSAnalysisResult> {
    if (this.aiClient && env.GEMINI_API_KEY) {
      try {
        const prompt = `
You are an expert ATS (Applicant Tracking System) Resume Analyzer.
Analyze the following candidate Resume against the target Job Description.

CANDIDATE VERIFIED SKILLS:
${studentSkills.join(', ')}

RESUME TEXT:
${resumeText}

JOB DESCRIPTION TEXT:
${jobDescriptionText}

Return ONLY a raw valid JSON object (no markdown, no backticks, no markdown code blocks) with the following exact key structure:
{
  "atsScore": number (0-100),
  "keywordMatch": number (0-100),
  "skillsMatch": number (0-100),
  "experienceMatch": number (0-100),
  "educationMatch": number (0-100),
  "projectRelevance": number (0-100),
  "matchedSkills": string[],
  "missingSkills": string[],
  "recommendedKeywords": string[],
  "strengths": string[],
  "weaknesses": string[],
  "improvements": string[]
}
`;

        const response = await this.aiClient.models.generateContent({
          model: env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: prompt,
        });

        const rawText = response.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedJson = JSON.parse(jsonMatch[0]);
          
          // Validate with Zod before returning/storing
          const validated = GeminiATSAnalysisSchema.parse(parsedJson);

          return {
            atsScore: validated.atsScore,
            breakdown: {
              keywordMatch: validated.keywordMatch,
              skillsMatch: validated.skillsMatch,
              experienceMatch: validated.experienceMatch,
              educationMatch: validated.educationMatch,
              projectRelevance: validated.projectRelevance,
            },
            matchedSkills: validated.matchedSkills,
            missingSkills: validated.missingSkills,
            recommendedKeywords: validated.recommendedKeywords,
            formattingIssues: validated.weaknesses,
            contentImprovements: validated.improvements,
            potentialConcerns: validated.missingSkills.length > 3 ? [`Missing key skills: ${validated.missingSkills.slice(0, 3).join(', ')}`] : [],
          };
        }
      } catch (geminiError: any) {
        console.warn('⚠️ Google Gemini API call failed or rate-limited. Using intelligent heuristic NLP fallback:', geminiError?.message || geminiError);
      }
    }

    // Heuristic NLP fallback engine
    return this.runHeuristicAnalysis(resumeText, jobDescriptionText, studentSkills);
  }

  private runHeuristicAnalysis(
    resumeText: string,
    jobDescriptionText: string,
    studentSkills: string[]
  ): ATSAnalysisResult {
    const cleanResume = resumeText.toLowerCase();
    const cleanJD = jobDescriptionText.toLowerCase();

    const commonKeywords = [
      'python', 'javascript', 'typescript', 'react', 'node.js', 'express', 'mongodb', 'sql',
      'aws', 'cloud', 'devops', 'docker', 'kubernetes', 'ci/cd', 'git', 'rest api', 'graphql',
      'data analytics', 'power bi', 'pandas', 'numpy', 'scikit-learn', 'html', 'css', 'tailwind',
      'agile', 'scrum', 'problem solving', 'system design', 'microservices', 'unit testing'
    ];

    const jdKeywords = commonKeywords.filter((kw) => cleanJD.includes(kw));
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    const allStudentSkills = Array.from(new Set([...studentSkills, ...jdKeywords.filter((k) => cleanResume.includes(k))]));

    jdKeywords.forEach((kw) => {
      if (cleanResume.includes(kw) || allStudentSkills.map((s) => s.toLowerCase()).includes(kw)) {
        matchedSkills.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      } else {
        missingSkills.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    });

    const totalKeywords = jdKeywords.length || 5;
    const matchedCount = matchedSkills.length;
    const keywordMatchPct = Math.min(100, Math.max(40, Math.round((matchedCount / totalKeywords) * 100)));

    const skillsMatchPct = Math.min(100, Math.max(50, Math.round(keywordMatchPct * 0.95)));
    const experienceMatchPct = cleanResume.includes('experience') || cleanResume.includes('project') ? 85 : 65;
    const educationMatchPct = cleanResume.includes('b.tech') || cleanResume.includes('degree') ? 95 : 75;
    const projectRelevancePct = cleanResume.includes('project') || cleanResume.includes('built') ? 88 : 60;

    const overallAtsScore = Math.round(
      keywordMatchPct * 0.35 +
      skillsMatchPct * 0.25 +
      experienceMatchPct * 0.15 +
      educationMatchPct * 0.15 +
      projectRelevancePct * 0.10
    );

    const recommendedKeywords = missingSkills.length > 0
      ? missingSkills.slice(0, 5).map((s) => `Incorporate '${s}' into your skills and project descriptions`)
      : ['Add quantified performance metrics to project outcomes', 'Include relevant certifications section'];

    return {
      atsScore: overallAtsScore,
      breakdown: {
        keywordMatch: keywordMatchPct,
        skillsMatch: skillsMatchPct,
        experienceMatch: experienceMatchPct,
        educationMatch: educationMatchPct,
        projectRelevance: projectRelevancePct,
      },
      matchedSkills,
      missingSkills,
      recommendedKeywords,
      formattingIssues: ['Ensure email and phone number are visible in header'],
      contentImprovements: ['Use strong action verbs at start of bullet points', 'Align tech stack with job requirements'],
      potentialConcerns: missingSkills.length > 3 ? [`Target job requires missing key technical competencies: ${missingSkills.slice(0, 3).join(', ')}`] : [],
    };
  }

  matchResumeToJob(studentSkills: string[], requiredSkills: string[], cgpa: number, minCgpa: number): number {
    if (cgpa < minCgpa) return 0;
    if (requiredSkills.length === 0) return 100;

    const normStudent = studentSkills.map((s) => s.toLowerCase());
    const matched = requiredSkills.filter((req) => normStudent.includes(req.toLowerCase()));
    
    const skillScore = (matched.length / requiredSkills.length) * 100;
    const cgpaBonus = Math.min(10, (cgpa - minCgpa) * 5);

    return Math.min(100, Math.round(skillScore * 0.9 + cgpaBonus));
  }
}

export const aiService = new AIService();
