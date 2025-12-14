<script setup lang="ts">
// The relative position of this file: src/components/ViewUserLayer.vue
// 此组件用于各个page的登录用户信息展示和登录界面
import { ref, computed, onMounted, onUnmounted } from 'vue';
import Tool from '@/class/Tool';
import { useUserStore } from '@/stores/store';
import { accountApiService, type LoginCredentials, type RegisterData } from '@/services/api';

// ==================== 接口定义 ====================
interface Props {
  loading?: boolean  // 是否显示加载状态
  theme?: string     // 界面显示主题(dark and light)
  design?: string    // 界面的样式类型(具体参考html模板)
};

// ==================== 用户名验证方法 ====================
const validateName = (name: string): boolean => {
  return !name.includes('&');
};

const getValidationMessage = (): string => {
  return '用户名中不能包含 "&" 符号';
};

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  theme: '',
  design: ''
});

// 事件定义
const emit = defineEmits<{
  'click-login': [credentials?: any]
  'click-logout': []
}>();

// ==================== Store 和 状态管理 ====================
const userStore = useUserStore();

// ==================== 响应式数据 ====================
// 设备类型检测
const isMobile = ref(false);
const isTablet = ref(false);

// 弹窗显示状态
const showLoginModal = ref(false);           // PC 登录界面
const showMobileLoginModal = ref(false);     // 移动版 登录界面
const showRegisterModal = ref(false);        // PC 注册界面
const showMobileRegisterModal = ref(false);  // 移动版 注册界面
const showForgetPwdModal = ref(false);       // PC 忘记密码界面
const showMobileForgetPwdModal = ref(false); // 移动版 忘记密码界面
const showChangePwdModal = ref(false);       // PC 修改密码界面
const showMobileChangePwdModal = ref(false); // 移动版 修改密码界面
const showUserDropdown = ref(false);
const showMobileUserMenu = ref(false);

// 表单数据
const loginForm = ref({
  email: '',
  password: ''
});

const registerForm = ref({
  email: '',
  password: '',
  name: '',
  qq: ''
});

const forgetPwdForm = ref({
  email: ''
});

const changePwdForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

// 错误信息
const loginError = ref('');
const registerError = ref('');
const forgetPwdError = ref('');
const forgetPwdSuccess = ref('');
const changePwdError = ref('');
const changePwdSuccess = ref('');

// 密码显示状态
const showLoginPassword = ref(false);
const showRegisterPassword = ref(false);
const showOldPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

// 自动登录状态
const autoLoginInProgress = ref(false);

// ==================== 计算属性 ====================
const isLoggedIn = computed(() => userStore.isLoggedIn);
const userData = computed(() => userStore.userData);

const userHeadImg = computed(() => {
  if (!userData.value) return '';
  // 使用自定义头像
  if ('head_img' in userData.value && userData.value.head_img) {
    if(Tool.isImgURI(userData.value.head_img)){
      return userData.value.head_img;
    }else{
      return Tool.getDefaultHeadImg(userData.value.name, 100);
    }
  }
  return Tool.getDefaultHeadImg(userData.value.name, 100);
});

// ==================== 方法定义 ====================
// 弹窗管理方法
const toggleLogin = () => {
  // 平板设备也可以使用移动端界面
  if (isMobile.value || isTablet.value) {
    showMobileLoginModal.value = !showMobileLoginModal.value;
    showLoginModal.value = false;
  } else {
    showLoginModal.value = !showLoginModal.value;
    showMobileLoginModal.value = false;
  }
  // 清空错误信息
  loginError.value = '';
  // 关闭其他弹窗
  showUserDropdown.value = false;
  showMobileUserMenu.value = false;
};

const toggleRegister = () => {
  if (isMobile.value || isTablet.value) {
    showMobileRegisterModal.value = !showMobileRegisterModal.value;
    showRegisterModal.value = false;
  } else {
    showRegisterModal.value = !showRegisterModal.value;
    showMobileRegisterModal.value = false;
  }
  // 清空错误信息
  registerError.value = '';
};

