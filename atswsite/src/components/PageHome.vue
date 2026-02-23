<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useConfigStore } from '@/stores/store'
import { CHINESE_CHESS_SERVER_URL } from '@/config/apiConfig'
import type InstructObject from '@/interface/InstructObject'
import ChineseChessInstruct from '@/class/ChineseChessInstruct'
import ViewBottomLicense from '@/components/ViewBottomLicense.vue'
import ViewUserLayer from '@/components/ViewUserLayer.vue'
import ViewBackOld from './ViewBackOld.vue' 

// 响应式数据
const loading = ref(true);
const theme = ref('light');
const design = ref('B');
const isMobile = ref(false);
const isTablet = ref(false);
const videoLoaded = ref(false);
const videoPlayer = ref<HTMLVideoElement | null>(null);
const activeTab = ref('prototype');

// Store 相关
const configStore = useConfigStore();

// 计算属性
const currentTitle = computed(() => configStore.homePageCurrentVideo.title);
const currentDescription = computed(() => configStore.homePageCurrentVideo.description);
const currentCover = computed(() => configStore.homePageCurrentVideo.cover);
const currentVideo = computed(() => configStore.homePageCurrentVideo.video);
const currentTargetUrl = computed(() => configStore.homePageCurrentVideo.targetUrl);
const currentButtonName = computed(() => configStore.homePageCurrentVideo.button_name);
const trialPartBoxList = computed(() => configStore.homePageTrialBox.list);
const logsPartBoxList = computed(() => configStore.homePageLogsBox.list);

watch(trialPartBoxList, (newVlue, oldValue) => {
  if (newVlue.length!==oldValue.length) {
    console.log(newVlue);
    for(let i=0;i<newVlue.length;i++){//只遍历在线多人项目(例如cc1)，获取在线状态等信息
      let key = newVlue[i].key;
      switch (key){
        case "cc1":{
          const ws = new ChineseChessInstruct(CHINESE_CHESS_SERVER_URL);
          ws.onOpen = (ev: Event):void => {
            newVlue[i].online_state=true;
            ws.getStorageJson();// 获取3d象棋的storage.json
          };
          ws.onMessage = (instructObj: InstructObject):void=>{
            const { type, class: class_, conveyor, data } = instructObj;
            if(type !== 'storage_json'){
              return;
            }
            try{
              let storageObj = JSON.parse(data);
              if(typeof storageObj === 'object' && storageObj!==null){
                if(storageObj.hasOwnProperty('visit_count')){
                  let visitCount = storageObj['visit_count'];
                  if(typeof visitCount === 'number'){
                    newVlue[i].visit_count = visitCount;
                  }
                }
                if(storageObj.hasOwnProperty('heart_count')){
                  let heartCount = storageObj['heart_count'];
                  if(typeof heartCount === 'number'){
                    newVlue[i].heart_count = heartCount;
                  }
                }
                if(storageObj.hasOwnProperty('online_count')){
                  let onlineCount = storageObj['online_count'];
                  if(typeof onlineCount === 'number'){
                    newVlue[i].online_count = onlineCount;
                  }
                }
              }
              ws.closeLink();
            }
            catch (e){
              ws.closeLink();
            }
          };
          break;
        }
        default:{
          break;
        }
      }
    }
  }
});

// 视频控制函数
const reloadVideo = () => {
  if (videoPlayer.value) {
    videoLoaded.value = false;
    videoPlayer.value.load();
    videoPlayer.value.play().catch(e => {
      console.log('视频自动播放被阻止:', e);
    });
  }
};

const onVideoLoaded = () => {
  videoLoaded.value = true;
  tryPlayVideo();
  setupSeamlessLoop(); // 添加无缝循环设置
};

const tryPlayVideo = () => {
  if (videoPlayer.value && videoLoaded.value) {
    videoPlayer.value.play().catch(e => {
      console.log('视频播放失败:', e);
    });
  }
};

const setupSeamlessLoop = () => {
  if (!videoPlayer.value) return;
  
  const video = videoPlayer.value;
  
  // 移除默认的 loop 属性，改用 JavaScript 控制
  video.loop = false;
  
  video.addEventListener('timeupdate', () => {
    // 当视频接近结束时（提前 0.1 秒），立即重置到开头并播放
    if (video.currentTime > video.duration - 0.1) {
      video.currentTime = 0;
      video.play().catch(e => {
        console.log('循环播放失败:', e);
      });
    }
  });
  video.addEventListener('ended', () => {
    // 备用方案：如果 timeupdate 没有捕获到，用 ended 事件
    video.currentTime = 0;
    video.play().catch(e => {
      console.log('循环播放失败:', e);
    });
  });
};

