import api from './api'

export interface Resource {
  id: string
  name: string
  type: string
  subtype?: string
  endpoint?: string
  method?: string
  config?: Record<string, unknown>
  auth?: Record<string, unknown>
  connection?: Record<string, unknown>
  metadata?: Record<string, unknown>
  isActive: boolean
  env: 'DEV' | 'PRD' | 'QA' | 'HOMOLOG'
  sensitivity: string
  visibility: string
  tags: string[]
  health?: {
    success: boolean
    message: string
    status: string
    checkedAt: string
    responseTime?: number
  }
  promotionStatus?: string
  createdAt: string
  updatedAt: string
}

export interface ResourceType {
  id: string
  name: string
  description: string
}

export interface CreateResourceRequest {
  name: string
  type: string
  subtype?: string
  endpoint?: string
  method?: string
  config?: Record<string, unknown>
  auth?: Record<string, unknown>
  connection?: Record<string, unknown>
  metadata?: Record<string, unknown>
  isActive?: boolean
  env?: 'DEV' | 'PRD' | 'QA' | 'HOMOLOG'
  sensitivity?: string
  visibility?: string
  tags?: string[]
  projectId?: string
}

export interface ResourcesResponse {
  success: boolean
  data: Resource[]
}

export interface ResourceResponse {
  success: boolean
  data: Resource
}

export interface ResourceTypesResponse {
  success: boolean
  data: ResourceType[]
}

export interface TestResultResponse {
  success: boolean
  data: {
    success: boolean
    message: string
    status: string
    checkedAt: string
    responseTime?: number
    statusCode?: number
    error?: string
  }
}

export async function listResources(filters?: {
  environment?: string
  type?: string
  isActive?: boolean
  search?: string
}): Promise<ResourcesResponse> {
  const params = new URLSearchParams()
  if (filters?.environment) params.append('environment', filters.environment)
  if (filters?.type) params.append('type', filters.type)
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive))
  if (filters?.search) params.append('search', filters.search)

  const response = await api.get<ResourcesResponse>(`/resources?${params}`)
  return response.data
}

export async function getResource(id: string): Promise<ResourceResponse> {
  const response = await api.get<ResourceResponse>(`/resources/${id}`)
  return response.data
}

export async function createResource(data: CreateResourceRequest): Promise<ResourceResponse> {
  const response = await api.post<ResourceResponse>('/resources', data)
  return response.data
}

export async function updateResource(id: string, data: Partial<CreateResourceRequest>): Promise<ResourceResponse> {
  const response = await api.put<ResourceResponse>(`/resources/${id}`, data)
  return response.data
}

export async function deleteResource(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/resources/${id}`)
  return response.data
}

export async function testResource(id: string): Promise<TestResultResponse> {
  const response = await api.post<TestResultResponse>(`/resources/${id}/test`)
  return response.data
}

export async function getResourceTypes(): Promise<ResourceTypesResponse> {
  const response = await api.get<ResourceTypesResponse>('/resources/types')
  return response.data
}

export async function promoteResource(id: string, notes?: string): Promise<ResourceResponse> {
  const response = await api.post<ResourceResponse>(`/resources/${id}/promote`, { notes })
  return response.data
}

export async function approveResource(id: string, notes?: string): Promise<ResourceResponse> {
  const response = await api.post<ResourceResponse>(`/resources/${id}/approve`, { notes })
  return response.data
}

export async function rejectResource(id: string, notes?: string): Promise<ResourceResponse> {
  const response = await api.post<ResourceResponse>(`/resources/${id}/reject`, { notes })
  return response.data
}

export async function healthCheckResource(id: string): Promise<TestResultResponse> {
  const response = await api.post<TestResultResponse>(`/resources/${id}/health-check`)
  return response.data
}

export default {
  listResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  testResource,
  getResourceTypes,
  promoteResource,
  approveResource,
  rejectResource,
  healthCheckResource,
}
