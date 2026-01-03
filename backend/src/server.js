/**
 * KVR (KeyVault Registry) - Main Server
 *
 * A lightweight application for Resource Registry and API Key management.
 * Shares database with OrchestratorAI.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import logger from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { getAuthModeDescription } from './config/auth.config.js';
import apiRouter from './api/index.js';

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// ============================================
// CORS Configuration
// ============================================
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Organization-Id']
}));

// ============================================
// Security Headers (Helmet)
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));

// ============================================
// Rate Limiting
// ============================================
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  skip: () => process.env.NODE_ENV === 'development'
});

app.use(limiter);

// ============================================
// Body Parsing
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// Request Logging
// ============================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ============================================
// Health Check (before API routes)
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'kvr-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    authMode: getAuthModeDescription()
  });
});

// ============================================
// API Routes
// ============================================
app.use(API_PREFIX, apiRouter);

// ============================================
// Error Handling
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// Start Server
// ============================================
app.listen(PORT, HOST, () => {
  logger.info('='.repeat(50));
  logger.info('KVR (KeyVault Registry) Backend');
  logger.info('='.repeat(50));
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`API endpoint: ${API_PREFIX}`);
  logger.info(`Auth mode: ${getAuthModeDescription()}`);
  logger.info(`CORS origins: ${corsOrigins.join(', ')}`);
  logger.info('='.repeat(50));
});

// ============================================
// Graceful Shutdown
// ============================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
