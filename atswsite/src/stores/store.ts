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
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_id')
    user.value = null
    token.value = null
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

interface HomePageVideoConfig {
  title: string
  description: string
  cover: string
  video: string
  targetUrl: string
  button_name: string
}

interface HomePageTrialCardConfig {
  key: string
  title: string
  description: string
  cover: string
  targetUrl: string
  mode: string
  online_count: number
  online_state: boolean
  visit_count: number
  heart_count: number
}

interface HomePageTrialBoxConfig {
  annotation: string
  version: string
  list: HomePageTrialCardConfig[]
}

interface HomePageLogItemConfig{
  id: number
  time: string
  title: string
  descript: string
}

interface HomePageLogsConfig{
  annotation: string
  version: string
  list: HomePageLogItemConfig[]
}

interface WebConfig {
  annotation?: string
  version?: string
  homePageCurrentVideo?: HomePageVideoConfig
  homePageTrialBox?: HomePageTrialBoxConfig
  homePageLogs?: HomePageLogsConfig
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
  const defaultTrialBoxConfig: HomePageTrialBoxConfig = {
    annotation: 'Loding',
    version: 'Loding',
    list: []
  }
  const defaultLogsConfig: HomePageLogsConfig = {
    annotation: 'Loding',
    version: 'Loding',
    list: []
  }

  // 计算属性，方便直接访问视频配置
  const homePageCurrentVideo = computed((): HomePageVideoConfig => {
    return config.value?.homePageCurrentVideo || defaultVideoConfig
  })
  const homePageTrialBox = computed((): HomePageTrialBoxConfig => {
    return config.value?.homePageTrialBox || defaultTrialBoxConfig
  })
  const homePageLogsBox = computed((): HomePageLogsConfig => {
    return config.value?.homePageLogs || defaultLogsConfig
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
    homePageTrialBox,
    homePageLogsBox,
    loading,  
    error,
    configVersion,
    loadConfig
  }
})

// 游戏设置接口
export interface CC1GameSetting {
  soundVolume: number;
  musicVolume: number;
  mouseSensitivity: number;
  moveSensitivity: number;
  fov: number;
  ambientIntensity: number;
  graphicsQuality: 'low' | 'medium' | 'high';
} 

// 游戏设置 store
export const useGameSettingStore = defineStore('gameSetting', () => {
  // 默认游戏设置
  const defaultGameSettings: CC1GameSetting = {
    soundVolume: 80,
    musicVolume: 60,
    mouseSensitivity: 75,
    moveSensitivity: 75,
    fov: 70,
    ambientIntensity: 50,
    graphicsQuality: 'high'
  };

  // 游戏设置
  const gameSettings = ref<CC1GameSetting>({ ...defaultGameSettings });

  // 保存设置到本地存储
  const saveSettingsToLocalStorage = () => {
    try {
      localStorage.setItem('cc1_gameSetting', JSON.stringify(gameSettings.value));
      console.log('游戏设置已保存到本地存储');
    } catch (error) {
      console.error('保存设置到本地存储失败:', error);
    }
  };

  // 从本地存储加载设置
  const loadSettingsFromLocalStorage = () => {
    try {
      const savedSettings = localStorage.getItem('cc1_gameSetting');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        
        // 验证并合并设置，确保所有必需的属性都存在
        gameSettings.value = {
          ...defaultGameSettings,
          ...parsedSettings,
          // 确保 graphicsQuality 是有效的值
          graphicsQuality: ['low', 'medium', 'high'].includes(parsedSettings.graphicsQuality) 
            ? parsedSettings.graphicsQuality 
            : defaultGameSettings.graphicsQuality
        };
        
        console.log('游戏设置已从本地存储加载');
      }
    } catch (error) {
      console.error('从本地存储加载设置失败:', error);
      // 加载失败时使用默认设置
      gameSettings.value = { ...defaultGameSettings };
    }
  };

  // 更新设置
  const updateSetting = <K extends keyof CC1GameSetting>(key: K, value: CC1GameSetting[K]) => {
    gameSettings.value[key] = value;
    saveSettingsToLocalStorage();
  };

  // 重置设置为默认值
  const resetToDefaultSettings = () => {
    gameSettings.value = { ...defaultGameSettings };
    saveSettingsToLocalStorage();
  };

  // 初始化时加载设置
  loadSettingsFromLocalStorage();

  return {
    gameSettings,
    defaultGameSettings,
    updateSetting,
    resetToDefaultSettings,
    saveSettingsToLocalStorage,
    loadSettingsFromLocalStorage
  }
});