// 导航函数
const navigateToVideo = () => {
  if (currentTargetUrl.value && typeof currentTargetUrl.value === 'string') {
    window.open(currentTargetUrl.value, '_blank');
  }
};

const navigateToProject = (url: string) => {
  if (url) {
    window.open(url, '_blank');
  }
};

// 标签页切换
const switchTab = (tab: string) => {
  activeTab.value = tab;
};

// 设备检测
const detectDeviceType = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const screenWidth = window.innerWidth;

  const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|windows phone|webos/i.test(userAgent);
  const isTabletDevice = /ipad|tablet|playbook|silk|kindle/i.test(userAgent) || 
                         (isMobileDevice && screenWidth >= 768 && screenWidth <= 1024);

  isMobile.value = isMobileDevice && !isTabletDevice;
  isTablet.value = isTabletDevice;
};

// 用户交互处理
const handleUserInteraction = () => {
  tryPlayVideo();
  document.removeEventListener('click', handleUserInteraction);
  document.removeEventListener('touchstart', handleUserInteraction);
};

// 监听器
watch(currentVideo, (newVideoUrl, oldVideoUrl) => {
  if (newVideoUrl && newVideoUrl !== oldVideoUrl) {
    reloadVideo();
  }
});

// 生命周期
onMounted(() => {
  detectDeviceType();
  window.addEventListener('resize', detectDeviceType);
  
  document.addEventListener('click', handleUserInteraction);
  document.addEventListener('touchstart', handleUserInteraction);
});

onUnmounted(() => {
  window.removeEventListener('resize', detectDeviceType);
  if (videoPlayer.value) {
    videoPlayer.value.pause();
    videoPlayer.value = null;
  }
});
</script>

