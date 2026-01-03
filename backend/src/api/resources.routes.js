/**
 * Resources Routes - Resource Registry API
 *
 * CRUD operations for managing resources (HTTP APIs, Databases, Files, etc.)
 * Supports multi-tenancy, hybrid authentication, and promotion workflow.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { authenticateHybrid, requireScope } from '../middleware/api-key.middleware.js';
import { getTenantContext } from '../utils/tenant-context.js';
import * as resourceService from '../services/resource.service.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * List all resources
 * GET /api/v1/resources
 */
router.get('/',
  authenticateHybrid,
  requireScope('resources:read'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { environment, type, isActive, search } = req.query;

      const filters = {
        orgId: context.orgId,
        environment,
        type,
        search
      };

      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      const resources = await resourceService.listResources(filters);

      res.json({
        success: true,
        data: resources
      });
    } catch (error) {
      logger.error('[Resources] Error listing resources:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list resources'
      });
    }
  }
);

/**
 * Get resource types
 * GET /api/v1/resources/types
 */
router.get('/types',
  authenticateHybrid,
  requireScope('resources:read'),
  (req, res) => {
    const types = resourceService.getResourceTypes();
    res.json({
      success: true,
      data: types
    });
  }
);

/**
 * Get a single resource
 * GET /api/v1/resources/:id
 */
router.get('/:id',
  authenticateHybrid,
  requireScope('resources:read'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;

      const resource = await resourceService.getResource(id, context.orgId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      res.json({
        success: true,
        data: resource
      });
    } catch (error) {
      logger.error('[Resources] Error getting resource:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource'
      });
    }
  }
);

/**
 * Create a new resource
 * POST /api/v1/resources
 */
router.post('/',
  authenticateHybrid,
  requireScope('resources:write'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const data = req.body;

      if (!data.name) {
        return res.status(400).json({
          success: false,
          error: 'Name is required'
        });
      }

      if (!data.type) {
        return res.status(400).json({
          success: false,
          error: 'Type is required'
        });
      }

      const resource = await resourceService.createResource(data, context);

      res.status(201).json({
        success: true,
        data: resource,
        message: 'Resource created successfully'
      });
    } catch (error) {
      logger.error('[Resources] Error creating resource:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create resource'
      });
    }
  }
);

/**
 * Update a resource
 * PUT /api/v1/resources/:id
 */
router.put('/:id',
  authenticateHybrid,
  requireScope('resources:write'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;
      const data = req.body;

      const resource = await resourceService.updateResource(id, data, context);

      res.json({
        success: true,
        data: resource,
        message: 'Resource updated successfully'
      });
    } catch (error) {
      logger.error('[Resources] Error updating resource:', error);

      if (error.message === 'Resource not found or access denied') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update resource'
      });
    }
  }
);

/**
 * Delete a resource
 * DELETE /api/v1/resources/:id
 */
router.delete('/:id',
  authenticateHybrid,
  requireScope('resources:write'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;

      await resourceService.deleteResource(id, context);

      res.json({
        success: true,
        message: 'Resource deleted successfully'
      });
    } catch (error) {
      logger.error('[Resources] Error deleting resource:', error);

      if (error.message === 'Resource not found or access denied') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete resource'
      });
    }
  }
);

/**
 * Test resource connection
 * POST /api/v1/resources/:id/test
 */
router.post('/:id/test',
  authenticateHybrid,
  requireScope('resources:read'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;

      const result = await resourceService.testResource(id, {
        orgId: context.orgId,
        userId: context.userId
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('[Resources] Error testing resource:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to test resource'
      });
    }
  }
);

/**
 * Health check resource
 * POST /api/v1/resources/:id/health-check
 */
router.post('/:id/health-check',
  authenticateHybrid,
  requireScope('resources:read'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;

      const result = await resourceService.healthCheckResource(id, {
        orgId: context.orgId,
        userId: context.userId
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('[Resources] Error health checking resource:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to health check resource'
      });
    }
  }
);

/**
 * Request promotion to production
 * POST /api/v1/resources/:id/promote
 */
router.post('/:id/promote',
  authenticateHybrid,
  requireScope('resources:write'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;
      const { notes } = req.body;

      const resource = await resourceService.promoteResource(id, { notes }, context);

      res.json({
        success: true,
        data: resource,
        message: 'Promotion request submitted'
      });
    } catch (error) {
      logger.error('[Resources] Error requesting promotion:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to request promotion'
      });
    }
  }
);

/**
 * Approve promotion request
 * POST /api/v1/resources/:id/approve
 * Requires JWT auth (not API key) and ADMIN role
 */
router.post('/:id/approve',
  authenticate,
  authorize(['ADMIN', 'OWNER']),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;
      const { notes } = req.body;

      const resource = await resourceService.approvePromotion(id, { notes }, context);

      res.json({
        success: true,
        data: resource,
        message: 'Promotion approved'
      });
    } catch (error) {
      logger.error('[Resources] Error approving promotion:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to approve promotion'
      });
    }
  }
);

/**
 * Reject promotion request
 * POST /api/v1/resources/:id/reject
 * Requires JWT auth (not API key) and ADMIN role
 */
router.post('/:id/reject',
  authenticate,
  authorize(['ADMIN', 'OWNER']),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;
      const { reason } = req.body;

      const resource = await resourceService.rejectPromotion(id, { reason }, context);

      res.json({
        success: true,
        data: resource,
        message: 'Promotion rejected'
      });
    } catch (error) {
      logger.error('[Resources] Error rejecting promotion:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to reject promotion'
      });
    }
  }
);

export default router;
