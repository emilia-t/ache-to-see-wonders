<script setup lang="ts">
// The relative position of this file: src/components/PartCC1Check.vue
import { ref, computed, watch, onMounted } from 'vue'
import { useUserStore } from '@/stores/store';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();
const showLoginPrompt = ref(false);
const isLoggedIn = computed(()=>userStore.isLoggedIn);
const handleLogin=()=>router.push('/home');
const handleCancel=()=>window.close();
watch(isLoggedIn,(newVal)=>showLoginPrompt.value=!newVal);
onMounted(()=>setTimeout(()=>showLoginPrompt.value=!isLoggedIn.value,1500));

</script>

<template>
  <div 
    class="part-cc1-check-container"
    v-if="showLoginPrompt"
  >
    <div class="login-prompt">
      <div class="prompt-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 15.5C14.2091 15.5 16 13.7091 16 11.5C16 9.29086 14.2091 7.5 12 7.5C9.79086 7.5 8 9.29086 8 11.5C8 13.7091 9.79086 15.5 12 15.5Z" stroke="currentColor" stroke-width="2"/>
          <path d="M4 6C2.89543 6 2 6.89543 2 8V16C2 17.1046 2.89543 18 4 18H20C21.1046 18 22 17.1046 22 16V8C22 6.89543 21.1046 6 20 6H4Z" stroke="currentColor" stroke-width="2"/>
          <path d="M19 10H19.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="prompt-title">需要登录</h2>
      <p class="prompt-message">您需要登录后才能访问此页面内容</p>
      <div class="prompt-actions">
        <button class="btn btn-secondary" @click="handleCancel">取消</button>
        <button class="btn btn-primary" @click="handleLogin">
          回到主页
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.part-cc1-check-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.8s ease-out, visibility 0.8s ease-out;
}

.login-prompt {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2.5rem;
  max-width: 400px;
  width: 90%;
  text-align: center;
  color: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: fadeIn 0.5s ease-out;
}

.prompt-icon {
  margin-bottom: 1.5rem;
  color: #4fc3f7;
}

.prompt-title {
  font-size: 1.5rem;
  margin-bottom: 1.08rem;
  font-weight: 600;
}

.prompt-message {
  margin-bottom: 2rem;
  line-height: 1.5;
  font-size: 1.08rem;
  opacity: 0.9;
}

.prompt-actions {
  display: flex;
  gap: 1.08rem;
  justify-content: center;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 1.08rem;
}

.btn-primary {
  background: #4fc3f7;
  color: #0d2b3e;
}

.btn-primary:hover {
  background: #29b6f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-prompt {
    padding: 2rem 1.5rem;
  }
  
  .prompt-actions {
    flex-direction: column;
  }
}
</style>