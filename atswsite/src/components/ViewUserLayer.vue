<script setup lang="ts">
// The relative position of this file: src/components/ViewUserLayer.vue
// 此组件用于各个page的登录用户信息展示和登录界面
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type ChineseChessUserData from '@/interface/ChineseChessUserData'
import type UserData from '@/interface/UserData'
import Tool from '@/class/Tool'
import { useUserStore } from '@/stores/store'
import { apiService, type LoginCredentials, type RegisterData } from '@/services/api'

// ==================== 接口定义 ====================
interface Props {
  loading?: boolean  // 是否显示加载状态
  theme?: string     // 界面显示主题(dark and light)
  design?: string    // 界面的样式类型(具体参考html模板)
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  theme: '',
  design: ''
})

// 事件定义
const emit = defineEmits<{
  login: [credentials?: any]
  logout: []
  'update:userData': [userData: UserData | ChineseChessUserData | null]
}>()

// ==================== Store 和 状态管理 ====================
const userStore = useUserStore()

// ==================== 响应式数据 ====================
// 设备类型检测
const isMobile = ref(false)
const isTablet = ref(false)

// 弹窗显示状态
const showLoginModal = ref(false)           // PC 登录界面
const showMobileLoginModal = ref(false)     // 移动版 登录界面
const showRegisterModal = ref(false)        // PC 注册界面
const showMobileRegisterModal = ref(false)  // 移动版 注册界面
const showUserDropdown = ref(false)
const showMobileUserMenu = ref(false)

// 表单数据
const loginForm = ref({
  email: '',
  password: ''
})

const registerForm = ref({
  email: '',
  password: '',
  name: '',
  qq: ''
})

// 错误信息
const loginError = ref('')
const registerError = ref('')

// ==================== 计算属性 ====================
const isLoggedIn = computed(() => userStore.isLoggedIn)
const userData = computed(() => userStore.userData)

const userHeadImg = computed(() => {
  if (!userData.value) return ''
  // 使用自定义头像
  if ('head_img' in userData.value && userData.value.head_img) {
    return userData.value.head_img
  }
  return Tool.getDefaultHeadImg(userData.value.name, 100)
})

// ==================== 方法定义 ====================
// 弹窗管理方法
const toggleLogin = () => {
  // 平板设备也可以使用移动端界面
  if (isMobile.value || isTablet.value) {
    showMobileLoginModal.value = !showMobileLoginModal.value
    showLoginModal.value = false
  } else {
    showLoginModal.value = !showLoginModal.value
    showMobileLoginModal.value = false
  }
  // 清空错误信息
  loginError.value = ''
  // 关闭其他弹窗
  showUserDropdown.value = false
  showMobileUserMenu.value = false
}

const toggleRegister = () => {
  if (isMobile.value || isTablet.value) {
    showMobileRegisterModal.value = !showMobileRegisterModal.value
    showRegisterModal.value = false
  } else {
    showRegisterModal.value = !showRegisterModal.value
    showMobileRegisterModal.value = false
  }
  // 清空错误信息
  registerError.value = ''
}

const toggleUserDropdown = () => {
  showUserDropdown.value = !showUserDropdown.value
}

const toggleMobileUserMenu = () => {
  showMobileUserMenu.value = !showMobileUserMenu.value
}

const closeAllModals = () => {
  showLoginModal.value = false
  showMobileLoginModal.value = false
  showRegisterModal.value = false
  showMobileRegisterModal.value = false
  showUserDropdown.value = false
  showMobileUserMenu.value = false
  
  // 清空错误信息
  loginError.value = ''
  registerError.value = ''

  // 清空注册表单
  registerForm.value = {
    email: '',
    password: '',
    name: '',
    qq: ''
  }
}

// 弹窗切换方法
const switchToRegister = () => {
  closeAllModals()
  toggleRegister()
}

const switchToLogin = () => {
  closeAllModals()
  toggleLogin()
}

