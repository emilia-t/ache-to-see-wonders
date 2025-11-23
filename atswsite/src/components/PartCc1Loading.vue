<script setup lang="ts">
// The relative position of this file: src/components/PartCC1Loading.vue
// CC1
import { ref, computed, watch } from 'vue'

// 定义props接收加载状态
interface LoadingState {
  isLoading: boolean;
  progress: number; // 0-100
  statusText: string;
  loadedResources: number;
  totalResources: number;
}

const props = defineProps<{
  loadingState: LoadingState;
}>();

// 本地状态
const isVisible = ref(true);
const isFadingOut = ref(false);

// 计算属性
const progressPercentage = computed(() => {
  return Math.min(100, Math.max(0, props.loadingState.progress));
});

const progressBarStyle = computed(() => {
  return {
    width: `${progressPercentage.value}%`
  };
});

const resourceText = computed(() => {
  return `${props.loadingState.loadedResources}/${props.loadingState.totalResources}`;
});

// 监听加载完成状态
const emit = defineEmits<{
  loadingComplete: [];
}>();

watch(() => props.loadingState.isLoading, (newVal) => {
  if (!newVal && isVisible.value) {
    // 加载完成，开始渐隐
    isFadingOut.value = true;
    setTimeout(() => {
      isVisible.value = false;
      emit('loadingComplete');
    }, 800); // 与CSS过渡时间匹配
  }
});

const emptyComputed = computed(() =>{
        return;
    }
)
</script>

<template>
  <div 
    v-if="isVisible" 
    class="part-cc1-loading"
    :class="{ 'fade-out': isFadingOut }"
  >
    <div class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
        <h2 class="loading-title">正在加载资源中请稍后</h2>
        <p class="loading-text">{{ loadingState.statusText }}</p>
        
        <!-- 进度条 -->
        <div class="progress-container">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="progressBarStyle"
            ></div>
          </div>
          <div class="progress-text">
            <span class="percentage">{{ Math.round(progressPercentage) }}%</span>
            <span class="resources">({{ resourceText }} 资源)</span>
          </div>
        </div>

        <!-- 加载提示 -->
        <div class="loading-tips">
          <p>• 正在初始化3D场景...</p>
          <p>• 加载模型和纹理...</p>
          <p>• 准备交互系统...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.part-cc1-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.8s ease-out, visibility 0.8s ease-out;
}

.part-cc1-loading.fade-out {
  opacity: 0;
  visibility: hidden;
}

.loading-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
}

.loading-content {
  text-align: center;
  color: white;
  max-width: 500px;
  padding: 2rem;
}

.loading-spinner {
  margin-bottom: 2rem;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #4ecca3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-title {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #4ecca3;
  font-weight: 300;
  letter-spacing: 2px;
}

.loading-text {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

/* 进度条样式 */
.progress-container {
  margin: 2rem 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecca3, #2ecc71);
  border-radius: 4px;
  transition: width 0.5s ease-out;
  position: relative;
  overflow: hidden;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  opacity: 0.8;
}

.percentage {
  font-weight: bold;
  color: #4ecca3;
}

.resources {
  font-style: italic;
}

/* 加载提示 */
.loading-tips {
  margin-top: 2rem;
  text-align: left;
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #4ecca3;
}

.loading-tips p {
  margin: 0.5rem 0;
  font-size: 0.9rem;
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .loading-content {
    padding: 1rem;
    max-width: 90%;
  }
  
  .loading-title {
    font-size: 1.5rem;
  }
  
  .loading-text {
    font-size: 1rem;
  }
  
  .spinner {
    width: 50px;
    height: 50px;
  }
}
</style>