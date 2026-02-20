<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1ResetChessResult.vue
import {ref,watch,computed} from 'vue'
import { useUserStore } from '@/stores/store';
// 定义组件属性
interface Props {
    resetChessCount: number;
    resetChessConveyor: string;
}

const props = withDefaults(defineProps<Props>(), {
  resetChessCount: 0,
  resetChessConveyor: ''
})

const isVisible = ref(false);
const isMyRest = ref(false);
const userStore = useUserStore();
const myCov = computed(
    ()=>{
       if(userStore.userData!==null){
          return userStore.userData.name + '&' + userStore.userData.email;
       }else{
          return '';
       }
    }
);

const handleOk = () => {
  isVisible.value = false;
};

// 暴露给父组件
defineExpose({
  isVisible
});

// 监听
watch(props,(newValue,oldValue)=>{
    isVisible.value=true;
    if(myCov.value === newValue.resetChessConveyor){
        isMyRest.value=true;
    }
    else{
        isMyRest.value=false;
    }
});
</script>

<template>
  <div 
    v-if="isVisible"
    class="modal-overlay"
    @click="handleOk"
  >
    <div 
      class="reset-chess-dialog"
      @click.stop
    >
      <div class="dialog-header" :class="{ 'my-reset': isMyRest, 'other-reset': !isMyRest }">
        <h3 class="dialog-title">
          {{ isMyRest ? '重置完成' : '棋盘已重置' }}
        </h3>
      </div>
      
      <div class="dialog-content">
        <div class="result-icon" :class="{ 'my-icon': isMyRest, 'other-icon': !isMyRest }">
          {{ isMyRest ? '♻️' : '🔄' }}
        </div>
        
        <div class="result-message">
          <p class="main-text">
            <template v-if="isMyRest">
              您已重置所有棋子！
            </template>
            <template v-else>
              {{ resetChessConveyor.split('&')[0] }} 已重置所有棋子！
            </template>
          </p>
          
          <p class="sub-text">
            <template v-if="isMyRest">
              棋子已恢复到初始位置，可以开始新游戏了
            </template>
            <template v-else>
              对方已完成重置，您可以继续游戏
            </template>
          </p>
          
          <div class="reset-count" v-if="resetChessCount > 0">
            本次游戏第 {{ resetChessCount }} 次重置
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button 
          class="btn btn-primary"
          @click.stop="handleOk"
        >
          我知道了
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

.reset-chess-dialog {
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
  background: linear-gradient(135deg, #667eea, #764ba2);
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
  animation: rotateIn 0.8s ease-out;
  
  &.my-icon {
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  &.other-icon {
    animation: bounce 0.6s ease;
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

.reset-count {
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
}

.btn {
  padding: 14px 32px;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 140px;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  
  &:hover {
    background: linear-gradient(135deg, #5a6fd8, #6a4190);
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

@keyframes rotateIn {
  from {
    opacity: 0;
    transform: rotate(-180deg) scale(0.5);
  }
  to {
    opacity: 1;
    transform: rotate(0) scale(1);
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

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-8px);
  }
  60% {
    transform: translateY(-4px);
  }
}

@media (max-width: 480px) {
  .reset-chess-dialog {
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
    padding: 12px 24px;
    font-size: 1.08rem;
    min-width: 120px;
  }
}
</style>