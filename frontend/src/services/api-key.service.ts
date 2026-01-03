import api from './api'

export interface ApiKey {
  id: string
  name: string
  description?: string
  keyPrefix: string
  scopes: string[]
  rateLimit: number
  rateLimitUsed?: number
  rateLimitReset?: string
  usageCount: number
  lastUsedAt?: string
  lastUsedIp?: string
  expiresAt?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string
}

export interface Scope {
  id: string
  name: string
  description: string
}

export interface CreateApiKeyRequest {
  name: string
  description?: string
  scopes?: string[]
  rateLimit?: number
  expiresAt?: string
}

export interface ApiKeysResponse {
  success: boolean
  data: ApiKey[]
}

export interface ApiKeyResponse {
  success: boolean
  data: ApiKey
  message?: string
}

export interface ApiKeyCreateResponse {
  success: boolean
  data: ApiKeyWithSecret
  message: string
}

export interface ScopesResponse {
  success: boolean
  data: Scope[]
}

export interface ApiKeyStatsResponse {
  success: boolean
  data: {
    id: string
    name: string
    usageCount: number
    rateLimit: number
    rateLimitUsed: number
    rateLimitRemaining: number
    rateLimitReset?: string
    rateLimitResetIn?: number
    lastUsedAt?: string
    lastUsedIp?: string
    createdAt: string
  }
}

export async function listApiKeys(includeInactive?: boolean): Promise<ApiKeysResponse> {
  const params = includeInactive ? '?includeInactive=true' : ''
  const response = await api.get<ApiKeysResponse>(`/api-keys${params}`)
  return response.data
}

export async function getApiKey(id: string): Promise<ApiKeyResponse> {
  const response = await api.get<ApiKeyResponse>(`/api-keys/${id}`)
  return response.data
}

export async function createApiKey(data: CreateApiKeyRequest): Promise<ApiKeyCreateResponse> {
  const response = await api.post<ApiKeyCreateResponse>('/api-keys', data)
  return response.data
}

export async function updateApiKey(id: string, data: Partial<CreateApiKeyRequest & { isActive?: boolean }>): Promise<ApiKeyResponse> {
  const response = await api.patch<ApiKeyResponse>(`/api-keys/${id}`, data)
  return response.data
}

export async function deleteApiKey(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/api-keys/${id}`)
  return response.data
}

export async function regenerateApiKey(id: string): Promise<ApiKeyCreateResponse> {
  const response = await api.post<ApiKeyCreateResponse>(`/api-keys/${id}/regenerate`)
  return response.data
}

export async function getApiKeyStats(id: string): Promise<ApiKeyStatsResponse> {
  const response = await api.get<ApiKeyStatsResponse>(`/api-keys/${id}/stats`)
  return response.data
}

export async function listScopes(): Promise<ScopesResponse> {
  const response = await api.get<ScopesResponse>('/api-keys/scopes/list')
  return response.data
}

export default {
  listApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  regenerateApiKey,
  getApiKeyStats,
  listScopes,
}
