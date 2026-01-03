/**
 * Projects Routes - Project Management API
 *
 * CRUD operations for managing projects.
 * Supports multi-tenancy and hybrid authentication.
 */

import { Router } from 'express';
import { authenticateHybrid, requireScope } from '../middleware/api-key.middleware.js';
import { getTenantContext } from '../utils/tenant-context.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * List all projects
 * GET /api/v1/projects
 */
router.get('/',
  authenticateHybrid,
  requireScope('resources:read'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { status, search } = req.query;

      const where = {};

      // Org filter for multi-tenancy
      if (context.orgId) {
        where.orgId = context.orgId;
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Search by name
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const projects = await prisma.project.findMany({
        where,
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      logger.error('[Projects] Error listing projects:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list projects'
      });
    }
  }
);

/**
 * Get a single project
 * GET /api/v1/projects/:id
 */
router.get('/:id',
  authenticateHybrid,
  requireScope('resources:read'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;

      const where = { id };
      if (context.orgId) {
        where.orgId = context.orgId;
      }

      const project = await prisma.project.findFirst({ where });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      logger.error('[Projects] Error getting project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project'
      });
    }
  }
);

/**
 * Create a new project
 * POST /api/v1/projects
 */
router.post('/',
  authenticateHybrid,
  requireScope('resources:write'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { name, description, status = 'active' } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Name is required'
        });
      }

      const project = await prisma.project.create({
        data: {
          name,
          description: description || null,
          status,
          orgId: context.orgId || null,
          createdBy: context.userId || null
        }
      });

      logger.info(`[Projects] Created project: ${project.id} - ${project.name}`);

      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });
    } catch (error) {
      logger.error('[Projects] Error creating project:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create project'
      });
    }
  }
);

/**
 * Update a project
 * PUT /api/v1/projects/:id
 */
router.put('/:id',
  authenticateHybrid,
  requireScope('resources:write'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;
      const { name, description, status } = req.body;

      // Verify ownership if orgId is provided
      if (context.orgId) {
        const existing = await prisma.project.findFirst({
          where: { id, orgId: context.orgId }
        });
        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Project not found or access denied'
          });
        }
      }

      const payload = {};
      if (name !== undefined) payload.name = name;
      if (description !== undefined) payload.description = description;
      if (status !== undefined) payload.status = status;

      const project = await prisma.project.update({
        where: { id },
        data: payload
      });

      logger.info(`[Projects] Updated project: ${project.id} - ${project.name}`);

      res.json({
        success: true,
        data: project,
        message: 'Project updated successfully'
      });
    } catch (error) {
      logger.error('[Projects] Error updating project:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update project'
      });
    }
  }
);

/**
 * Delete a project
 * DELETE /api/v1/projects/:id
 */
router.delete('/:id',
  authenticateHybrid,
  requireScope('resources:write'),
  async (req, res) => {
    try {
      const context = getTenantContext(req);
      const { id } = req.params;

      // Verify ownership if orgId is provided
      if (context.orgId) {
        const existing = await prisma.project.findFirst({
          where: { id, orgId: context.orgId }
        });
        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Project not found or access denied'
          });
        }
      }

      await prisma.project.delete({
        where: { id }
      });

      logger.info(`[Projects] Deleted project: ${id}`);

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error) {
      logger.error('[Projects] Error deleting project:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete project'
      });
    }
  }
);

export default router;
