/**
 * Tenant Context Utility
 *
 * Helper functions para trabalhar com contexto de tenant (multi-tenancy)
 * em rotas e serviços.
 *
 * Supports both local and TAH (Tenant Access Hub) authentication.
 */

/**
 * Extrai o contexto de tenant da requisição
 * @param {Object} req - Express request object
 * @returns {Object} - { userId, orgId, authSource, permissions }
 */
export function getTenantContext(req) {
  const userId = req.user?.id || req.user?.userId || null;
  const orgId = req.org?.orgId || req.user?.orgId || null;
  const authSource = req.user?.authSource || 'local';
  const permissions = req.user?.permissions || [];

  return { userId, orgId, authSource, permissions };
}

/**
 * Verifica se o usuário autenticou via TAH
 * @param {Object} req - Express request object
 * @returns {boolean}
 */
export function isTahUser(req) {
  return req.user?.authSource === 'tah';
}

/**
 * Verifica se o usuário tem uma permissão específica (TAH)
 * @param {Object} req - Express request object
 * @param {string} permission - Permissão a verificar (ex: "resources:read")
 * @returns {boolean}
 */
export function hasPermission(req, permission) {
  // TAH users have explicit permissions
  if (req.user?.authSource === 'tah') {
    const permissions = req.user.permissions || [];
    return permissions.some(p => {
      if (p === '*' || p === '*:*') return true;
      if (p === permission) return true;
      // Check category wildcard (e.g., "resources:*" matches "resources:read")
      const [category, action] = permission.split(':');
      if (p === `${category}:*`) return true;
      return false;
    });
  }
  // Local users: no explicit permission check (role-based)
  return true;
}

/**
 * Verifica se o contexto de tenant está completo
 * @param {Object} context - { userId, orgId }
 * @returns {boolean}
 */
export function isValidTenantContext(context) {
  return Boolean(context && context.userId && context.orgId);
}

/**
 * Verifica se o usuário tem acesso a uma organização específica
 * @param {Object} req - Express request object
 * @param {string} targetOrgId - orgId a verificar
 * @returns {boolean}
 */
export function hasOrgAccess(req, targetOrgId) {
  if (!req.user?.orgIds) return false;
  return req.user.orgIds.includes(targetOrgId);
}

/**
 * Retorna os orgIds que o usuário pode acessar
 * @param {Object} req - Express request object
 * @returns {string[]}
 */
export function getAccessibleOrgs(req) {
  return req.user?.orgIds || [];
}

/**
 * Verifica se o usuário tem um role mínimo na org atual
 * @param {Object} req - Express request object
 * @param {string} minRole - Role mínimo (OWNER, ADMIN, MEMBER, VIEWER)
 * @returns {boolean}
 */
export function hasMinRole(req, minRole) {
  const roleHierarchy = {
    'VIEWER': 1,
    'MEMBER': 2,
    'ADMIN': 3,
    'OWNER': 4
  };

  const userLevel = roleHierarchy[req.user?.orgRole] || 0;
  const requiredLevel = roleHierarchy[minRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Verifica se é um admin da organização
 * @param {Object} req - Express request object
 * @returns {boolean}
 */
export function isOrgAdmin(req) {
  return hasMinRole(req, 'ADMIN');
}

/**
 * Verifica se é o owner da organização
 * @param {Object} req - Express request object
 * @returns {boolean}
 */
export function isOrgOwner(req) {
  return req.user?.orgRole === 'OWNER';
}

/**
 * Constrói um filtro WHERE para queries com isolamento de tenant
 * @param {Object} context - { userId, orgId }
 * @param {Object} additionalFilters - Filtros adicionais a serem mesclados
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.requireOrg - Se true, sempre adiciona orgId ao filtro (default: true)
 * @param {boolean} options.requireUser - Se true, sempre adiciona userId ao filtro (default: false)
 * @returns {Object} - Filtro WHERE para Prisma
 */
export function buildTenantFilter(context, additionalFilters = {}, options = {}) {
  const { requireOrg = true, requireUser = false } = options;

  const filter = { ...additionalFilters };

  // Adicionar filtro de organização
  if (context.orgId && requireOrg) {
    filter.orgId = context.orgId;
  }

  // Adicionar filtro de usuário (opcional)
  if (context.userId && requireUser) {
    filter.userId = context.userId;
  }

  return filter;
}

/**
 * Prepara dados para criação de um novo registro com contexto de tenant
 * @param {Object} context - { userId, orgId }
 * @param {Object} data - Dados do registro a ser criado
 * @returns {Object} - Dados com userId e orgId adicionados
 */
export function addTenantToData(context, data) {
  return {
    ...data,
    userId: context.userId,
    orgId: context.orgId
  };
}

/**
 * Valida que um registro pertence ao tenant atual
 * @param {Object} record - Registro do banco de dados
 * @param {Object} context - { userId, orgId }
 * @param {Object} options - Opções de validação
 * @param {boolean} options.checkUser - Verificar userId também (default: false)
 * @returns {boolean}
 */
export function belongsToTenant(record, context, options = {}) {
  const { checkUser = false } = options;

  if (!record || !context) return false;

  // Verificar organização
  if (context.orgId && record.orgId && record.orgId !== context.orgId) {
    return false;
  }

  // Verificar usuário (opcional)
  if (checkUser && context.userId && record.userId && record.userId !== context.userId) {
    return false;
  }

  return true;
}

/**
 * Middleware helper para extrair contexto e passar para controller
 * Uso: const context = extractContext(req);
 */
export function extractContext(req) {
  return {
    userId: req.user?.id || req.user?.userId,
    orgId: req.org?.orgId || req.user?.orgId,
    orgRole: req.user?.orgRole,
    orgIds: req.user?.orgIds || [],
    orgName: req.org?.name,
    userEmail: req.user?.email,
    userName: req.user?.fullName || req.user?.name
  };
}

export default {
  getTenantContext,
  isValidTenantContext,
  hasOrgAccess,
  getAccessibleOrgs,
  hasMinRole,
  isOrgAdmin,
  isOrgOwner,
  buildTenantFilter,
  addTenantToData,
  belongsToTenant,
  extractContext,
  isTahUser,
  hasPermission
};
