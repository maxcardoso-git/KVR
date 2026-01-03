/**
 * KVR App Features Routes
 *
 * Exposes the application features manifest for TAH (Tenant Access Hub) integration.
 * The manifest allows TAH to sync permissions and features from this application.
 */

import { Router } from 'express';
import prisma from '../database/prisma.js';

const router = Router();

// App configuration
const APP_CONFIG = {
  appId: 'kvr',
  appName: 'KeyVault Registry',
  version: '1.0.0',
  description: 'Centralized management of integration resources and API keys for workflows',
};

// Default features for KVR
const DEFAULT_FEATURES = [
  {
    id: 'kvr.dashboard',
    name: 'Dashboard',
    description: 'Overview of resources, API keys, and system health',
    module: 'core',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    actions: ['read'],
    isPublic: false,
    requiresOrg: true,
  },
  {
    id: 'kvr.resources',
    name: 'Resources',
    description: 'Manage integration resources (APIs, databases, messaging systems)',
    module: 'resources',
    path: '/resources',
    icon: 'Database',
    actions: ['read', 'create', 'update', 'delete', 'execute'],
    isPublic: false,
    requiresOrg: true,
  },
  {
    id: 'kvr.resources.test',
    name: 'Test Resources',
    description: 'Test connection and health check for resources',
    module: 'resources',
    path: '/resources/:id/test',
    icon: 'PlayCircle',
    actions: ['execute'],
    isPublic: false,
    requiresOrg: true,
  },
  {
    id: 'kvr.resources.promote',
    name: 'Promote Resources',
    description: 'Promote resources from DEV to PRD environment',
    module: 'resources',
    path: '/resources/:id/promote',
    icon: 'ArrowUpCircle',
    actions: ['execute'],
    isPublic: false,
    requiresOrg: true,
  },
  {
    id: 'kvr.resources.approve',
    name: 'Approve Promotions',
    description: 'Approve or reject resource promotion requests',
    module: 'resources',
    path: '/resources/:id/approve',
    icon: 'CheckCircle',
    actions: ['execute'],
    isPublic: false,
    requiresOrg: true,
  },
  {
    id: 'kvr.apikeys',
    name: 'API Keys',
    description: 'Manage API keys for external integrations',
    module: 'apikeys',
    path: '/api-keys',
    icon: 'Key',
    actions: ['read', 'create', 'update', 'delete'],
    isPublic: false,
    requiresOrg: true,
  },
  {
    id: 'kvr.apikeys.regenerate',
    name: 'Regenerate API Keys',
    description: 'Regenerate API key secrets',
    module: 'apikeys',
    path: '/api-keys/:id/regenerate',
    icon: 'RefreshCw',
    actions: ['execute'],
    isPublic: false,
    requiresOrg: true,
  },
];

/**
 * GET /api/v1/app-features/manifest
 * Public endpoint that returns the app features manifest for TAH integration
 */
router.get('/manifest', async (req, res) => {
  try {
    // Try to get features from database first, fallback to default
    let features = DEFAULT_FEATURES;

    try {
      const dbFeatures = await prisma.appFeature.findMany({
        orderBy: [{ module: 'asc' }, { name: 'asc' }],
      });

      if (dbFeatures.length > 0) {
        features = dbFeatures.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          module: f.module,
          path: f.path,
          icon: f.icon,
          actions: f.actions || [],
          isPublic: f.isPublic,
          requiresOrg: f.requiresOrg,
        }));
      }
    } catch (dbError) {
      // Database table might not exist, use defaults
      console.log('Using default features (DB table may not exist)');
    }

    // Group features by module
    const modules = features.reduce((acc, feature) => {
      if (!acc[feature.module]) {
        acc[feature.module] = {
          id: feature.module,
          name: feature.module.charAt(0).toUpperCase() + feature.module.slice(1),
          featureCount: 0,
        };
      }
      acc[feature.module].featureCount++;
      return acc;
    }, {});

    const manifest = {
      ...APP_CONFIG,
      modules: Object.values(modules),
      features,
      stats: {
        totalFeatures: features.length,
        totalModules: Object.keys(modules).length,
        publicFeatures: features.filter((f) => f.isPublic).length,
      },
    };

    res.json(manifest);
  } catch (error) {
    console.error('Error generating manifest:', error);
    res.status(500).json({ error: 'Failed to generate manifest' });
  }
});

/**
 * GET /api/v1/app-features
 * List all features (authenticated)
 */
router.get('/', async (req, res) => {
  try {
    // Try DB first
    try {
      const features = await prisma.appFeature.findMany({
        orderBy: [{ module: 'asc' }, { name: 'asc' }],
      });

      if (features.length > 0) {
        return res.json({ success: true, data: features });
      }
    } catch (dbError) {
      // DB table might not exist
    }

    // Return defaults
    res.json({ success: true, data: DEFAULT_FEATURES });
  } catch (error) {
    console.error('Error listing features:', error);
    res.status(500).json({ success: false, error: 'Failed to list features' });
  }
});

/**
 * POST /api/v1/app-features/seed
 * Seed default features into database (admin only)
 */
router.post('/seed', async (req, res) => {
  try {
    // Upsert each default feature
    const results = await Promise.all(
      DEFAULT_FEATURES.map(async (feature) => {
        try {
          return await prisma.appFeature.upsert({
            where: { id: feature.id },
            update: {
              name: feature.name,
              description: feature.description,
              module: feature.module,
              path: feature.path,
              icon: feature.icon,
              actions: feature.actions,
              isPublic: feature.isPublic,
              requiresOrg: feature.requiresOrg,
            },
            create: {
              id: feature.id,
              name: feature.name,
              description: feature.description,
              module: feature.module,
              path: feature.path,
              icon: feature.icon,
              actions: feature.actions,
              isPublic: feature.isPublic,
              requiresOrg: feature.requiresOrg,
            },
          });
        } catch (error) {
          console.error(`Error upserting feature ${feature.id}:`, error);
          return null;
        }
      })
    );

    const seeded = results.filter((r) => r !== null);

    res.json({
      success: true,
      message: `Seeded ${seeded.length} features`,
      data: seeded,
    });
  } catch (error) {
    console.error('Error seeding features:', error);
    res.status(500).json({ success: false, error: 'Failed to seed features' });
  }
});

export default router;
