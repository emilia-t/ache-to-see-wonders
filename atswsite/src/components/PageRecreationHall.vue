<script setup lang="ts">
// The relative position of this file: src/components/PageRecreationHall.vue
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue';
import SceneManager from '@/class/recreation_hall_3d/SceneManager';

// 导入组件
import ViewFilingLicense from '@/components/ViewFilingLicense.vue';

// ==============================
// 管理类实例
// ==============================
let sceneManager: SceneManager;

// ==============================s
// Dom 引用
// ==============================
const sceneRef = ref<HTMLDivElement>();

// ==============================
// 视频控制相关
// ==============================
const videoControl = reactive({
  isVisible: false,
  isPlaying: false,
  volume: 0.5,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  videoUrl: '/video/default.mp4' // 默认视频路径
});

const videoUrls = [
  { name: '默认演示', url: '/videos/default.mp4' },
  { name: '自然风光', url: '/videos/nature.mp4' },
  { name: '城市夜景', url: '/videos/city_night.mp4' },
  { name: '抽象艺术', url: '/videos/abstract.mp4' }
];

// ==============================
// 生命周期
// ==============================
onMounted(() => {
  if (!sceneRef.value) return;
  
  sceneManager = new SceneManager(
    sceneRef.value,
    (increment, status) => {
      console.log(`加载进度: ${Math.round(increment * 100)}% - ${status}`);
    }
  );
  
  sceneManager.init();
  
  // 添加窗口大小调整监听
  window.addEventListener('resize', handleResize);
  
  // 添加键盘快捷键
  document.addEventListener('keydown', handleKeyDown);
})

onUnmounted(() => {
  if (sceneManager) {
    sceneManager.dispose();
    sceneManager = null as any;
  }
  
  // 移除事件监听
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('keydown', handleKeyDown);
})

// ==============================
// 事件处理函数
// ==============================
const handleResize = () => {
  if (sceneManager) {
    sceneManager.resize();
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  // F2: 切换视频控制面板
  if (e.key === 'F2') {
    videoControl.isVisible = !videoControl.isVisible;
    e.preventDefault();
  }
  
  // 空格键: 播放/暂停视频
  if (e.key === ' ' && !e.ctrlKey && !e.altKey) {
    toggleVideoPlay();
    e.preventDefault();
  }
  
  // M键: 切换静音
  if (e.key === 'm' || e.key === 'M') {
    toggleVideoMute();
    e.preventDefault();
  }
}

// ==============================
// 视频控制方法
// ==============================
const toggleVideoPlay = async () => {
  if (!sceneManager) return;
  
  if (videoControl.isPlaying) {
    sceneManager.pauseScreenVideo();
  } else {
    await sceneManager.playScreenVideo(videoControl.videoUrl);
  }
  
  // 更新状态
  const status = sceneManager.getVideoStatus();
  if (status) {
    videoControl.isPlaying = status.isPlaying;
  }
}

const toggleVideoMute = () => {
  if (!sceneManager) return;
  
  videoControl.isMuted = sceneManager.toggleVideoMute();
}

const changeVideo = async (url: string) => {
  videoControl.videoUrl = url;
  
  if (sceneManager) {
    sceneManager.changeVideoSource(url);
    
    // 如果正在播放，重新播放
    if (videoControl.isPlaying) {
      await sceneManager.playScreenVideo(url);
    }
  }
}
const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target) {
    changeVolume(parseFloat(target.value));
  }
};
const changeVolume = (volume: number) => {
  videoControl.volume = volume;
  
  if (sceneManager) {
    sceneManager.setVideoVolume(volume);
  }
}

// 更新视频状态（可以在动画循环中调用）
const updateVideoStatus = () => {
  if (!sceneManager) return;
  
  const status = sceneManager.getVideoStatus();
  if (status) {
    videoControl.isPlaying = status.isPlaying;
    videoControl.volume = status.volume;
    videoControl.isMuted = status.muted;
    videoControl.currentTime = status.currentTime;
    videoControl.duration = status.duration;
  }
}

// 格式化时间显示
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 手动触发播放（解决浏览器自动播放限制）
const manualPlayVideo = async () => {
  if (!sceneManager) return;
  
  // 先设置音量
  sceneManager.setVideoVolume(videoControl.volume);
  
  // 尝试播放
  try {
    await sceneManager.playScreenVideo(videoControl.videoUrl);
    videoControl.isPlaying = true;
  } catch (error) {
    console.warn('自动播放被阻止，需要用户交互');
    // 可以在这里显示提示，让用户点击播放按钮
  }
}
</script>

