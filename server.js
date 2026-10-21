import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { apiLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/authRoutes.js';
import resumeRoutes from './routes/resumeRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';
import lastWorkRoutes from './routes/lastWorkRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

dotenv.config();
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ FIX: Trust Render / Vercel reverse proxy (fixes express-rate-limit error)
app.set('trust proxy', 1);

// Core middleware
// ✅ FIX: Dynamic CORS for localhost, Vercel frontend, and production origins with credentials support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile, server-to-server)
      if (!origin) return callback(null, true);

      // Explicitly allow configured CLIENT_URL
      if (
        process.env.CLIENT_URL &&
        (origin === process.env.CLIENT_URL ||
          origin === process.env.CLIENT_URL.replace(/\/+$/, ''))
      ) {
        return callback(null, true);
      }

      // Always allow local development
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return callback(null, true);
      }

      // Always allow Vercel and Render deployments
      if (
        /^https:\/\/.*\.vercel\.app$/i.test(origin) ||
        /^https:\/\/.*\.onrender\.com$/i.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use('/api', apiLimiter);

// Static file serving for uploaded resume/images with permissive CORS and CORP headers
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// Root endpoint for Render and browser checks
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Portfolio API is running',
    health: '/api/health',
  });
});

// Health check
app.get('/api/health', (req, res) => res.status(200).json({ success: true, message: 'API is running' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/last-work', lastWorkRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/contact', contactRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// ✅ Needed for Vercel serverless — harmless on Render
export default app;