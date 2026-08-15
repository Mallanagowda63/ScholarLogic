import { Router } from 'express';
import {
  getPlacementOverview,
  getCompanies,
  getCompanyDetail,
  verifyCompanyHiringStatus,
  createCompany,
  getJobPostings,
  getOfficialJobs,
  getHiringNowJobs,
  getJobDetail,
  checkEligibility,
  applyToJob,
  getStudentApplications,
  getApplicationDetail,
  createJobPosting,
  getHiringIntelligence,
  getSkillsInDemand,
  getHiringLocations,
  getHiringTrends,
  compareCompanies,
} from '../controllers/placementController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);

router.get('/overview', asyncHandler(getPlacementOverview));
router.get('/metrics', asyncHandler(getPlacementOverview));

router.get('/companies', asyncHandler(getCompanies));
router.get('/companies/comparison', asyncHandler(compareCompanies));
router.get('/companies/:id', asyncHandler(getCompanyDetail));
router.post('/companies', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PLACEMENT_MANAGER'), asyncHandler(createCompany));
router.post('/companies/:id/verify', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PLACEMENT_MANAGER'), asyncHandler(verifyCompanyHiringStatus));

router.get('/jobs', asyncHandler(getJobPostings));
router.get('/jobs/official', asyncHandler(getOfficialJobs));
router.get('/jobs/hiring-now', asyncHandler(getHiringNowJobs));
router.get('/jobs/:id', asyncHandler(getJobDetail));
router.get('/jobs/:id/eligibility', asyncHandler(checkEligibility));
router.post('/jobs/:id/apply', asyncHandler(applyToJob));
router.post('/jobs', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PLACEMENT_MANAGER'), asyncHandler(createJobPosting));

router.get('/applications', asyncHandler(getStudentApplications));
router.get('/applications/:id', asyncHandler(getApplicationDetail));

router.get('/hiring-intelligence', asyncHandler(getHiringIntelligence));
router.get('/hiring-intelligence/skills', asyncHandler(getSkillsInDemand));
router.get('/hiring-intelligence/locations', asyncHandler(getHiringLocations));
router.get('/hiring-intelligence/trends', asyncHandler(getHiringTrends));
router.get('/company-comparison', asyncHandler(compareCompanies));

export default router;
