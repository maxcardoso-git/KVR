/**
 * TAH (Tenant Access Hub) Authentication Middleware
 *
 * Validates JWT tokens issued by the TAH identity provider.
 * Supports both JWKS and static public key verification.
 */

import jwt from 'jsonwebtoken';
import { TAH_CONFIG, SHADOW_USER_CONFIG } from '../config/auth.config.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

// JWKS cache
let jwksCache = null;
let jwksCacheExpiry = 0;

/**
 * Fetch JWKS from TAH server
 */
async function fetchJwks() {
  const now = Date.now();

  // Return cached JWKS if still valid
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }

  try {
    const response = await fetch(TAH_CONFIG.jwksUrl);
    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status}`);
    }

    jwksCache = await response.json();
    jwksCacheExpiry = now + (TAH_CONFIG.jwksCacheTtl * 1000);

    logger.info('[TAH] JWKS cache refreshed');
    return jwksCache;
  } catch (error) {
    logger.error('[TAH] Failed to fetch JWKS:', error.message);

    // Return stale cache if available
    if (jwksCache) {
      logger.warn('[TAH] Using stale JWKS cache');
      return jwksCache;
    }

    throw error;
  }
}

/**
 * Get signing key from JWKS
 */
async function getSigningKey(kid) {
  // If static public key is configured, use it
  if (TAH_CONFIG.publicKey) {
    return TAH_CONFIG.publicKey;
  }

  // Otherwise fetch from JWKS
  const jwks = await fetchJwks();
  const key = jwks.keys?.find(k => k.kid === kid);

  if (!key) {
    throw new Error(`Signing key not found: ${kid}`);
  }

  // Convert JWK to PEM format
  // For RS256, the key should have x5c (certificate chain)
  if (key.x5c && key.x5c[0]) {
    return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  }

  // For simpler cases, return the key as-is (jwt library handles JWK)
  return key;
}

/**
 * Detect if a token is from TAH
 */
export function isTahToken(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) return false;

    // Check issuer
    if (decoded.payload.iss === TAH_CONFIG.issuer) {
      return true;
    }

    // Check if audience includes our app
    const aud = decoded.payload.aud;
    if (Array.isArray(aud) && aud.includes(TAH_CONFIG.audience)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validate TAH token and extract user info
 */
export async function validateTahToken(token) {
  const decoded = jwt.decode(token, { complete: true });

  if (!decoded) {
    throw new Error('Invalid token format');
  }

  // Get the signing key
  const signingKey = await getSigningKey(decoded.header.kid);

  // Verify the token
  const payload = jwt.verify(token, signingKey, {
    issuer: TAH_CONFIG.issuer,
    audience: TAH_CONFIG.audience,
    clockTolerance: TAH_CONFIG.clockTolerance
  });

  // Check if app is enabled for this user
  const appAccess = payload.apps?.[TAH_CONFIG.appId];
  if (!appAccess?.enabled) {
    throw new Error(`Access to ${TAH_CONFIG.appId} not authorized`);
  }

  return {
    // User identification
    userId: payload.sub,
    tahUserId: payload.sub, // Original TAH user ID
    email: payload.email,
    name: payload.name || payload.preferred_username,
    fullName: payload.name,

    // Organization context
    orgId: payload.org_id,
    orgName: payload.org_name,
    orgIds: payload.org_ids || [payload.org_id].filter(Boolean),
    orgRole: payload.org_role || 'MEMBER',

    // Roles and permissions
    roles: payload.roles || ['USER'],
    permissions: appAccess.permissions || [],

    // Auth metadata
    authSource: 'tah',
    tokenIssuer: payload.iss,
    tokenExpiry: new Date(payload.exp * 1000)
  };
}

/**
 * Create or update shadow user in local database
 */
async function upsertShadowUser(tahUser) {
  if (!SHADOW_USER_CONFIG.createShadowUser) {
    return tahUser.userId;
  }

  try {
    // Check if user exists by TAH ID or email
    let existingUser = await prisma.usuario.findFirst({
      where: {
        OR: [
          { tahUserId: tahUser.tahUserId },
          { email: tahUser.email }
        ]
      }
    });

    if (existingUser) {
      // Update if sync is enabled
      if (SHADOW_USER_CONFIG.syncOnLogin) {
        await prisma.usuario.update({
          where: { id: existingUser.id },
          data: {
            tahUserId: tahUser.tahUserId,
            fullName: tahUser.fullName || existingUser.fullName,
            // Don't override local roles if they exist
            lastLoginAt: new Date()
          }
        });
      }
      return existingUser.id;
    }

    // Create new shadow user
    const newUser = await prisma.usuario.create({
      data: {
        email: tahUser.email,
        fullName: tahUser.fullName || tahUser.email,
        tahUserId: tahUser.tahUserId,
        roles: [SHADOW_USER_CONFIG.defaultRole],
        isActive: true,
        lastLoginAt: new Date()
      }
    });

    logger.info(`[TAH] Created shadow user: ${newUser.id} for TAH user: ${tahUser.tahUserId}`);

    // Associate with organization if exists
    if (tahUser.orgId) {
      const org = await prisma.organization.findFirst({
        where: { orgId: tahUser.orgId }
      });

      if (org) {
        await prisma.userOrganization.upsert({
          where: {
            userId_organizationId: {
              userId: newUser.id,
              organizationId: org.id
            }
          },
          create: {
            userId: newUser.id,
            organizationId: org.id,
            role: tahUser.orgRole || 'MEMBER',
            isDefault: true
          },
          update: {
            role: tahUser.orgRole || 'MEMBER'
          }
        });
      }
    }

    return newUser.id;
  } catch (error) {
    logger.error('[TAH] Failed to upsert shadow user:', error);
    // Return TAH user ID as fallback
    return tahUser.tahUserId;
  }
}

/**
 * TAH Authentication Middleware
 */
export async function tahAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    // Validate TAH token
    const tahUser = await validateTahToken(token);

    // Create/update shadow user and get local ID
    const localUserId = await upsertShadowUser(tahUser);

    // Attach user info to request
    req.user = {
      id: localUserId,
      userId: localUserId,
      tahUserId: tahUser.tahUserId,
      email: tahUser.email,
      name: tahUser.name,
      fullName: tahUser.fullName,
      orgId: tahUser.orgId,
      orgName: tahUser.orgName,
      orgIds: tahUser.orgIds,
      orgRole: tahUser.orgRole,
      roles: tahUser.roles,
      role: tahUser.roles[0] || 'USER',
      permissions: tahUser.permissions,
      authSource: 'tah'
    };

    next();
  } catch (error) {
    logger.error('[TAH] Authentication error:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired TAH token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Check if user has permission for a feature action
 */
export function checkTahPermission(featureId, action) {
  return (req, res, next) => {
    if (req.user?.authSource !== 'tah') {
      // Not a TAH user, skip TAH permission check
      return next();
    }

    const permissions = req.user.permissions || [];

    // Check for exact match or wildcard
    const hasPermission = permissions.some(p => {
      const [resource, allowedAction] = p.split(':');

      // Wildcard permission
      if (resource === '*' || allowedAction === '*') {
        return true;
      }

      // Exact match
      if (p === `${featureId}:${action}`) {
        return true;
      }

      // Resource-level match with wildcard action
      if (p === `${featureId}:*`) {
        return true;
      }

      // Category match (e.g., "workflows:*" matches "workflows.list:read")
      const [category] = featureId.split('.');
      if (resource === category && (allowedAction === '*' || allowedAction === action)) {
        return true;
      }

      return false;
    });

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        feature: featureId,
        action: action,
        required: `${featureId}:${action}`
      });
    }

    next();
  };
}

export default {
  isTahToken,
  validateTahToken,
  tahAuthenticate,
  checkTahPermission
};
