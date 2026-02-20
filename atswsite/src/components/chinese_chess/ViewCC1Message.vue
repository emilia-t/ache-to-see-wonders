<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1Message.vue
import { ref, onMounted, onUnmounted, nextTick, reactive , watch} from 'vue'
import type MessageSimple from '@/interface/MessageSimple';
import Tool from '@/class/Tool';

interface Props {
    messagesSp: MessageSimple[];
    messageCountSp: number;
}

const props = withDefaults(defineProps<Props>(), {
    messagesSp: () => [],
    messageCountSp: 0
});

const unreadCounter = ref(0);

// 定义点击事件
const emit = defineEmits<{
  'click-send-message-sp': [value: string]
}>();

// 聊天窗口状态
const chatVisible = ref(false);
const inputText = ref('');
const showEmojiPicker = ref(false);

// 窗口位置和大小状态
const windowState = reactive({
  x: window.innerWidth - 320 - 20, // 初始位置在右下角，留出20px边距
  y: window.innerHeight - 500 - 20,
  width: 320,
  height: 500,
  minWidth: 280,
  minHeight: 400,
  maxWidth: 600,
  maxHeight: 800
});

// 拖拽状态
const dragState = reactive({
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startWindowX: 0,
  startWindowY: 0
});

// 调整大小状态
const resizeState = reactive({
  isResizing: false,
  resizeDirection: '', // 'nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w' 8 个方向
  resizeStartX: 0,
  resizeStartY: 0,
  startWidth: 0,
  startHeight: 0,
  startWindowX: 0,
  startWindowY: 0
});

// 消息显示区域引用
const messagesContainerRef = ref<HTMLElement>();
const inputRef = ref<HTMLTextAreaElement>();
const emojiPickerRef = ref<HTMLElement>();

// 常用emoji列表
const commonEmojis = ref([
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
  '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
  '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
  '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
  '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
  '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
  '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
  '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
  '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
  '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
]);

// 方法
const handleClickSendMessageSp = () => {
  let text = inputText.value.trim();
  if (text) {
    emit('click-send-message-sp', text);
    inputText.value = '';
    showEmojiPicker.value = false;
    
    // 发送后滚动到底部
    nextTick(() => {
      scrollToBottom();
    });
  }
};

// 添加emoji到输入框
const addEmoji = (emoji: string) => {
  if (inputRef.value) {
    const cursorPosition = inputRef.value.selectionStart;
    const textBefore = inputText.value.substring(0, cursorPosition);
    const textAfter = inputText.value.substring(cursorPosition);
    
    inputText.value = textBefore + emoji + textAfter;
    
    // 移动光标到emoji后面
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus();
        const newPosition = cursorPosition + emoji.length;
        inputRef.value.setSelectionRange(newPosition, newPosition);
      }
    });
  }
};

// 切换emoji选择器
const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value;
  if (showEmojiPicker.value) {
    nextTick(() => {
      // 确保emoji选择器可见
      if (emojiPickerRef.value) {
        emojiPickerRef.value.scrollTop = 0;
      }
    });
  }
};

// 拖拽处理
const startDrag = (e: MouseEvent) => {
  if (resizeState.isResizing) return;
  
  dragState.isDragging = true;
  dragState.dragStartX = e.clientX;
  dragState.dragStartY = e.clientY;
  dragState.startWindowX = windowState.x;
  dragState.startWindowY = windowState.y;
  
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
};

const handleDragMove = (e: MouseEvent) => {
  if (!dragState.isDragging) return;
  
  const deltaX = e.clientX - dragState.dragStartX;
  const deltaY = e.clientY - dragState.dragStartY;
  
  // 计算新位置，限制在窗口范围内
  let newX = dragState.startWindowX + deltaX;
  let newY = dragState.startWindowY + deltaY;
  
  // 边界检查
  newX = Math.max(0, Math.min(newX, window.innerWidth - windowState.width));
  newY = Math.max(0, Math.min(newY, window.innerHeight - windowState.height));
  
  windowState.x = newX;
  windowState.y = newY;
};

const stopDrag = () => {
  if (dragState.isDragging) {
    dragState.isDragging = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', stopDrag);
  }
};

