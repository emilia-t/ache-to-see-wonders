<!-- ViewCC1ResponDraw.vue -->
<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1ResponDraw.vue
import { ref, watch, computed } from 'vue'
import { useUserStore } from '@/stores/store';

// 定义组件属性
interface Props {
    requestDrawCounter: number; // 请求和棋的次数
    requestDrawConveyor: string; // 请求和棋的人
    responseDrawCounter: number; // 响应和棋的次数
    responseDrawConveyor: string; // 响应和棋的人
    responseDrawStatus: boolean; // 响应和棋的状态(true表示同意)
}

const props = withDefaults(defineProps<Props>(), {
  requestDrawCounter: 0,
  requestDrawConveyor: '',
  responseDrawCounter: 0,
  responseDrawConveyor: '',
  responseDrawStatus: false
})

const isVisible = ref(false);
const isMyResponse = ref(false);
const isMyRequest = ref(false);
const isAwaitingResponse = ref(false); // 是否正在等待响应
const userStore = useUserStore();

// 计算当前用户身份
const myCov = computed(() => {
  if (userStore.userData !== null) {
    return userStore.userData.name + '&' + userStore.userData.email;
  } else {
    return '';
  }
});

// 计算当前状态
const currentStatus = computed(() => {
  if (props.responseDrawConveyor) {
    return 'response'; // 已有响应结果
  } else if (props.requestDrawConveyor) {
    return 'request'; // 有和棋请求，等待响应
  }
  return 'none';
});

// 事件发射
const emit = defineEmits(['agree-draw', 'reject-draw', 'close']);

// 处理同意和棋
const handleAgree = () => {
  emit('agree-draw');
  isVisible.value = false;
};

// 处理拒绝和棋
const handleReject = () => {
  emit('reject-draw');
  isVisible.value = false;
};

// 处理关闭
const handleClose = () => {
  emit('close');
  isVisible.value = false;
};

// 暴露给父组件
defineExpose({
  isVisible
});

// 监听属性变化
watch(props, (newValue) => {
  isVisible.value = true;
  
  // 判断是否为我的响应
  if (myCov.value === newValue.responseDrawConveyor) {
    isMyResponse.value = true;
  } else {
    isMyResponse.value = false;
  }
  
  // 判断是否为我的请求
  if (myCov.value === newValue.requestDrawConveyor) {
    isMyRequest.value = true;
  } else {
    isMyRequest.value = false;
  }
  
  // 判断是否正在等待响应
  isAwaitingResponse.value = newValue.requestDrawConveyor !== '' && newValue.responseDrawConveyor === '';
});

</script>

