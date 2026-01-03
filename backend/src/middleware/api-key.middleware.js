/**
 * API Key Authentication Middleware
 *
 * Provides authentication via API Key for external integrations.
 * Supports hybrid authentication (JWT or API Key).
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../auth/jwt.service.js';
import logger from '../utils/logger.js';

// Hash an API key for comparison
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate and extract API key from request
 * Supports both X-API-Key header and Authorization: Bearer for API keys
 * Accepts prefixes: orc_, ak_, sk_
 */
function extractApiKey(req) {
  // Valid API key prefixes
  const validPrefixes = ['orc_', 'ak_', 'sk_'];

  // Check X-API-Key header first
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && validPrefixes.some(p => apiKeyHeader.startsWith(p))) {
    return apiKeyHeader;
  }

  // Check Authorization header for API key (Bearer xxx)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (validPrefixes.some(p => token.startsWith(p))) {
      return token;
    }
  }

  return null;
}

/**
 * Validate API key and check permissions
 * @param {string} key - API key
 * @param {string} requiredScope - Required scope
 * @param {string} resourceId - Resource ID for access check
 * @param {string} requestedOrgId - Organization ID from X-Organization-Id header
 */
async function validateApiKey(key, requiredScope = null, resourceId = null, requestedOrgId = null) {
  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash }
  });

  if (!apiKey) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if active
  if (!apiKey.isActive) {
    return { valid: false, error: 'API key is inactive' };
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Multi-tenancy: Validar que API Key pertence à org solicitada (se especificada)
  if (requestedOrgId && apiKey.orgId && apiKey.orgId !== requestedOrgId) {
    return { valid: false, error: 'API key does not belong to the requested organization' };
  }

  // Check rate limit
  const now = new Date();
  if (apiKey.rateLimitReset && apiKey.rateLimitReset < now) {
    // Reset rate limit counter
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        rateLimitUsed: 0,
        rateLimitReset: new Date(now.getTime() + 3600000) // Reset in 1 hour
      }
    });
    apiKey.rateLimitUsed = 0;
  }

  if (apiKey.rateLimitUsed >= apiKey.rateLimit) {
    return { valid: false, error: 'Rate limit exceeded', rateLimited: true };
  }

  // Check scope permission
  if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
    return { valid: false, error: `Missing required scope: ${requiredScope}` };
  }

  // Check workflow access if resourceId provided
  if (resourceId && apiKey.workflowIds.length > 0) {
    if (!apiKey.workflowIds.includes(resourceId)) {
      return { valid: false, error: 'API key does not have access to this workflow' };
    }
  }

  return { valid: true, apiKey };
}

/**
 * Update API key usage stats
 */
async function updateApiKeyUsage(apiKeyId, ip) {
  const now = new Date();

  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      usageCount: { increment: 1 },
      rateLimitUsed: { increment: 1 },
      lastUsedAt: now,
      lastUsedIp: ip,
      rateLimitReset: {
        set: await prisma.apiKey.findUnique({ where: { id: apiKeyId } })
          .then(k => k.rateLimitReset || new Date(now.getTime() + 3600000))
      }
    }
  });
}

/**
 * Hybrid authentication middleware
 * Accepts both JWT tokens and API Keys
 *
 * @param {Object} options - Options
 * @param {string} options.scope - Required scope for API key authentication
 * @param {string} options.resourceIdParam - Request param name for resource ID check
 */