const toggleForgetPwd = () => {
  if (isMobile.value || isTablet.value) {
    showMobileForgetPwdModal.value = !showMobileForgetPwdModal.value;
    showForgetPwdModal.value = false;
  } else {
    showForgetPwdModal.value = !showForgetPwdModal.value;
    showMobileForgetPwdModal.value = false;
  }
  // 清空消息
  forgetPwdError.value = '';
  forgetPwdSuccess.value = '';
};

const toggleChangePwd = () => {
  if (isMobile.value || isTablet.value) {
    showMobileChangePwdModal.value = !showMobileChangePwdModal.value;
    showChangePwdModal.value = false;
  } else {
    showChangePwdModal.value = !showChangePwdModal.value;
    showMobileChangePwdModal.value = false;
  }
  // 清空消息和表单
  changePwdError.value = '';
  changePwdSuccess.value = '';
  changePwdForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  // 关闭其他弹窗
  showMobileUserMenu.value = false;
};

const toggleUserDropdown = () => {
  showUserDropdown.value = !showUserDropdown.value;
};

const toggleMobileUserMenu = () => {
  showMobileUserMenu.value = !showMobileUserMenu.value;
};

const closeAllModals = () => {
  showLoginModal.value = false;
  showMobileLoginModal.value = false;
  showRegisterModal.value = false;
  showMobileRegisterModal.value = false;
  showForgetPwdModal.value = false;
  showMobileForgetPwdModal.value = false;
  showChangePwdModal.value = false;
  showMobileChangePwdModal.value = false;
  showUserDropdown.value = false;
  showMobileUserMenu.value = false;
  
  // 清空错误信息
  loginError.value = '';
  registerError.value = '';
  forgetPwdError.value = '';
  forgetPwdSuccess.value = '';
  changePwdError.value = '';
  changePwdSuccess.value = '';

  // 清空表单
  loginForm.value = { email: '', password: '' };
  registerForm.value = {
    email: '',
    password: '',
    name: '',
    qq: ''
  };
  forgetPwdForm.value = { email: '' };
  changePwdForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
};

// 弹窗切换方法
const switchToRegister = () => {
  closeAllModals();
  toggleRegister();
};

const switchToLogin = () => {
  closeAllModals();
  toggleLogin();
};

const switchToRestPwd = () => {
  closeAllModals();
  toggleForgetPwd();
};

const switchToChangePwd = () => {
  closeAllModals();
  toggleChangePwd();
};

// 忘记密码处理方法
const handleForgetPassword = async () => {
  forgetPwdError.value = '';
  forgetPwdSuccess.value = '';
  userStore.setLoading(true);

  try {
    // 这里调用重置密码的API
    const response = await accountApiService.resetPwd(forgetPwdForm.value.email);
    
    if (response.success) {
      forgetPwdSuccess.value = response.message;
    } else {
      forgetPwdError.value = response.message || '发送重置邮件失败，请重试';
    }
  } catch (error) {
    forgetPwdError.value = error instanceof Error ? error.message : '发送重置邮件失败，请重试';
  } finally {
    userStore.setLoading(false);
  }
};

