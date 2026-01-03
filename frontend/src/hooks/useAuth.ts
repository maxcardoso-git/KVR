import { create } from 'zustand'
import * as authService from '@/services/auth.service'
import type { User } from '@/services/auth.service'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setTahToken: (token: string) => Promise<void>
}

// Simple zustand store without persist for now (we'll add it via localStorage)
const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await authService.login({ email, password })
    const { user, accessToken, refreshToken } = response.data

    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)

    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  logout: async () => {
    try {
      await authService.logout()
    } catch (error) {
      // Ignore logout errors
    }

    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken')

    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    try {
      const response = await authService.getMe()
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  setTahToken: async (token: string) => {
    // Store the TAH token as access token
    localStorage.setItem('accessToken', token)

    set({
      accessToken: token,
      isLoading: true,
    })

    try {
      // Validate token by fetching user info
      const response = await authService.getMe()
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      localStorage.removeItem('accessToken')
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      })
      throw new Error('Token inválido ou expirado')
    }
  },
}))

// Hook that initializes auth check on first use
export function useAuth() {
  const store = useAuthStore()

  // Check auth on mount if loading
  if (store.isLoading && store.accessToken) {
    store.checkAuth()
  } else if (store.isLoading && !store.accessToken) {
    useAuthStore.setState({ isLoading: false })
  }

  return store
}

export default useAuth
