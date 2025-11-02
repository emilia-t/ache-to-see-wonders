<script setup lang="ts">
// The relative position of this file: src/components/PageHome.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'
import ViewUserLayer from './ViewUserLayer.vue'
import type ChineseChessUserData from '@/interface/ChineseChessUserData'
import type UserData from '@/interface/UserData'

const userData = null;
let loading = true;
let theme = 'light';
let design = 'B';

const isMobile = ref(false);
const isTablet = ref(false);
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
})
onUnmounted(() => {
    
})
</script>

<template>
  <div class="page-home-container">
    <!-- 头部 -->
    <div class="page-head">
      <div class="head-content">
        <!-- Logo区域 -->
        <div class="logo-section">
          <img v-if="isTablet" class="logo" src="/public/atsw.png" alt="ATSW Logo"/>
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
              <img src="/public/home.png" alt="主站"/>
              <span>主站</span>
            </div>
          </a>
          <a
            target="_blank"
            href="https://myacghome.com"
            class="nav-link"
          >
            <div class="nav-link-content">
              <img src="/public/blog.png" alt="博客"/>
              <span>博客</span>
            </div>
          </a>
          <a
            target="_blank"
            href="https://map.atsw.top"
            class="nav-link"
          >
            <div class="nav-link-content">
              <img src="/public/map.png" alt="地图"/>
              <span>地图</span>
            </div>
          </a>
          <a
            target="_blank"
            href="https://git.atsw.top"
            class="nav-link"
          >
            <div class="nav-link-content">
              <img src="/public/gitea.png" alt="gitea"/>
              <span>gitea</span>
            </div>
          </a>
        </div>

        <!-- 用户信息 -->
        <view-user-layer 
          class="user-section"
          :user-data="userData" 
          :loading="loading" 
          :theme="theme" 
          :design="design"
        />
      </div>
    </div>

    <!-- 内容 -->
    <div class="page-content">
      <!-- 大字图区(16:6) -->
      <div>

      </div>
    </div>
    
  </div>
  <ViewFilingLicense/>
</template>

<style scoped>
.page-head {
  width: 100vw;
  height: 70px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
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

/* Logo区域样式 */
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

/* 导航链接样式 */
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

/* 用户区域样式 */
.user-section {
  flex-shrink: 0;
}

.page-content {
  width: 100vw;
  height: 37.5vw;
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
</style>