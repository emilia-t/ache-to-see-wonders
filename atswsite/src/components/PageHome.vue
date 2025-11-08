<script setup lang="ts">
// The relative position of this file: src/components/PageHome.vue
import { ref, computed, onMounted, onUnmounted, watch} from 'vue'
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'
import ViewUserLayer from './ViewUserLayer.vue'
import { useConfigStore } from '@/stores/store';

let loading = true;
let theme = 'light';
let design = 'B';

const isMobile = ref(false);
const isTablet = ref(false);

const videoLoaded = ref(false);// 视频相关响应式数据
const videoPlayer = ref<HTMLVideoElement | null>(null);

const configStore = useConfigStore() // 配置对象
const currentTitle = computed(() => configStore.homePageCurrentVideo.title)
const currentDescription = computed(() => configStore.homePageCurrentVideo.description)
const currentCover = computed(() => configStore.homePageCurrentVideo.cover)
const currentVideo = computed(() => configStore.homePageCurrentVideo.video)
const currentTargetUrl = computed(() => configStore.homePageCurrentVideo.targetUrl)
const currentButtonName = computed(() => configStore.homePageCurrentVideo.button_name)

// 当配置文件加载后重加载视频
watch(currentVideo, (newVideoUrl, oldVideoUrl) => {
  if (newVideoUrl && newVideoUrl !== oldVideoUrl) {
    reloadVideo();
  }
});

// 添加重新加载视频的函数
const reloadVideo = () => {
  if (videoPlayer.value) {
    videoLoaded.value = false;
    videoPlayer.value.load(); // 重新加载视频
    videoPlayer.value.play().catch(e => {
      console.log('视频自动播放被阻止:', e);
    });
  }
};

const onVideoLoaded = () => {// 视频加载完成处理
  videoLoaded.value = true;
  if (videoPlayer.value) {
    videoPlayer.value.play().catch(e => {
      console.log('自动播放被阻止:', e);
    });
  }
};

// 添加视频播放尝试函数
const tryPlayVideo = () => {
  if (videoPlayer.value && videoLoaded.value) {
    videoPlayer.value.play().catch(e => {
      console.log('视频播放失败:', e);
      // 可以在这里添加用户手动播放的UI提示
    });
  }
};

const navigateToVideo = () => {// 跳转到视频页面
  if(currentTargetUrl !== null){
    if(typeof currentTargetUrl.value == 'string'){
      window.open(currentTargetUrl.value, '_blank');
    }
  }
};

const activeTab = ref('prototype')

const switchTab = (tab: string) => {
  activeTab.value = tab
}


// 设备检测函数
const detectDeviceType = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const screenWidth = window.innerWidth;

  // 移动设备特征检测
  const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|windows phone|webos/i.test(userAgent);
  const isTabletDevice = /ipad|tablet|playbook|silk|kindle/i.test(userAgent) || 
                         (isMobileDevice && screenWidth >= 768 && screenWidth <= 1024);

  isMobile.value = isMobileDevice && !isTabletDevice;
  isTablet.value = isTabletDevice;
};


