/**
 * Resource Service
 *
 * Business logic for Resource Registry operations.
 * Extracted from OrchestratorAI orchestrator.service.js
 */

import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

/**
 * Parse JSON safely
 */
function parseJsonMaybe(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

/**
 * Get status message for HTTP codes
 */
function getStatusMessage(status) {
  const statusMessages = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };
  return statusMessages[status] || 'Unknown Error';
}

/**
 * Build auth headers from config
 */
function buildAuthHeaders(authConfig) {
  const headers = {};
  const parsedAuth = parseJsonMaybe(authConfig);
  if (!parsedAuth) {
    return headers;
  }

  const authMode = parsedAuth.mode || parsedAuth.type;

  if (authMode === 'BEARER' && parsedAuth.token) {
    headers.Authorization = `Bearer ${parsedAuth.token}`;
  } else if (authMode === 'API_KEY') {
    if (parsedAuth.headerName && parsedAuth.apiKey) {
      headers[parsedAuth.headerName] = parsedAuth.apiKey;
    }
  } else if (authMode === 'BASIC' && parsedAuth.username && parsedAuth.password) {
    const encoded = Buffer.from(`${parsedAuth.username}:${parsedAuth.password}`).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }
  return headers;
}

/**
 * Compose URL from base and path
 */
function composeUrl(baseUrl = '', path = '') {
  if (!path) {
    return baseUrl;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/**
 * Normalize resource type
 */
function normalizeResourceType(value) {
  if (!value) return 'HTTP';
  const normalized = String(value).toUpperCase();
  const allowed = [
    'HTTP', 'WEBHOOK', 'DB', 'FILE', 'MESSAGE',
    'SLACK', 'TEAMS', 'TELEGRAM',
    'REPORT', 'ALERT', 'FUNCTION', 'EMBEDDING',
    'VECTOR_ENGINE', 'DATA_LAYER'
  ];
  return allowed.includes(normalized) ? normalized : 'HTTP';
}

/**
 * List all resources
 * @param {Object} filters - { orgId, environment, type, isActive }
 */
export async function listResources(filters = {}) {
  try {
    const { orgId, environment, type, isActive, search } = filters;

    const where = {};

    // Org filter for multi-tenancy
    if (orgId) {
      where.orgId = orgId;
    }

    // Environment filter (DEV, PRD)
    if (environment) {
      where.environment = environment;
    }

    // Type filter
    if (type) {
      where.type = normalizeResourceType(type);
    }

    // Active filter
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Search by name
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const resources = await prisma.orchestratorResource.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    return resources;
  } catch (error) {
    logger.error('[ResourceService] listResources error', error);
    throw error;
  }
}

/**
 * Get a single resource by ID
 */
export async function getResource(id, orgId = null) {
  try {
    const where = { id };
    if (orgId) {
      where.orgId = orgId;
    }

    const resource = await prisma.orchestratorResource.findFirst({ where });
    return resource;
  } catch (error) {
    logger.error('[ResourceService] getResource error', error);
    throw error;
  }
}

/**
 * Normalize sensitivity value
 */
function normalizeSensitivity(value) {
  if (!value) return 'MEDIUM';
  const normalized = String(value).toUpperCase();
  const allowed = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return allowed.includes(normalized) ? normalized : 'MEDIUM';
}

/**
 * Normalize visibility value
 */
function normalizeVisibility(value) {
  if (!value) return 'PROJECT_ONLY';
  const normalized = String(value).toUpperCase();
  const allowed = ['PUBLIC', 'ORGANIZATION', 'PROJECT_ONLY', 'ADMIN_ONLY'];
  return allowed.includes(normalized) ? normalized : 'PROJECT_ONLY';
}

/**
 * Normalize environment value
 */
function normalizeEnvironment(value) {
  if (!value) return 'DEV';
  const normalized = String(value).toUpperCase();
  const allowed = ['DEV', 'QA', 'HOMOLOG', 'PRD'];
  return allowed.includes(normalized) ? normalized : 'DEV';
}

/**
 * Create a new resource
 */
export async function createResource(data, context = {}) {
  const {
    name,
    type,
    subtype,
    endpoint,
    method,
    config,
    auth,
    connection,
    metadata,
    isActive,
    env,
    environment,
    sensitivity,
    visibility,
    tags = [],
    projectId
  } = data;

  // Support both 'env' and 'environment' fields
  const envValue = normalizeEnvironment(env || environment);

  try {
    const resource = await prisma.orchestratorResource.create({
      data: {
        name,
        type: normalizeResourceType(type),
        subtype: subtype || null,
        endpoint: endpoint || null,
        method: method || null,
        config: config || null,
        auth: auth || null,
        connection: connection || null,
        metadata: metadata || null,
        orgId: context.orgId || null,
        projectId: projectId || null,
        createdBy: context.userId || null,
        isActive: isActive !== false,
        env: envValue,
        sensitivity: normalizeSensitivity(sensitivity),
        visibility: normalizeVisibility(visibility),
        tags
      }
    });

    logger.info(`[ResourceService] Created resource: ${resource.id} - ${resource.name}`);
    return resource;
  } catch (error) {
    logger.error('[ResourceService] createResource error', error);
    throw error;
  }
}

/**
 * Update a resource
 */
export async function updateResource(id, data, context = {}) {
  const payload = {};

  if (data.name !== undefined) payload.name = data.name;
  if (data.type !== undefined) payload.type = normalizeResourceType(data.type);
  if (data.subtype !== undefined) payload.subtype = data.subtype;
  if (data.endpoint !== undefined) payload.endpoint = data.endpoint;
  if (data.method !== undefined) payload.method = data.method;
  if (data.config !== undefined) payload.config = data.config;
  if (data.auth !== undefined) payload.auth = data.auth;
  if (data.connection !== undefined) payload.connection = data.connection;
  if (data.metadata !== undefined) payload.metadata = data.metadata;
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  // Support both 'env' and 'environment' fields
  if (data.env !== undefined || data.environment !== undefined) {
    payload.env = normalizeEnvironment(data.env || data.environment);
  }
  if (data.sensitivity !== undefined) payload.sensitivity = normalizeSensitivity(data.sensitivity);
  if (data.visibility !== undefined) payload.visibility = normalizeVisibility(data.visibility);
  if (data.tags !== undefined) payload.tags = data.tags;
  if (data.projectId !== undefined) payload.projectId = data.projectId || null;

  try {
    // Verify resource exists and check ownership
    const existing = await prisma.orchestratorResource.findFirst({
      where: { id }
    });

    if (!existing) {
      throw new Error('Resource not found or access denied');
    }

    // Check org access: allow if resource has no org, or if orgs match
    if (context.orgId && existing.orgId && existing.orgId !== context.orgId) {
      throw new Error('Resource not found or access denied');
    }

    const resource = await prisma.orchestratorResource.update({
      where: { id },
      data: payload
    });

    logger.info(`[ResourceService] Updated resource: ${resource.id} - ${resource.name}`);
    return resource;
  } catch (error) {
    logger.error('[ResourceService] updateResource error', error);
    throw error;
  }
}

/**
 * Delete a resource
 */
export async function deleteResource(id, context = {}) {
  try {
    // Verify resource exists
    const existing = await prisma.orchestratorResource.findFirst({
      where: { id }
    });

    if (!existing) {
      throw new Error('Resource not found or access denied');
    }

    // Check org access: allow if resource has no org, or if orgs match
    if (context.orgId && existing.orgId && existing.orgId !== context.orgId) {
      throw new Error('Resource not found or access denied');
    }

    await prisma.orchestratorResource.delete({
      where: { id }
    });

    logger.info(`[ResourceService] Deleted resource: ${id}`);
    return { success: true };
  } catch (error) {
    logger.error('[ResourceService] deleteResource error', error);
    throw error;
  }
}

/**
 * Test a resource connection
 */
export async function testResource(id, options = {}) {
  try {
    const resource = await getResource(id, options.orgId);
    if (!resource) {
      throw new Error('Resource not found');
    }

    const startTime = Date.now();
    let testResult;

    // Test based on resource type
    if (resource.type === 'HTTP' || resource.type === 'API_HTTP') {
      const axios = (await import('axios')).default;

      // Prepare headers from auth config
      const headers = buildAuthHeaders(resource.auth);

      // Determine test URL - use healthcheck endpoint if available in config
      let testUrl = resource.endpoint;
      let testMethod = resource.method || 'GET';

      const resourceConfig = parseJsonMaybe(resource.config);

      // Check for healthcheck endpoint in config
      if (resourceConfig?.endpoints?.healthcheck?.path) {
        const baseUrl = resource.endpoint.replace(/\/+$/, '');
        const healthPath = resourceConfig.endpoints.healthcheck.path;
        testUrl = `${baseUrl}${healthPath.startsWith('/') ? '' : '/'}${healthPath}`;
        testMethod = resourceConfig.endpoints.healthcheck.method || 'GET';
      }

      logger.info(`[ResourceService] Testing ${testMethod} ${testUrl}`);
      const response = await axios({
        method: testMethod,
        url: testUrl,
        headers,
        timeout: 10000,
        validateStatus: () => true
      });

      const responseTime = Date.now() - startTime;
      const checkedAt = new Date().toISOString();
      const isSuccess = response.status >= 200 && response.status < 400;

      testResult = {
        success: isSuccess,
        message: isSuccess
          ? `Connection established. Status: ${response.status}`
          : `Connection failed. Status: ${response.status} - ${getStatusMessage(response.status)}`,
        responseTime,
        statusCode: response.status,
        testedAt: checkedAt,
        checkedAt,
        status: response.status >= 200 && response.status < 300 ? 'OK'
              : response.status >= 300 && response.status < 400 ? 'REDIRECT'
              : response.status >= 400 && response.status < 500 ? 'CLIENT_ERROR'
              : 'SERVER_ERROR'
      };

    } else if (resource.type === 'DB' || resource.type === 'DATABASE') {
      const connectionConfig = parseJsonMaybe(resource.connection);

      if (!connectionConfig) {
        throw new Error('Connection configuration not found');
      }

      const resolvedConfig = {};
      if (connectionConfig.connectionString) {
        resolvedConfig.connectionString = connectionConfig.connectionString;
      } else {
        resolvedConfig.host = connectionConfig.host || connectionConfig.hostname;
        resolvedConfig.port = Number(connectionConfig.port || 5432);
        resolvedConfig.user = connectionConfig.user || connectionConfig.username;
        resolvedConfig.password = connectionConfig.password || connectionConfig.pass;
        resolvedConfig.database = connectionConfig.database || connectionConfig.db || connectionConfig.name;
      }

      if (!resolvedConfig.connectionString && (!resolvedConfig.host || !resolvedConfig.user || !resolvedConfig.database)) {
        throw new Error('Invalid connection config. Provide host, user and database or a connectionString.');
      }

      const { Pool } = await import('pg');
      const pool = new Pool(resolvedConfig);

      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
      } finally {
        await pool.end();
      }

      const responseTime = Date.now() - startTime;
      const checkedAt = new Date().toISOString();

      testResult = {
        success: true,
        message: 'Database connection validated',
        responseTime,
        metadata: {
          host: resolvedConfig.host,
          database: resolvedConfig.database
        },
        testedAt: checkedAt,
        checkedAt,
        status: 'OK'
      };

    } else if (resource.type === 'EMBEDDING') {
      const axios = (await import('axios')).default;

      const authConfig = parseJsonMaybe(resource.auth) || {};
      const apiKey = authConfig.token || authConfig.apiKey || (authConfig.credentials && authConfig.credentials.apiKey);

      if (!apiKey) {
        throw new Error('API Key not configured. Set Bearer token in authentication.');
      }

      const endpoint = resource.endpoint || 'https://api.openai.com/v1/embeddings';
      const config = parseJsonMaybe(resource.config) || {};
      const model = config.model || 'text-embedding-3-small';

      const response = await axios({
        method: 'POST',
        url: endpoint,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          input: 'test',
          model: model
        },
        timeout: 15000,
        validateStatus: () => true
      });

      const responseTime = Date.now() - startTime;
      const checkedAt = new Date().toISOString();
      const isSuccess = response.status >= 200 && response.status < 300;

      if (isSuccess && response.data?.data?.[0]?.embedding) {
        testResult = {
          success: true,
          message: `Embedding API validated. Model: ${model}`,
          responseTime,
          testedAt: checkedAt,
          checkedAt,
          status: 'OK',
          metadata: {
            model,
            dimensions: response.data.data[0].embedding.length,
            usage: response.data.usage
          }
        };
      } else {
        const errorMessage = response.data?.error?.message || `Status ${response.status}`;
        throw new Error(`Embedding API error: ${errorMessage}`);
      }

    } else {
      const checkedAt = new Date().toISOString();
      testResult = {
        success: true,
        message: 'Resource type does not support automatic testing',
        responseTime: Date.now() - startTime,
        testedAt: checkedAt,
        checkedAt,
        status: 'WARN'
      };
    }

    // Update health field with test result
    await prisma.orchestratorResource.update({
      where: { id },
      data: { health: testResult }
    });

    return testResult;
  } catch (error) {
    logger.error('[ResourceService] testResource error', error);

    const checkedAt = new Date().toISOString();
    const testResult = {
      success: false,
      message: error.message || 'Error testing connection',
      error: error.response?.data || error.message,
      testedAt: checkedAt,
      checkedAt,
      status: 'DOWN'
    };

    // Update health field with error result
    try {
      await prisma.orchestratorResource.update({
        where: { id },
        data: { health: testResult }
      });
    } catch (updateError) {
      logger.error('[ResourceService] Failed to update health status', updateError);
    }

    return testResult;
  }
}