// 修改密码处理方法
const handleChangePassword = async () => {
  changePwdError.value = '';
  changePwdSuccess.value = '';
  
  // 验证表单
  if (!changePwdForm.value.oldPassword || !changePwdForm.value.newPassword || !changePwdForm.value.confirmPassword) {
    changePwdError.value = '请填写所有密码字段';
    return;
  }
  
  if (changePwdForm.value.newPassword.length < 8) {
    changePwdError.value = '新密码长度至少8位';
    return;
  }
  
  if (changePwdForm.value.newPassword !== changePwdForm.value.confirmPassword) {
    changePwdError.value = '新密码和确认密码不一致';
    return;
  }
  
  if (changePwdForm.value.oldPassword === changePwdForm.value.newPassword) {
    changePwdError.value = '新密码不能和旧密码相同';
    return;
  }
  
  userStore.setLoading(true);

  try {
    // 获取当前用户的token和ID
    const token = localStorage.getItem('user_token');
    const userId = localStorage.getItem('user_id');
    
    if (!token || !userId) {
      changePwdError.value = '用户未登录或登录已过期';
      userStore.setLoading(false);
      return;
    }
    
    // 调用修改密码API
    const response = await accountApiService.updatePwd(
      userId,
      token,
      changePwdForm.value.oldPassword,
      changePwdForm.value.newPassword
    );
    
    if (response.success) {
      changePwdSuccess.value = '密码修改成功！';
      // 清空表单
      changePwdForm.value = {
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
      // 退出登录
      userStore.logout();
      emit('click-logout');
      // 刷新页面
      setTimeout(()=>{window.alert("登录失效，即将刷新页面。");window.location.reload()},1000);
    } else {
      changePwdError.value = response.message || '密码修改失败，请重试';
    }
  } catch (error) {
    changePwdError.value = error instanceof Error ? error.message : '密码修改失败，请重试';
  } finally {
    userStore.setLoading(false);
  }
};

// 认证相关方法
const handleLogin = async () => {
  loginError.value = '';
  userStore.setLoading(true);

  try {
    const credentials: LoginCredentials = {
      email: loginForm.value.email,
      password: loginForm.value.password
    };
    const response = await accountApiService.login(credentials);
    
    if (response.success) {
      // 保存token和用户ID到localStorage
      localStorage.setItem('user_token', response.user?.token || '');
      localStorage.setItem('user_id', response.user?.id?.toString() || '');
      
      // 更新store
      userStore.setUser(response.user);
      userStore.setToken(response.user?.token || '');
      
      // 关闭登录弹窗
      closeAllModals();
      
      // 清空登录表单
      loginForm.value = { email: '', password: '' };
      
      // 触发事件
      emit('click-login', credentials);
    } else {
      loginError.value = response.message;
    }
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '登录失败，请重试';
  } finally {
    userStore.setLoading(false);
  }
};

const handleRegister = async () => {
  registerError.value = '';
  userStore.setLoading(true);

  // 用户名验证 - 检查是否包含 "&" 符号
  if (!validateName(registerForm.value.name)) {
    registerError.value = getValidationMessage();
    userStore.setLoading(false);
    return;
  }

  try {
    const registerData: RegisterData = {
      email: registerForm.value.email,
      password: registerForm.value.password,
      name: registerForm.value.name,
      qq: registerForm.value.qq || undefined
    };
    const response = await accountApiService.register(registerData);

    if (response.success) {
      // 注册成功，显示成功消息
      alert('注册成功！请查看邮箱激活您的账户。');
      
      // 关闭注册弹窗，切换到登录
      closeAllModals();
      switchToLogin();
      
      // 清空注册表单
      registerForm.value = { email: '', password: '', name: '', qq: '' };
    } else {
      registerError.value = response.message;
    }
  } catch (error) {
    registerError.value = error instanceof Error ? error.message : '注册失败，请重试';
  } finally {
    userStore.setLoading(false);
  }
};

const handleLogout = () => {
  userStore.logout();
  closeAllModals();
  emit('click-logout');
};

// 自动登录检查 - 使用新的tokenLogin方法
const checkAutoLogin = async () => {
  // 从localStorage获取token和user_id
  const token = localStorage.getItem('user_token');
  const userId = localStorage.getItem('user_id');
  
  // 如果已经有token和user_id，尝试自动登录
  if (token && userId && !isLoggedIn.value) {
    autoLoginInProgress.value = true;
    
    try {
      const response = await accountApiService.tokenLogin(userId, token);
      
      if (response.success && response.user) {
        // 自动登录成功，更新用户状态
        userStore.setUser(response.user);
        userStore.setToken(token);
        console.log('自动登录成功');
      } else {
        // 自动登录失败，清除无效的token
        console.log('自动登录失败:', response.message);
        handleAutoLoginFailure();
      }
    } catch (error) {
      console.error('自动登录异常:', error);
      handleAutoLoginFailure();
    } finally {
      autoLoginInProgress.value = false;
    }
  }
};

// 自动登录失败处理
const handleAutoLoginFailure = () => {
  userStore.logout();
};

// 工具方法
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.user-avatar') && 
      !target.closest('.user-dropdown') && 
      !target.closest('.login-modal') && 
      !target.closest('.mobile-user-menu')) {
    closeAllModals();
  }
};

