import axios from 'axios'
import { getToken } from '../utils/token'

export const apiClient = axios.create({
  baseURL: 'https://chat-go.jwzhd.com',
  timeout: 30000,
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['token'] = token
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear()
      window.location.hash = '#/login'
    }
    return Promise.reject(err)
  }
)