<template>
  <div class="page-home-container">
    <!-- 头部 -->
    <div class="page-head">
      <div class="head-content">
        <!-- Logo区域 -->
        <div class="logo-section">
          <img v-if="!isMobile" class="logo" src="/otherImage/atsw.png" alt="ATSW Logo"/>
          <div class="logo-text">
            <span class="logo-text1">ATS<span class="logo-text1-1">W</span></span>
            <span class="logo-text2">Ache to see wonders</span>
          </div>
        </div>
        <!-- 导航链接 -->
        <div class="nav-links">
          <a
            target="_blank"
            href="https://atsw.top"
            class="nav-link active"
          >
            <div class="nav-link-content">
              <div class="icon-wrapper">
                <ul class="icon">
                  <li class="home"></li><!--class = 图标名(图标文件名称)-->
                </ul>
              </div>
              <span>主站</span>
            </div>
          </a>
          <a
            target="_blank"
            href="https://myacghome.com"
            class="nav-link"
          >
            <div class="nav-link-content">
              <div class="icon-wrapper">
                <ul class="icon">
                  <li class="blog"></li>
                </ul>
              </div>
              <span>博客</span>
            </div>
          </a>
          <a
            target="_blank"
            href="https://map.atsw.top"
            class="nav-link"
          >
            <div class="nav-link-content">
              <div class="icon-wrapper">
                <ul class="icon">
                  <li class="map"></li>
                </ul>
              </div>
              <span>地图</span>
            </div>
          </a>
          <a
            target="_blank"
            href="https://git.atsw.top"
            class="nav-link"
          >
            <div class="nav-link-content">
              <div class="icon-wrapper">
                <ul class="icon">
                  <li class="gitea"></li>
                </ul>
              </div>
              <span>gitea</span>
            </div>
          </a>
        </div>

        <!-- 用户信息 -->
        <ViewUserLayer 
          class="user-section"
          :loading="loading" 
          :theme="theme" 
          :design="design"
        />
      </div>
    </div>

    <!-- 大屏展示区 -->
    <div class="showcase-section">
      <!-- 视频和封面容器 -->
      <div class="video-container" :class="{ 'mobile': isMobile, 'tablet': isTablet }">
        <!-- 视频 -->
        <video 
          ref="videoPlayer"
          class="showcase-video"
          :poster="currentCover"
          muted
          
          playsinline
          preload="auto"
          @loadeddata="onVideoLoaded"
          @canplay="tryPlayVideo"
          @play="videoLoaded = true"
        >
          <source :src="currentVideo" type="video/mp4">
          您的浏览器不支持视频播放。
        </video>
        
        <!-- 封面图片 -->
        <div 
          v-show="!videoLoaded" 
          class="cover-image"
          :style="{ backgroundImage: `url(${currentCover})` }"
        ></div>
        
        <!-- 左下角悬浮内容 -->
        <div class="video-overlay-content">
          <h2 class="video-title">{{ currentTitle }}</h2>
          <p class="video-description">{{ currentDescription }}</p>
          <button class="action-button" @click="navigateToVideo">{{ currentButtonName }}</button>
        </div>
        
        <!-- 半透明渐变白色过度背景 -->
        <div class="gradient-overlay"></div>
      </div>
    </div>
    
    <!-- 具体内容 -->
    <div class="app-rct">
      <!-- 切换按钮 -->
      <div class="rct-switch">
        <div class="switch-container">
          <button 
            class="switch-btn" :class="activeTab == 'prototype' ? 'active':''"
            @click="switchTab('prototype')"
          >
            <div class="icon-wrapper">
                <ul class="icon t2">
                  <li class="trial"></li>
                </ul>
            </div>
            <span class="btn-text">试做型</span>
          </button>
          <button 
            class="switch-btn" :class="activeTab == 'module' ? 'active':''"
            @click="switchTab('module')"
          >
            <div class="icon-wrapper">
                <ul class="icon t2">
                  <li class="atom"></li>
                </ul>
            </div>
            <span class="btn-text">模组</span>
          </button>
          <button 
            class="switch-btn" :class="activeTab == 'daily' ? 'active':''"
            @click="switchTab('daily')"
          >
            <div class="icon-wrapper">
                <ul class="icon t2">
                  <li class="daily"></li>
                </ul>
            </div>
            <span class="btn-text">日志</span>
          </button>
        </div>
      </div>
      
      <!-- 内容区域 -->
      <div class="rct-content">
        <!-- 试做型 -->
        <div v-show="activeTab === 'prototype'" class="tab-content">

        <div class="rct-placeholder">
          <!-- 作品卡片盒子 -->
          <div class="cards-container">
            <div 
              v-for="value in trialPartBoxList" 
              :key="value.key" 
              class="crd-box"
              @click="navigateToProject(value.targetUrl)"
            >
              <!-- 卡片玻璃态背景 -->
              <div class="crd-box-glass"></div>
              
              <!-- 卡片内容 -->
              <div class="crd-content">
                <!-- 图片区域 -->
                <div class="crd-image-container">
                  <img 
                    class="crd-box-image" 
                    :src="value.cover" 
                    :alt="value.description"
                    loading="lazy"
                  />
                  <!-- 图片遮罩渐变 -->
                  <div class="image-overlay"></div>
                </div>
                
                <!-- 内容区域 -->
                <div class="crd-info">
                  <h3 class="crd-title">{{ value.title }}</h3>
                  <!-- 统计信息 -->
                  <div class="crd-stats" v-if="value.mode!=='single_person'">
                    <div class="stat-item">
                      <span class="stat-icon">👁️</span>
                      <span class="stat-value">{{ value.visit_count || 0 }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-icon">❤️</span>
                      <span class="stat-value">{{ value.heart_count || 0 }}</span>
                    </div>
                    <div v-if="value.online_state" class="stat-item online">
                      <span class="stat-icon">🟢</span>
                      <span class="stat-value">{{ value.online_count || 0 }}在线</span>
                    </div>
                  </div>
                  <div class="crd-stats" v-if="value.mode==='single_person'">
                    <div>
                      🏃单人项目
                    </div>
                  </div>
                </div>
                
                <!-- 悬停效果 -->
                <div class="crd-hover-effect"></div>
              </div>
            </div>
          </div>
        </div>
        </div>
        <!-- 模组 -->
        <div v-show="activeTab === 'module'" class="tab-content">
          <div class="rct-placeholder">
            <p>敬请期待</p>
          </div>
        </div>
        <!-- 日志 -->
        <div v-show="activeTab === 'daily'" class="tab-content">
          <div class="rct-placeholder">
            <!-- 添加 daily 专用的容器 -->
            <div class="daily-container">
              <div 
                v-for="value in logsPartBoxList"
                :key="value.id"
                class="daily-item"
              >
                <div class="daily-date">{{ value.time }}</div>
                <div class="daily-content">
                  <h4>{{ value.title }}</h4>
                  <p>{{ value.descript }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ViewBottomLicense/>
  <ViewBackOld/>
</template>

<style scoped lang="scss">
/* 导入路径根据实际情况编写 */
@import '@/sprite/style/sprite.scss';
.page-home-container{
  overflow-x: hidden;
}
.page-head {
  width: 100vw;
  height: 70px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 rgba(255, 255, 255, 0.8) inset;
  position: fixed;
  z-index: 999;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
}

.head-content {
  width: 100%;
  max-width: calc(100vw - 200px);
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}



/*** Logo区域样式 ***/
.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.05);
}