<template>
  <div class="page-recreation-hall-container">
    <div ref="sceneRef" class="hall-container"></div>
    <div class="crosshair"></div>
    
    <!-- 视频控制面板 -->
    <div v-if="videoControl.isVisible" class="video-control-panel">
      <div class="panel-header">
        <h3>屏幕视频控制</h3>
        <button class="close-btn" @click="videoControl.isVisible = false">×</button>
      </div>
      
      <div class="video-selector">
        <label>选择视频:</label>
        <select v-model="videoControl.videoUrl" @change="changeVideo(videoControl.videoUrl)">
          <option v-for="video in videoUrls" :key="video.url" :value="video.url">
            {{ video.name }}
          </option>
        </select>
      </div>
      
      <div class="playback-controls">
        <button class="control-btn" @click="toggleVideoPlay">
          {{ videoControl.isPlaying ? '❚❚ 暂停' : '▶ 播放' }}
        </button>
        <button class="control-btn" @click="toggleVideoMute">
          {{ videoControl.isMuted ? '🔇 取消静音' : '🔊 静音' }}
        </button>
        <button class="control-btn" @click="manualPlayVideo">
          ▶ 手动播放
        </button>
      </div>
      
      <div class="volume-control">
        <label>音量:</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.1" 
          v-model="videoControl.volume"
          @input="handleVolumeChange($event)"
        />
        <span>{{ Math.round(videoControl.volume * 100) }}%</span>
      </div>
      
      <div class="time-display" v-if="videoControl.duration > 0">
        <span>{{ formatTime(videoControl.currentTime) }}</span>
        <span>/</span>
        <span>{{ formatTime(videoControl.duration) }}</span>
      </div>
      
      <div class="shortcuts">
        <p>快捷键:</p>
        <ul>
          <li><kbd>F2</kbd> 显示/隐藏控制面板</li>
          <li><kbd>空格</kbd> 播放/暂停</li>
          <li><kbd>M</kbd> 切换静音</li>
        </ul>
      </div>
    </div>
    
    <!-- 简化控制按钮（固定在角落） -->
    <div class="mini-controls">
      <button 
        class="mini-btn" 
        @click="videoControl.isVisible = !videoControl.isVisible"
        :title="videoControl.isVisible ? '隐藏控制面板' : '显示控制面板'"
      >
        🎬
      </button>
      <button 
        class="mini-btn" 
        @click="toggleVideoPlay"
        :title="videoControl.isPlaying ? '暂停视频' : '播放视频'"
      >
        {{ videoControl.isPlaying ? '❚❚' : '▶' }}
      </button>
    </div>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped>
.crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.7);
  pointer-events: none;
  border-radius: 3px;
  z-index: 999;
  box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.5);
}

/* 视频控制面板样式 */
.video-control-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 300px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 20px;
  color: white;
  z-index: 1000;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.video-selector {
  margin-bottom: 20px;
}

.video-selector label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #ccc;
}

.video-selector select {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 14px;
}

.playback-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.control-btn {
  flex: 1;
  padding: 10px;
  background: rgba(59, 130, 246, 0.8);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.control-btn:hover {
  background: rgba(59, 130, 246, 1);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.volume-control label {
  font-size: 14px;
  color: #ccc;
}

.volume-control input[type="range"] {
  flex: 1;
}

.volume-control span {
  min-width: 40px;
  text-align: right;
  font-size: 14px;
}

.time-display {
  display: flex;
  justify-content: center;
  gap: 5px;
  font-family: monospace;
  font-size: 14px;
  margin-bottom: 20px;
  color: #ccc;
}

.shortcuts {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 15px;
}

.shortcuts p {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #ccc;
}

.shortcuts ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shortcuts li {
  font-size: 12px;
  margin-bottom: 5px;
  color: #aaa;
}

.shortcuts kbd {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
}

/* 迷你控制按钮 */
.mini-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 999;
}

.mini-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
  transition: all 0.2s;
}

.mini-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.1);
}

.page-recreation-hall-container:fullscreen,
.page-recreation-hall-container:-webkit-full-screen,
.page-recreation-hall-container:-moz-full-screen {
  cursor: none;
}
</style>