<template>
  <div 
    v-if="isVisible"
    class="modal-overlay"
    @click="handleClose"
  >
    <!-- 和棋请求对话框（等待响应） -->
    <div 
      v-if="currentStatus === 'request'"
      class="draw-request-dialog"
      @click.stop
    >
      <div class="dialog-header request-header">
        <h3 class="dialog-title">
          {{ isMyRequest ? '和棋请求已发送' : '和棋请求' }}
        </h3>
      </div>
      
      <div class="dialog-content">
        <div class="result-icon request-icon">
          {{ isMyRequest ? '⏳' : '🤔' }}
        </div>
        
        <div class="result-message">
          <p class="main-text">
            <template v-if="isMyRequest">
              已向对方发送和棋请求
            </template>
            <template v-else>
              {{ requestDrawConveyor.split('&')[0] }} 请求和棋
            </template>
          </p>
          
          <p class="sub-text">
            <template v-if="isMyRequest">
              等待对方响应...
            </template>
            <template v-else>
              您是否同意和棋？
            </template>
          </p>
          
          <div class="request-counter" v-if="requestDrawCounter > 0">
            本局第 {{ requestDrawCounter }} 次和棋请求
          </div>
        </div>
      </div>
      
      <div class="dialog-actions" v-if="!isMyRequest">
        <div class="action-buttons">
          <button 
            class="btn btn-reject"
            @click.stop="handleReject"
          >
            拒绝
          </button>
          <button 
            class="btn btn-agree"
            @click.stop="handleAgree"
          >
            同意
          </button>
        </div>
        <button 
          class="btn btn-close"
          @click.stop="handleClose"
          v-if="isMyRequest"
        >
          取消请求
        </button>
      </div>
    </div>
    
    <!-- 和棋响应结果对话框 -->
    <div 
      v-if="currentStatus === 'response'"
      class="draw-response-dialog"
      @click.stop
    >
      <div class="dialog-header" :class="{ 
        'response-agreed': responseDrawStatus, 
        'response-rejected': !responseDrawStatus 
      }">
        <h3 class="dialog-title">
          {{ responseDrawStatus ? '和棋已同意' : '和棋被拒绝' }}
        </h3>
      </div>
      
      <div class="dialog-content">
        <div class="result-icon" :class="{ 
          'agreed-icon': responseDrawStatus, 
          'rejected-icon': !responseDrawStatus 
        }">
          {{ responseDrawStatus ? '🤝' : '✋' }}
        </div>
        
        <div class="result-message">
          <p class="main-text">
            <template v-if="isMyResponse">
              <span v-if="responseDrawStatus">
                您已同意和棋请求
              </span>
              <span v-else>
                您已拒绝和棋请求
              </span>
            </template>
            <template v-else>
              <span v-if="responseDrawStatus">
                {{ responseDrawConveyor.split('&')[0] }} 已同意和棋
              </span>
              <span v-else>
                {{ responseDrawConveyor.split('&')[0] }} 已拒绝和棋
              </span>
            </template>
          </p>
          
          <p class="sub-text">
            <template v-if="responseDrawStatus">
              和棋成立，游戏结束
            </template>
            <template v-else>
              游戏将继续进行
            </template>
          </p>
          
          <div class="response-counter" v-if="responseDrawCounter > 0">
            本局第 {{ responseDrawCounter }} 次和棋响应
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button 
          class="btn btn-primary"
          @click.stop="handleClose"
          :style="{
            background: responseDrawStatus 
              ? 'linear-gradient(135deg, #4CAF50, #2E7D32)' 
              : 'linear-gradient(135deg, #667eea, #764ba2)'
          }"
        >
          {{ responseDrawStatus ? '确认结果' : '继续游戏' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.draw-request-dialog,
.draw-response-dialog {
  background: white;
  border-radius: 12px;
  padding: 0;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
  overflow: hidden;
}

.dialog-header {
  padding: 20px 24px;
  text-align: center;
  
  &.request-header {
    background: linear-gradient(135deg, #FF9800, #F57C00);
  }
  
  &.response-agreed {
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
  }
  
  &.response-rejected {
    background: linear-gradient(135deg, #f44336, #c62828);
  }
}

.dialog-title {
  margin: 0;
  color: white;
  font-size: 1.25rem;
  font-weight: 600;
}

.dialog-content {
  padding: 32px 24px;
  text-align: center;
}

.result-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  
  &.request-icon {
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  &.agreed-icon {
    animation: scaleIn 0.6s ease-out;
  }
  
  &.rejected-icon {
    animation: shake 0.5s ease;
  }
}

.result-message {
  .main-text {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 1.3rem;
    font-weight: 600;
    line-height: 1.4;
  }
  
  .sub-text {
    margin: 0 0 16px 0;
    color: #666;
    font-size: 1.08rem;
    line-height: 1.5;
  }
}

.request-counter,
.response-counter {
  display: inline-block;
  background: #f8f9fa;
  color: #888;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  border: 1px solid #e9ecef;
}

.dialog-actions {
  padding: 20px 24px;
  background: #f8f9fa;
  text-align: center;
  
  .action-buttons {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
  }
}

.btn {
  padding: 14px 32px;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  color: white;
  flex: 1;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &.btn-agree {
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
    
    &:hover {
      background: linear-gradient(135deg, #43A047, #1B5E20);
    }
  }
  
  &.btn-reject {
    background: linear-gradient(135deg, #f44336, #c62828);
    
    &:hover {
      background: linear-gradient(135deg, #e53935, #b71C1C);
    }
  }
  
  &.btn-close {
    background: linear-gradient(135deg, #757575, #424242);
    
    &:hover {
      background: linear-gradient(135deg, #616161, #212121);
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes scaleIn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  70% {
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-5px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(5px);
  }
}

@media (max-width: 480px) {
  .draw-request-dialog,
  .draw-response-dialog {
    margin: 20px;
    width: calc(100% - 40px);
  }
  
  .dialog-content {
    padding: 24px 20px;
  }
  
  .result-icon {
    font-size: 3rem;
  }
  
  .main-text {
    font-size: 1.2rem !important;
  }
  
  .btn {
    padding: 12px 20px;
    font-size: 1.08rem;
    min-width: 100px;
  }
  
  .dialog-actions .action-buttons {
    flex-direction: column;
    gap: 12px;
  }
}
</style>