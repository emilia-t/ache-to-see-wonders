// The relative position of this file: src/services/api.ts
import { useUserStore } from '@/stores/store'

const API_BASE_URL = 'http://localhost:810' // 后端用户登录服务器地址

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
  qq?: string
}

export interface ApiResponse {
  success: boolean
  message: string
  user?: any
}

class ApiService {
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, { ...defaultOptions, ...options })
      const data = await response.json()
      return data
    } catch (error) {
      console.error('API请求失败:', error)
      throw new Error('网络请求失败，请检查网络连接')
    }
  }

  async register(userData: RegisterData): Promise<ApiResponse> {
    const formData = new URLSearchParams()
    formData.append('email', userData.email)
    formData.append('password', userData.password)
    formData.append('name', userData.name)
    if (userData.qq) {
      formData.append('qq', userData.qq)
    }

    return this.request('/register', {
      method: 'POST',
      body: formData,
    })
  }

  async login(credentials: LoginCredentials): Promise<ApiResponse> {
    const formData = new URLSearchParams()
    formData.append('email', credentials.email)
    formData.append('password', credentials.password)

    return this.request('/login', {
      method: 'POST',
      body: formData,
    })
  }

  async getUserData(userId: string, token: string): Promise<ApiResponse> {
    const formData = new URLSearchParams()
    formData.append('user_id', userId)
    formData.append('token', token)

    return this.request('/getuserdata', {
      method: 'POST',
      body: formData,
    })
  }

  async activateAccount(code: string, userId: string): Promise<ApiResponse> {
    return this.request(`/activate?code=${code}&user_id=${userId}`, {
      method: 'GET',
    })
  }
}

export const apiService = new ApiService()