import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Import Routes
import authRoutes from './routes/authRoutes';
import studentRoutes from './routes/studentRoutes';
import courseRoutes from './routes/courseRoutes';
import examRoutes from './routes/examRoutes';
import resumeRoutes from './routes/resumeRoutes';
import placementRoutes from './routes/placementRoutes';
import certificateRoutes from './routes/certificateRoutes';
import notificationRoutes from './routes/notificationRoutes';
import adminRoutes from './routes/adminRoutes';
import trainerRoutes from './routes/trainerRoutes';

const app = express();

// Trust Proxy Configuration for Load Balancers & Rate Limiting
app.set('trust proxy', 1);

// Infrastructure Security: Production Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false, // Allowed for HTML5 video player and PDF preview
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    frameguard: { action: 'sameorigin' },
  })
);

// Permissions-Policy Header for Proctoring Devices
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), fullscreen=(self)');
  next();
});

// CORS Security: Strict Whitelist Configuration
const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS security policy'));
      }
    },
    credentials: true,
  })
);

// Granular API Rate Limiters (API Security Control)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100,
  message: { success: false, code: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, code: 'AI_RATE_LIMIT', message: 'Too many AI analysis requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const examSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, code: 'EXAM_RATE_LIMIT', message: 'Too many submission requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply Granular Rate Limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/resumes/analyze', aiLimiter);
app.use('/api/exams/attempts/*/submit', examSubmitLimiter);

// Payload Size Restrictions (Protects against 10MB DoS payloads)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.resolve(env.STORAGE_PATH)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/placements', placementRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trainer', trainerRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'ScholarLogic API Service is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Central Error Handler (Production Stack Trace Protection)
app.use(errorHandler);

export default app;
