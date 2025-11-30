<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1Notifications.vue
import type Notification from '@/interface/Notification';
import { computed } from 'vue';

const props = defineProps<{
  notifications: Notification[];
}>();

/* 计算每条通知的垂直位置 */
const positionedNotifications = computed(() => {
  return props.notifications.map((notification, index) => {
    const top = 100 + index * 70;
    return {
      ...notification,
      position: { top: `${top}px` }
    };
  });
});
</script>

<template>
    <div class="view-cc1-notifications">
        <div class="notification-wrapper" 
             v-for="notification in positionedNotifications" 
             :key="notification.id"
             :style="notification.position">
            <div class="user-line-notification" v-if="notification.content.type === 'left'">
                <div class="notification-icon">👋</div>
                <div class="notification-content">
                    <span class="user-name">{{ notification.content.name }}</span>
                    <span class="notification-text">离开了世界</span>
                </div>
            </div>
            <div class="user-line-notification" v-if="notification.content.type === 'join'">
                <div class="notification-icon">🤗</div>
                <div class="notification-content">
                    <span class="user-name">{{ notification.content.name }}</span>
                    <span class="notification-text">加入了世界</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.view-cc1-notifications{
    position: fixed;
    left: 0;
    top: 0;
    z-index: 9900;
    pointer-events: none;
}

/*** 通知包装器 ***/
.notification-wrapper {
  position: fixed;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
  transition: top 0.3s ease;
}

.user-line-notification {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideInRight 0.3s ease-out;
  pointer-events: auto;
  cursor: pointer;
  max-width: 250px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.user-line-notification:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: translateX(-5px);
}

.notification-icon {
  font-size: 18px;
  margin-right: 10px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: bold;
  font-size: 14px;
  color: #ff6b6b;
  margin-bottom: 2px;
}

.notification-text {
  font-size: 12px;
  color: #ccc;
}

.notification-close {
  font-size: 18px;
  margin-left: 10px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.notification-close:hover {
  opacity: 1;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .notification-wrapper {
    right: 10px;
  }
  
  .user-line-notification {
    max-width: 200px;
    padding: 10px 12px;
  }
  
  .user-name {
    font-size: 13px;
  }
  
  .notification-text {
    font-size: 11px;
  }
}
</style>