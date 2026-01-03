/**
 * KVR API Router
 *
 * Main router that aggregates all API routes.
 */

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import resourcesRoutes from './resources.routes.js';
import apiKeysRoutes from './api-keys.routes.js';
import appFeaturesRoutes from './app-features.routes.js';
import projectsRoutes from './projects.routes.js';

const router = Router();

// Health check
router.use('/health', healthRoutes);

// Authentication
router.use('/auth', authRoutes);

// Resources (Resource Registry)
router.use('/resources', resourcesRoutes);

// Projects
router.use('/projects', projectsRoutes);

// API Keys
router.use('/api-keys', apiKeysRoutes);

// App Features (TAH Integration)
router.use('/app-features', appFeaturesRoutes);

export default router;