.logo-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.logo-text1 {
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 20px;
  font-family: 'Microsoft YaHei', sans-serif;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.5px;
  cursor: default;
}

.logo-text1-1 {
  background: linear-gradient(135deg, rgb(199, 62, 62), rgb(186, 5, 80));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 700;
  cursor: default;
}

.logo-text2 {
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180), rgb(186, 5, 80));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 10px;
  font-weight: 600;
  margin-top: 2px;
  opacity: 0.8;
  cursor: default;
}

/*** 导航链接样式 ***/
.nav-links {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.nav-link {
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-link-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  transition: all 0.3s ease;
  position: relative;
  color: #666;
  font-weight: 500;
  font-size: 18px;
}

.nav-link-content:hover {
  background: rgba(81, 155, 233, 0.08);
  color: rgb(81, 155, 233);
  transform: translateY(-1px);
}

.nav-link.active .nav-link-content {
  background: linear-gradient(135deg, rgba(81, 155, 233, 0.15), rgba(15, 111, 180, 0.1));
  color: rgb(81, 155, 233);
  box-shadow: 0 2px 8px rgba(81, 155, 233, 0.15);
}

/*** 用户区域样式 ***/
.user-section {
  flex-shrink: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .head-content {
    padding: 0 16px;
    gap: 16px;
    max-width: calc(100vw - 50px);
  }

  .logo-text2 {
    display: none;
  }

  .nav-link-content span {
    display: none;
  }

  .nav-link-content {
    padding: 5px;
  }

  .nav-links {
    gap: 2px;
  }
}

@media (max-width: 480px) {
  .page-head {
    height: 60px;
  }

  .head-content {
    padding: 0 12px;
    gap: 0;
    max-width: 100vw;
  }

  .logo {
    width: 32px;
    height: 32px;
  }

  .logo-text1 {
    font-size: 18px;
  }
  
  .nav-links {
    gap: 2px;
  }
}


/*** 大屏展示区样式 ***/
.showcase-section {
  width: 100%;
  max-height: 67vh;
  position: relative;
}

.video-container {
  position: relative;
  width: 100%;
  /* 移除固定高度，改为由内容决定 */
  height: auto;
  overflow: hidden;
  background: #000;
  aspect-ratio: 16/9; /* 保持16:9宽高比 */
}

/* PC端视频样式 - 根据宽高比自适应，但不超过67vh */
.video-container:not(.mobile):not(.tablet) {
  max-height: 67vh;
  height: auto;
}

.video-container:not(.mobile):not(.tablet) .showcase-video,
.video-container:not(.mobile):not(.tablet) .cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 移动端视频样式 - 固定较小高度 */
.video-container.mobile,
.video-container.tablet {
  height: 40vh;
  max-height: 40vh;
  aspect-ratio: unset; /* 移动端不使用固定宽高比 */
}

.video-container.mobile .showcase-video,
.video-container.tablet .showcase-video,
.video-container.mobile .cover-image,
.video-container.tablet .cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.showcase-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: opacity 0.5s ease;
}

/*** 左下角悬浮内容 ***/
.video-overlay-content {
  position: absolute;
  bottom: 80px;
  left: 100px;
  z-index: 10;
  color: white;
  max-width: 500px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.video-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 16px;
  line-height: 1.2;
  background: linear-gradient(135deg, #fff, #26b1ea);
  -webkit-background-clip: text;
  background-clip: text;
  color: rgba(255,255,255,0.5);
}

.video-description {
  font-size: 1.1rem;
  margin-bottom: 24px;
  line-height: 1.5;
  opacity: 0.9;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180));
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(81, 155, 233, 0.3);
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(81, 155, 233, 0.4);
}