/**
 * Health check a resource
 */
export async function healthCheckResource(id, options = {}) {
  return testResource(id, options);
}

/**
 * Request promotion of a resource from DEV to PRD
 */
export async function promoteResource(id, data = {}, context = {}) {
  try {
    const resource = await getResource(id, context.orgId);
    if (!resource) {
      throw new Error('Resource not found');
    }

    if (resource.environment !== 'DEV') {
      throw new Error('Only DEV resources can be promoted');
    }

    if (resource.promotionStatus === 'PENDING') {
      throw new Error('Resource already has a pending promotion request');
    }

    const updated = await prisma.orchestratorResource.update({
      where: { id },
      data: {
        promotionStatus: 'PENDING',
        promotionRequestedAt: new Date(),
        promotionRequestedBy: context.userId,
        promotionNotes: data.notes || null
      }
    });

    logger.info(`[ResourceService] Promotion requested for resource: ${id} by user: ${context.userId}`);
    return updated;
  } catch (error) {
    logger.error('[ResourceService] promoteResource error', error);
    throw error;
  }
}

/**
 * Approve promotion request
 */
export async function approvePromotion(id, data = {}, context = {}) {
  try {
    const resource = await getResource(id, context.orgId);
    if (!resource) {
      throw new Error('Resource not found');
    }

    if (resource.promotionStatus !== 'PENDING') {
      throw new Error('No pending promotion request');
    }

    const updated = await prisma.orchestratorResource.update({
      where: { id },
      data: {
        environment: 'PRD',
        promotionStatus: 'APPROVED',
        promotionApprovedAt: new Date(),
        promotionApprovedBy: context.userId,
        promotionNotes: data.notes || resource.promotionNotes
      }
    });

    logger.info(`[ResourceService] Promotion approved for resource: ${id} by user: ${context.userId}`);
    return updated;
  } catch (error) {
    logger.error('[ResourceService] approvePromotion error', error);
    throw error;
  }
}