onMounted(() => {
  detectDeviceType();
  window.addEventListener('resize', detectDeviceType);
  // 添加用户交互检测以解决自动播放问题
  const handleUserInteraction = () => {
    if (videoPlayer.value && !videoLoaded.value) {
      videoPlayer.value.play().catch(e => {
        console.log('自动播放被阻止:', e);
      });
    }
    document.removeEventListener('click', handleUserInteraction);
    document.removeEventListener('touchstart', handleUserInteraction);
  };
  
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
        <view-user-layer 
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
          loop
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
    <div class="app-rt">
      <!-- 切换按钮 -->
      <div class="rt-switch">
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
      <div class="rt-content">
        <!-- 试做型 -->
        <div v-show="activeTab === 'prototype'" class="tab-content">
          <div class="content-placeholder">
            <h3>试做型项目</h3>
            <p>这里将展示各种测试项目</p>
          </div>
        </div>
        <!-- 模组 -->
        <div v-show="activeTab === 'module'" class="tab-content">
          <div class="content-placeholder">
            <h3>功能模组</h3>
            <p>这里将展示模组</p>
          </div>
        </div>
        <!-- 日志 -->
        <div v-show="activeTab === 'daily'" class="tab-content">
          <div class="content-placeholder">
            <h3>开发日志</h3>
            <p>这里将记录项目开发过程和更新日志</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ViewFilingLicense/>
</template>

<style scoped lang="scss">
/* 导入路径根据实际情况编写 */
@import '../sprite/style/sprite.scss';
.page-head {
  width: 100vw;
  height: 70px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 0 rgba(255, 255, 255, 0.8) inset;
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}

/** Logo区域样式 **/
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

/** 导航链接样式 **/
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

.nav-link-content img {
  width: 30px;
  height: 30px;
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.nav-link:hover .nav-link-content img,
.nav-link.active .nav-link-content img {
  opacity: 1;
}

/** 用户区域样式 **/
.user-section {
  flex-shrink: 0;
}

.page-content {
  width: 100vw;
  height: 67vh;
  background-color: rgba(255, 255, 255, 1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .head-content {
    padding: 0 16px;
    gap: 16px;
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
    gap: 4px;
  }
}

@media (max-width: 480px) {
  .page-head {
    height: 60px;
  }

  .head-content {
    padding: 0 12px;
  }

  .logo {
    width: 32px;
    height: 32px;
  }

  .logo-text1 {
    font-size: 18px;
  }

  .page-content {
    margin-top: 60px;
  }
}


/** 大屏展示区样式 **/
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

/** 左下角悬浮内容 **/
.video-overlay-content {
  position: absolute;
  bottom: 80px;
  left: 40px;
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

.action-button:hover .button-icon {
  transform: translateX(4px);
}

/** 渐变过度背景 **/
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


/** 具体内容区域 **/
.app-rt {
  width: 100vw;
  height: auto;
  background: #fff;
  min-height: 400px;
}

/** 切换按钮区域 **/
.rt-switch {
  width: 100%;
  height: auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
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
  max-width: 1200px;
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

.btn-icon {
  font-size: 1.8rem;
  transition: transform 0.3s ease;
}

.switch-btn:hover .btn-icon {
  transform: scale(1.1);
}

.switch-btn.active .btn-icon {
  transform: scale(1.1);
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

/** 内容区域 **/
.rt-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 0px;
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

.content-placeholder {
  text-align: center;
  padding: 60px 0;
  background: rgba(81, 155, 233, 0.03);
  border-radius: 20px;
  border: 1px dashed rgba(81, 155, 233, 0.2);
}

.content-placeholder h3 {
  font-size: 1.8rem;
  margin-bottom: 16px;
  background: linear-gradient(135deg, rgb(81, 155, 233), rgb(15, 111, 180));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.content-placeholder p {
  color: #666;
  font-size: 1.1rem;
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .switch-container {
    gap: 12px;
    padding: 0 16px;
  }
  
  .switch-btn {
    padding: 12px 16px;
    min-width: 80px;
  }
  
  .btn-icon {
    font-size: 1.5rem;
  }
  
  .btn-text {
    font-size: 0.85rem;
  }
  
  .rt-content {
    padding: 30px 0;
  }
  
  .content-placeholder {
    padding: 40px 0;
  }
  
  .content-placeholder h3 {
    font-size: 1.5rem;
  }
}

@media (max-width: 480px) {
  .rt-switch {
    top: 60px;
    padding: 16px 0;
  }
  
  .switch-container {
    gap: 8px;
    padding: 0 12px;
  }
  
  .switch-btn {
    padding: 10px 12px;
    min-width: 70px;
    border-radius: 12px;
  }
  
  .btn-icon {
    font-size: 1.3rem;
  }
  
  .btn-text {
    font-size: 0.8rem;
  }
  
  .rt-content {
    padding: 24px 0;
  }
  
  .content-placeholder {
    padding: 30px 0;
  }
  
  .content-placeholder h3 {
    font-size: 1.3rem;
  }
  
  .content-placeholder p {
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

/** sprites icon **/
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
</style>