// 认证相关方法
const handleLogin = async () => {
  loginError.value = ''
  userStore.setLoading(true)

  try {
    const credentials: LoginCredentials = {
      email: loginForm.value.email,
      password: loginForm.value.password
    }

    const response = await apiService.login(credentials)
    
    if (response.success) {
      // 保存token和用户ID到localStorage
      localStorage.setItem('user_token', response.user?.token || '')
      localStorage.setItem('user_id', response.user?.id?.toString() || '')
      
      // 更新store
      userStore.setUser(response.user)
      userStore.setToken(response.user?.token || '')
      
      // 关闭登录弹窗
      closeAllModals()
      
      // 清空登录表单
      loginForm.value = { email: '', password: '' }
      
      // 触发事件
      emit('login', credentials)
    } else {
      loginError.value = response.message
    }
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '登录失败，请重试'
  } finally {
    userStore.setLoading(false)
  }
}

const handleRegister = async () => {
  registerError.value = ''
  userStore.setLoading(true)

  try {
    const registerData: RegisterData = {
      email: registerForm.value.email,
      password: registerForm.value.password,
      name: registerForm.value.name,
      qq: registerForm.value.qq || undefined
    }

    const response = await apiService.register(registerData)
    
    if (response.success) {
      // 注册成功，显示成功消息
      alert('注册成功！请查看邮箱激活您的账户。')
      
      // 关闭注册弹窗，切换到登录
      closeAllModals()
      switchToLogin()
      
      // 清空注册表单
      registerForm.value = { email: '', password: '', name: '', qq: '' }
    } else {
      registerError.value = response.message
    }
  } catch (error) {
    registerError.value = error instanceof Error ? error.message : '注册失败，请重试'
  } finally {
    userStore.setLoading(false)
  }
}

const handleLogout = () => {
  userStore.logout()
  closeAllModals()
  emit('logout')
}

// 自动登录检查
const checkAutoLogin = async () => {
  const authInfo = userStore.restoreAuth()
  if (authInfo) {
    try {
      userStore.setLoading(true)
      const response = await apiService.getUserData(authInfo.userId, authInfo.token)
      if (response.success && response.user) {
        userStore.setUser(response.user)
      } else {
        // token无效，清除本地存储
        userStore.logout()
      }
    } catch (error) {
      console.error('自动登录失败:', error)
      userStore.logout()
    } finally {
      userStore.setLoading(false)
    }
  }
}

// 工具方法
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-avatar') && !target.closest('.user-dropdown') && 
      !target.closest('.login-modal') && !target.closest('.mobile-user-menu')) {
    closeAllModals()
  }
}

const detectDeviceType = () => {
  const userAgent = navigator.userAgent.toLowerCase()
  const screenWidth = window.innerWidth
  
  // 移动设备特征检测
  const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|windows phone|webos/i.test(userAgent)
  const isTabletDevice = /ipad|tablet|playbook|silk|kindle/i.test(userAgent) || 
                         (isMobileDevice && screenWidth >= 768 && screenWidth <= 1024)
  
  isMobile.value = isMobileDevice && !isTabletDevice
  isTablet.value = isTabletDevice
}

// ==================== 生命周期 ====================
onMounted(() => {
  detectDeviceType()
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', detectDeviceType)
  // 检查自动登录
  checkAutoLogin()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', detectDeviceType)
})

// ==================== 暴露给模板的方法和数据 ====================
defineExpose({
  isLoggedIn,
  userHeadImg,
  handleLogin,
  handleLogout
})
</script>

