<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1GiveUpConfirm.vue
import {ref,watch} from 'vue';

// 定义组件属性
interface Props {
    giveUpState: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  giveUpState:false
});

const isVisible = ref(false);

// 定义点击事件
const emit = defineEmits<{
  'confirm-give-up': [value: boolean]
}>();

// 方法
const handleClickYes = () => {
  emit('confirm-give-up', true);
};

const handleClickNo = () => {
  isVisible.value=false;
};
// 暴露给父组件
defineExpose({
  isVisible
});

// 监听
watch(props,(newValue,oldValue)=>{
    if(newValue.giveUpState){
        isVisible.value=false;
    }
});
</script>

<template>
  <div 
    v-if="isVisible"
    class="modal-overlay"
    @click="handleClickNo"
  >
    <div 
      class="give-up-confirm-dialog"
      @click.stop
    >
      <div class="dialog-header">
        <h3 class="dialog-title">确认投降</h3>
      </div>
      
      <div class="dialog-content">
        <div class="warning-icon">⚠️</div>
        <p class="confirm-text">确定要投降吗？此操作不可撤销</p>
      </div>
      
      <div class="dialog-actions">
        <button 
          class="btn btn-secondary"
          @click.stop="handleClickNo"
        >
          再想想
        </button>
        <button 
          class="btn btn-primary"
          @click.stop="handleClickYes"
        >
          确认投降
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 导入路径根据实际情况编写 */
@import '../sprite/style/sprite.scss';

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

.give-up-confirm-dialog {
  background: white;
  border-radius: 12px;
  padding: 0;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
  overflow: hidden;
}

.dialog-header {
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  padding: 20px 24px;
  text-align: center;
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

.warning-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.confirm-text {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  padding: 16px 24px 24px;
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
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  color: white;
  
  &:hover {
    background: linear-gradient(135deg, #ff5252, #e53935);
  }
}

.btn-secondary {
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

@media (max-width: 480px) {
  .give-up-confirm-dialog {
    margin: 20px;
    width: calc(100% - 40px);
  }
  
  .dialog-content {
    padding: 24px 20px;
  }
  
  .dialog-actions {
    flex-direction: column;
    gap: 8px;
  }
}
</style>