<script setup lang="ts">
// The relative position of this file: src/components/ViewHeart.vue
import { ref, computed, onMounted, onUnmounted ,watch} from 'vue'
import { useUserStore } from '@/stores/store';

// 定义组件属性
interface Props {
  label?: string
  initialLiked?: boolean
  autoReset?: boolean
  resetDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Like',
  initialLiked: false,
  autoReset: true,
  resetDelay: 1000
})

// 响应式状态
const isLiked = ref(props.initialLiked)
const showThankYou = ref(false) // 控制感谢提示的显示
const showLoginPrompt = ref(false) // 控制登录提示的显示

// 计算属性
const buttonClasses = computed(() => ({
  'like-button': true,
  'liked': isLiked.value
}))
const userStore = useUserStore();
const isLoggedIn = computed(() => userStore.isLoggedIn);

// 定义点赞事件
const emit = defineEmits<{
  'like-change': [value: boolean]
}>()

// 方法
const handleClick = () => {
  if(isLiked.value){
    return;
  }
  if(isLoggedIn.value == false){
    // 显示登录提示
    showLoginPrompt.value = true;
    
    // 2秒后自动隐藏登录提示
    setTimeout(() => {
      showLoginPrompt.value = false;
    }, 2000);
    return;
  }
  
  // 设置点赞状态
  isLiked.value = true;
  
  // 显示感谢提示
  showThankYou.value = true;
  
  // 2秒后自动隐藏感谢提示
  setTimeout(() => {
    showThankYou.value = false;
  }, 2000);
  
  emit('like-change', isLiked.value)
}

// 暴露方法给父组件（可选）
defineExpose({
  setLiked: (value: boolean) => {
    isLiked.value = value
  },
  getLiked: () => {
    return isLiked.value
  }
})

// 监听 isLiked 变化
// 如果通过其他方式设置 isLiked 为 true，也显示感谢提示
watch(isLiked, (newVal) => {
  if (newVal && isLoggedIn.value) {
    showThankYou.value = true;
    setTimeout(() => {
      showThankYou.value = false;
    }, 2000);
  }
})

// 生命周期
onMounted(() => {

})

onUnmounted(() => {
  
})
</script>

<template>
  <div class="view-heart-container">
    <!-- 登录提示 -->
    <div v-if="showLoginPrompt" class="login-prompt-message">
      请先登录~
    </div>

    <!-- 感谢提示 -->
    <div v-if="showThankYou" class="thank-you-message">
      感谢支持~
    </div>
    
    <a 
      class="like-button" 
      :class="buttonClasses"
      @click="handleClick"
      role="button"
      tabindex="0"
      @keydown.enter="handleClick"
      @keydown.space.prevent="handleClick"
    >
      <span class="like-icon">
        <div class="heart-animation-1"></div>
        <div class="heart-animation-2"></div>
      </span>
      {{ label }}
    </a>
  </div>
</template>

<style scoped>
.view-heart-container {
    position: fixed;
    left: 20px;
    top: 20px;
    z-index: 500;
}

/* 登录提示样式 */
.login-prompt-message {
  position: absolute;
  bottom: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(52, 152, 219, 0.9); /* 蓝色背景 */
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  white-space: nowrap;
  animation: fadeInOut 2s ease-in-out;
  box-shadow: 0 2px 10px rgba(52, 152, 219, 0.3);
}

/* 感谢提示样式 */
.thank-you-message {
  position: absolute;
  bottom: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 110, 111, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  white-space: nowrap;
  animation: fadeInOut 2s ease-in-out;
  box-shadow: 0 2px 10px rgba(255, 110, 111, 0.3);
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  20% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  80% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
}

@media (max-width: 480px) {
    .view-heart-container {
        position: fixed;
        left: 10px;
        top: 10px;
    }
}
.like-button {
  border: 2px solid #c7c7c7;
  border-radius: 40px;
  padding: 0.45rem 0.75rem;
  color: #878787;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  filter: grayscale(100%);
  -webkit-user-select: none;
     -moz-user-select: none;
      -ms-user-select: none;
          user-select: none;
  text-decoration: none;
  background: white;
  cursor: pointer;
  outline: none;
}
.like-button.liked {
  color: #ff6e6f;
  border-color: currentColor;
  filter: grayscale(0);
}
.like-button:hover {
  border-color: currentColor;
}

.like-icon {
  width: 18px;
  height: 16px;
  display: inline-block;
  position: relative;
  margin-right: 0.25em;
  font-size: 1.5rem;
  background: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyMSAxOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAuMTAxIDQuNDE3UzguODk1LjIwNyA1LjExMS4yMDdjLTQuNDY1IDAtMTAuOTY3IDYuODQ2IDUuMDgyIDE3LjU5MkMyNS4yMzcgNy4wMyAxOS42NjUuMjAyIDE1LjUwMS4yMDJjLTQuMTYyIDAtNS40IDQuMjE1LTUuNCA0LjIxNXoiIGZpbGw9IiNGRjZFNkYiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==") no-repeat center;
  background-size: 100%;
  -webkit-animation: heartUnlike 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartUnlike 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}

