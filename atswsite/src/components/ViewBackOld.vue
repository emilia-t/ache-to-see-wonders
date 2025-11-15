<script setup lang="ts">
// The relative position of this file: src/components/ViewBackOld.vue
const navigateToLegacy = () => {
  window.open('https://old.atsw.top', '_blank');
};
</script>

<template>
  <div class="view-back-old-container">
    <div class="legacy-button-container">
      <button class="legacy-button" @click="navigateToLegacy">
        <div class="button-content">
          <div class="icon-wrapper">
            <ul class="icon">
              <li class="switch_old"></li>
            </ul>
          </div>
          <span class="legacy-text">旧版</span>
        </div>
        <div class="button-glow"></div>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 导入路径根据实际情况编写 */
@import '../sprite/style/sprite.scss';
.view-back-old-container {
  position: fixed;
  bottom: 0;
  right: 0;
  z-index: 998;
}

.legacy-button-container {
  position: absolute;
  bottom: 40px;
  right: 40px;
  z-index: 10;
}

.legacy-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 8px 10px;
  background: linear-gradient(135deg, 
    rgba(81, 155, 233, 0.9) 0%, 
    rgba(15, 111, 180, 0.8) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
  box-shadow: 
    0 8px 32px rgba(81, 155, 233, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.legacy-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.1) 0%, 
    rgba(255, 255, 255, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.legacy-button:hover {
  transform: translateY(-3px) scale(1.02);
  background: linear-gradient(135deg, 
    rgba(81, 155, 233, 0.95) 0%, 
    rgba(15, 111, 180, 0.85) 100%);
  box-shadow: 
    0 12px 40px rgba(81, 155, 233, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.legacy-button:hover::before {
  opacity: 1;
}

.legacy-button:active {
  transform: translateY(-1px) scale(1);
  transition: all 0.1s ease;
}

.button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
}

.legacy-text {
  background: linear-gradient(135deg, #fff, #e6f2ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  letter-spacing: 0.5px;
}

.button-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.4) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 16px;
  z-index: 1;
}

.legacy-button:hover .button-glow {
  opacity: 0.6;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .legacy-button-container {
    bottom: 35px;
    right: 35px;
  }
}

@media (max-width: 768px) {
  .legacy-button-container {
    bottom: 25px;
    right: 25px;
  }
  
  .legacy-button {
    padding: 8px 10px;
    font-size: 0.9rem;
    border-radius: 14px;
  }
  
  .legacy-text {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .legacy-button-container {
    bottom: 20px;
    right: 20px;
  }
  
  .legacy-button {
    padding: 6px 8px;
    font-size: 0.8rem;
    border-radius: 12px;
  }
  
  .legacy-text {
    display: block; /* 保持文字显示 */
    font-size: 0.8rem;
  }
  
  .legacy-button:hover {
    transform: translateY(-2px) scale(1.01);
  }
}

/* 超小屏幕优化 */
@media (max-width: 360px) {
  .legacy-button-container {
    bottom: 15px;
    right: 15px;
  }
  
  .legacy-button {
    padding: 6px 8px;
    font-size: 0.75rem;
  }
  
  .legacy-text {
    font-size: 0.75rem;
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
</style>