/*** 渐变过度背景 ***/
.gradient-overlay {
 position: absolute;
 bottom: -1px; /* 向下延伸1px */
 left: 0;
 width: 100%;
 height: 41%; /* 高度增加1px，因为向下延伸了1px，所以实际高度比原来多1px */
 background: linear-gradient(to top, 
   rgba(255, 255, 255, 1) 0%,
   rgba(255, 255, 255, 1) 10%,
   rgba(255, 255, 255, 0.8) 30%,
   rgba(255, 255, 255, 0.4) 60%,
   rgba(255, 255, 255, 0) 100%);
 pointer-events: none;
 z-index: 5;
 transform: translateZ(0);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .video-overlay-content {
    bottom: 40px;
    left: 20px;
    right: 20px;
    max-width: none;
  }
  
  .video-title {
    font-size: 1.8rem;
  }
  
  .video-description {
    font-size: 1rem;
  }
  
  .action-button {
    padding: 10px 20px;
    font-size: 0.9rem;
  }
  
  .video-container.mobile {
    height: 35vh;
    max-height: 35vh;
  }
}
/* 屏幕宽度小于或等于480px时 */
@media (max-width: 480px) {
  .video-overlay-content {
    bottom: 30px;
    left: 15px;
    right: 15px;
  }
  
  .video-title {
    font-size: 1.4rem;
    margin-bottom: 6px;
    margin-top: 8px;
  }
  
  .video-description {
    font-size: 0.9rem;
    margin-top: 10px;
    margin-bottom: 10px;
  }
  
  .video-container.mobile {
    height: 50vh;
    max-height: 50vh;
  }

  .action-button {
    padding: 8px 14px;
    font-size: 0.9rem;
  }
}

/* 针对不支持 aspect-ratio 的浏览器提供备用方案 */
@supports not (aspect-ratio: 16/9) {
  .video-container:not(.mobile):not(.tablet) {
    height: 0;
    padding-bottom: 56.25%; /* 16:9 比例的padding-bottom */
  }
  
  .video-container:not(.mobile):not(.tablet) .showcase-video,
  .video-container:not(.mobile):not(.tablet) .cover-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}


/*** 具体内容区域 ***/
.app-rct {
  width: 100vw;
  height: auto;
  background: #fff;
  min-height: 400px;
}

/*** 切换按钮区域 ***/
.rct-switch {
  width: 100%;
  height: auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky;
  top: 70px;
  z-index: 100;
  padding: 20px 0;
}

.switch-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  max-width: calc(100vw - 200px);
  margin: 0 auto;
  padding: 0 24px;
}

.switch-btn {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(81, 155, 233, 0.2);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 79px;
  position: relative;
  overflow: hidden;
}

.switch-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(81, 155, 233, 0.05), rgba(15, 111, 180, 0.02));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.switch-btn:hover {
  transform: translateY(-2px);
  border-color: rgba(81, 155, 233, 0.4);
  box-shadow: 0 4px 16px rgba(81, 155, 233, 0.15);
}

.switch-btn:hover::before {
  opacity: 1;
}

.switch-btn.active {
  background: linear-gradient(135deg, rgba(81, 155, 233, 0.1), rgba(15, 111, 180, 0.05));
  border-color: rgba(81, 155, 233, 0.5);
  box-shadow: 0 4px 20px rgba(81, 155, 233, 0.2);
}

.switch-btn.active::before {
  opacity: 1;
}

.btn-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  transition: color 0.3s ease;
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.switch-btn.active .btn-text {
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 700;
}

/*** 内容区域 ***/
.rct-content {
  width: 100%;
  max-width: calc(100vw - 200px);
  margin: 0 auto;
  padding: 0px 0px 40px 0px;
}