// 调整大小处理
const startResize = (e: MouseEvent, direction: string) => {
  if (dragState.isDragging) return;
  
  resizeState.isResizing = true;
  resizeState.resizeDirection = direction;
  resizeState.resizeStartX = e.clientX;
  resizeState.resizeStartY = e.clientY;
  resizeState.startWidth = windowState.width;
  resizeState.startHeight = windowState.height;
  resizeState.startWindowX = windowState.x;
  resizeState.startWindowY = windowState.y;
  
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
};

const handleResizeMove = (e: MouseEvent) => {
  if (!resizeState.isResizing) return;
  
  const deltaX = e.clientX - resizeState.resizeStartX;
  const deltaY = e.clientY - resizeState.resizeStartY;
  
  let newWidth = resizeState.startWidth;
  let newHeight = resizeState.startHeight;
  let newX = resizeState.startWindowX;
  let newY = resizeState.startWindowY;
  
  // 根据方向调整大小和位置
  if (resizeState.resizeDirection.includes('e')) {
    newWidth = Math.min(
      resizeState.startWidth + deltaX,
      windowState.maxWidth
    );
  }
  if (resizeState.resizeDirection.includes('s')) {
    newHeight = Math.min(
      resizeState.startHeight + deltaY,
      windowState.maxHeight
    );
  }
  if (resizeState.resizeDirection.includes('w')) {
    newWidth = Math.min(
      resizeState.startWidth - deltaX,
      windowState.maxWidth
    );
    if (newWidth >= windowState.minWidth) {
      newX = resizeState.startWindowX + deltaX;
    }
  }
  if (resizeState.resizeDirection.includes('n')) {
    newHeight = Math.min(
      resizeState.startHeight - deltaY,
      windowState.maxHeight
    );
    if (newHeight >= windowState.minHeight) {
      newY = resizeState.startWindowY + deltaY;
    }
  }
  
  // 应用最小值限制
  newWidth = Math.max(windowState.minWidth, newWidth);
  newHeight = Math.max(windowState.minHeight, newHeight);
  
  // 边界检查
  newX = Math.max(0, Math.min(newX, window.innerWidth - newWidth));
  newY = Math.max(0, Math.min(newY, window.innerHeight - newHeight));
  
  windowState.width = newWidth;
  windowState.height = newHeight;
  windowState.x = newX;
  windowState.y = newY;
};

const stopResize = () => {
  if (resizeState.isResizing) {
    resizeState.isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', stopResize);
  }
};

// 输入框自适应高度
const adjustInputHeight = () => {
  if (inputRef.value) {
    inputRef.value.style.height = 'auto';
    inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 120) + 'px';
  }
};

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
  }
};

// 回车发送消息，Ctrl+Enter换行
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
    e.preventDefault();
    handleClickSendMessageSp();
  }
};

// 生成头像（使用缓存）
const getAvatar = (username: string) => {
  return Tool.getDefaultHeadImg(username, 40);
};

// 点击外部关闭emoji选择器
const handleClickOutside = (e: MouseEvent) => {
  if (showEmojiPicker.value && emojiPickerRef.value && !emojiPickerRef.value.contains(e.target as Node)) {
    showEmojiPicker.value = false;
  }
};

// 监听消息变化，自动滚动到底部
watch(() => props.messagesSp.length, () => {
  nextTick(() => {
    scrollToBottom();
    if(chatVisible.value === false){
        unreadCounter.value +=1;
    } 
    else{
        unreadCounter.value = 0;
    }
  });
});

// 监听消息变化，自动滚动到底部
watch(() => chatVisible.value, () => {
  nextTick(() => {
    if(chatVisible.value){
        unreadCounter.value = 0;
    }//打开后清空未读
  });
});


// 监听emoji选择器状态，添加/移除点击外部关闭事件
watch(showEmojiPicker, (newVal) => {
  if (newVal) {
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
  }
});