<template>
  <div class="view-user-layer-container" :class="[`theme-${props.theme}`, `design-${props.design}`]">
    <!-- 样式 A : 悬浮固定在右上角的卡片样式，会美观的显示用户信息，点击头像会展开登录弹窗 -->
    <div v-if="props.design == 'A'" class="design-a">
      <div class="user-card" :class="{ 'logged-in': isLoggedIn }">
        <div v-if="isLoggedIn && userData" class="user-info">
          <div class="avatar-container" @click="toggleUserDropdown">
            <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
          </div>
          <div class="user-details">
            <div class="user-name">{{ userData.name }}</div>
            <div class="user-email">{{ userData.email }}</div>
          </div>
          <div v-if="showUserDropdown" class="user-dropdown">
            <div class="dropdown-item" @click="handleLogout">退出登录</div>
          </div>
        </div>
        <div v-else class="login-prompt">
          <button class="login-btn" @click.stop="toggleLogin">登录/注册</button>
        </div>
      </div>
    </div>

    <!-- 样式 B : 非固定悬浮的，跟随父组件的文档流的单一头像+用户名的样式，鼠标悬浮在头像或用户名上会显示用户信息，点击头像或用户名会展开登录弹窗 -->
    <div v-if="props.design == 'B'" class="design-b">
      <div class="user-compact" :class="{ 'logged-in': isLoggedIn }">
        <div v-if="isLoggedIn && userData" class="user-info-hoverable">
          <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
          <span class="user-name">{{ userData.name }}</span>
          <div class="user-tooltip">
            <div class="tooltip-content">
              <p>{{ userData.name }}</p>
              <p>{{ userData.email }}</p>
              <button class="logout-btn" @click="handleLogout">退出</button>
            </div>
          </div>
        </div>
        <div v-else class="login-compact" @click.stop="toggleLogin">
          <div class="avatar-placeholder"></div>
          <span class="login-text">登入</span>
        </div>
      </div>
    </div>

    <!-- 样式 C : 悬浮固定在右上角的单一头像+用户名的样式，鼠标悬浮在头像或用户名上会显示用户信息，点击头像或用户名会展开登录弹窗 -->
    <div v-if="props.design == 'C'" class="design-c">
      <div class="user-fixed" :class="{ 'logged-in': isLoggedIn }">
        <div v-if="isLoggedIn && userData" class="user-info-fixed">
          <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
          <span class="user-name">{{ userData.name }}</span>
          <div class="user-tooltip">
            <div class="tooltip-content">
              <p>{{ userData.name }}</p>
              <p>{{ userData.email }}</p>
              <button class="logout-btn" @click="handleLogout">退出</button>
            </div>
          </div>
        </div>
        <div v-else class="login-fixed" @click.stop="toggleLogin">
          <div class="avatar-placeholder"></div>
          <span class="login-text">登录</span>
        </div>
      </div>
    </div>

    <!-- 样式 D : 非固定悬浮的，跟随父组件的文档流的仅显示用户头像的样式，没有任何其他的行为 -->
    <div v-if="props.design == 'D'" class="design-d">
      <div v-if="isLoggedIn && userData" class="user-avatar-only">
        <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
      </div>
      <div v-else class="avatar-placeholder-only">
        <div class="avatar-placeholder"></div>
      </div>
    </div>

    <!-- 样式 E : 悬浮固定在右上角的单一头像的样式，没有任何其他的行为 -->
    <div v-if="props.design == 'E'" class="design-e">
      <div v-if="isLoggedIn && userData" class="user-avatar-fixed">
        <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
      </div>
      <div v-else class="avatar-placeholder-fixed">
        <div class="avatar-placeholder"></div>
      </div>
    </div>

    <!-- 样式 F : 非固定悬浮的，跟随父组件的文档流的仅显示用户头像+用户名的样式，专为移动端定制，轻触头像会展开或关闭用户的信息与登出按钮(如果未登录的话会展开登录弹窗) -->
    <div v-if="props.design == 'F'" class="design-f">
      <div class="user-mobile" :class="{ 'logged-in': isLoggedIn }">
        <div v-if="isLoggedIn && userData" class="user-mobile-logged">
          <div class="mobile-user-header" @click="toggleMobileUserMenu">
            <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
            <span class="user-name">{{ userData.name }}</span>
          </div>
          <div v-if="showMobileUserMenu" class="mobile-user-menu">
            <div class="menu-item">{{ userData.email }}</div>
            <div class="menu-item" @click="handleLogout">退出登录</div>
          </div>
        </div>
        <div v-else class="user-mobile-anonymous" @click="toggleLogin">
          <div class="avatar-placeholder"></div>
          <span class="login-text">登入</span>
        </div>
      </div>
    </div>

    <!-- 统一的中央登录弹窗面板(PC版本) -->
    <div v-if="showLoginModal" class="login-modal pc-login-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>登录ATSW</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="email">邮箱</label>
              <input type="email" id="email" autocomplete="autocomplete" v-model="loginForm.email" required placeholder="请输入邮箱" />
            </div>
            <div class="form-group">
              <label for="password">密码</label>
              <input type="password" id="password" v-model="loginForm.password" required placeholder="请输入密码" />
            </div>
            <!-- 显示服务器的登录错误信息 -->
            <div v-if="loginError" class="error-message">{{ loginError }}</div>
            <button type="submit" class="submit-btn" :disabled="userStore.loading">
              {{ userStore.loading ? '登录中...' : '登录' }}
            </button>
          </form>
          <div class="register-prompt">
            没有账号? <a href="#" class="register-link" @click.prevent.stop="switchToRegister">立即注册</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 统一的中央登录弹窗面板(移动端版) -->
    <div v-if="showMobileLoginModal" class="login-modal mobile-login-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>登录ATSW</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleLogin">
            <div class="form-group">
              <input type="email" id="email" autocomplete="autocomplete" v-model="loginForm.email" required placeholder="邮箱" />
            </div>
            <div class="form-group">
              <input type="password" id="password" v-model="loginForm.password" required placeholder="密码" />
            </div>
            <!-- 显示服务器的登录错误信息 -->
            <div v-if="loginError" class="error-message">{{ loginError }}</div>
            <button type="submit" class="submit-btn" :disabled="userStore.loading">
              {{ userStore.loading ? '登录中...' : '登录' }}
            </button>
          </form>
          <div class="mobile-login-options">
            <a href="#" class="mobile-option-link1">没有账号?</a>
            <a href="#" class="mobile-option-reg" @click.prevent="switchToRegister">立即注册</a>
          </div>
        </div>
      </div>
    </div>

    <!-- PC版注册弹窗 -->
    <div v-if="showRegisterModal" class="login-modal pc-register-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>注册ATSW账号</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleRegister">
            <div class="form-group">
              <label for="reg-email">邮箱</label>
              <input 
                type="email" 
                id="reg-email" 
                v-model="registerForm.email" 
                required 
                placeholder="请输入邮箱" 
              />
            </div>
            <div class="form-group">
              <label for="reg-password">密码</label>
              <input 
                type="password" 
                id="reg-password" 
                v-model="registerForm.password" 
                required 
                placeholder="请输入密码" 
              />
            </div>
            <div class="form-group">
              <label for="reg-name">昵称</label>
              <input 
                type="text" 
                id="reg-name" 
                v-model="registerForm.name" 
                required 
                placeholder="请输入昵称" 
              />
            </div>
            <div class="form-group">
              <label for="reg-qq">QQ号 <span class="optional">(选填)</span></label>
              <input 
                type="text" 
                id="reg-qq" 
                v-model="registerForm.qq" 
                placeholder="请输入QQ号" 
              />
            </div>
            <!-- 显示服务器的登录错误信息 -->
            <div v-if="registerError" class="error-message">{{ registerError }}</div>
            <button type="submit" class="submit-btn register-submit-btn" :disabled="userStore.loading">
              {{ userStore.loading ? '注册中...' : '注册' }}
            </button>
          </form>
          <div class="login-prompt">
            已有账号? <a href="#" class="login-link" @click.prevent="switchToLogin">立即登录</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动版注册弹窗 -->
    <div v-if="showMobileRegisterModal" class="login-modal mobile-register-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>注册ATSW账号</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleRegister">
            <div class="form-group">
              <input 
                type="email" 
                id="reg-email" 
                v-model="registerForm.email" 
                required 
                placeholder="邮箱" 
              />
            </div>
            <div class="form-group">
              <input 
                type="password" 
                id="reg-password" 
                v-model="registerForm.password" 
                required 
                placeholder="密码" 
              />
            </div>
            <div class="form-group">
              <input 
                type="text" 
                id="reg-name" 
                v-model="registerForm.name" 
                required 
                placeholder="昵称" 
              />
            </div>
            <div class="form-group">
              <input 
                type="text" 
                id="reg-qq" 
                v-model="registerForm.qq" 
                placeholder="QQ号 (选填)" 
              />
            </div>
            <!-- 显示服务器的登录错误信息 -->
            <div v-if="registerError" class="error-message">{{ registerError }}</div>
            <button type="submit" class="submit-btn register-submit-btn" :disabled="userStore.loading">
              {{ userStore.loading ? '注册中...' : '注册' }}
            </button>
          </form>
          <div class="mobile-login-options">
            <a href="#" class="mobile-option-link1">已有账号?</a>
            <a href="#" class="mobile-option-link" @click.prevent="switchToLogin">立即登录</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-user-layer-container {
  font-family: 'Microsoft YaHei', sans-serif;
  max-width: 27vw;
}

