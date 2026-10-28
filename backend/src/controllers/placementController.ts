import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Application, COUNTED_APPLICATION } from '../models/Application';
import { AuditLog } from '../models/AuditLog';
import { Student } from '../models/Student';
import { Resume } from '../models/Resume';
import { AppError } from '../middleware/errorHandler';
import { PLACEHOLDER_EMAIL_DOMAIN } from '../services/trackingService';

// Only http(s) links are stored, so a job can never send students to a javascript: or file: URL
const cleanApplyUrl = (raw: unknown) => {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new AppError('The company application link is not a valid web address', 400, 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new AppError('The company application link must start with http:// or https://', 400, 'INVALID_URL');
  return url.toString();
};
const realEmail = (email?: string) => (email && !email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`) ? email : '');

export const getPlacementOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  const partnerCompanyCount = await Company.countDocuments();
  const hiringNowCompaniesCount = await Company.countDocuments({ hiringStatus: 'HIRING_NOW' });

  const jobs = await Job.find({ status: 'OPEN' });
  // Jobs students can still apply to
  const openPositionsCount = jobs.filter((j) => new Date(j.deadline).getTime() > Date.now()).length;
  const notCompletedCount = await Application.countDocuments({ appliedVia: 'COMPANY_SITE', completion: { $ne: 'COMPLETED' } });

  const totalApplicationsCount = await Application.countDocuments(COUNTED_APPLICATION);
  const shortlistedCandidatesCount = await Application.countDocuments({ status: { $in: ['SHORTLISTED', 'TECH_INTERVIEW', 'HR_INTERVIEW', 'OFFERED', 'JOINED'] } });
  const interviewsScheduledCount = await Application.countDocuments({ status: { $in: ['TECH_INTERVIEW', 'HR_INTERVIEW'] } });
  const offersCount = await Application.countDocuments({ status: { $in: ['OFFERED', 'JOINED'] } });
  const studentsPlacedCount = await Application.countDocuments({ status: 'JOINED' });

  const totalStudents = await Student.countDocuments();
  const placementRatePct = totalStudents > 0 ? Math.min(100, Math.round((studentsPlacedCount / totalStudents) * 100)) : 0;

  const pipeline = {
    applied: await Application.countDocuments({ status: 'APPLIED', ...COUNTED_APPLICATION }),
    shortlisted: await Application.countDocuments({ status: 'SHORTLISTED' }),
    assessment: await Application.countDocuments({ status: 'ASSESSMENT' }),
    techInterview: await Application.countDocuments({ status: 'TECH_INTERVIEW' }),
    hrInterview: await Application.countDocuments({ status: 'HR_INTERVIEW' }),
    offered: offersCount,
    joined: studentsPlacedCount,
  };

  const topCompanies = await Company.find({ hiringStatus: 'HIRING_NOW' }).limit(5);
  const recentJobDiscoveries = await Job.find().populate('companyId', 'name logoUrl website').sort({ createdAt: -1 }).limit(5);

  const allRequiredSkills = jobs.flatMap((j) => j.requiredSkills);
  const skillCounts: Record<string, number> = {};
  allRequiredSkills.forEach((sk) => {
    const normalized = sk.trim();
    skillCounts[normalized] = (skillCounts[normalized] || 0) + 1;
  });

  const topSkillsInDemand = Object.entries(skillCounts)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  res.json({
    success: true,
    data: {
      metrics: {
        partnerCompanyCount,
        activeHiringCompaniesCount: hiringNowCompaniesCount,
        hiringNowCompaniesCount,
        openPositionsCount,
        totalApplicationsCount,
        notCompletedCount,
        shortlistedCandidatesCount,
        interviewsScheduledCount,
        offersCount,
        studentsPlacedCount,
        placementRatePct,
      },
      pipeline,
      topCompanies,
      recentJobDiscoveries,
      topSkillsInDemand,
    },
  });
};

export const getCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  const { hiringStatus, industry } = req.query;

  const query: any = {};
  if (hiringStatus) query.hiringStatus = hiringStatus;
  if (industry) query.industry = industry;

  const companies = await Company.find(query).sort({ createdAt: -1 });

  const formattedCompanies = await Promise.all(
    companies.map(async (comp) => {
      const companyJobs = await Job.find({ companyId: comp._id });
      const jobIds = companyJobs.map((j) => j._id);

      const applicationsCount = await Application.countDocuments({ jobId: { $in: jobIds }, ...COUNTED_APPLICATION });
      const shortlistedCount = await Application.countDocuments({ jobId: { $in: jobIds }, status: { $in: ['SHORTLISTED', 'OFFERED', 'JOINED'] } });
      const offersCount = await Application.countDocuments({ jobId: { $in: jobIds }, status: { $in: ['OFFERED', 'JOINED'] } });

      return {
        ...comp.toObject(),
        openPositionsCount: companyJobs.length,
        scholarlogicApplicationsCount: applicationsCount,
        shortlistedCount,
        offersCount,
      };
    })
  );

  res.json({
    success: true,
    data: { companies: formattedCompanies },
  });
};

export const getCompanyDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const company = await Company.findById(id);
  if (!company) throw new AppError('Company not found', 404, 'NOT_FOUND');

  const jobs = await Job.find({ companyId: company._id }).sort({ createdAt: -1 });
  const jobIds = jobs.map((j) => j._id);

  const applications = await Application.find({ jobId: { $in: jobIds } })
    .populate({
      path: 'studentId',
      select: 'studentId branch cgpa',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate('jobId', 'title');

  res.json({
    success: true,
    data: {
      company,
      jobs,
      applications,
    },
  });
};

export const verifyCompanyHiringStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const company = await Company.findById(id);
  if (!company) throw new AppError('Company not found', 404, 'NOT_FOUND');

  company.verificationStatus = 'VERIFIED';
  company.hiringStatus = 'HIRING_NOW';
  company.lastVerifiedAt = new Date();
  await company.save();

  res.json({
    success: true,
    message: `Official hiring status for ${company.name} verified successfully from official careers page.`,
    data: { company },
  });
};

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, website, officialCareersUrl, industry, description, location, contactEmail, headquarters } = req.body;

  if (!String(name || '').trim()) {
    throw new AppError('Company name is required', 400, 'MISSING_FIELDS');
  }
  const escaped = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (await Company.exists({ name: { $regex: `^${escaped}$`, $options: 'i' } })) {
    throw new AppError('This company is already in the list', 409, 'DUPLICATE');
  }
  const place = String(location || '').trim() || 'India';

  // Only links the placement team actually gave; nothing is made up
  const company = await Company.create({
    name: String(name).trim(),
    website: website ? cleanApplyUrl(website) : '',
    officialCareersUrl: officialCareersUrl ? cleanApplyUrl(officialCareersUrl) : '',
    industry: industry || 'Information Technology',
    description: description || '',
    location: place,
    headquarters: headquarters || place,
    contactEmail: contactEmail || '',
    hiringStatus: 'HIRING_NOW',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: new Date(),
    sourceType: 'OFFICIAL_COMPANY_CAREERS',
  });

  res.status(201).json({
    success: true,
    message: 'Company registered successfully',
    data: { company },
  });
};

export const getJobPostings = async (req: AuthRequest, res: Response): Promise<void> => {
  const { postingType, type } = req.query;

  const query: any = {};
  if (postingType) {
    query.postingType = postingType;
  } else if (type === 'official') {
    query.postingType = 'OFFICIAL_COMPANY_POSTING';
  } else if (type === 'scholarlogic') {
    query.postingType = 'SCHOLARLOGIC_POSTING';
  }
  // Draft postings are only visible to staff
  if (req.user?.role === 'STUDENT') {
    query.status = { $ne: 'DRAFT' };
  }

  const jobs = await Job.find(query)
    .populate('companyId', 'name logoUrl website officialCareersUrl hiringStatus verificationStatus')
    .sort({ createdAt: -1 });

  let studentApplicationMap: Record<string, string> = {};
  const externalMap: Record<string, { applicationId: string; completion: string }> = {};
  const linkStats: Record<string, { clicks: number; students: number; completed: number; notCompleted: number; portal: number }> = {};
  if (req.user && req.user.role !== 'STUDENT') {
    // Placement team: per job, how many opened the company link and how many finished applying
    const rows = await Application.aggregate([
      { $match: { jobId: { $in: jobs.map((j) => j._id) } } },
      {
        $group: {
          _id: '$jobId',
          clicks: { $sum: { $ifNull: ['$linkClicks', 0] } },
          students: { $sum: { $cond: [{ $eq: ['$appliedVia', 'COMPANY_SITE'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $and: [{ $eq: ['$appliedVia', 'COMPANY_SITE'] }, { $eq: ['$completion', 'COMPLETED'] }] }, 1, 0] } },
          portal: { $sum: { $cond: [{ $ne: ['$appliedVia', 'COMPANY_SITE'] }, 1, 0] } },
        },
      },
    ]);
    rows.forEach((r) => {
      linkStats[String(r._id)] = { clicks: r.clicks, students: r.students, completed: r.completed, notCompleted: r.students - r.completed, portal: r.portal };
    });
  }
  if (req.user && req.user.role === 'STUDENT') {
    let student = await Student.findOne({ userId: req.user.userId });
    if (student) {
      const studentApps = await Application.find({
        $or: [{ studentId: student._id }, { studentId: req.user.userId }],
      });
      studentApps.forEach((app) => {
        if (!app.jobId) return;
        const key = app.jobId.toString();
        // A company-site click only counts as applied once the student confirms they finished
        if (app.appliedVia === 'COMPANY_SITE') {
          externalMap[key] = { applicationId: String(app._id), completion: app.completion || 'PENDING' };
          if (app.completion !== 'COMPLETED') return;
        }
        studentApplicationMap[key] = app.status;
      });
    }
  }

  const formattedJobs = jobs.map((j) => ({
    ...j.toObject(),
    matchScore: 92,
    appliedStatus: studentApplicationMap[j._id.toString()] || null,
    externalApplication: externalMap[j._id.toString()] || null,
    linkStats: linkStats[j._id.toString()] || undefined,
  }));

  res.json({
    success: true,
    data: { jobs: formattedJobs },
  });
};

export const getOfficialJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await Job.find({
    $or: [
      { postingType: 'OFFICIAL_COMPANY_POSTING' },
      { sourceType: 'OFFICIAL_CAREERS_PAGE' },
      { status: 'OPEN' },
    ],
  })
    .populate('companyId')
    .sort({ lastVerifiedAt: -1, createdAt: -1 });

  const officialJobs = jobs.map((job) => {
    const comp: any = job.companyId || {};
    return {
      _id: job._id,
      companyName: comp.name || 'Partner Company',
      companyLogo: comp.logoUrl || '',
      officialWebsite: comp.website || '',
      officialCareersUrl: comp.officialCareersUrl || `${comp.website || 'https://example.com'}/careers`,
      jobTitle: job.title,
      location: job.location,
      workMode: job.location?.toLowerCase().includes('remote') ? 'Remote' : job.location?.toLowerCase().includes('hybrid') ? 'Hybrid' : 'On-site',
      employmentType: job.type || 'FULL_TIME',
      salaryPackage: job.salaryPackage || 'Not specified',
      requiredSkills: job.requiredSkills || [],
      eligibilityCriteria: job.eligibilityCriteria || { minCgpa: 6.0 },
      description: job.description,
      deadline: job.deadline,
      sourceUrl: job.sourceUrl || comp.officialCareersUrl || '',
      sourceType: job.sourceType || 'OFFICIAL_COMPANY_CAREERS',
      lastVerifiedAt: job.lastVerifiedAt || comp.lastVerifiedAt || new Date(),
      verificationStatus: comp.verificationStatus || 'VERIFIED',
      postingType: job.postingType || 'OFFICIAL_COMPANY_POSTING',
    };
  });

  res.json({
    success: true,
    data: { jobs: officialJobs },
  });
};

export const getHiringNowJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await Job.find({
    status: 'OPEN',
    deadline: { $gte: new Date() },
  })
    .populate('companyId')
    .sort({ lastVerifiedAt: -1, createdAt: -1 });

  res.json({
    success: true,
    data: { jobs },
  });
};

export const getJobDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const job = await Job.findById(id).populate('companyId', 'name logoUrl website officialCareersUrl hiringStatus verificationStatus industry description location');
  if (!job) throw new AppError('Job posting not found', 404, 'JOB_NOT_FOUND');

  let appliedStatus = null;
  if (req.user && req.user.role === 'STUDENT') {
    let student = await Student.findOne({ userId: req.user.userId });
    if (student) {
      const existingApp = await Application.findOne({
        jobId: job._id,
        $or: [{ studentId: student._id }, { studentId: req.user.userId }],
      });
      if (existingApp) appliedStatus = existingApp.status;
    }
  }

  res.json({
    success: true,
    data: {
      job,
      appliedStatus,
    },
  });
};

export const checkEligibility = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can check eligibility', 403, 'FORBIDDEN');
  }

  let student = await Student.findOne({ userId: req.user.userId }).populate('userId', 'fullName email');
  if (!student) throw new AppError('Student profile not found', 404, 'STUDENT_NOT_FOUND');

  let job = await Job.findById(id);
  if (!job) {
    job = await Job.findOne({ status: 'OPEN' });
  }
  if (!job) throw new AppError('Job posting not found. Please refresh the page to view current active job drives.', 404, 'JOB_NOT_FOUND');

  const reasons: string[] = [];
  const minCgpa = job.eligibilityCriteria?.minCgpa ?? 6.0;

  // 0 = open to everyone
  if (minCgpa > 0 && student.cgpa < minCgpa) {
    reasons.push(`Minimum CGPA required is ${minCgpa}, but your CGPA is ${student.cgpa}.`);
  }

  if (job.status !== 'OPEN') {
    reasons.push('This job application drive is currently closed.');
  }

  if (new Date() > new Date(job.deadline)) {
    reasons.push('The application deadline for this job posting has expired.');
  }

  const existingApp = await Application.findOne({
    jobId: job._id,
    $or: [{ studentId: student._id }, { studentId: req.user.userId }],
  });
  const isApplied = !!existingApp;
  if (isApplied) {
    reasons.push(`You have already applied for this position (Status: ${existingApp.status}).`);
  }

  const eligible = reasons.length === 0;

  res.json({
    success: true,
    data: {
      eligible,
      reasons,
      isApplied,
      studentSummary: {
        fullName: (student.userId as any)?.fullName,
        studentId: student.studentId,
        email: (student.userId as any)?.email,
        phone: student.phone || '',
        college: student.college,
        degree: student.degree,
        branch: student.branch,
        cgpa: student.cgpa,
        graduationYear: student.graduationYear,
        skills: student.skills,
        certifications: student.certifications,
      },
    },
  });
};

export const applyToJob = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id: jobId } = req.params;
  const { resumeId, coverLetter, answers, selectedCertificates, documents } = req.body;

  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can apply to jobs', 403, 'FORBIDDEN');
  }

  let student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student profile not found', 404, 'STUDENT_NOT_FOUND');

  let job = await Job.findById(jobId);
  if (!job) {
    job = await Job.findOne({ status: 'OPEN' });
  }
  if (!job) throw new AppError('Job posting not found. Please refresh the page to view current active job drives.', 404, 'JOB_NOT_FOUND');

  if (job.status !== 'OPEN') {
    throw new AppError('This job drive is closed', 400, 'JOB_CLOSED');
  }

  if (new Date() > new Date(job.deadline)) {
    throw new AppError('The application deadline has passed', 400, 'DEADLINE_EXCEEDED');
  }

  const minCgpa = job.eligibilityCriteria?.minCgpa ?? 6.0;
  if (minCgpa > 0 && student.cgpa < minCgpa) {
    throw new AppError(`Your CGPA (${student.cgpa}) does not meet the minimum requirement of ${minCgpa}`, 400, 'NOT_ELIGIBLE');
  }

  const existingApp = await Application.findOne({
    jobId: job._id,
    $or: [{ studentId: student._id }, { studentId: req.user.userId }],
  });
  if (existingApp) {
    throw new AppError('You have already applied for this job position', 400, 'ALREADY_APPLIED');
  }

  let targetResumeId = resumeId;
  if (!targetResumeId) {
    const defaultResume = await Resume.findOne({ studentId: student._id }).sort({ createdAt: -1 });
    if (defaultResume) {
      targetResumeId = defaultResume._id;
    } else {
      const studentUserDoc: any = await student.populate('userId', 'fullName email');
      const userFullName = studentUserDoc?.userId?.fullName || req.user.fullName || 'Student Applicant';
      const userEmail = studentUserDoc?.userId?.email || req.user.email || 'student@scholarlogic.edu';

      const newRes = await Resume.create({
        studentId: student._id,
        title: `${userFullName} Resume`,
        versionName: 'Primary Resume',
        template: 'MODERN',
        isDefault: true,
        data: {
          fullName: userFullName,
          email: userEmail,
          phone: student.phone || '+91 98765 43210',
          location: student.location || 'Bangalore, India',
          summary: `Student pursuing ${student.degree || 'B.Tech'}${student.branch ? ` in ${student.branch}` : ''}.`,
          skills: student.skills?.length ? student.skills : ['Python', 'JavaScript', 'SQL', 'React', 'Git'],
          experience: [],
          education: [
            {
              institution: student.college || '',
              degree: student.degree || 'B.Tech',
              fieldOfStudy: student.branch || '',
              startDate: '2022',
              endDate: String(student.graduationYear || 2026),
              grade: `CGPA: ${student.cgpa || 8.5}`,
            },
          ],
          projects: [],
          certifications: [],
        },
      });
      targetResumeId = newRes._id;
    }
  }

  const application = await Application.create({
    jobId: job._id,
    studentId: student._id,
    companyId: job.companyId,
    resumeId: targetResumeId,
    coverLetter: coverLetter || '',
    answers: answers || [],
    selectedCertificates: selectedCertificates || [],
    documents: documents || [],
    status: 'APPLIED',
    placementRound: 'Initial Application',
    matchScore: 92,
    appliedAt: new Date(),
  });

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully to placement drive!',
    data: {
      application,
      applicationId: `SL-APP-${application._id.toString().slice(-8).toUpperCase()}`,
    },
  });
};

export const getStudentApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can fetch their applications', 403, 'FORBIDDEN');
  }

  let student = await Student.findOne({ userId: req.user.userId });

  const queryIds: any[] = [];
  if (req.user.userId) {
    queryIds.push(req.user.userId);
    if (mongoose.Types.ObjectId.isValid(req.user.userId)) {
      queryIds.push(new mongoose.Types.ObjectId(req.user.userId));
    }
  }

  if (student) {
    queryIds.push(student._id);
    queryIds.push(student._id.toString());
    // Note: student.studentId (e.g. "SL-2026-00001") is a display ID, not an ObjectId.
    // Application.studentId is an ObjectId ref, so including it makes the whole query throw a CastError.
  }

  const applications = await Application.find({
    $or: [
      { studentId: { $in: queryIds } },
      ...(student ? [{ studentId: student._id }] : []),
      { studentId: req.user.userId },
    ],
  })
    .populate({
      path: 'jobId',
      populate: { path: 'companyId' },
    })
    .populate('companyId')
    .populate('resumeId')
    .sort({ updatedAt: -1, createdAt: -1 });

  const formattedApplications = applications.map((app) => {
    const obj: any = app.toObject();
    const appId = `SL-APP-${app._id.toString().slice(-6).toUpperCase()}`;
    return {
      ...obj,
      applicationId: appId,
      job: obj.jobId,
      company: obj.companyId || obj.jobId?.companyId,
    };
  });

  res.json({
    success: true,
    data: { applications: formattedApplications },
    applications: formattedApplications,
  });
};

export const getApplicationDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const application = await Application.findById(id)
    .populate('jobId')
    .populate('companyId')
    .populate('resumeId')
    .populate({
      path: 'studentId',
      select: 'studentId college degree branch cgpa phone',
      populate: { path: 'userId', select: 'fullName email' },
    });

  if (!application) throw new AppError('Application record not found', 404, 'NOT_FOUND');

  res.json({
    success: true,
    data: { application },
  });
};

export const createJobPosting = async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, type, postingType, location, salaryPackage, requiredSkills, eligibilityCriteria, deadline, openings, sourceUrl, applyUrl } = req.body;
  let { companyId } = req.body;
  const companyName = String(req.body.companyName || '').trim();

  // The placement team pastes the whole job post; location and salary are optional extras
  if (!title || (!companyId && !companyName) || !description) {
    throw new AppError('Company, job title and the job post are required', 400, 'MISSING_FIELDS');
  }
  const place = String(location || '').trim() || 'See job details';
  const pay = String(salaryPackage || '').trim() || 'See job details';

  // A typed company name: reuse the company with that name, or add it (details can be completed later)
  if (!companyId) {
    const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Company.findOne({ name: { $regex: `^${escaped}$`, $options: 'i' } }).select('_id');
    companyId = existing
      ? existing._id
      : (
          await Company.create({
            name: companyName,
            location: place,
            headquarters: place,
            hiringStatus: 'HIRING_NOW',
            verificationStatus: 'PENDING',
            sourceType: 'SCHOLARLOGIC_INTERNAL',
          })
        )._id;
  } else if (!mongoose.isValidObjectId(companyId) || !(await Company.exists({ _id: companyId }))) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const job = await Job.create({
    title,
    companyId,
    description,
    type: type || 'FULL_TIME',
    postingType: postingType || 'SCHOLARLOGIC_POSTING',
    location: place,
    salaryPackage: pay,
    requiredSkills: Array.isArray(requiredSkills) ? requiredSkills.map((x: unknown) => String(x).trim()).filter(Boolean) : [],
    // Open to every student unless the placement team sets limits
    eligibilityCriteria: eligibilityCriteria || { minCgpa: 0, allowedBranches: [], passoutYears: [] },
    deadline: deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    openings: openings || 5,
    status: 'OPEN',
    sourceUrl: sourceUrl || '',
    applyUrl: cleanApplyUrl(applyUrl),
    sourceType: postingType === 'OFFICIAL_COMPANY_POSTING' ? 'OFFICIAL_CAREERS_PAGE' : 'SCHOLARLOGIC_INTERNAL',
    lastVerifiedAt: new Date(),
    createdById: req.user!.userId,
  });

  res.status(201).json({
    success: true,
    message: 'Job posting published successfully',
    data: { job },
  });
};

function normalizeSkillName(raw: string): string {
  const s = raw.trim();
  const lower = s.toLowerCase();
  if (lower === 'python') return 'Python';
  if (lower === 'react' || lower === 'react.js' || lower === 'reactjs') return 'React';
  if (lower === 'sql' || lower === 'mysql' || lower === 'postgresql') return 'SQL';
  if (lower === 'node.js' || lower === 'node' || lower === 'nodejs') return 'Node.js';
  if (lower === 'aws' || lower === 'amazon web services') return 'AWS';
  if (lower === 'docker') return 'Docker';
  if (lower === 'java') return 'Java';
  if (lower === 'typescript') return 'TypeScript';
  if (lower === 'javascript' || lower === 'js') return 'JavaScript';
  if (lower === 'git' || lower === 'github') return 'Git';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeLocationName(raw: string): { canonicalLocation: string; originalLocation: string } {
  const originalLocation = raw.trim();
  const lower = originalLocation.toLowerCase();

  if (lower.includes('bengaluru') || lower.includes('bangalore')) {
    return { canonicalLocation: 'Bangalore', originalLocation };
  }
  if (lower.includes('delhi') || lower.includes('noida') || lower.includes('gurgaon') || lower.includes('gurugram')) {
    return { canonicalLocation: 'Delhi NCR', originalLocation };
  }
  if (lower.includes('mumbai') || lower.includes('pune')) {
    return { canonicalLocation: 'Mumbai / Pune', originalLocation };
  }
  if (lower.includes('hyderabad')) {
    return { canonicalLocation: 'Hyderabad', originalLocation };
  }
  if (lower.includes('chennai')) {
    return { canonicalLocation: 'Chennai', originalLocation };
  }
  if (lower.includes('remote')) {
    return { canonicalLocation: 'Remote', originalLocation };
  }
  return { canonicalLocation: originalLocation, originalLocation };
}

export const getSkillsInDemand = async (req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await Job.find({ status: 'OPEN' });
  const totalJobs = jobs.length;

  const skillCounts: Record<string, number> = {};
  jobs.forEach((job) => {
    (job.requiredSkills || []).forEach((rawSkill) => {
      const canonical = normalizeSkillName(rawSkill);
      skillCounts[canonical] = (skillCounts[canonical] || 0) + 1;
    });
  });

  const skills = Object.entries(skillCounts)
    .map(([skill, jobCount]) => ({
      skill,
      jobCount,
      percentage: totalJobs > 0 ? Math.round((jobCount / totalJobs) * 100) : 0,
    }))
    .sort((a, b) => b.jobCount - a.jobCount);

  let matchedStudentSkills: string[] = [];
  let recommendedStudentSkills: string[] = [];

  if (req.user && req.user.role === 'STUDENT') {
    const student = await Student.findOne({ userId: req.user.userId });
    if (student && student.skills) {
      const studentSkillSet = new Set(student.skills.map((s) => normalizeSkillName(s)));
      skills.forEach((item) => {
        if (studentSkillSet.has(item.skill)) {
          matchedStudentSkills.push(item.skill);
        } else {
          recommendedStudentSkills.push(item.skill);
        }
      });
    }
  }

  res.json({
    success: true,
    data: {
      totalJobs,
      skills,
      studentPersonalization: {
        matchedSkills: matchedStudentSkills,
        recommendedSkills: recommendedStudentSkills,
      },
    },
  });
};

export const getHiringLocations = async (req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await Job.find({ status: 'OPEN' });
  const totalJobs = jobs.length;

  const locationMap: Record<string, { jobCount: number; originalLocation: string; workModes: { onSite: number; hybrid: number; remote: number } }> = {};

  jobs.forEach((job) => {
    const { canonicalLocation, originalLocation } = normalizeLocationName(job.location || 'Bangalore');
    if (!locationMap[canonicalLocation]) {
      locationMap[canonicalLocation] = {
        jobCount: 0,
        originalLocation,
        workModes: { onSite: 0, hybrid: 0, remote: 0 },
      };
    }

    locationMap[canonicalLocation].jobCount += 1;

    const locLower = (job.location || '').toLowerCase();
    if (locLower.includes('remote')) {
      locationMap[canonicalLocation].workModes.remote += 1;
    } else if (locLower.includes('hybrid')) {
      locationMap[canonicalLocation].workModes.hybrid += 1;
    } else {
      locationMap[canonicalLocation].workModes.onSite += 1;
    }
  });

  const locations = Object.entries(locationMap)
    .map(([canonicalLocation, data]) => ({
      canonicalLocation,
      originalLocation: data.originalLocation,
      jobCount: data.jobCount,
      percentage: totalJobs > 0 ? Math.round((data.jobCount / totalJobs) * 100) : 0,
      workModes: data.workModes,
    }))
    .sort((a, b) => b.jobCount - a.jobCount);

  res.json({
    success: true,
    data: {
      totalJobs,
      locations,
    },
  });
};

export const getHiringTrends = async (req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await Job.find().sort({ createdAt: 1 });

  const monthlyCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    const monthKey = new Date(j.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
  });

  const trendEntries = Object.entries(monthlyCounts).map(([month, count]) => ({ month, count }));

  if (trendEntries.length < 2) {
    res.json({
      success: true,
      data: {
        hasData: false,
        message: 'Not enough historical data to calculate hiring trends.',
        trends: trendEntries,
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      hasData: true,
      trends: trendEntries,
    },
  });
};

export const getHiringIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await Job.find({ status: 'OPEN' }).populate('companyId', 'industry location');

  const industryCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    const ind = (j.companyId as any)?.industry || 'Technology';
    industryCounts[ind] = (industryCounts[ind] || 0) + 1;
  });

  const hiringByIndustry = Object.entries(industryCounts).map(([industry, count]) => ({ industry, count }));

  const locationCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    const { canonicalLocation } = normalizeLocationName(j.location || 'Bangalore');
    locationCounts[canonicalLocation] = (locationCounts[canonicalLocation] || 0) + 1;
  });

  const hiringLocations = Object.entries(locationCounts).map(([location, count]) => ({ location, count }));

  const allSkills = jobs.flatMap((j) => j.requiredSkills || []);
  const skillMap: Record<string, number> = {};
  allSkills.forEach((sk) => {
    const canonical = normalizeSkillName(sk);
    skillMap[canonical] = (skillMap[canonical] || 0) + 1;
  });

  const skillsInDemand = Object.entries(skillMap)
    .map(([skill, demandCount]) => ({ skill, demandCount }))
    .sort((a, b) => b.demandCount - a.demandCount);

  res.json({
    success: true,
    data: {
      hiringByIndustry,
      hiringLocations,
      skillsInDemand,
    },
  });
};

export const compareCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  const { ids } = req.query;
  const companyIds = typeof ids === 'string' ? ids.split(',') : [];

  let query: any = {};
  if (companyIds.length > 0) {
    query._id = { $in: companyIds };
  }

  const companies = await Company.find(query).limit(6);

  const comparison = await Promise.all(
    companies.map(async (c) => {
      const companyJobs = await Job.find({ companyId: c._id });
      const jobIds = companyJobs.map((j) => j._id);
      const applicationsCount = await Application.countDocuments({ jobId: { $in: jobIds }, ...COUNTED_APPLICATION });
      const offersCount = await Application.countDocuments({ jobId: { $in: jobIds }, status: { $in: ['OFFERED', 'JOINED'] } });

      const allSkills = companyJobs.flatMap((j) => j.requiredSkills || []);
      const uniqueSkills = Array.from(new Set(allSkills.map((s) => normalizeSkillName(s)))).slice(0, 5);

      const locations = Array.from(new Set(companyJobs.map((j) => normalizeLocationName(j.location || '').canonicalLocation)));

      return {
        _id: c._id,
        name: c.name,
        logoUrl: c.logoUrl,
        industry: c.industry,
        location: c.location,
        locations: locations.length > 0 ? locations : [c.location],
        hiringStatus: c.hiringStatus,
        officialCareersUrl: c.officialCareersUrl,
        openRoles: companyJobs.length,
        scholarlogicApplications: applicationsCount,
        offersIssued: offersCount,
        topSkills: uniqueSkills,
        lastVerifiedAt: c.lastVerifiedAt,
      };
    })
  );

  res.json({
    success: true,
    data: { comparison },
  });
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, notes, interviewDate } = req.body;

  const application = await Application.findById(id)
    .populate('jobId', 'title')
    .populate('companyId', 'name')
    .populate({
      path: 'studentId',
      select: 'studentId fullName email',
      populate: { path: 'userId', select: 'fullName email' },
    });

  if (!application) throw new AppError('Application not found', 404, 'NOT_FOUND');

  application.status = status;
  if (notes) application.placementRound = notes;
  if (interviewDate) application.interviewDate = new Date(interviewDate);
  await application.save();

  // Send status email trigger
  const studentEmail = (application.studentId as any)?.userId?.email || (application.studentId as any)?.email;
  const studentName = (application.studentId as any)?.userId?.fullName || (application.studentId as any)?.fullName || 'Student';
  const companyName = (application.companyId as any)?.name || 'Target Company';
  const jobTitle = (application.jobId as any)?.title || 'Job Position';

  if (studentEmail) {
    const { emailService } = await import('../services/emailService');
    await emailService.sendApplicationStatusEmail(studentEmail, studentName, companyName, jobTitle, status);
  }

  res.json({
    success: true,
    message: `Application status updated to ${status}`,
    data: { application },
  });
};

export const exportApplicantsCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  const applications = await Application.find()
    .populate('jobId', 'title')
    .populate('companyId', 'name')
    .populate({
      path: 'studentId',
      select: 'studentId branch cgpa phone',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .sort({ createdAt: -1 });

  let csv = 'Application ID,Student ID,Student Name,Email,Phone,Branch,CGPA,Job Title,Company,Applied Via,Completed,Link Clicks,Status,Applied Date\n';

  applications.forEach((app: any) => {
    const appId = `SL-APP-${app._id.toString().slice(-6).toUpperCase()}`;
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const s = app.studentId;
    const via = app.appliedVia === 'COMPANY_SITE' ? 'Company website' : 'ScholarLogic portal';
    const date = new Date(app.appliedAt || app.createdAt).toLocaleDateString();
    const done = app.appliedVia !== 'COMPANY_SITE' || app.completion === 'COMPLETED' ? 'Yes' : 'Not completed';
    const clicks = app.appliedVia === 'COMPANY_SITE' ? app.linkClicks || 0 : '';
    csv += [appId, s?.studentId, s?.userId?.fullName, realEmail(s?.userId?.email), s?.phone, s?.branch, s?.cgpa, app.jobId?.title, app.companyId?.name, via, done, clicks, app.status, date].map(q).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="scholarlogic-applicants.csv"');
  res.status(200).send(csv);
};

export const getInterviewICS = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const application = await Application.findById(id)
    .populate('jobId', 'title')
    .populate('companyId', 'name')
    .populate({
      path: 'studentId',
      select: 'studentId',
      populate: { path: 'userId', select: 'fullName email' },
    });

  if (!application) throw new AppError('Application not found', 404, 'NOT_FOUND');

  const startDate = application.interviewDate || new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatDateStr = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScholarLogic Placement Hub//EN',
    'BEGIN:VEVENT',
    `UID:interview-${application._id}@scholarlogic.edu`,
    `DTSTAMP:${formatDateStr(new Date())}`,
    `DTSTART:${formatDateStr(startDate)}`,
    `DTEND:${formatDateStr(endDate)}`,
    `SUMMARY:Technical Interview - ${(application.jobId as any)?.title || 'Position'} at ${(application.companyId as any)?.name || 'Company'}`,
    `DESCRIPTION:ScholarLogic Official Placement Drive Technical Interview for ${(application.studentId as any)?.userId?.fullName || 'Candidate'}.`,
    'LOCATION:ScholarLogic Virtual Interview Platform / Google Meet',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', `attachment; filename="interview-${application._id}.ics"`);
  res.status(200).send(icsContent);
};

/**
 * Student clicked Apply on a job that has the company's own application link. The student finishes
 * the application on the company's site; ScholarLogic records who went to apply and when, once per job.
 */
export const recordExternalApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') throw new AppError('Only students can apply to jobs', 403, 'FORBIDDEN');
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid job', 400, 'INVALID_ID');
  const student = await Student.findOne({ userId: req.user.userId }).select('_id');
  if (!student) throw new AppError('Student profile not found', 404, 'STUDENT_NOT_FOUND');
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError('Job posting not found', 404, 'JOB_NOT_FOUND');
  if (!job.applyUrl) throw new AppError('This job has no company application link', 400, 'NO_APPLY_URL');

  const existing = await Application.findOne({ jobId: job._id, studentId: student._id });
  if (existing) {
    // Opening the company's page again is fine; count the click
    if (existing.appliedVia === 'COMPANY_SITE') {
      existing.linkClicks = (existing.linkClicks || 0) + 1;
      existing.lastClickedAt = new Date();
      if (!existing.completion) existing.completion = 'PENDING';
      await existing.save();
    }
    res.json({ success: true, message: 'Already recorded', data: { applyUrl: job.applyUrl, alreadyApplied: existing.completion === 'COMPLETED', application: existing } });
    return;
  }
  if (job.status !== 'OPEN') throw new AppError('This job drive is closed', 400, 'JOB_CLOSED');
  if (new Date() > new Date(job.deadline)) throw new AppError('The application deadline has passed', 400, 'DEADLINE_EXCEEDED');

  const application = await Application.create({
    jobId: job._id,
    studentId: student._id,
    companyId: job.companyId,
    status: 'APPLIED',
    placementRound: 'Applied on company website',
    appliedVia: 'COMPANY_SITE',
    externalApplyUrl: job.applyUrl,
    appliedAt: new Date(),
    linkClicks: 1,
    lastClickedAt: new Date(),
    completion: 'PENDING',
  });
  res.status(201).json({ success: true, message: 'Link opened', data: { applyUrl: job.applyUrl, alreadyApplied: false, application } });
};

// Student, back from the company's page: "I finished applying" or "I didn't finish"
export const confirmExternalApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') throw new AppError('Only students can confirm their applications', 403, 'FORBIDDEN');
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid application', 400, 'INVALID_ID');
  if (typeof req.body?.completed !== 'boolean') throw new AppError('Say whether you finished applying', 400, 'MISSING_FIELDS');
  const student = await Student.findOne({ userId: req.user.userId }).select('_id');
  const app = student && (await Application.findOne({ _id: req.params.id, studentId: student._id, appliedVia: 'COMPANY_SITE' }));
  if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');
  app.completion = req.body.completed ? 'COMPLETED' : 'NOT_COMPLETED';
  app.completionAt = new Date();
  if (req.body.completed) app.appliedAt = new Date();
  await app.save();
  res.json({ success: true, message: req.body.completed ? 'Application completed' : 'Marked as not completed', data: { application: app } });
};

// Placement team: remove a job posting together with its applications
export const deleteJobPosting = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid job', 400, 'INVALID_ID');
  const job = await Job.findById(req.params.id).select('title');
  if (!job) throw new AppError('Job posting not found', 404, 'JOB_NOT_FOUND');
  const removed = await removeJobsAndApplications([job._id]);
  await AuditLog.create({
    userId: req.user?.userId,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    action: 'JOB_DELETED',
    resource: 'JOB',
    metadata: { jobId: String(job._id), title: job.title, ...removed },
    ipAddress: req.ip,
  }).catch(() => undefined);
  res.json({ success: true, message: `${job.title} was removed`, data: removed });
};

// Placement team: remove a company, its jobs and their applications
export const deleteCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid company', 400, 'INVALID_ID');
  const company = await Company.findById(req.params.id).select('name');
  if (!company) throw new AppError('Company not found', 404, 'NOT_FOUND');
  const jobIds = (await Job.find({ companyId: company._id }).select('_id').lean()).map((j) => j._id);
  const removed = await removeJobsAndApplications(jobIds, company._id);
  await Company.deleteOne({ _id: company._id });
  await AuditLog.create({
    userId: req.user?.userId,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    action: 'COMPANY_DELETED',
    resource: 'COMPANY',
    metadata: { companyId: String(company._id), name: company.name, ...removed },
    ipAddress: req.ip,
  }).catch(() => undefined);
  res.json({ success: true, message: `${company.name} was removed`, data: removed });
};

async function removeJobsAndApplications(jobIds: mongoose.Types.ObjectId[], companyId?: mongoose.Types.ObjectId) {
  const or: Record<string, unknown>[] = [{ jobId: { $in: jobIds } }];
  if (companyId) or.push({ companyId });
  const appIds = (await Application.find({ $or: or }).select('_id').lean()).map((a) => a._id);
  const db = mongoose.connection.db!;
  // Offers and interviews hang off an application or job
  for (const name of ['offers', 'interviews']) {
    await db.collection(name).deleteMany({ $or: [{ applicationId: { $in: appIds } }, ...or] });
  }
  const applications = (await Application.deleteMany({ _id: { $in: appIds } })).deletedCount;
  const jobs = (await Job.deleteMany({ _id: { $in: jobIds } })).deletedCount;
  return { jobs, applications };
}

// Placement team: change a job's company application link (or remove it with an empty value), status or deadline
export const updateJobPosting = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid job', 400, 'INVALID_ID');
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError('Job posting not found', 404, 'JOB_NOT_FOUND');
  const { applyUrl, status, deadline } = req.body || {};
  if (applyUrl !== undefined) job.applyUrl = cleanApplyUrl(applyUrl);
  // Fix a typo in the title or the pasted post without re-posting the job
  for (const key of ['title', 'description', 'location', 'salaryPackage'] as const) {
    const v = req.body?.[key];
    if (v === undefined) continue;
    const text = String(v).trim();
    if (!text && (key === 'title' || key === 'description')) throw new AppError('Job title and the job post cannot be empty', 400, 'MISSING_FIELDS');
    job[key] = text || 'See job details';
  }
  if (status !== undefined) {
    if (!['OPEN', 'CLOSED', 'DRAFT'].includes(status)) throw new AppError('Status must be OPEN, CLOSED or DRAFT', 400, 'INVALID_STATUS');
    job.status = status;
  }
  if (deadline !== undefined) {
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) throw new AppError('Invalid deadline', 400, 'INVALID_DATE');
    job.deadline = d;
  }
  await job.save();
  res.json({ success: true, message: 'Job updated', data: { job } });
};

// Placement team: every application with the student's name, for the Applications section
export const listAllApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.jobId === 'string' && mongoose.isValidObjectId(req.query.jobId)) filter.jobId = req.query.jobId;
  if (req.query.via === 'COMPANY_SITE' || req.query.via === 'PORTAL') filter.appliedVia = req.query.via;
  const apps: any[] = await Application.find(filter)
    .sort({ appliedAt: -1, createdAt: -1 })
    .limit(2000)
    .populate('jobId', 'title location salaryPackage applyUrl deadline status')
    .populate('companyId', 'name logoUrl')
    .populate({ path: 'studentId', select: 'studentId phone college branch cgpa', populate: { path: 'userId', select: 'fullName email' } })
    .lean();
  const applications = apps.map((a) => ({
    _id: a._id,
    applicationId: `SL-APP-${String(a._id).slice(-6).toUpperCase()}`,
    student: a.studentId
      ? {
          _id: a.studentId._id,
          studentId: a.studentId.studentId,
          fullName: a.studentId.userId?.fullName || '',
          email: realEmail(a.studentId.userId?.email),
          phone: a.studentId.phone || '',
          college: a.studentId.college || '',
        }
      : null,
    job: a.jobId ? { _id: a.jobId._id, title: a.jobId.title, location: a.jobId.location, salaryPackage: a.jobId.salaryPackage } : null,
    company: a.companyId ? { _id: a.companyId._id, name: a.companyId.name } : null,
    appliedVia: a.appliedVia || 'PORTAL',
    linkClicks: a.linkClicks || 0,
    completion: a.appliedVia === 'COMPANY_SITE' ? a.completion || 'PENDING' : 'COMPLETED',
    status: a.status,
    appliedAt: a.appliedAt || a.createdAt,
  }));
  res.json({ success: true, data: { applications } });
};
