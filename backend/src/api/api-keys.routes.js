/**
 * API Keys Routes - Enterprise Authentication for External Integrations
 *
 * Provides CRUD operations for managing API Keys that allow external systems
 * to access the Resource Registry and other features.
 * Multi-tenant enabled.
 */

import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../database/prisma.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { getTenantContext } from '../utils/tenant-context.js';
import logger from '../utils/logger.js';

const router = Router();

// Generate a secure random API key
function generateApiKey() {
  const prefix = 'kvr_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
}

// Hash an API key for storage
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Extract prefix from key
function getKeyPrefix(key) {
  return key.substring(0, 12); // kvr_ + first 8 chars
}

/**
 * Build tenant filter for API keys queries
 */
function buildTenantFilter(context) {
  const filter = {};
  if (context.orgId) {
    filter.orgId = context.orgId;
  } else if (context.userId) {
    filter.userId = context.userId;
  }
  return filter;
}

/**
 * List all API keys for the current user/org
 * GET /api/v1/api-keys
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);
    const { includeInactive } = req.query;

    const tenantFilter = buildTenantFilter(context);
    const where = { ...tenantFilter };
    if (!includeInactive) {
      where.isActive = true;
    }

    const apiKeys = await prisma.apiKey.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        scopes: true,
        workflowIds: true,
        rateLimit: true,
        usageCount: true,
        lastUsedAt: true,
        lastUsedIp: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
        // Note: keyHash is NOT returned for security
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    logger.error('Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys'
    });
  }
});

/**
 * Create a new API key
 * POST /api/v1/api-keys
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);
    const {
      name,
      description,
      scopes = ['resources:read'],
      workflowIds = [],
      rateLimit = 1000,
      expiresAt
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Generate the API key
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    // Create the API key record with tenant context
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: context.userId,
        orgId: context.orgId,
        name,
        description,
        keyHash,
        keyPrefix,
        scopes,
        workflowIds,
        rateLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        scopes: true,
        workflowIds: true,
        rateLimit: true,
        expiresAt: true,
        isActive: true,
        createdAt: true
      }
    });

    logger.info(`[ApiKey] Created API key "${name}" (${keyPrefix}...) for user ${context.userId} org ${context.orgId || 'none'}`);

    // Return the raw key ONLY on creation - it won't be shown again
    res.status(201).json({
      success: true,
      data: {
        ...apiKey,
        key: rawKey // Only returned once!
      },
      message: 'API Key created. Save this key securely - it will not be shown again!'
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key'
    });
  }
});

/**
 * Get a single API key by ID
 * GET /api/v1/api-keys/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);
    const tenantFilter = buildTenantFilter(context);
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, ...tenantFilter },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        scopes: true,
        workflowIds: true,
        rateLimit: true,
        rateLimitUsed: true,
        rateLimitReset: true,
        usageCount: true,
        lastUsedAt: true,
        lastUsedIp: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API Key not found'
      });
    }

    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    logger.error('Error getting API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get API key'
    });
  }
});

/**
 * Update an API key
 * PATCH /api/v1/api-keys/:id
 */
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);
    const tenantFilter = buildTenantFilter(context);
    const { id } = req.params;
    const {
      name,
      description,
      scopes,
      workflowIds,
      rateLimit,
      expiresAt,
      isActive
    } = req.body;

    // Verify ownership
    const existing = await prisma.apiKey.findFirst({
      where: { id, ...tenantFilter }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'API Key not found'
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (scopes !== undefined) updateData.scopes = scopes;
    if (workflowIds !== undefined) updateData.workflowIds = workflowIds;
    if (rateLimit !== undefined) updateData.rateLimit = rateLimit;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        scopes: true,
        workflowIds: true,
        rateLimit: true,
        expiresAt: true,
        isActive: true,
        updatedAt: true
      }
    });

    logger.info(`[ApiKey] Updated API key "${apiKey.name}" (${apiKey.keyPrefix}...)`);

    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    logger.error('Error updating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key'
    });
  }
});

