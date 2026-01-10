import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Helper to extract error message from API response
function extractErrorMessage(error: AxiosError): string {
  const data = error.response?.data as { error?: string; message?: string; required?: string[]; current?: string[] } | undefined

  if (data) {
    // Handle permission errors with details
    if (error.response?.status === 403 && data.required && data.current) {
      return `Permissão insuficiente. Requer: ${data.required.join(' ou ')}. Sua role: ${data.current.join(', ')}`
    }
    // Use error message from backend
    if (data.error) return data.error
    if (data.message) return data.message
  }

  // Fallback to generic messages
  if (error.response?.status === 403) return 'Acesso negado. Você não tem permissão para esta ação.'
  if (error.response?.status === 401) return 'Sessão expirada. Faça login novamente.'
  if (error.response?.status === 404) return 'Recurso não encontrado.'
  if (error.response?.status === 500) return 'Erro interno do servidor.'

  return error.message || 'Erro desconhecido'
}

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
          }
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // Create a new error with the extracted message
    const errorMessage = extractErrorMessage(error)
    const enhancedError = new Error(errorMessage)
    ;(enhancedError as Error & { originalError: AxiosError }).originalError = error

    return Promise.reject(enhancedError)
  }
)

export default api