const detectDeviceType = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const screenWidth = window.innerWidth;
  
  // 移动设备特征检测
  const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|windows phone|webos/i.test(userAgent);
  const isTabletDevice = /ipad|tablet|playbook|silk|kindle/i.test(userAgent) || (isMobileDevice && screenWidth >= 768 && screenWidth <= 1024);
  
  isMobile.value = isMobileDevice && !isTabletDevice;
  isTablet.value = isTabletDevice;
};

// 密码显示/隐藏切换方法
const togglePasswordVisibility = (type: 'login' | 'register' | 'old' | 'new' | 'confirm') => {
  switch (type) {
    case 'login':
      showLoginPassword.value = !showLoginPassword.value;
      break;
    case 'register':
      showRegisterPassword.value = !showRegisterPassword.value;
      break;
    case 'old':
      showOldPassword.value = !showOldPassword.value;
      break;
    case 'new':
      showNewPassword.value = !showNewPassword.value;
      break;
    case 'confirm':
      showConfirmPassword.value = !showConfirmPassword.value;
      break;
  }
};

// ==================== 生命周期 ====================
onMounted(() => {
  detectDeviceType();
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', detectDeviceType);
  // 检查自动登录
  checkAutoLogin();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', detectDeviceType);
});

// ==================== 暴露给模板的方法和数据 ====================
defineExpose({
  isLoggedIn,
  userHeadImg,
  handleLogin,
  handleLogout,
  togglePasswordVisibility,
  showLoginPassword,
  showRegisterPassword,
  checkAutoLogin
});
</script>

