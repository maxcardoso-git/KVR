/**
 * Authentication Middleware - Dual Mode Support
 *
 * Supports multiple authentication methods:
 * 1. Local JWT (current/legacy)
 * 2. TAH SSO (Tenant Access Hub)
 * 3. API Key (for external integrations)
 *
 * The mode is determined by AUTH_MODE environment variable:
 * - 'local': Only local JWT authentication
 * - 'tah': Only TAH authentication
 * - 'dual': Both local and TAH (auto-detect based on token)
 */

import { verifyAccessToken } from '../auth/jwt.service.js';
import { isTahEnabled, isLocalEnabled, AUTH_FEATURES } from '../config/auth.config.js';
import { isTahToken, validateTahToken } from './tah-auth.middleware.js';
import logger from '../utils/logger.js';

// Dev bypass configuration
const AUTH_BYPASS_ENABLED = process.env.DEV_AUTH_BYPASS === 'true';
let bypassWarningLogged = false;
const DEV_USER = {
  id: process.env.DEV_USER_ID || 'dev-user',
  userId: process.env.DEV_USER_ID || 'dev-user',
  email: process.env.DEV_USER_EMAIL || 'dev@example.com',
  role: process.env.DEV_USER_ROLE || 'DEVELOPER',
  roles: [process.env.DEV_USER_ROLE || 'DEVELOPER'],
  orgId: process.env.DEV_ORG_ID || null,
  authSource: 'dev-bypass'
};

/**
 * Apply dev bypass if enabled
 */
function applyDevBypass(req, res, next) {
  if (!AUTH_BYPASS_ENABLED) {
    return false;
  }

  req.user = { ...DEV_USER };
  next();

  if (!bypassWarningLogged && process.env.NODE_ENV !== 'production') {
    logger.warn('[Auth] Authentication bypassed via DEV_AUTH_BYPASS. Do not use this in production.');
    bypassWarningLogged = true;
  }

  return true;
}

/**
 * Extract token from request
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Validate local JWT token
 */
function validateLocalToken(token) {
  const decoded = verifyAccessToken(token);

  return {
    id: decoded.userId || decoded.id,
    userId: decoded.userId || decoded.id,
    email: decoded.email,
    name: decoded.fullName || decoded.name,
    fullName: decoded.fullName,
    role: decoded.role || decoded.roles?.[0] || 'USER',
    roles: decoded.roles || (decoded.role ? [decoded.role] : ['USER']),
    perfis: decoded.perfis || [],
    orgId: decoded.orgId || null,
    orgIds: decoded.orgIds || [],
    orgRole: decoded.orgRole || null,
    authSource: 'local'
  };
}

/**
 * Detect token type and validate accordingly
 */
async function validateToken(token) {
  // Check if TAH is enabled and token is from TAH
  if (isTahEnabled() && isTahToken(token)) {
    const tahUser = await validateTahToken(token);
    return {
      id: tahUser.userId,
      userId: tahUser.userId,
      tahUserId: tahUser.tahUserId,
      email: tahUser.email,
      name: tahUser.name,
      fullName: tahUser.fullName,
      role: tahUser.roles?.[0] || 'USER',
      roles: tahUser.roles || ['USER'],
      orgId: tahUser.orgId,
      orgName: tahUser.orgName,
      orgIds: tahUser.orgIds || [],
      orgRole: tahUser.orgRole,
      permissions: tahUser.permissions || [],
      authSource: 'tah'
    };
  }

  // Fall back to local JWT validation
  if (isLocalEnabled()) {
    return validateLocalToken(token);
  }

  throw new Error('No valid authentication method available');
}

/**
 * Main authentication middleware
 * Automatically detects and validates tokens from both local and TAH sources
 */
export async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      // Try dev bypass if no token
      if (applyDevBypass(req, res, next)) {
        return;
      }

      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Validate token (auto-detect type)
    const user = await validateToken(token);

    // Attach user info to request
    req.user = user;

    // Log authentication if enabled
    if (AUTH_FEATURES.logAuthEvents) {
      logger.info(`[Auth] User authenticated: ${user.email} via ${user.authSource}`);
    }

    next();
  } catch (error) {
    logger.error('[Auth] Authentication error:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Middleware to check if user has required role
 * @param {...string} allowedRoles - Allowed roles
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user has any of the allowed roles
    const userRoles = req.user.roles || [req.user.role];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRoles
      });
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      req.user = await validateToken(token);
    } else if (AUTH_BYPASS_ENABLED) {
      req.user = { ...DEV_USER };
    }

    next();
  } catch (error) {
    // Continue without authentication
    logger.debug('[Auth] Optional auth failed, continuing without user:', error.message);
    next();
  }
}

/**
 * Require specific auth source
 * @param {'local' | 'tah' | 'any'} source - Required auth source
 */
export function requireAuthSource(source) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (source !== 'any' && req.user.authSource !== source) {
      return res.status(403).json({
        success: false,
        error: `This endpoint requires ${source} authentication`,
        current: req.user.authSource
      });
    }

    next();
  };
}

/**
 * Require organization context
 */
export function requireOrgContext(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!req.user.orgId) {
    return res.status(403).json({
      success: false,
      error: 'Organization context required',
      hint: 'User must be associated with an organization'
    });
  }

  next();
}

/**
 * Check feature permission (works with both local and TAH auth)
 */
export function checkPermission(featureId, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // TAH users have explicit permissions in token
    if (req.user.authSource === 'tah') {
      const permissions = req.user.permissions || [];

      const hasPermission = permissions.some(p => {
        if (p === '*' || p === '*:*') return true;
        if (p === `${featureId}:*`) return true;
        if (p === `${featureId}:${action}`) return true;

        // Category match
        const [category] = featureId.split('.');
        if (p === `${category}:*` || p === `${category}:${action}`) return true;

        return false;
      });

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Feature access denied',
          feature: featureId,
          action: action
        });
      }
    }

    // Local users: role-based access (legacy behavior)
    // TODO: Implement local permission checking if needed

    next();
  };
}

export default {
  authenticate,
  authorize,
  optionalAuth,
  requireAuthSource,
  requireOrgContext,
  checkPermission
};
