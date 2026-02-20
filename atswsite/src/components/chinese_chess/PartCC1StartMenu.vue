<script setup lang="ts">
// The relative position of this file: src/components/PartCC1StartMenu.vue
// CC1
import { ref, computed } from 'vue';
import ViewFilingLicense from '@/components/ViewFilingLicense.vue';
import { useGameSettingStore } from '@/stores/store';
import type CC1GameSetting from '@/interface/CC1GameSetting';
import type CampData from '@/interface/CampData';

// 使用设置 store
const gameSettingStore = useGameSettingStore();

// 菜单状态
const isVisible = ref(true);
const activeTab = ref('main'); // 'main', 'settings', 'about'

const props = defineProps<{
  campData: CampData;
  selectedCamp: string;
}>();

// 定义事件
const emit = defineEmits<{
  'start-game': [side: 'red' | 'black'];
  'change-setting': [value: any]
}>();

// 暴露给父组件
defineExpose({
  isVisible
});

// 计算属性：判断阵营是否已被选择
const isRedSelected = computed(() => {
  return props.campData.red.id !== 0 && props.campData.red.name !== '';
});

const isBlackSelected = computed(() => {
  return props.campData.black.id !== 0 && props.campData.black.name !== '';
});

// 计算属性：获取阵营选择者信息
const redSelectorInfo = computed(() => {
  return isRedSelected.value ? `已被 ${props.campData.red.name} 选择` : '可选';
});

const blackSelectorInfo = computed(() => {
  return isBlackSelected.value ? `已被 ${props.campData.black.name} 选择` : '可选';
});

// 计算属性：判断当前玩家是否已选择阵营
const currentPlayerId = computed(() => {
  // 这里需要根据你的实际用户系统获取当前玩家ID
  // 假设从 localStorage 获取
  const userId = localStorage.getItem('user_id');
  return userId ? parseInt(userId) : 0;
});

const isCurrentPlayerRed = computed(() => {
  return currentPlayerId.value === props.campData.red.id;
});

const isCurrentPlayerBlack = computed(() => {
  return currentPlayerId.value === props.campData.black.id;
});

const backGame = () => {
    isVisible.value = false;
};

// 开始 - 选择阵营
const startGame = (side: 'red' | 'black') => {
  // 检查阵营是否已被其他玩家选择
  if (side === 'red' && isRedSelected.value && !isCurrentPlayerRed.value) {
    alert(`红方已被 ${props.campData.red.name} 选择，请选择其他阵营或等待`);
    return;
  }
  
  if (side === 'black' && isBlackSelected.value && !isCurrentPlayerBlack.value) {
    alert(`黑方已被 ${props.campData.black.name} 选择，请选择其他阵营或等待`);
    return;
  }
  
  console.log(`选择阵营: ${side}`);
  emit('start-game', side);
  isVisible.value=false;
};

// 显示设置
const showSettings = () => {
  activeTab.value = 'settings';
};

// 显示关于
const showAbout = () => {
  activeTab.value = 'about';
};

// 返回主菜单
const backToMain = () => {
  activeTab.value = 'main';
};

// 退出
const exitGame = () => {
  if (confirm('确定要退出吗？')) {
    window.close();
  }
};

// 处理设置变更
const handleSettingChange = (setting: keyof CC1GameSetting, value: number | string) => {
  // 使用类型断言来确保类型安全
  if (setting === 'graphicsQuality') {
    if (value === 'low' || value === 'medium' || value === 'high') {
      gameSettingStore.updateSetting(setting, value);
    }
  } else {
    // 对于数字类型的设置，确保值是数字
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(numValue as number)) {
      gameSettingStore.updateSetting(setting, numValue as number);
    }
  }
  emit('change-setting',gameSettingStore)
  console.log('设置已更新:', setting, value);
};

// 重置设置为默认值
const resetToDefaultSettings = () => {
  if (confirm('确定要重置所有设置为默认值吗？')) {
    gameSettingStore.resetToDefaultSettings();
    emit('change-setting',gameSettingStore);
    console.log('设置已重置为默认值');
  }
};
</script>

