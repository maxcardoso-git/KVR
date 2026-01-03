/**
 * Health Check Routes
 */

import { Router } from 'express';
import prisma from '../database/prisma.js';
import { getAuthModeDescription } from '../config/auth.config.js';

const router = Router();

/**
 * GET /api/v1/health
 * Basic health check
 */
router.get('/', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      service: 'kvr-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      authMode: getAuthModeDescription(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'kvr-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/health/ready
 * Readiness check
 */
router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

/**
 * GET /api/v1/health/live
 * Liveness check
 */
router.get('/live', (req, res) => {
  res.json({ live: true });
});

export default router;
