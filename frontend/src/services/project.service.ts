import api from './api'

export interface Project {
  id: string
  name: string
  description?: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ProjectsResponse {
  success: boolean
  data: Project[]
}

export interface ProjectResponse {
  success: boolean
  data: Project
}

export async function listProjects(): Promise<ProjectsResponse> {
  const response = await api.get<ProjectsResponse>('/projects')
  return response.data
}

export async function getProject(id: string): Promise<ProjectResponse> {
  const response = await api.get<ProjectResponse>(`/projects/${id}`)
  return response.data
}

export default {
  listProjects,
  getProject,
}