<template>
  <div 
    v-if="isVisible" 
    class="part-cc1-start-menu-container"
    :class="{ 'settings-active': activeTab !== 'main' }"
  >
    <!-- 插槽，允许父组件插入内容 -->
    <slot name="extra-content"></slot>
    
    <!-- 背景遮罩 -->
    <div class="menu-backdrop"></div>
    
    <!-- 主菜单内容 -->
    <div class="menu-content" v-if="activeTab === 'main'">
      <!-- 标题 -->
      <div class="game-title">
        <h1 class="title-main">3D象棋</h1>
        <p class="title-sub">棋逢对手, 将遇良才</p>
      </div>

      <!-- 阵营状态显示 -->
      <div class="camp-status">
        <div class="camp-status-item red-status" :class="{ 'selected': isRedSelected }">
          <span class="status-icon">🔴</span>
          <span class="status-text">
            {{ isRedSelected ? `红方: ${campData.red.name}` : '红方: 等待选择' }}
          </span>
        </div>
        <div class="camp-status-item black-status" :class="{ 'selected': isBlackSelected }">
          <span class="status-icon">⚫</span>
          <span class="status-text">
            {{ isBlackSelected ? `黑方: ${campData.black.name}` : '黑方: 等待选择' }}
          </span>
        </div>
      </div>

      <!-- 菜单按钮组 -->
      <div class="menu-buttons">
        <!-- 阵营选择按钮 -->
        <div class="side-selection">
          <button 
            class="menu-btn red-side" 
            @click="startGame('red')"
            :class="{ 
              'disabled': isRedSelected && !isCurrentPlayerRed,
              'rejoin': isCurrentPlayerRed
            }"
            :disabled="isRedSelected && !isCurrentPlayerRed"
          >
            <span class="btn-icon">🔴</span>
            <span class="btn-text">
              {{ isCurrentPlayerRed ? '已选择红方' : '红方阵营' }}
            </span>
            <span class="btn-status" v-if="isRedSelected">
              {{ redSelectorInfo }}
            </span>
          </button>
          
          <button 
            class="menu-btn black-side" 
            @click="startGame('black')"
            :class="{ 
              'disabled': isBlackSelected && !isCurrentPlayerBlack,
              'rejoin': isCurrentPlayerBlack
            }"
            :disabled="isBlackSelected && !isCurrentPlayerBlack"
          >
            <span class="btn-icon">⚫</span>
            <span class="btn-text">
              {{ isCurrentPlayerBlack ? '已选择黑方' : '黑方阵营' }}
            </span>
            <span class="btn-status" v-if="isBlackSelected">
              {{ blackSelectorInfo }}
            </span>
          </button>
        </div>
        
        <button class="menu-btn secondary" @click="showSettings">
          <span class="btn-icon">⚙️</span>
          设置
        </button>
        
        <button class="menu-btn secondary" @click="showAbout">
          <span class="btn-icon">ℹ️</span>
          关于
        </button>
        
        <button class="menu-btn back" @click="backGame">
          <span class="btn-icon">🔙</span>
          {{ selectedCamp === '' ? "自由观看":"返回"}}
        </button>

        <button class="menu-btn exit" @click="exitGame">
          <span class="btn-icon">🚪</span>
          退出
        </button>
      </div>
    </div>

    <!-- 设置菜单 -->
    <div class="settings-content" v-if="activeTab === 'settings'">
      <div class="settings-header">
        <button class="back-btn" @click="backToMain">
          <span class="back-arrow">←</span>
          返回
        </button>
        <h2>设置</h2>
        <button class="reset-btn" @click="resetToDefaultSettings" title="重置为默认设置">
          🔄 重置
        </button>
      </div>

      <div class="settings-options">
        <!-- 音量设置 -->
        <div class="setting-group">
          <label class="setting-label">
            <span class="label-icon">🔊</span>
            <span class="label-text">音效音量</span>
          </label>
          <div class="slider-container">
            <input 
              type="range" 
              min="0" 
              max="100" 
              :value="gameSettingStore.gameSettings.soundVolume"
              @input="handleSettingChange('soundVolume', ($event.target as HTMLInputElement).value)"
              @change="handleSettingChange('soundVolume', ($event.target as HTMLInputElement).value)"
              class="setting-slider"
            >
            <span class="slider-value">{{ gameSettingStore.gameSettings.soundVolume }}%</span>
          </div>
        </div>

        <!-- 音乐音量 -->
        <div class="setting-group">
          <label class="setting-label">
            <span class="label-icon">🎵</span>
            <span class="label-text">背景音乐</span>
          </label>
          <div class="slider-container">
            <input 
              type="range" 
              min="0" 
              max="100" 
              :value="gameSettingStore.gameSettings.musicVolume"
              @input="handleSettingChange('musicVolume', ($event.target as HTMLInputElement).value)"
              @change="handleSettingChange('musicVolume', ($event.target as HTMLInputElement).value)"
              class="setting-slider"
            >
            <span class="slider-value">{{ gameSettingStore.gameSettings.musicVolume }}%</span>
          </div>
        </div>

        <!-- 鼠标灵敏度 -->
        <div class="setting-group">
          <label class="setting-label">
            <span class="label-icon">🖱️</span>
            <span class="label-text">鼠标灵敏度</span>
          </label>
          <div class="slider-container">
            <input 
              type="range" 
              min="1" 
              max="100" 
              :value="gameSettingStore.gameSettings.mouseSensitivity"
              @input="handleSettingChange('mouseSensitivity', ($event.target as HTMLInputElement).value)"
              @change="handleSettingChange('mouseSensitivity', ($event.target as HTMLInputElement).value)"
              class="setting-slider"
            >
            <span class="slider-value">{{ gameSettingStore.gameSettings.mouseSensitivity }}</span>
          </div>
        </div>

        <!-- 移动灵敏度 -->
        <div class="setting-group">
          <label class="setting-label">
            <span class="label-icon">🏃</span>
            <span class="label-text">移动速度</span>
          </label>
          <div class="slider-container">
            <input 
              type="range" 
              min="1" 
              max="100" 
              :value="gameSettingStore.gameSettings.moveSensitivity"
              @input="handleSettingChange('moveSensitivity', ($event.target as HTMLInputElement).value)"
              @change="handleSettingChange('moveSensitivity', ($event.target as HTMLInputElement).value)"
              class="setting-slider"
            >
            <span class="slider-value">{{ gameSettingStore.gameSettings.moveSensitivity }}</span>
          </div>
        </div>

        <!-- 视野范围 -->
        <div class="setting-group">
          <label class="setting-label">
            <span class="label-icon">👁️</span>
            <span class="label-text">视野范围</span>
          </label>
          <div class="slider-container">
            <input 
              type="range" 
              min="60" 
              max="120" 
              :value="gameSettingStore.gameSettings.fov"
              @input="handleSettingChange('fov', ($event.target as HTMLInputElement).value)"
              @change="handleSettingChange('fov', ($event.target as HTMLInputElement).value)"
              class="setting-slider"
            >
            <span class="slider-value">{{ gameSettingStore.gameSettings.fov }}°</span>
          </div>
        </div>

        <!-- 环境光照亮度 -->
        <div class="setting-group">
          <label class="setting-label">
            <span class="label-icon">💡</span>
            <span class="label-text">环境光亮度</span>
          </label>
          <div class="slider-container">
            <input 
              type="range" 
              min="1" 
              max="100" 
              :value="gameSettingStore.gameSettings.ambientIntensity"
              @input="handleSettingChange('ambientIntensity', ($event.target as HTMLInputElement).value)"
              @change="handleSettingChange('ambientIntensity', ($event.target as HTMLInputElement).value)"
              class="setting-slider"
            >
            <span class="slider-value">{{ gameSettingStore.gameSettings.ambientIntensity }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 关于菜单 -->
    <div class="about-content" v-if="activeTab === 'about'">
      <div class="about-header">
        <button class="back-btn" @click="backToMain">
          <span class="back-arrow">←</span>
          返回
        </button>
        <h2>关于</h2>
      </div>

      <div class="about-info">
        <div class="game-logo">
          <div class="logo-icon">♟️</div>
          <h3>3D象棋</h3>
        </div>

        <div class="info-section">
          <h4>操作指南</h4>
          <ul>
            <li>• WASD/方向键：移动视角</li>
            <li>• 鼠标移动：环顾四周</li>
            <li>• 鼠标点击：拾取/放置棋子</li>
            <li>• 空格键：跳跃</li>
          </ul>
        </div>

        <div class="info-section">
          <h4>版本信息</h4>
          <p>版本: 1.0.2</p>
          <p>Copyright © 2025 Ache to See Wonders. All rights reserved.</p>
        </div>
      </div>
    </div>
  </div>
  
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped>
.part-cc1-start-menu-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  background-color: rgba(255,255,255,0.5);
}