onMounted(() => {
  // 初始化时滚动到底部
  nextTick(() => {
    scrollToBottom();
  });
  
  // 添加窗口大小变化监听
  window.addEventListener('resize', () => {
    // 确保聊天窗口不会超出屏幕
    windowState.x = Math.max(0, Math.min(windowState.x, window.innerWidth - windowState.width));
    windowState.y = Math.max(0, Math.min(windowState.y, window.innerHeight - windowState.height));
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', () => {});
  document.removeEventListener('mousedown', handleClickOutside);
  stopDrag();
  stopResize();
});
</script>

<template>
  <div
    v-if="chatVisible"
    class="floating-chat-window"
    :style="{
      left: `${windowState.x}px`,
      top: `${windowState.y}px`,
      width: `${windowState.width}px`,
      height: `${windowState.height}px`
    }"
  >
    <!-- 标题栏 -->
    <div class="chat-header" @mousedown="startDrag">
      <div class="header-title">
        <span class="title-icon">💬</span>
        <span class="title-text">聊天</span>
      </div>
      <button class="close-btn" @click="chatVisible = false" title="关闭聊天">×</button>
    </div>
    
    <!-- 消息显示区域 -->
    <div class="messages-container" ref="messagesContainerRef">
      <div
        v-for="message in messagesSp"
        :key="message.id"
        class="message-item"
        :class="{ 'own-message': message.conveyor === 'currentUser' }"
      >
        <div class="avatar-container">
          <img
            :src="getAvatar(message.conveyor)"
            :alt="message.conveyor"
            class="message-avatar"
          />
        </div>
        <div class="message-content">
          <div class="message-sender">{{ message.conveyor }}</div>
          <div class="message-bubble">{{ message.text }}</div>
        </div>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-area">
      <!-- 输入框和按钮 -->
      <div class="input-controls">
        <div class="input-wrapper">
          <textarea
            ref="inputRef"
            v-model="inputText"
            @input="adjustInputHeight"
            @keydown="handleKeyDown"
            placeholder="输入消息... (Enter发送, Shift+Enter换行)"
            class="message-input"
            rows="1"
          ></textarea>
        </div>
        
        <div class="button-group">
          <button
            class="emoji-toggle-btn"
            @click="toggleEmojiPicker"
            :class="{ active: showEmojiPicker }"
            title="表情"
          >
            😀
          </button>
          <button
            class="send-btn"
            @click="handleClickSendMessageSp"
            :disabled="!inputText.trim()"
            title="发送消息"
          >
            发送
          </button>
        </div>
      </div>
    </div>
    
    <!-- Emoji选择器 -->
    <div v-if="showEmojiPicker" class="emoji-picker-container" ref="emojiPickerRef">
      <div class="emoji-picker">
        <div class="emoji-header">
          <span>选择表情</span>
          <button class="emoji-close" @click="showEmojiPicker = false">×</button>
        </div>
        <div class="emoji-grid">
          <button
            v-for="(emoji, index) in commonEmojis"
            :key="index"
            class="emoji-item"
            @click="addEmoji(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- 调整大小的把手 -->
    <div class="resize-handle n" @mousedown="(e) => startResize(e, 'n')"></div>
    <div class="resize-handle e" @mousedown="(e) => startResize(e, 'e')"></div>
    <div class="resize-handle s" @mousedown="(e) => startResize(e, 's')"></div>
    <div class="resize-handle w" @mousedown="(e) => startResize(e, 'w')"></div>
    <div class="resize-handle nw" @mousedown="(e) => startResize(e, 'nw')"></div>
    <div class="resize-handle ne" @mousedown="(e) => startResize(e, 'ne')"></div>
    <div class="resize-handle sw" @mousedown="(e) => startResize(e, 'sw')"></div>
    <div class="resize-handle se" @mousedown="(e) => startResize(e, 'se')"></div>
  </div>
  
  <!-- 聊天窗口显示按钮 -->
  <button
    v-else
    class="chat-toggle-btn"
    @click="chatVisible = true"
    title="打开聊天"
  >
    💬
    <span v-if="unreadCounter > 0" class="notification-badge">{{ unreadCounter }}</span>
  </button>
</template>

<style scoped lang="scss">
.floating-chat-window {
  position: fixed;
  z-index: 1001;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  min-width: 280px;
  min-height: 400px;
  transition: box-shadow 0.3s ease;
  
  &:hover {
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  }
  
  .chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    cursor: move;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 16px;
      
      .title-icon {
        font-size: 18px;
      }
    }
    
    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      
      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }
  
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f8f9fa;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
      
      &:hover {
        background: #a8a8a8;
      }
    }
    
    .message-item {
      display: flex;
      margin-bottom: 16px;
      animation: fadeIn 0.3s ease;
      
      &.own-message {
        flex-direction: row-reverse;
        
        .message-content {
          align-items: flex-end;
          
          .message-bubble {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-bottom-right-radius: 4px;
            border-bottom-left-radius: 12px;
          }
        }
      }
      
      .avatar-container {
        flex-shrink: 0;
        margin: 0 12px;
        
        .message-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
      }
      
      .message-content {
        max-width: 70%;
        display: flex;
        flex-direction: column;
        
        .message-sender {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
          padding: 0 8px;
        }
        
        .message-bubble {
          background: white;
          padding: 10px 14px;
          border-radius: 18px;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          line-height: 1.4;
          word-break: break-word;
          white-space: pre-wrap;
        }
      }
    }
  }
  
  .input-area {
    border-top: 1px solid #e0e0e0;
    background: white;
    padding: 16px;
    flex-shrink: 0;
    position: relative;
    
    .input-controls {
      display: flex;
      gap: 12px;
      
      .input-wrapper {
        flex: 1;
        
        .message-input {
          width: 100%;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          padding: 12px 16px;
          font-size: 14px;
          resize: none;
          min-height: 44px;
          max-height: 120px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          
          &:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          &::placeholder {
            color: #999;
          }
        }
      }
      
      .button-group {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        
        .emoji-toggle-btn {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 20px;
          transition: all 0.2s;
          
          &:hover {
            background: #e9ecef;
          }
          
          &.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
          }
        }
        
        .send-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 0 24px;
          height: 44px;
          border-radius: 22px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
          
          &:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          
          &:active:not(:disabled) {
            transform: translateY(0);
          }
          
          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }
  }
  
  // Emoji选择器容器 - 固定在聊天窗口内
  .emoji-picker-container {
    position: absolute;
    bottom: 110px; // 位于输入区域上方
    left: 16px;
    right: 16px;
    z-index: 1000; // 确保在最上层
    
    .emoji-picker {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      
      .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        font-size: 14px;
        font-weight: 500;
        background: #f8f9fa;
        
        .emoji-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          
          &:hover {
            background: #e9ecef;
            color: #333;
          }
        }
      }
      
      .emoji-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 4px;
        padding: 12px;
        max-height: 200px;
        overflow-y: auto;
        
        &::-webkit-scrollbar {
          width: 4px;
        }
        
        &::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        &::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 2px;
        }
        
        .emoji-item {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          
          &:hover {
            background: #f0f0f0;
            transform: scale(1.1);
          }
          
          &:active {
            transform: scale(0.95);
          }
        }
      }
    }
  }
  
  // 调整大小的把手
  .resize-handle {
    position: absolute;
    z-index: 100;
    
    &.n, &.s {
      left: 4px;
      right: 4px;
      height: 6px;
      cursor: ns-resize;
    }
    
    &.e, &.w {
      top: 4px;
      bottom: 4px;
      width: 6px;
      cursor: ew-resize;
    }
    
    &.nw, &.ne, &.sw, &.se {
      width: 12px;
      height: 12px;
    }
    
    &.n {
      top: 0;
    }
    
    &.e {
      right: 0;
    }
    
    &.s {
      bottom: 0;
    }
    
    &.w {
      left: 0;
    }
    
    &.nw {
      top: 0;
      left: 0;
      cursor: nwse-resize;
    }
    
    &.ne {
      top: 0;
      right: 0;
      cursor: nesw-resize;
    }
    
    &.sw {
      bottom: 0;
      left: 0;
      cursor: nesw-resize;
    }
    
    &.se {
      bottom: 0;
      right: 0;
      cursor: nwse-resize;
    }
  }
}

.chat-toggle-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 24px;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 998;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(102, 126, 234, 0.6);
  }
  
  .notification-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ff4757;
    color: white;
    font-size: 12px;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>