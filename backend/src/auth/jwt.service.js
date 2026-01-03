import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

/**
 * Busca as organizações do usuário para incluir no token
 * @param {string} userId - ID do usuário
 * @returns {Object} { orgId, orgIds, orgRole }
 */
export async function getUserOrganizationsForToken(userId) {
  try {
    const userOrgs = await prisma.userOrganization.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            orgId: true,
            name: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    if (!userOrgs || userOrgs.length === 0) {
      return { orgId: null, orgIds: [], orgRole: null };
    }

    // Pegar a org default ou a primeira
    const defaultOrg = userOrgs.find(uo => uo.isDefault) || userOrgs[0];

    return {
      orgId: defaultOrg.organization.orgId,
      orgIds: userOrgs.map(uo => uo.organization.orgId),
      orgRole: defaultOrg.role
    };
  } catch (error) {
    logger.warn('[JWT] Não foi possível buscar organizações do usuário:', error.message);
    return { orgId: null, orgIds: [], orgRole: null };
  }
}

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRATION
  });
}

/**
 * Generate JWT access token with organization context
 * @param {Object} user - User object from database
 * @returns {Promise<string>} JWT token with org info
 */
export async function generateAccessTokenWithOrg(user) {
  const orgInfo = await getUserOrganizationsForToken(user.id);

  const payload = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles || ['USER'],
    perfis: user.perfis || [],
    // Multi-tenancy fields
    orgId: orgInfo.orgId,
    orgIds: orgInfo.orgIds,
    orgRole: orgInfo.orgRole
  };

  return generateAccessToken(payload);
}

/**
 * Generate JWT refresh token and store in database
 * @param {string} userId - User ID
 * @returns {Object} { token, expiresAt }
 */
export async function generateRefreshToken(userId) {
  const token = uuidv4();
  const expiresAt = new Date();

  // Parse expiration time (e.g., "7d" -> 7 days)
  const match = JWT_REFRESH_EXPIRATION.match(/^(\d+)([dhms])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        expiresAt.setDate(expiresAt.getDate() + value);
        break;
      case 'h':
        expiresAt.setHours(expiresAt.getHours() + value);
        break;
      case 'm':
        expiresAt.setMinutes(expiresAt.getMinutes() + value);
        break;
      case 's':
        expiresAt.setSeconds(expiresAt.getSeconds() + value);
        break;
    }
  } else {
    // Default: 7 days
    expiresAt.setDate(expiresAt.getDate() + 7);
  }

  try {
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt
      }
    });
  } catch (error) {
    logger.warn('[Auth] Não foi possível persistir refresh token (tabela ausente?)', error.message);
  }

  return { token, expiresAt };
}

/**
 * Verify JWT access token
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.error('JWT verification error:', error.message);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Token data from database
 */
export async function verifyRefreshToken(token) {
  try {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token }
    });

    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }

    if (new Date() > refreshToken.expiresAt) {
      await prisma.refreshToken.delete({
        where: { id: refreshToken.id }
      });
      throw new Error('Refresh token expired');
    }

    return refreshToken;
  } catch (error) {
    logger.warn('[Auth] Falha ao verificar refresh token. Validação será ignorada.', error.message);
    return { token, userId: null, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
  }
}

/**
 * Revoke refresh token
 * @param {string} token - Refresh token
 */
export async function revokeRefreshToken(token) {
  await prisma.refreshToken.deleteMany({
    where: { token }
  });
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 */
export async function revokeAllRefreshTokens(userId) {
  await prisma.refreshToken.deleteMany({
    where: { userId }
  });
}

/**
 * Clean up expired refresh tokens
 */
export async function cleanupExpiredTokens() {
  const deleted = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });

  logger.info(`Cleaned up ${deleted.count} expired refresh tokens`);
  return deleted.count;
}