/**
 * Reject promotion request
 */
export async function rejectPromotion(id, data = {}, context = {}) {
  try {
    const resource = await getResource(id, context.orgId);
    if (!resource) {
      throw new Error('Resource not found');
    }

    if (resource.promotionStatus !== 'PENDING') {
      throw new Error('No pending promotion request');
    }

    const updated = await prisma.orchestratorResource.update({
      where: { id },
      data: {
        promotionStatus: 'REJECTED',
        promotionNotes: data.reason || 'Promotion rejected'
      }
    });

    logger.info(`[ResourceService] Promotion rejected for resource: ${id} by user: ${context.userId}`);
    return updated;
  } catch (error) {
    logger.error('[ResourceService] rejectPromotion error', error);
    throw error;
  }
}

/**
 * Get resource types
 */
export function getResourceTypes() {
  return [
    { id: 'HTTP', name: 'API HTTP (Outbound)', description: 'REST API endpoints for outbound calls' },
    { id: 'WEBHOOK', name: 'Webhook (Inbound)', description: 'Incoming webhook endpoints' },
    { id: 'DB', name: 'Database', description: 'Database connections (PostgreSQL, MySQL, etc.)' },
    { id: 'FILE', name: 'File/NFS', description: 'File system and network storage resources' },
    { id: 'MESSAGE', name: 'Messaging', description: 'Message brokers and queues (Kafka, RabbitMQ)' },
    { id: 'SLACK', name: 'Slack', description: 'Slack integration and bot connections' },
    { id: 'TEAMS', name: 'Microsoft Teams', description: 'Microsoft Teams integration' },
    { id: 'TELEGRAM', name: 'Telegram', description: 'Telegram bot connections' },
    { id: 'FUNCTION', name: 'Function/Script', description: 'Custom function handlers and scripts' },
    { id: 'EMBEDDING', name: 'Embedding Function', description: 'Text embedding APIs (OpenAI, etc.)' },
    { id: 'VECTOR_ENGINE', name: 'Vector Engine', description: 'Vector databases (Pinecone, Weaviate, etc.)' },
    { id: 'DATA_LAYER', name: 'Data Layer', description: 'Feature stores and data aggregation layers' }
  ];
}

export default {
  listResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  testResource,
  healthCheckResource,
  promoteResource,
  approvePromotion,
  rejectPromotion,
  getResourceTypes
};