.tab-content {
  animation: fadeIn 0.5s ease;
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

.rct-placeholder {
  text-align: center;
  padding: 0px 0px 20px 0px;
  font-size: 1.08rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .switch-container {
    gap: 12px;
    padding: 0 16px;
    max-width: calc(100vw - 50px);
  }
  
  .switch-btn {
    padding: 12px 16px;
    min-width: 80px;
  }

  .btn-text {
    font-size: 0.85rem;
  }
  
  .rct-content {
    padding: 0px 0px 30px 0px;
    max-width: calc(100vw - 50px);
  }
  
  .rct-placeholder {
    padding: 40px 0;
  }
  
  .rct-placeholder h3 {
    font-size: 1.0rem;
  }
}

@media (max-width: 480px) {
  .rct-switch {
    top: 60px;
    padding: 16px 0;
  }
  
  .switch-container {
    gap: 8px;
    padding: 0 12px;
    max-width: 100vw;
  }
  
  .switch-btn {
    padding: 10px 12px;
    min-width: 70px;
    border-radius: 12px;
  }
  
  .btn-text {
    font-size: 0.8rem;
  }
  
  .rct-content {
    padding: 0px 0px 24px 0px;
    max-width: 100vw;
  }
  
  .rct-placeholder {
    padding: 30px 0;
  }
  
  .rct-placeholder h3 {
    font-size: 1rem;
  }
}

/* 针对小屏幕的横向滚动方案 */
@media (max-width: 360px) {
  .switch-container {
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 8px;
  }
  
  .switch-container::-webkit-scrollbar {
    height: 4px;
  }
  
  .switch-container::-webkit-scrollbar-track {
    background: rgba(81, 155, 233, 0.1);
    border-radius: 2px;
  }
  
  .switch-container::-webkit-scrollbar-thumb {
    background: rgba(81, 155, 233, 0.3);
    border-radius: 2px;
  }
}

/*** sprites icon ***/
// .png 图片引用
.icon {
	@include sprites($spritesheet-sprites);
}
// @2x.png 图片引用
.icon_retina {
	@include retina-sprites($retina_groups);
}
// 自定义图标样式
.icon-wrapper {
  width: 30px;  /* 图标显示的大小 */
  height: 30px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 隐藏超出部分 */
}
.icon-wrapper .icon {
  transform: scale(0.3); /* 根据原始图标与显示尺寸的比例调整 */
  /* 例如图标原始尺寸是60x60，想显示为30x30，则缩放0.5 */
}
ul.icon{
  padding-inline-start:0px;
  padding-block-end:0px;
  margin-block-start:0px;
  margin-block-end:0px;
  opacity:0.8; /* 增加透明度 */
}
.icon-wrapper .icon.t2{
  transform: scale(0.4); /* 根据原始图标与显示尺寸的比例调整 */
  /* 例如图标原始尺寸是60x60，想显示为30x30，则缩放0.5 */
}

/*** 试作型box样式 ***/
/* 卡片容器 */
.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
  padding: 20px;
  max-width: calc(100vw - 200px);
  margin: 0 auto;
}

/* 作品卡片盒子 */
.crd-box {
  position: relative;
  background: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 卡片玻璃态背景 */
.crd-box-glass {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.25) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
  pointer-events: none;
  z-index: 1;
}

/* 卡片内容 */
.crd-content {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 图片容器 */
.crd-image-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 5px;
}

.crd-box-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
  box-shadow:  0 4px 20px rgba(0, 0, 0, 1);
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.6) 0%,
    transparent 100%
  );
  pointer-events: none;
}

/* 信息区域 */
.crd-info {
  padding: 5px 1px 15px 1px;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 3;
  color: #444;
}

.crd-title {
  font-size: 1.1rem;
  font-weight: 400;
  margin-bottom: 8px;
  text-align: left;
  background: linear-gradient(135deg, #333, #555);
  -webkit-background-clip: text;
  background-clip: text;
  line-height: 1.3;
  margin-block-start: 0.3em;
  margin-block-end: 0.3em;
}

/* 统计信息 */
.crd-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: #888;
  
  &.online {
    color: #22c55e;
    font-weight: 600;
  }
}

.stat-icon {
  font-size: 0.7rem;
}

.stat-value {
  font-weight: 600;
}

/* 悬停效果 */
.crd-hover-effect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    rgba(81, 155, 233, 0.05) 0%,
    rgba(15, 111, 180, 0.02) 100%
  );
  opacity: 0;
  transform: scale(0.95);
  transition: all 0.4s ease;
  pointer-events: none;
  z-index: 1;
}

/* 响应式设计 - 平板 */
@media (max-width: 1024px) {
  .cards-container {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    padding: 16px 0px;
    max-width: calc(100vw - 100px);
  }
  
  .crd-image-container {
    height: 180px;
  }
  
  .crd-info {
    padding: 5px 1px 12px 1px;
  }
  
  .crd-title {
    font-size: 1.1rem;
  }
}