<template>
  <div class="view-user-layer-container" :class="[`theme-${props.theme}`, `design-${props.design}`]">
    <!-- 自动登录加载指示器 -->
    <div v-if="autoLoginInProgress" class="auto-login-loading">
      自动登录中...
    </div>
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
            <div class="dropdown-item" @click.stop="switchToChangePwd">修改密码</div>
            <div class="dropdown-item" @click.stop="handleLogout">退出登录</div>
          </div>
        </div>
        <div v-else class="login-prompt">
          <button class="login-btn" @click.stop="toggleLogin">登录/注册</button>
        </div>
      </div>
    </div>

    <!-- 样式 B : 非固定悬浮的，跟随父组件的文档流的单一头像+用户名的样式，鼠标悬浮在头像或用户名上会显示账号信息和账号设置(退出登录,修改密码)内容，点击头像或用户名会展开登录弹窗 -->
    <div v-if="props.design == 'B'" class="design-b">
      <div class="user-compact" :class="{ 'logged-in': isLoggedIn }">
        <div v-if="isLoggedIn && userData" class="user-info-hoverable">
          <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
          <span class="user-name">{{ userData.name }}</span>
          <div class="user-tooltip">
            <div class="tooltip-content">
              <p>{{ userData.name }}</p>
              <p>{{ userData.email }}</p>
              <button class="change-pwd-btn" @click.stop="switchToChangePwd">修改密码</button>
              <button class="logout-btn" @click.stop="handleLogout">退出登录</button>
            </div>
          </div>
        </div>
        <div v-else class="login-compact" @click.stop="toggleLogin">
          <div class="avatar-placeholder"></div>
          <span class="login-text">登录</span>
        </div>
      </div>
    </div>

    <!-- 样式 C : 悬浮固定在右上角的单一头像+用户名的样式，鼠标悬浮在头像或用户名上会显示账号信息和账号设置(退出登录,修改密码)内容，点击头像或用户名会展开登录弹窗 -->
    <div v-if="props.design == 'C'" class="design-c">
      <div class="user-fixed" :class="{ 'logged-in': isLoggedIn }">
        <div v-if="isLoggedIn && userData" class="user-info-fixed">
          <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
          <span class="user-name">{{ userData.name }}</span>
          <div class="user-tooltip">
            <div class="tooltip-content">
              <p>{{ userData.name }}</p>
              <p>{{ userData.email }}</p>
              <button class="change-pwd-btn" @click.stop="switchToChangePwd">修改密码</button>
              <button class="logout-btn" @click.stop="handleLogout">退出登录</button>
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

    <!-- 样式 F : 非固定悬浮的，跟随父组件的文档流的仅显示用户头像+用户名的样式，手指点触会显示账号信息和账号设置(退出登录,修改密码)内容，专为移动端定制 -->
    <div v-if="props.design == 'F'" class="design-f">
      <div class="user-mobile" :class="{ 'logged-in': isLoggedIn }">
        <div v-if="isLoggedIn && userData" class="user-mobile-logged">
          <div class="mobile-user-header" @click="toggleMobileUserMenu">
            <img :src="userHeadImg" :alt="userData.name" class="user-avatar" />
            <span class="user-name">{{ userData.name }}</span>
          </div>
          <div v-if="showMobileUserMenu" class="mobile-user-menu">
            <div class="menu-item">{{ userData.email }}</div>
            <div class="menu-item" @click.stop="switchToChangePwd">修改密码</div>
            <div class="menu-item" @click.stop="handleLogout">退出登录</div>
          </div>
        </div>
        <div v-else class="user-mobile-anonymous" @click.stop="toggleLogin">
          <div class="avatar-placeholder"></div>
          <span class="login-text">登录</span>
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
            <div class="form-group password-group">
              <label for="password">密码</label>
              <div class="password-input-container">
                <input 
                  :type="showLoginPassword ? 'text' : 'password'" 
                  id="password" 
                  v-model="loginForm.password" 
                  required 
                  placeholder="请输入密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('login')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showLoginPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            <!-- 显示服务器的登录错误信息 -->
            <div v-if="loginError" class="error-message">{{ loginError }}</div>
            <button type="submit" class="submit-btn" :disabled="userStore.loading">
              {{ userStore.loading ? '登录中...' : '登录' }}
            </button>
          </form>
          <div class="register-prompt">
            <a href="#" class="register-link" @click.prevent.stop="switchToRegister">立即注册</a>
            <a href="#" class="register-link" @click.prevent.stop="switchToRestPwd">忘记密码</a>
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
            <div class="form-group password-group">
              <div class="password-input-container">
                <input 
                  :type="showLoginPassword ? 'text' : 'password'" 
                  id="password" 
                  v-model="loginForm.password" 
                  required 
                  placeholder="密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('login')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showLoginPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            <!-- 显示服务器的登录错误信息 -->
            <div v-if="loginError" class="error-message">{{ loginError }}</div>
            <button type="submit" class="submit-btn" :disabled="userStore.loading">
              {{ userStore.loading ? '登录中...' : '登录' }}
            </button>
          </form>
          <div class="mobile-login-options">
            <a href="#" class="mobile-option-reg" @click.prevent.stop="switchToRegister">注册账号</a>
            <a href="#" class="mobile-option-reg" @click.prevent.stop="switchToRestPwd">忘记密码</a>
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
            <div class="form-group password-group">
              <label for="reg-password">密码</label>
              <div class="password-input-container">
                <input 
                  :type="showRegisterPassword ? 'text' : 'password'" 
                  id="reg-password" 
                  v-model="registerForm.password" 
                  required 
                  placeholder="请输入密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('register')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showRegisterPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label for="reg-name">昵称</label>
              <input 
                type="text" 
                id="reg-name" 
                v-model="registerForm.name" 
                required 
                placeholder="请输入昵称（不能包含&符号）" 
                @input="registerError = validateName(registerForm.name) ? '' : getValidationMessage()"
              />
              <div v-if="registerForm.name && !validateName(registerForm.name)" class="validation-error">
                {{ getValidationMessage() }}
              </div>
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
            <div class="form-group password-group">
              <div class="password-input-container">
                <input 
                  :type="showRegisterPassword ? 'text' : 'password'" 
                  id="reg-password" 
                  v-model="registerForm.password" 
                  required 
                  placeholder="密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('register')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showRegisterPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            <div class="form-group">
              <input 
                type="text" 
                id="reg-name" 
                v-model="registerForm.name" 
                required 
                placeholder="昵称（不能包含&符号）" 
                @input="registerError = validateName(registerForm.name) ? '' : getValidationMessage()"
              />
              <div v-if="registerForm.name && !validateName(registerForm.name)" class="validation-error">
                {{ getValidationMessage() }}
              </div>
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

    <!-- PC版忘记密码弹窗 -->
    <div v-if="showForgetPwdModal" class="login-modal pc-forgetpwd-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>重置密码</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleForgetPassword">
            <div class="form-group">
              <label for="forget-email">邮箱</label>
              <input 
                type="email" 
                id="forget-email" 
                v-model="forgetPwdForm.email" 
                required 
                placeholder="请输入您注册时使用的邮箱" 
              />
            </div>
            
            <!-- 显示错误信息 -->
            <div v-if="forgetPwdError" class="error-message">{{ forgetPwdError }}</div>
            
            <!-- 显示成功信息 -->
            <div v-if="forgetPwdSuccess" class="success-message">
              {{ forgetPwdSuccess }}
            </div>
            
            <button 
              type="submit" 
              class="submit-btn forgetpwd-submit-btn" 
              :disabled="userStore.loading || forgetPwdSuccess!==''"
            >
              {{ userStore.loading ? '发送中...' : '发送重置链接' }}
            </button>
          </form>
          <div class="forgetpwd-prompt">
            <a href="#" class="back-to-login" @click.prevent="switchToLogin">返回登录</a>
            <span class="prompt-divider">|</span>
            <a href="#" class="register-link" @click.prevent="switchToRegister">注册新账号</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动版忘记密码弹窗 -->
    <div v-if="showMobileForgetPwdModal" class="login-modal mobile-forgetpwd-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>重置密码</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleForgetPassword">
            <div class="form-group">
              <input 
                type="email" 
                id="mobile-forget-email" 
                v-model="forgetPwdForm.email" 
                required 
                placeholder="请输入注册邮箱" 
              />
            </div>
            
            <!-- 显示错误信息 -->
            <div v-if="forgetPwdError" class="error-message">{{ forgetPwdError }}</div>
            
            <!-- 显示成功信息 -->
            <div v-if="forgetPwdSuccess" class="success-message">
              {{ forgetPwdSuccess }}
              <p class="success-hint">3秒后自动跳转...</p>
            </div>
            
            <button 
              type="submit" 
              class="submit-btn forgetpwd-submit-btn" 
              :disabled="userStore.loading || forgetPwdSuccess!==''"
            >
              {{ userStore.loading ? '发送中...' : '发送重置链接' }}
            </button>
          </form>
          <div class="mobile-forgetpwd-options">
            <a href="#" class="mobile-option-link" @click.prevent="switchToLogin">返回登录</a>
            <a href="#" class="mobile-option-reg" @click.prevent="switchToRegister">注册账号</a>
          </div>
        </div>
      </div>
    </div>

    <!-- PC版修改密码弹窗 -->
    <div v-if="showChangePwdModal" class="login-modal pc-changepwd-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>修改密码</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleChangePassword">
            <div class="form-group password-group">
              <label for="old-password">原密码</label>
              <div class="password-input-container">
                <input 
                  :type="showOldPassword ? 'text' : 'password'" 
                  id="old-password" 
                  v-model="changePwdForm.oldPassword" 
                  required 
                  placeholder="请输入原密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('old')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showOldPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            
            <div class="form-group password-group">
              <label for="new-password">新密码</label>
              <div class="password-input-container">
                <input 
                  :type="showNewPassword ? 'text' : 'password'" 
                  id="new-password" 
                  v-model="changePwdForm.newPassword" 
                  required 
                  placeholder="请输入新密码（至少8位）" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('new')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showNewPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            
            <div class="form-group password-group">
              <label for="confirm-password">确认新密码</label>
              <div class="password-input-container">
                <input 
                  :type="showConfirmPassword ? 'text' : 'password'" 
                  id="confirm-password" 
                  v-model="changePwdForm.confirmPassword" 
                  required 
                  placeholder="请再次输入新密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('confirm')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showConfirmPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            
            <!-- 显示错误信息 -->
            <div v-if="changePwdError" class="error-message">{{ changePwdError }}</div>
            
            <!-- 显示成功信息 -->
            <div v-if="changePwdSuccess" class="success-message">
              {{ changePwdSuccess }}
            </div>
            
            <button 
              type="submit" 
              class="submit-btn changepwd-submit-btn" 
              :disabled="userStore.loading || changePwdSuccess!==''"
            >
              {{ userStore.loading ? '修改中...' : '确认修改' }}
            </button>
          </form>
          <div class="changepwd-prompt">
            <a href="#" class="back-to-login" @click.prevent="closeAllModals">放弃修改</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动版修改密码弹窗 -->
    <div v-if="showMobileChangePwdModal" class="login-modal mobile-changepwd-modal">
      <div class="modal-overlay" @click.stop="closeAllModals"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>修改密码</h3>
          <button class="close-btn" @click.stop="closeAllModals">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleChangePassword">
            <div class="form-group password-group">
              <div class="password-input-container">
                <input 
                  :type="showOldPassword ? 'text' : 'password'" 
                  id="mobile-old-password" 
                  v-model="changePwdForm.oldPassword" 
                  required 
                  placeholder="原密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('old')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showOldPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            
            <div class="form-group password-group">
              <div class="password-input-container">
                <input 
                  :type="showNewPassword ? 'text' : 'password'" 
                  id="mobile-new-password" 
                  v-model="changePwdForm.newPassword" 
                  required 
                  placeholder="新密码（至少8位）" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('new')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showNewPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            
            <div class="form-group password-group">
              <div class="password-input-container">
                <input 
                  :type="showConfirmPassword ? 'text' : 'password'" 
                  id="mobile-confirm-password" 
                  v-model="changePwdForm.confirmPassword" 
                  required 
                  placeholder="确认新密码" 
                />
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordVisibility('confirm')"
                >
                  <div class="icon-wrapper">
                    <ul class="icon">
                      <li :class="showConfirmPassword ? 'eye_close' : 'eye'"></li>
                    </ul>
                  </div>
                </button>
              </div>
            </div>
            
            <!-- 显示错误信息 -->
            <div v-if="changePwdError" class="error-message">{{ changePwdError }}</div>
            
            <!-- 显示成功信息 -->
            <div v-if="changePwdSuccess" class="success-message">
              {{ changePwdSuccess }}
            </div>
            
            <button 
              type="submit" 
              class="submit-btn changepwd-submit-btn" 
              :disabled="userStore.loading || changePwdSuccess!==''"
            >
              {{ userStore.loading ? '修改中...' : '确认修改' }}
            </button>
          </form>
          <div class="mobile-changepwd-options">
            <a href="#" class="mobile-option-link" @click.prevent="closeAllModals">放弃修改</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 导入路径根据实际情况编写 */
