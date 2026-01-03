/**
 * Re-export prisma from database module for backwards compatibility
 */
import prismaDefault from '../database/prisma.js';

// Re-export as both default and named export
export const prisma = prismaDefault;
export default prismaDefault;