.liked .like-icon {
  -webkit-animation: heartPulse 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartPulse 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}
.liked .like-icon [class^=heart-animation-] {
  background: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyMSAxOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAuMTAxIDQuNDE3UzguODk1LjIwNyA1LjExMS4yMDdjLTQuNDY1IDAtMTAuOTY3IDYuODQ2IDUuMDgyIDE3LjU5MkMyNS4zMzcgNy4wMyAxOS42NjUuMjAyIDE1LjUwMS4yMDJjLTQuMTYyIDAtNS40IDQuMjE1LTUuNCA0LjIxNXoiIGZpbGw9IiNGRjZFNkYiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==") no-repeat center;
  background-size: 100%;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 14px;
  opacity: 0;
}
.liked .like-icon [class^=heart-animation-]::before, .liked .like-icon [class^=heart-animation-]::after {
  content: "";
  background: inherit;
  background-size: 100%;
  width: inherit;
  height: inherit;
  display: inherit;
  position: relative;
  top: inherit;
  left: inherit;
  opacity: 0;
}
.liked .like-icon .heart-animation-1 {
  -webkit-animation: heartFloatMain-1 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartFloatMain-1 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}
.liked .like-icon .heart-animation-1::before, .liked .like-icon .heart-animation-1::after {
  width: 12px;
  height: 10px;
  visibility: hidden;
}
.liked .like-icon .heart-animation-1::before {
  opacity: 0.6;
  -webkit-animation: heartFloatSub-1 1s 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartFloatSub-1 1s 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}
.liked .like-icon .heart-animation-1::after {
  -webkit-animation: heartFloatSub-2 1s 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartFloatSub-2 1s 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  opacity: 0.75;
}
.liked .like-icon .heart-animation-2 {
  -webkit-animation: heartFloatMain-2 1s 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartFloatMain-2 1s 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}
.liked .like-icon .heart-animation-2::before, .liked .like-icon .heart-animation-2::after {
  width: 10px;
  height: 8px;
  visibility: hidden;
}
.liked .like-icon .heart-animation-2::before {
  -webkit-animation: heartFloatSub-3 1s 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartFloatSub-3 1s 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  opacity: 0.25;
}
.liked .like-icon .heart-animation-2::after {
  -webkit-animation: heartFloatSub-4 1s 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          animation: heartFloatSub-4 1s 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  opacity: 0.4;
}

@-webkit-keyframes heartPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.5);
  }
}

@keyframes heartPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.5);
  }
}
@-webkit-keyframes heartUnlike {
  50% {
    transform: scale(0.75);
  }
}
@keyframes heartUnlike {
  50% {
    transform: scale(0.75);
  }
}
@-webkit-keyframes heartFloatMain-1 {
  0% {
    opacity: 0;
    transform: translate(0) rotate(0);
  }
  50% {
    opacity: 1;
    transform: translate(0, -25px) rotate(-20deg);
  }
}
@keyframes heartFloatMain-1 {
  0% {
    opacity: 0;
    transform: translate(0) rotate(0);
  }
  50% {
    opacity: 1;
    transform: translate(0, -25px) rotate(-20deg);
  }
}
@-webkit-keyframes heartFloatMain-2 {
  0% {
    opacity: 0;
    transform: translate(0) rotate(0) scale(0);
  }
  50% {
    opacity: 0.9;
    transform: translate(-10px, -38px) rotate(25deg) scale(1);
  }
}
@keyframes heartFloatMain-2 {
  0% {
    opacity: 0;
    transform: translate(0) rotate(0) scale(0);
  }
  50% {
    opacity: 0.9;
    transform: translate(-10px, -38px) rotate(25deg) scale(1);
  }
}
@-webkit-keyframes heartFloatSub-1 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(13px, -13px) rotate(30deg);
  }
}
@keyframes heartFloatSub-1 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(13px, -13px) rotate(30deg);
  }
}
@-webkit-keyframes heartFloatSub-2 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(18px, -10px) rotate(55deg);
  }
}
@keyframes heartFloatSub-2 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(18px, -10px) rotate(55deg);
  }
}
@-webkit-keyframes heartFloatSub-3 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(-10px, -10px) rotate(-40deg);
  }
  100% {
    transform: translate(-50px, 0);
  }
}
@keyframes heartFloatSub-3 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(-10px, -10px) rotate(-40deg);
  }
  100% {
    transform: translate(-50px, 0);
  }
}
@-webkit-keyframes heartFloatSub-4 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(2px, -18px) rotate(-25deg);
  }
}
@keyframes heartFloatSub-4 {
  0% {
    visibility: hidden;
    transform: translate(0) rotate(0);
  }
  50% {
    visibility: visible;
    transform: translate(2px, -18px) rotate(-25deg);
  }
}
</style>