/* 通用样式 */
.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-image: url('/public/default_avatar_1.jpg');
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  cursor: pointer;
}

.user-name {
  font-weight: bold;
  margin-left: 8px;
  color: #444;
  max-width: calc(27vw - 34px - 8px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-text{
  font-weight: bold;
  margin-left: 8px;
  color: #444;
  max-width: calc(27vw - 34px - 8px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 设计A样式 */
.design-a .user-card {
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 15px;
  z-index: 1000;
  min-width: 200px;
}

.design-a .user-info {
  display: flex;
  align-items: center;
  position: relative;
}

.design-a .user-details {
  margin-left: 10px;
}

.design-a .user-name {
  font-size: 16px;
  margin-bottom: 5px;
}

.design-a .user-email {
  font-size: 12px;
  color: #666;
}

.design-a .user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 10px;
  padding: 5px 0;
  min-width: 120px;
}

.design-a .dropdown-item {
  padding: 8px 15px;
  cursor: pointer;
}

.design-a .dropdown-item:hover {
  background: #f5f5f5;
}

.design-a .login-prompt {
  text-align: center;
}

.design-a .login-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 5px;
  cursor: pointer;
}

/* 设计B样式 */
.design-b .user-compact {
  display: inline-flex;
  align-items: center;
  position: relative;
}

.design-b .user-info-hoverable {
  display: flex;
  align-items: center;
  position: relative;
}

.design-b .user-tooltip {
  position: absolute;
  top: 100%;
  right: -2px;
  background: white;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 10px;
  margin-top: 10px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
  z-index: 100;
  min-width: 150px;
}

.design-b .user-info-hoverable:hover .user-tooltip {
  opacity: 1;
  visibility: visible;
}

.design-b .logout-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 5px;
}

.design-b .login-compact {
  display: flex;
  align-items: center;
  cursor: pointer;
}

/* 设计C样式 */
.design-c .user-fixed {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.design-c .user-info-fixed {
  display: flex;
  align-items: center;
  position: relative;
}

.design-c .user-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 10px;
  margin-top: 10px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
  z-index: 100;
  min-width: 150px;
}

.design-c .user-info-fixed:hover .user-tooltip {
  opacity: 1;
  visibility: visible;
}

.design-c .login-fixed {
  display: flex;
  align-items: center;
  cursor: pointer;
}

/* 设计D和E样式 */
.design-d .user-avatar-only,
.design-e .user-avatar-fixed {
  display: inline-block;
}

.design-e .user-avatar-fixed {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

/* 设计F样式 - 移动端 */
.design-f .user-mobile {
  position: relative;
}

.design-f .user-mobile-logged {
  display: flex;
  flex-direction: column;
}

.design-f .mobile-user-header {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.design-f .mobile-user-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 10px 0;
  margin-top: 5px;
  min-width: 150px;
  z-index: 100;
}

.design-f .menu-item {
  padding: 8px 15px;
  cursor: pointer;
}

.design-f .menu-item:hover {
  background: #f5f5f5;
}

.design-f .user-mobile-anonymous {
  display: flex;
  align-items: center;
  cursor: pointer;
}

/* 登录弹窗通用样式 */
.login-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 14px 12px;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
  font-size: 16px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.forgot-password {
  color: #4CAF50;
  text-decoration: none;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #58c81c 0%, #58bd5b 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(154, 154, 154, 0.3);
  border: none;
  padding: 12px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  margin-bottom: 15px;
  transition:0.3s;
  transform: scale(1);
}
.submit-btn:hover {
  transition:0.3s;
  background: linear-gradient(135deg, #58c81c 0%, #58bd5b 100%);
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(102, 234, 144, 0.3);
}

.login-divider {
  text-align: center;
  margin: 15px 0;
  position: relative;
}

.login-divider:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #eee;
}

.login-divider span {
  background: white;
  padding: 0 10px;
  color: #999;
}

.register-prompt {
  text-align: center;
  color: #666;
}

.register-link {
  color: #9560c6;
  text-decoration: none;
}
.register-link:hover {
  text-decoration: underline;
}

/* 移动端登录弹窗特定样式 */
.mobile-login-options {
  display: flex;
  justify-content: space-between;
  margin: 15px 0;
}

.mobile-option-reg{
  color: #9560c6;
  text-decoration: none;
}
.mobile-option-link {
  color: #58bd5b;
  text-decoration: none;
}

.mobile-option-link1 {
  color: #666;
  text-decoration: none;
}

/* 主题样式 */
.theme-dark .user-card,
.theme-dark .user-tooltip,
.theme-dark .user-dropdown,
.theme-dark .mobile-user-menu,
.theme-dark .modal-content {
  background: #333;
  color: white;
}

.theme-dark .form-group input {
  background: #444;
  color: white;
  border-color: #555;
  font-size: 16px;
  padding: 14px 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .design-a .user-card {
    top: 10px;
    right: 10px;
    padding: 10px;
    min-width: 150px;
  }
  
  .design-c .user-fixed {
    top: 10px;
    right: 10px;
  }
  
  .design-e .user-avatar-fixed {
    top: 10px;
    right: 10px;
  }
}

/* 注册页面 */

.pc-register-modal .modal-content,
.mobile-register-modal .modal-content {
  max-width: 400px;
}

.register-submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #9560c6 100%);
  margin-top: 10px;
}

.register-submit-btn:hover {
  background: linear-gradient(135deg, #667eea 0%, #9560c6 100%);
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.optional {
  color: #999;
  font-size: 12px;
  font-weight: normal;
}

.login-prompt {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.login-link {
  color: #58bd5b;
  text-decoration: none;
  font-weight: 500;
}

.login-link:hover {
  text-decoration: underline;
}

/* 移动端注册表单优化 */
.mobile-register-modal .form-group {
  margin-bottom: 16px;
}

.mobile-register-modal .form-group input {
  padding: 14px 12px;
  font-size: 16px; /* 防止iOS缩放 */
}

/* 响应式调整 */
@media (max-width: 480px) {
  .pc-register-modal .modal-content,
  .mobile-register-modal .modal-content {
    width: 95%;
    margin: 20px auto;
  }
}

/* 暗色主题支持 */
.theme-dark .optional {
  color: #bbb;
}

.theme-dark .login-prompt {
  color: #ccc;
}

/* 注册和登录的服务器消息 */
.error-message {
  color: #f44336;
  background: #ffebee;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 15px;
  font-size: 14px;
  text-align: center;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}
</style>