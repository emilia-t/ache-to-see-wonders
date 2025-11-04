// The relative position of this file: src/services/api.ts
import { ACCOUNT_SERVER_URL } from '@/config/apiConfig'

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

export interface AccountApiResponse {
  success: boolean
  message: string
  user?: any
}

class AccountApiService {
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
      const url = `${ACCOUNT_SERVER_URL}${endpoint}`
      
      const defaultOptions: RequestInit = {
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              ...options.headers,
          },
      }

      try {
          // 创建带有超时的AbortController
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
          
          const response = await fetch(url, { 
              ...defaultOptions, 
              ...options,
              signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          const data = await response.json();
          return data;
      } catch (error: unknown) {
          console.log("API请求失败时间:"+this.formatDate());
          console.error('API请求失败:', error);
          if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'AbortError') {
              throw new Error('请求超时，请稍后重试');
          }
          throw new Error('网络请求失败，请检查网络连接');
      }
  }

  async register(userData: RegisterData): Promise<AccountApiResponse> {
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

  async login(credentials: LoginCredentials): Promise<AccountApiResponse> {
    const formData = new URLSearchParams()
    formData.append('email', credentials.email)
    formData.append('password', credentials.password)

    return this.request('/login', {
      method: 'POST',
      body: formData,
    })
  }

  async getUserData(userId: string, token: string): Promise<AccountApiResponse> {
    const formData = new URLSearchParams()
    formData.append('user_id', userId)
    formData.append('token', token)

    return this.request('/getuserdata', {
      method: 'POST',
      body: formData,
    })
  }

  async activateAccount(code: string, userId: string): Promise<AccountApiResponse> {
    return this.request(`/activate?code=${code}&user_id=${userId}`, {
      method: 'GET',
    })
  }

  private formatDate(date=new Date()): string {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0'); // 月份是从0开始的，所以需要+1
    let day = date.getDate().toString().padStart(2, '0');
    let hours = date.getHours().toString().padStart(2, '0');
    let minutes = date.getMinutes().toString().padStart(2, '0');
    let seconds = date.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

export const accountApiService = new AccountApiService()