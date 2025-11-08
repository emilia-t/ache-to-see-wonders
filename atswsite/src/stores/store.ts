// The relative position of this file: src/stores/store.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type UserData from '@/interface/UserData'

export const useUserStore = defineStore('user', () => {
  const user = ref<UserData | null>(null)
  const token = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => user.value !== null)
  const userData = computed(() => user.value)

  // 设置用户信息
  function setUser(userData: UserData | null) {
    user.value = userData
  }

  // 设置token
  function setToken(newToken: string | null) {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('user_token', newToken)
    } else {
      localStorage.removeItem('user_token')
    }
  }

  // 设置加载状态
  function setLoading(isLoading: boolean) {
    loading.value = isLoading
  }

  // 设置错误信息
  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }

  // 登出
  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_id')
    error.value = null
  }

  // 从localStorage恢复登录状态
  function restoreAuth() {
    const savedToken = localStorage.getItem('user_token')
    const savedUserId = localStorage.getItem('user_id')
    
    if (savedToken && savedUserId) {
      token.value = savedToken
      // 可以在这里自动获取用户数据
      return { token: savedToken, userId: savedUserId }
    }
    return null
  }

  return {
    user,
    token,
    loading,
    error,
    isLoggedIn,
    userData,
    setUser,
    setToken,
    setLoading,
    setError,
    logout,
    restoreAuth
  }
})

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)
  function increment() {
    count.value++
  }

  return { count, doubleCount, increment }
})

interface HomePageVideoConfig {
  title: string
  description: string
  cover: string
  video: string
  targetUrl: string
  button_name: string
}

interface WebConfig {
  annotation?: string
  version?: string
  homePageCurrentVideo?: HomePageVideoConfig
  [key: string]: any
}

export const useConfigStore = defineStore('config', () => {
  const config = ref<WebConfig | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 默认配置
  const defaultVideoConfig: HomePageVideoConfig = {
    title: 'Loding',
    description: 'Loding',
    cover: 'Loding',
    video: 'Loding',
    targetUrl: '#',
    button_name: 'Loding'
  }

  // 计算属性，方便直接访问视频配置
  const homePageCurrentVideo = computed((): HomePageVideoConfig => {
    return config.value?.homePageCurrentVideo || defaultVideoConfig
  })

  // 加载配置
  async function loadConfig() {
    if (loading.value) return
    
    loading.value = true
    error.value = null
    
    try {
      // 添加时间戳参数避免缓存
      const timestamp = new Date().getTime()
      const response = await fetch(`/webConfig.json?t=${timestamp}`)
      if (!response.ok) {
        throw new Error(`配置加载失败: ${response.status}`)
      }
      const configData = await response.json() as WebConfig
      config.value = configData
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
    } finally {
      loading.value = false
    }
  }

  // 自动加载配置 - 在 store 创建时立即执行
  loadConfig()

  // 检查配置版本
  const configVersion = computed(() => config.value?.version || 'unknown')

  return {
    config,
    homePageCurrentVideo,
    loading,  
    error,
    configVersion,
    loadConfig
  }
})