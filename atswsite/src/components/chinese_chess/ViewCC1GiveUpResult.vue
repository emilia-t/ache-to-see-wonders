<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1GiveUpResult.vue
import {ref,watch,computed} from 'vue';
import { useUserStore } from '@/stores/store';
// 定义组件属性
interface Props {
    giveUpState: boolean;
    giveUpConveyor: string;
}

const props = withDefaults(defineProps<Props>(), {
  giveUpState:false,
  giveUpConveyor: ''
});

const isVisible = ref(false);
const isMyFail = ref(false);
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

// 定义点击事件
const emit = defineEmits<{
  'click-reset-chess': [value: boolean]
}>();

// 方法
const handleClickResetChess = () => {
  emit('click-reset-chess',props.giveUpState);
  isVisible.value = false;
};

const handleClickHoldOn = () => {
  isVisible.value = false;
};

const handleOk = () => {
  isVisible.value = false;
};

// 暴露给父组件
defineExpose({
  isVisible
});

// 监听
watch(props,(newValue,oldValue)=>{
    if(newValue.giveUpState){
        if(newValue.giveUpConveyor === myCov.value){//投降方
            isVisible.value=true;
            isMyFail.value=true;
        }
        else{//其他人
            isVisible.value=true;
            isMyFail.value=false;
        }
    }
});
</script>

<template>
  <div 
    v-if="isVisible"
    class="modal-overlay"
    @click="isMyFail ? handleClickHoldOn() : handleOk()"
  >
    <div 
      class="give-up-result-dialog"
      @click.stop
    >
      <div class="dialog-header" :class="{ 'fail-header': isMyFail, 'opponent-header': !isMyFail }">
        <h3 class="dialog-title">
          {{ isMyFail ? '投降确认' : '对手投降' }}
        </h3>
      </div>
      
      <div class="dialog-content">
        <div class="result-icon" :class="{ 'fail-icon': isMyFail, 'opponent-icon': !isMyFail }">
          {{ isMyFail ? '😔' : '🎉' }}
        </div>
        
        <div v-if="isMyFail" class="result-message">
          <p class="main-text">您已选择投降</p>
          <p class="sub-text">是否要立即重置棋子？</p>
        </div>
        
        <div v-else class="result-message">
          <p class="main-text">{{ giveUpConveyor.split('&')[0] }} 已投降</p>
          <p class="sub-text">请等待对方重置棋子</p>
        </div>
      </div>
      
      <div class="dialog-actions">
        <template v-if="isMyFail">
          <button 
            class="btn btn-outline"
            @click.stop="handleClickHoldOn"
          >
            稍后再说
          </button>
          <button 
            class="btn btn-primary"
            @click.stop="handleClickResetChess"
          >
            立即重置
          </button>
        </template>
        <template v-else>
          <button 
            class="btn btn-primary"
            @click.stop="handleOk"
          >
            我知道了
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 导入路径根据实际情况编写 */
@import '@/sprite/style/sprite.scss';

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

.give-up-result-dialog {
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
  
  &.fail-header {
    background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  }
  
  &.opponent-header {
    background: linear-gradient(135deg, #4ecdc4, #44a08d);
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
  animation: bounce 0.6s ease;
}

.fail-icon {
  filter: grayscale(0.3);
}

.opponent-icon {
  animation: celebrate 1s ease;
}

.result-message {
  .main-text {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .sub-text {
    margin: 0;
    color: #666;
    font-size: 1.08rem;
    line-height: 1.5;
  }
}

.dialog-actions {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  background: #f8f9fa;
}

.btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }
}

.btn-primary {
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
  color: white;
  
  &:hover {
    background: linear-gradient(135deg, #3dbdb4, #359083);
  }
}

.btn-outline {
  background: white;
  color: #666;
  border: 2px solid #e0e0e0;
  
  &:hover {
    background: #f5f5f5;
    border-color: #ccc;
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

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

@keyframes celebrate {
  0% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.1) rotate(5deg);
  }
  50% {
    transform: scale(1.15) rotate(-5deg);
  }
  75% {
    transform: scale(1.1) rotate(5deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@media (max-width: 480px) {
  .give-up-result-dialog {
    margin: 20px;
    width: calc(100% - 40px);
  }
  
  .dialog-content {
    padding: 24px 20px;
  }
  
  .result-icon {
    font-size: 3rem;
  }
  
  .dialog-actions {
    flex-direction: column;
    gap: 8px;
  }
}
</style>