/* 响应式设计 - 平板小尺寸 */
@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    padding: 16px 0px;
    max-width: calc(100vw - 50px);
  }
  
  .crd-image-container {
    height: 150px;
  }
  
  .crd-info {
    padding: 5px 1px 10px 1px;
  }
  
  .crd-title {
    font-size: 1.0rem;
    margin-bottom: 6px;
  }
  
  .crd-stats {
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .stat-item {
    font-size: 0.75rem;
  }
}

/* 响应式设计 - 手机端 (2列布局) */
@media (max-width: 480px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr); /* 强制2列布局 */
    gap: 12px;
    padding: 12px 0px;
    max-width: calc(100vw - 30px);
  }
  
  .crd-box {
    min-height: 260px; /* 确保卡片有最小高度 */
  }
  
  .crd-image-container {
    height: 140px; /* 减小图片高度以适应2列布局 */
  }
  
  .crd-info {
    padding: 2px 1px 8px 1px;
  }
  
  .crd-title {
    font-size: 0.9rem;
    margin-bottom: 4px;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .crd-stats {
    gap: 6px;
    margin-bottom: 10px;
  }
  
  .stat-item {
    font-size: 0.7rem;
    gap: 2px;
  }
  
  .stat-icon {
    font-size: 0.65rem;
  }
  
  /* 手机端简化悬停效果 */
  .crd-hover-effect {
    display: none; /* 手机端移除复杂的悬停效果 */
  }
}

/* 响应式设计 - 超小屏幕手机 */
@media (max-width: 360px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    padding: 10px;
  }
  
  .crd-image-container {
    height: 100px;
  }
  
  .crd-info {
    padding: 2px 1px 6px 1px;
  }
  
  .crd-title {
    font-size: 0.8rem;
  }
  
  .crd-stats {
    gap: 4px;
    margin-bottom: 8px;
  }
  
  .stat-item {
    font-size: 0.65rem;
  }
}

/* 响应式设计 - 横屏手机优化 */
@media (max-width: 480px) and (orientation: landscape) {
  .cards-container {
    grid-template-columns: repeat(3, 1fr); /* 横屏时显示3列 */
    gap: 10px;
  }
  
  .crd-image-container {
    height: 100px;
  }
  
  .crd-info {
    padding: 2px 1px 6px 1px;
  }
  
  .crd-title {
    font-size: 0.75rem;
  }
}

/* 空状态 */
.cards-container:empty::before {
  content: "暂无项目展示";
  display: block;
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 1.1rem;
  grid-column: 1 / -1;
}

/* 手机端空状态优化 */
@media (max-width: 480px) {
  .cards-container:empty::before {
    padding: 40px 15px;
    font-size: 1rem;
  }
}

/*** 日志样式 ***/
.daily-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.daily-item {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid rgba(81, 155, 233, 0.1);
  position: relative;
  overflow: hidden;
}

.daily-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 4px;
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.daily-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(81, 155, 233, 0.15);
  border-color: rgba(81, 155, 233, 0.3);
}

.daily-item:hover::before {
  opacity: 1;
}

.daily-date {
  flex-shrink: 0;
  width: 120px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180));
  color: white;
  border-radius: 8px;
  text-align: center;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(81, 155, 233, 0.3);
}

.daily-content {
  flex: 1;
}

.daily-content h4 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  background: linear-gradient(135deg, #333, #555);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.daily-content p {
  margin: 0;
  color: #666;
  line-height: 1.5;
  font-size: 1.08rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .daily-container {
    padding: 16px;
  }
  
  .daily-item {
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px;
  }
  
  .daily-date {
    width: auto;
    align-self: flex-start;
  }
  
  .daily-content h4 {
    font-size: 1rem;
  }
  
  .daily-content p {
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .daily-container {
    padding: 12px;
  }
  
  .daily-item {
    padding: 12px;
    margin-bottom: 16px;
  }
  
  .daily-date {
    font-size: 0.85rem;
    padding: 6px 10px;
  }
  
  .daily-content h4 {
    font-size: 0.95rem;
    margin-bottom: 6px;
  }
  
  .daily-content p {
    font-size: 0.85rem;
  }
}

/* 空状态 */
.daily-container:empty::before {
  content: "暂无日志记录";
  display: block;
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 1.1rem;
}
</style>