/**
 * Delete (revoke) an API key
 * DELETE /api/v1/api-keys/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);
    const tenantFilter = buildTenantFilter(context);
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.apiKey.findFirst({
      where: { id, ...tenantFilter }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'API Key not found'
      });
    }

    await prisma.apiKey.delete({
      where: { id }
    });

    logger.info(`[ApiKey] Deleted API key "${existing.name}" (${existing.keyPrefix}...)`);

    res.json({
      success: true,
      message: 'API Key deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key'
    });
  }
});

/**
 * Regenerate an API key (creates new key, invalidates old one)
 * POST /api/v1/api-keys/:id/regenerate
 */
router.post('/:id/regenerate', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);
    const tenantFilter = buildTenantFilter(context);
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.apiKey.findFirst({
      where: { id, ...tenantFilter }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'API Key not found'
      });
    }

    // Generate new key
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        keyHash,
        keyPrefix,
        usageCount: 0, // Reset usage count
        rateLimitUsed: 0 // Reset rate limit
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        updatedAt: true
      }
    });

    logger.info(`[ApiKey] Regenerated API key "${existing.name}" (new prefix: ${keyPrefix}...)`);

    res.json({
      success: true,
      data: {
        ...apiKey,
        key: rawKey // Only returned once!
      },
      message: 'API Key regenerated. Save this key securely - it will not be shown again!'
    });
  } catch (error) {
    logger.error('Error regenerating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate API key'
    });
  }
});

/**
 * Get usage statistics for an API key
 * GET /api/v1/api-keys/:id/stats
 */
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);
    const tenantFilter = buildTenantFilter(context);
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, ...tenantFilter },
      select: {
        id: true,
        name: true,
        usageCount: true,
        rateLimit: true,
        rateLimitUsed: true,
        rateLimitReset: true,
        lastUsedAt: true,
        lastUsedIp: true,
        createdAt: true
      }
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API Key not found'
      });
    }

    // Calculate remaining rate limit
    const now = new Date();
    let rateLimitRemaining = apiKey.rateLimit;
    if (apiKey.rateLimitReset && apiKey.rateLimitReset > now) {
      rateLimitRemaining = apiKey.rateLimit - apiKey.rateLimitUsed;
    }

    res.json({
      success: true,
      data: {
        ...apiKey,
        rateLimitRemaining,
        rateLimitResetIn: apiKey.rateLimitReset
          ? Math.max(0, apiKey.rateLimitReset.getTime() - now.getTime())
          : null
      }
    });
  } catch (error) {
    logger.error('Error getting API key stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get API key stats'
    });
  }
});

/**
 * List available scopes
 * GET /api/v1/api-keys/scopes/list
 */
router.get('/scopes/list', authenticate, (req, res) => {
  const scopes = [
    { id: 'resources:read', name: 'Read Resources', description: 'Allows listing and viewing resources from Resource Registry' },
    { id: 'resources:write', name: 'Write Resources', description: 'Allows creating, updating and deleting resources in Resource Registry' },
    { id: 'resources:test', name: 'Test Resources', description: 'Allows testing resource connectivity' },
    { id: 'resources:promote', name: 'Promote Resources', description: 'Allows requesting resource promotion to production' },
    { id: 'resources:approve', name: 'Approve Promotions', description: 'Allows approving or rejecting resource promotion requests' },
    { id: 'apikeys:read', name: 'Read API Keys', description: 'Allows listing and viewing API keys' },
    { id: 'apikeys:write', name: 'Write API Keys', description: 'Allows creating, updating and deleting API keys' }
  ];

  res.json({
    success: true,
    data: scopes
  });
});

/**
 * List available workflows for API Key restriction
 * GET /api/v1/api-keys/workflows/list
 */
router.get('/workflows/list', authenticate, async (req, res) => {
  try {
    const context = getTenantContext(req);

    // Build where clause with tenant isolation
    const where = {
      status: 'PUBLISHED' // Only show published workflows
    };

    // Filter by organization if available
    if (context.orgId) {
      where.orgId = context.orgId;
    }

    const workflows = await prisma.workflow.findMany({
      where,
      select: {
        id: true,
        workflowId: true,
        name: true,
        description: true,
        version: true,
        projectId: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: workflows
    });
  } catch (error) {
    logger.error('Error listing workflows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list workflows'
    });
  }
});

export default router;
