/**
 * Auth Routes
 *
 * Authentication endpoints for local JWT auth.
 * TAH authentication is handled automatically by the auth middleware.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../database/prisma.js';
import { authenticate } from '../middleware/auth.middleware.js';
import * as jwtService from '../auth/jwt.service.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is disabled'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const accessToken = jwtService.generateAccessToken(user);
    const refreshToken = await jwtService.generateRefreshToken(user);

    // Update last login
    await prisma.usuario.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logger.info(`[Auth] User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('[Auth] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout and invalidate refresh token
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      await jwtService.revokeRefreshToken(refreshToken);
    }

    // Clear cookie
    res.clearCookie('refreshToken');

    logger.info(`[Auth] User logged out: ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('[Auth] Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not provided'
      });
    }

    // Verify refresh token
    const payload = jwtService.verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Find user
    const user = await prisma.usuario.findUnique({
      where: { id: payload.userId }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or disabled'
      });
    }

    // Revoke old refresh token
    await jwtService.revokeRefreshToken(refreshToken);

    // Generate new tokens
    const newAccessToken = jwtService.generateAccessToken(user);
    const newRefreshToken = await jwtService.generateRefreshToken(user);

    // Update cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    logger.error('[Auth] Refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // If user came from TAH, return TAH user info
    if (req.user?.authSource === 'tah') {
      return res.json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          fullName: req.user.fullName || req.user.name,
          roles: req.user.roles,
          orgId: req.user.orgId,
          orgName: req.user.orgName,
          authSource: 'tah'
        }
      });
    }

    // For local users, fetch from database
    const user = await prisma.usuario.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...user,
        authSource: 'local'
      }
    });
  } catch (error) {
    logger.error('[Auth] Get me error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
});

/**
 * PUT /api/v1/auth/password
 * Update password
 */
router.put('/password', authenticate, async (req, res) => {
  try {
    // Only for local users
    if (req.user?.authSource === 'tah') {
      return res.status(400).json({
        success: false,
        error: 'Password change not available for TAH users'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters'
      });
    }

    // Get user
    const user = await prisma.usuario.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.usuario.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    logger.info(`[Auth] Password changed for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('[Auth] Password change error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update password'
    });
  }
});

export default router;
