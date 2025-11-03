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