export function authenticateHybrid(options = {}) {
  const { scope = null, resourceIdParam = null } = options;

  return async (req, res, next) => {
    try {
      // Log headers received for debugging auth issues
      logger.debug(`[Auth] ${req.method} ${req.url} - X-API-Key: ${req.headers['x-api-key'] ? 'present' : 'missing'}, Authorization: ${req.headers.authorization ? 'present' : 'missing'}`);

      // Try API Key first
      const apiKey = extractApiKey(req);

      if (apiKey) {
        logger.debug(`[Auth] Extracted API key: ${apiKey.substring(0, 15)}...`);
      }

      if (apiKey) {
        const resourceId = resourceIdParam ? req.params[resourceIdParam] : null;
        const requestedOrgId = req.headers['x-organization-id'] || null;
        const validation = await validateApiKey(apiKey, scope, resourceId, requestedOrgId);

        if (!validation.valid) {
          logger.warn(`[Auth] API key validation failed: ${validation.error}`);
          if (validation.rateLimited) {
            return res.status(429).json({
              success: false,
              error: validation.error,
              retryAfter: 3600
            });
          }
          return res.status(401).json({
            success: false,
            error: validation.error
          });
        }

        // Get user info from API key owner
        const user = await prisma.usuario.findUnique({
          where: { id: validation.apiKey.userId },
          select: { id: true, email: true, roles: true, fullName: true }
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'API key owner not found'
          });
        }

        // Multi-tenancy: Resolver org context da API Key
        const apiKeyOrgId = validation.apiKey.orgId || requestedOrgId;

        // Set request context with org info
        req.user = {
          id: user.id,
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.roles[0] || 'USER',
          roles: user.roles,
          // Multi-tenancy fields
          orgId: apiKeyOrgId,
          orgIds: apiKeyOrgId ? [apiKeyOrgId] : [],
          orgRole: 'MEMBER' // API Keys têm role MEMBER por padrão
        };
        req.apiKey = {
          id: validation.apiKey.id,
          name: validation.apiKey.name,
          scopes: validation.apiKey.scopes,
          projectIds: validation.apiKey.projectIds,
          workflowIds: validation.apiKey.workflowIds,
          orgId: validation.apiKey.orgId
        };
        req.authMethod = 'api_key';

        // Set org context for tenant middleware compatibility
        if (apiKeyOrgId) {
          req.org = {
            orgId: apiKeyOrgId
          };
          req.tenantContext = {
            userId: user.id,
            orgId: apiKeyOrgId
          };
        }

        // Update usage stats asynchronously
        const clientIp = req.ip || req.connection.remoteAddress;
        updateApiKeyUsage(validation.apiKey.id, clientIp).catch(err => {
          logger.error('Failed to update API key usage:', err);
        });

        logger.info(`[ApiKey] Authenticated via API key: ${validation.apiKey.keyPrefix}... (${validation.apiKey.name}) org: ${apiKeyOrgId || 'none'}`);

        return next();
      }

      // Fall back to JWT authentication
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`[Auth] No valid authentication provided for ${req.method} ${req.url}`);
        return res.status(401).json({
          success: false,
          error: 'No authentication provided. Use X-API-Key header or Bearer token.'
        });
      }

      const token = authHeader.substring(7);

      try {
        const decoded = verifyAccessToken(token);

        // Suportar tanto userId quanto id no token (compatibilidade)
        const userId = decoded.userId || decoded.id;

        // Multi-tenancy: Pegar org do header ou do token
        const requestedOrgId = req.headers['x-organization-id'];
        const tokenOrgId = decoded.orgId;
        const tokenOrgIds = decoded.orgIds || [];

        // Se header X-Organization-Id foi enviado, validar que usuário tem acesso
        let effectiveOrgId = tokenOrgId;
        if (requestedOrgId && tokenOrgIds.length > 0) {
          if (!tokenOrgIds.includes(requestedOrgId)) {
            return res.status(403).json({
              success: false,
              error: 'Access denied to requested organization'
            });
          }
          effectiveOrgId = requestedOrgId;
        }

        req.user = {
          id: userId,
          userId: userId,
          email: decoded.email,
          fullName: decoded.fullName,
          role: decoded.role,
          roles: decoded.roles || (decoded.role ? [decoded.role] : ['USER']),
          perfis: decoded.perfis || [],
          // Multi-tenancy fields
          orgId: effectiveOrgId,
          orgIds: tokenOrgIds,
          orgRole: decoded.orgRole
        };
        req.authMethod = 'jwt';

        // Set org context for tenant middleware compatibility
        if (effectiveOrgId) {
          req.org = {
            orgId: effectiveOrgId
          };
          req.tenantContext = {
            userId: userId,
            orgId: effectiveOrgId
          };
        }

        return next();
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
    } catch (error) {
      logger.error('Authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  };
}

/**
 * API Key only authentication middleware
 * Requires API Key, does not accept JWT
 */
export function authenticateApiKeyOnly(options = {}) {
  const { scope = null, resourceIdParam = null } = options;

  return async (req, res, next) => {
    try {
      const apiKey = extractApiKey(req);

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API Key required. Use X-API-Key header.'
        });
      }

      const resourceId = resourceIdParam ? req.params[resourceIdParam] : null;
      const validation = await validateApiKey(apiKey, scope, resourceId);

      if (!validation.valid) {
        if (validation.rateLimited) {
          return res.status(429).json({
            success: false,
            error: validation.error,
            retryAfter: 3600
          });
        }
        return res.status(401).json({
          success: false,
          error: validation.error
        });
      }

      // Get user info
      const user = await prisma.usuario.findUnique({
        where: { id: validation.apiKey.userId },
        select: { id: true, email: true, roles: true }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'API key owner not found'
        });
      }

      req.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.roles[0] || 'USER',
        roles: user.roles
      };
      req.apiKey = {
        id: validation.apiKey.id,
        name: validation.apiKey.name,
        scopes: validation.apiKey.scopes,
        projectIds: validation.apiKey.projectIds,
        workflowIds: validation.apiKey.workflowIds
      };
      req.authMethod = 'api_key';

      // Update usage stats
      const clientIp = req.ip || req.connection.remoteAddress;
      updateApiKeyUsage(validation.apiKey.id, clientIp).catch(err => {
        logger.error('Failed to update API key usage:', err);
      });

      return next();
    } catch (error) {
      logger.error('API Key authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  };
}

/**
 * Check if request has specific scope
 * Use after authenticateHybrid middleware
 */
export function requireScope(scope) {
  return (req, res, next) => {
    // JWT users have full access
    if (req.authMethod === 'jwt') {
      return next();
    }

    // Check API key scope
    if (req.apiKey && req.apiKey.scopes.includes(scope)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Missing required scope: ${scope}`
    });
  };
}

/**
 * Check if API key has access to specific workflow
 * Use after authenticateHybrid middleware
 */
export function checkWorkflowAccess(paramName = 'workflowId') {
  return (req, res, next) => {
    // JWT users have full access (will be validated by service layer)
    if (req.authMethod === 'jwt') {
      return next();
    }

    const workflowId = req.params[paramName] || req.params.id;

    // If API key has no workflow restrictions, allow
    if (!req.apiKey || req.apiKey.workflowIds.length === 0) {
      return next();
    }

    // Check if workflow is in allowed list
    if (req.apiKey.workflowIds.includes(workflowId)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'API key does not have access to this workflow'
    });
  };
}

export default {
  authenticateHybrid,
  authenticateApiKeyOnly,
  requireScope,
  checkWorkflowAccess
};
