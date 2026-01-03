import api from './api'

export interface User {
  id: string
  email: string
  fullName: string
  roles: string[]
  orgId?: string
  orgName?: string
  authSource: 'local' | 'tah'
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  data: {
    user: User
    accessToken: string
    refreshToken: string
  }
}

export interface AuthResponse {
  success: boolean
  data: User
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', credentials)
  return response.data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function getMe(): Promise<AuthResponse> {
  const response = await api.get<AuthResponse>('/auth/me')
  return response.data
}

export async function refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await api.post('/auth/refresh')
  return response.data.data
}

export default {
  login,
  logout,
  getMe,
  refreshToken,
}
