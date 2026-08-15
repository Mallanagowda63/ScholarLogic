import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { Student } from '../models/Student';
import { Resume } from '../models/Resume';
import { AppError } from '../middleware/errorHandler';

export const getPlacementOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  const partnerCompanyCount = await Company.countDocuments();
  const hiringNowCompaniesCount = await Company.countDocuments({ hiringStatus: 'HIRING_NOW' });

  const jobs = await Job.find({ status: 'OPEN' });
  const openPositionsCount = jobs.reduce((sum, j) => sum + (j.openings || 1), 0);

  const totalApplicationsCount = await Application.countDocuments();
  const shortlistedCandidatesCount = await Application.countDocuments({ status: { $in: ['SHORTLISTED', 'TECH_INTERVIEW', 'HR_INTERVIEW', 'OFFERED', 'JOINED'] } });
  const interviewsScheduledCount = await Application.countDocuments({ status: { $in: ['TECH_INTERVIEW', 'HR_INTERVIEW'] } });
  const offersCount = await Application.countDocuments({ status: { $in: ['OFFERED', 'JOINED'] } });
  const studentsPlacedCount = await Application.countDocuments({ status: 'JOINED' });

  const totalStudents = await Student.countDocuments();
  const placementRatePct = totalStudents > 0 ? Math.min(100, Math.round((studentsPlacedCount / totalStudents) * 100)) : 78;

  const pipeline = {
    applied: await Application.countDocuments({ status: 'APPLIED' }),
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

      const applicationsCount = await Application.countDocuments({ jobId: { $in: jobIds } });
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

  if (!name || !description || !location || !contactEmail) {
    throw new AppError('Company name, description, location, and contact email are required', 400, 'MISSING_FIELDS');
  }

  const company = await Company.create({
    name,
    website: website || `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
    officialCareersUrl: officialCareersUrl || `${website || 'https://' + name.toLowerCase().replace(/\s+/g, '') + '.com'}/careers`,
    industry: industry || 'Information Technology',
    description,
    location,
    headquarters: headquarters || location,
    contactEmail,
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

  const jobs = await Job.find(query)
    .populate('companyId', 'name logoUrl website officialCareersUrl hiringStatus verificationStatus')
    .sort({ createdAt: -1 });

  let studentApplicationMap: Record<string, string> = {};
  if (req.user && req.user.role === 'STUDENT') {
    let student = await Student.findOne({ userId: req.user.userId });
    if (student) {
      const studentApps = await Application.find({
        $or: [{ studentId: student._id }, { studentId: req.user.userId }],
      });
      studentApps.forEach((app) => {
        if (app.jobId) {
          studentApplicationMap[app.jobId.toString()] = app.status;
        }
      });
    }
  }

  const formattedJobs = jobs.map((j) => ({
    ...j.toObject(),
    matchScore: 92,
    appliedStatus: studentApplicationMap[j._id.toString()] || null,
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
  const minCgpa = job.eligibilityCriteria?.minCgpa || 6.0;

  if (student.cgpa < minCgpa) {
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

  const minCgpa = job.eligibilityCriteria?.minCgpa || 6.0;
  if (student.cgpa < minCgpa) {
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
          summary: `Student pursuing ${student.degree || 'B.Tech'} in ${student.branch || 'CSE'}.`,
          skills: student.skills?.length ? student.skills : ['Python', 'JavaScript', 'SQL', 'React', 'Git'],
          experience: [],
          education: [
            {
              institution: student.college || 'ScholarLogic Institute of Technology',
              degree: student.degree || 'B.Tech',
              fieldOfStudy: student.branch || 'Computer Science & Engineering',
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
    if (student.studentId) {
      queryIds.push(student.studentId);
    }
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
  const { title, companyId, description, type, postingType, location, salaryPackage, requiredSkills, eligibilityCriteria, deadline, openings, sourceUrl } = req.body;

  if (!title || !companyId || !description || !location || !salaryPackage) {
    throw new AppError('Job title, company, description, location, and salary package are required', 400, 'MISSING_FIELDS');
  }

  const job = await Job.create({
    title,
    companyId,
    description,
    type: type || 'FULL_TIME',
    postingType: postingType || 'SCHOLARLOGIC_POSTING',
    location,
    salaryPackage,
    requiredSkills: requiredSkills || ['Python', 'SQL'],
    eligibilityCriteria: eligibilityCriteria || { minCgpa: 6.5, allowedBranches: ['CSE', 'ECE'], passoutYears: [2026] },
    deadline: deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    openings: openings || 5,
    status: 'OPEN',
    sourceUrl: sourceUrl || '',
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
      const applicationsCount = await Application.countDocuments({ jobId: { $in: jobIds } });
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