.menu-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backdrop-filter: blur(10px);
}

.menu-content,
.settings-content,
.about-content {
  position: relative;
  border-radius: 20px;
  padding: 3rem;
  max-width: 500px;
  width: 90%;
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 标题样式 */
.game-title {
  text-align: center;
  margin-bottom: 2rem;
}

.title-main {
  font-size: 3.5rem;
  font-weight: bold;
  background: linear-gradient(135deg, #d4af37, #ffd700, #d4af37);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.title-sub {
  font-size: 1.2rem;
  color: #666;
  margin: 0.5rem 0 0 0;
  font-weight: 300;
}

/* 阵营状态显示 */
.camp-status {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.camp-status-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.camp-status-item.selected {
  background: rgba(0, 0, 0, 0.05);
  border-left: 4px solid;
}

.red-status.selected {
  border-left-color: #e74c3c;
}

.black-status.selected {
  border-left-color: #2c3e50;
}

.status-icon {
  font-size: 1.5rem;
}

.status-text {
  font-weight: 600;
  color: #333;
}

/* 菜单按钮样式 */
.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

/* 阵营选择样式 */
.side-selection {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.side-selection .menu-btn {
  flex: 1;
  padding: 1rem 1.5rem;
  flex-direction: column;
  gap: 0.5rem;
}

.menu-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  position: relative;
}

/* 红方按钮样式 */
.menu-btn.red-side {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
  box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
}

.menu-btn.red-side:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(231, 76, 60, 0.6);
}

.menu-btn.red-side.rejoin {
  background: linear-gradient(135deg, #e67e22, #d35400);
}

/* 黑方按钮样式 */
.menu-btn.black-side {
  background: linear-gradient(135deg, #2c3e50, #34495e);
  color: white;
  box-shadow: 0 4px 15px rgba(44, 62, 80, 0.4);
}

.menu-btn.black-side:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(44, 62, 80, 0.6);
}

.menu-btn.black-side.rejoin {
  background: linear-gradient(135deg, #7f8c8d, #95a5a6);
}

/* 禁用状态 */
.menu-btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}

.btn-text {
  font-size: 1rem;
}

.btn-status {
  font-size: 0.8rem;
  opacity: 0.8;
  font-weight: normal;
}

.menu-btn.secondary {
  background: rgba(78, 204, 163, 0.1);
  color: #2ecc71;
  border: 2px solid #4ecca3;
}

.menu-btn.secondary:hover {
  background: rgba(78, 204, 163, 0.2);
  transform: translateY(-1px);
}

.menu-btn.exit {
  background: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
  border: 2px solid #ff6b6b;
}

.menu-btn.exit:hover {
  background: rgba(255, 107, 107, 0.2);
  transform: translateY(-1px);
}

.menu-btn.back {
  background: rgba(255, 107, 107, 0.1);
  color: #249bd6;
  border: 2px solid #2cc1eb;
}

.menu-btn.back:hover {
  background: rgba(40, 139, 226, 0.2);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 1.2rem;
}

/* 设置和关于页面样式 */
.settings-header,
.about-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
}

.settings-header h2,
.about-header h2 {
  margin: 0;
  color: #333;
  font-size: 2rem;
}

.back-btn {
  background: none;
  border: 2px solid #4ecca3;
  color: #4ecca3;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.back-btn:hover {
  background: rgba(78, 204, 163, 0.1);
}

.back-arrow {
  font-size: 1.2rem;
}

.reset-btn {
  background: rgba(255, 152, 0, 0.1);
  border: 2px solid #ff9800;
  color: #ff9800;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.reset-btn:hover {
  background: rgba(255, 152, 0, 0.2);
}

/* 设置选项样式 */
.settings-options {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
}

.label-icon {
  font-size: 1.2rem;
}

.label-text{
  font-size: 1.2rem;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.setting-slider {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #afafaf;
  outline: none;
}

.setting-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #4ecca3;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.setting-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #4ecca3;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.slider-value {
  min-width: 50px;
  text-align: center;
  font-weight: 600;
  color: #4ecca3;
}

/* 关于页面样式 */
.about-info {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.game-logo {
  text-align: center;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(78, 204, 163, 0.1), rgba(46, 204, 113, 0.1));
  border-radius: 12px;
}

.logo-icon {
  font-size: 4rem;
  margin-bottom: 0.5rem;
}

.game-logo h3 {
  margin: 0;
  color: #333;
  font-size: 1.8rem;
}

.info-section h4 {
  color: #4ecca3;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.info-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.info-section li {
  padding: 0.3rem 0;
  color: #666;
}

.info-section p {
  margin: 0.3rem 0;
  color: #666;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .menu-content,
  .settings-content,
  .about-content {
    padding: 2rem 1.5rem;
    margin: 1rem;
  }

  .title-main {
    font-size: 2.5rem;
  }

  .side-selection {
    flex-direction: column;
    gap: 0.8rem;
  }

  .game-features {
    flex-direction: column;
    gap: 1rem;
  }

  .settings-header,
  .about-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .reset-btn {
    align-self: flex-start;
  }
}
</style>