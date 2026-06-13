import { create } from 'zustand'
import { getToken, setToken, removeToken, getUserId, setUserId, removeUserId } from '../utils/token'

interface AuthState {
  token: string | null
  userId: string | null
  isLoggedIn: boolean
  login: (token: string, userId: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getToken(),
  userId: getUserId(),
  isLoggedIn: !!getToken(),

  login: (token: string, userId: string) => {
    setToken(token)
    setUserId(userId)
    set({ token, userId, isLoggedIn: true })
  },

  logout: () => {
    removeToken()
    removeUserId()
    set({ token: null, userId: null, isLoggedIn: false })
  },
}))