@import '../sprite/style/sprite.scss';
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
  background-image: url('/otherImage/default_avatar_1.jpg');
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

/* 密码输入框样式 */
.password-group {
  position: relative;
}

.password-input-container {
  position: relative;
}

.password-input-container input {
  padding-right: 40px !important;
}

.password-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.password-toggle:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.theme-dark .password-toggle:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.validation-error {
  color: #f44336;
  font-size: 12px;
  margin-top: 5px;
  padding: 5px;
  background: #ffebee;
  border-radius: 3px;
  border-left: 3px solid #f44336;
}

.theme-dark .validation-error {
  background: rgba(244, 67, 54, 0.1);
  color: #ff8a80;
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
  padding: 8px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 8px;
  width: 100%;
  font-size: 14px;
}

.design-b .change-pwd-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 8px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 8px;
  width: 100%;
  font-size: 14px;
}

.design-b .change-pwd-btn:hover {
  background: #1976D2;
}

.design-b .logout-btn:hover {
  background: #d32f2f;
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

.design-c .logout-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 8px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 8px;
  width: 100%;
  font-size: 14px;
}

.design-c .change-pwd-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 8px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 8px;
  width: 100%;
  font-size: 14px;
}

.design-c .change-pwd-btn:hover {
  background: #1976D2;
}

