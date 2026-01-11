/**
 * Authentication Configuration for KVR (KeyVault Registry)
 *
 * Supports three modes:
 * - local: Only local JWT authentication
 * - tah: Only TAH (Tenant Access Hub) authentication
 * - dual: Both local and TAH authentication (recommended)
 */

// Auth mode: 'local' | 'tah' | 'dual'
export const AUTH_MODE = process.env.AUTH_MODE || 'dual';

// TAH Configuration
export const TAH_CONFIG = {
  enabled: process.env.TAH_ENABLED === 'true',
  issuer: process.env.TAH_ISSUER || 'https://tah.yourdomain.com',
  jwksUrl: process.env.TAH_JWKS_URL || `${process.env.TAH_ISSUER}/.well-known/jwks.json`,
  audience: process.env.TAH_AUDIENCE || 'kvr',
  // Public key for token verification (if not using JWKS)
  publicKey: process.env.TAH_PUBLIC_KEY || null,
  // App ID for this application in TAH
  appId: process.env.TAH_APP_ID || 'kvr',
  // Cache JWKS for performance (seconds)
  jwksCacheTtl: parseInt(process.env.TAH_JWKS_CACHE_TTL || '3600', 10),
  // Token clock tolerance (seconds)
  clockTolerance: parseInt(process.env.TAH_CLOCK_TOLERANCE || '30', 10)
};

// Local JWT Configuration
export const LOCAL_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  issuer: process.env.JWT_ISSUER || 'kvr'
};

// Shadow User Configuration (for TAH users)
export const SHADOW_USER_CONFIG = {
  // Create local user record for TAH users
  createShadowUser: process.env.TAH_CREATE_SHADOW_USER !== 'false',
  // Sync user data on each login
  syncOnLogin: process.env.TAH_SYNC_ON_LOGIN !== 'false',
  // Default role for new shadow users
  defaultRole: process.env.TAH_DEFAULT_ROLE || 'USER'
};

// Role mapping from TAH to local system
// Maps TAH role names (case-insensitive) to local role names
export const TAH_ROLE_MAPPING = {
  // Portuguese role names
  'administrador': 'ADMIN',
  'proprietario': 'OWNER',
  'proprietário': 'OWNER',
  'desenvolvedor': 'DEVELOPER',
  'usuario': 'USER',
  'usuário': 'USER',
  'visualizador': 'VIEWER',
  'gerente': 'ADMIN',
  'gestor': 'ADMIN',
  // English role names (normalize case)
  'admin': 'ADMIN',
  'administrator': 'ADMIN',
  'superadmin': 'ADMIN',
  'super_admin': 'ADMIN',
  'super-admin': 'ADMIN',
  'sysadmin': 'ADMIN',
  'owner': 'OWNER',
  'developer': 'DEVELOPER',
  'dev': 'DEVELOPER',
  'user': 'USER',
  'viewer': 'VIEWER',
  'member': 'USER',
  'editor': 'DEVELOPER',
  'manager': 'ADMIN',
  'moderator': 'ADMIN'
};

/**
 * Map TAH role to local role
 */
export function mapTahRole(tahRole) {
  if (!tahRole) return 'USER';
  const normalizedRole = tahRole.toLowerCase().trim();
  return TAH_ROLE_MAPPING[normalizedRole] || tahRole.toUpperCase();
}

// Feature flags
export const AUTH_FEATURES = {
  // Allow API Key authentication (for workflow execution)
  apiKeyAuth: process.env.API_KEY_AUTH_ENABLED !== 'false',
  // Log authentication events
  logAuthEvents: process.env.LOG_AUTH_EVENTS === 'true',
  // Require org context for all requests
  requireOrgContext: process.env.REQUIRE_ORG_CONTEXT === 'true'
};

/**
 * Check if TAH authentication is available
 */
export function isTahEnabled() {
  return TAH_CONFIG.enabled && (AUTH_MODE === 'tah' || AUTH_MODE === 'dual');
}

/**
 * Check if local authentication is available
 */
export function isLocalEnabled() {
  return AUTH_MODE === 'local' || AUTH_MODE === 'dual';
}

/**
 * Get auth mode description for logging
 */
export function getAuthModeDescription() {
  const modes = [];
  if (isLocalEnabled()) modes.push('Local JWT');
  if (isTahEnabled()) modes.push('TAH SSO');
  return modes.join(' + ') || 'None';
}

export default {
  AUTH_MODE,
  TAH_CONFIG,
  LOCAL_CONFIG,
  SHADOW_USER_CONFIG,
  TAH_ROLE_MAPPING,
  AUTH_FEATURES,
  isTahEnabled,
  isLocalEnabled,
  getAuthModeDescription,
  mapTahRole
};
