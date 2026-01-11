/**
 * TAH (Tenant Access Hub) Authentication Middleware
 *
 * Validates JWT tokens issued by the TAH identity provider.
 * Supports both JWKS and static public key verification.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { TAH_CONFIG, SHADOW_USER_CONFIG, mapTahRole } from '../config/auth.config.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

/**
 * Convert JWK RSA key to PEM format
 */
function jwkToPem(jwk) {
  if (jwk.x5c && jwk.x5c[0]) {
    // If x5c is available, use it directly
    return `-----BEGIN CERTIFICATE-----\n${jwk.x5c[0]}\n-----END CERTIFICATE-----`;
  }

  // Convert RSA JWK (n, e) to PEM using Node.js crypto
  if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
    const keyObject = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e
      },
      format: 'jwk'
    });
    return keyObject.export({ type: 'spki', format: 'pem' });
  }

  throw new Error(`Unsupported key type: ${jwk.kty}`);
}

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
  return jwkToPem(key);
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

  // Extract permissions - support both formats:
  // 1. Direct permissions array in token (newer format)
  // 2. App-specific permissions in apps object (older format)
  let permissions = [];
  if (payload.permissions && Array.isArray(payload.permissions)) {
    permissions = payload.permissions;
  } else if (payload.apps?.[TAH_CONFIG.appId]?.permissions) {
    permissions = payload.apps[TAH_CONFIG.appId].permissions;
  }

  // Extract and map roles from various possible fields
  // TAH may send roles in different formats: roles array, role string, org_role, perfil, etc.
  let rawRoles = [];

  // Log payload keys for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[TAH] Token payload keys: ${Object.keys(payload).join(', ')}`);
    logger.debug(`[TAH] Token payload.apps: ${JSON.stringify(payload.apps || {})}`);
  }

  // Check app-specific roles first (similar to permissions)
  if (payload.apps?.[TAH_CONFIG.appId]?.roles) {
    const appRoles = payload.apps[TAH_CONFIG.appId].roles;
    rawRoles = Array.isArray(appRoles) ? appRoles : [appRoles];
  } else if (payload.apps?.[TAH_CONFIG.appId]?.role) {
    rawRoles = [payload.apps[TAH_CONFIG.appId].role];
  } else if (payload.roles && Array.isArray(payload.roles)) {
    rawRoles = payload.roles;
  } else if (payload.role) {
    rawRoles = [payload.role];
  } else if (payload.org_role) {
    rawRoles = [payload.org_role];
  } else if (payload.perfil) {
    rawRoles = Array.isArray(payload.perfil) ? payload.perfil : [payload.perfil];
  } else if (payload.perfis) {
    rawRoles = Array.isArray(payload.perfis) ? payload.perfis : [payload.perfis];
  } else if (payload.groups) {
    // Some identity providers use 'groups' for roles
    rawRoles = Array.isArray(payload.groups) ? payload.groups : [payload.groups];
  } else if (payload.realm_access?.roles) {
    // Keycloak-style roles
    rawRoles = payload.realm_access.roles;
  }

  // Log raw roles for debugging
  logger.info(`[TAH] Raw roles extracted: ${JSON.stringify(rawRoles)}`)

  // Map TAH roles to local roles (handles Portuguese names like 'administrador' -> 'ADMIN')
  const mappedRoles = rawRoles.length > 0
    ? rawRoles.map(r => mapTahRole(r))
    : ['USER'];

  // Log successful TAH authentication
  logger.info(`[TAH] User authenticated: ${payload.email} with roles: ${mappedRoles.join(', ')} and ${permissions.length} permissions`);

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
    orgRole: mapTahRole(payload.org_role) || 'MEMBER',
    tenantId: payload.tenant_id,

    // Roles and permissions (mapped from TAH)
    roles: mappedRoles,
    permissions: permissions,

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