.design-c .logout-btn:hover {
  background: #d32f2f;
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
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

.design-f .menu-item:last-child {
  border-bottom: none;
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
  background: linear-gradient(135deg, #69d131 0%, #58bd5b 100%);
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
  background: linear-gradient(135deg, #69d131 0%, #58bd5b 100%);
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
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
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

.theme-dark .design-f .menu-item {
  border-bottom: 1px solid #444;
}

.theme-dark .design-f .menu-item:hover {
  background: #444;
}

.theme-dark .design-a .dropdown-item:hover,
.theme-dark .design-b .change-pwd-btn:hover,
.theme-dark .design-c .change-pwd-btn:hover,
.theme-dark .design-b .logout-btn:hover,
.theme-dark .design-c .logout-btn:hover {
  background: #555;
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

/* 成功消息样式 */
.success-message {
  color: #4caf50;
  background: #e8f5e9;
  padding: 12px;
  border-radius: 5px;
  margin-bottom: 15px;
  font-size: 14px;
  text-align: center;
  border-left: 3px solid #4caf50;
}

.success-hint {
  font-size: 12px;
  color: #388e3c;
  margin-top: 5px;
  font-style: italic;
}

.theme-dark .success-message {
  background: rgba(76, 175, 80, 0.1);
  color: #81c784;
}

.theme-dark .success-hint {
  color: #a5d6a7;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* 忘记密码弹窗样式 */
.pc-forgetpwd-modal .modal-content,
.mobile-forgetpwd-modal .modal-content {
  max-width: 400px;
}

.forgetpwd-submit-btn {
  background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%);
  margin-top: 10px;
}

.forgetpwd-submit-btn:hover {
  background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%);
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
}

.forgetpwd-prompt {
  text-align: center;
  margin-top: 20px;
  color: #666;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.back-to-login {
  color: #58bd5b;
  text-decoration: none;
  font-weight: 500;
}

.back-to-login:hover {
  text-decoration: underline;
}

.prompt-divider {
  color: #ccc;
}

.mobile-forgetpwd-options {
  display: flex;
  justify-content: space-between;
  margin: 15px 0;
}

/* 修改密码弹窗样式 */
.pc-changepwd-modal .modal-content,
.mobile-changepwd-modal .modal-content {
  max-width: 400px;
}

.changepwd-submit-btn {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  margin-top: 10px;
}

.changepwd-submit-btn:hover {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
}

.changepwd-prompt {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.mobile-changepwd-options {
  display: flex;
  justify-content: center;
  margin: 15px 0;
}

/** sprites icon **/
// .png 图片引用
.icon {
		@include sprites($spritesheet-sprites);
	}
// @2x.png 图片引用
.icon_retina {
	@include retina-sprites($retina_groups);
}
// 自定义图标样式
.icon-wrapper {
    width: 30px;  /* 图标显示的大小 */
    height: 30px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    overflow: hidden; /* 隐藏超出部分 */
}
.icon-wrapper .icon {
    transform: scale(0.3); /* 根据原始图标与显示尺寸的比例调整 */
    /* 例如图标原始尺寸是60x60，想显示为30x30，则缩放0.5 */
}
ul.icon{
  padding-inline-start:0px;
  padding-block-end:0px;
  margin-block-start:0px;
  margin-block-end:0px;
  opacity:0.8; /* 增加透明度 */
}
/*** 自动登录加载样式 ***/
.auto-login-loading{
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0,1);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 9999;
    pointer-events: none;
    opacity: 0.6;
}
</style>