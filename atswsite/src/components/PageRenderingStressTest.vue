<script setup lang="ts">
// The relative position of this file: src/components/PageRenderingStressTest.vue
// Code name:RT3
import {ref,computed,onMounted,onUnmounted}     from 'vue';

import SceneManager                             from '@/class/rendering_stress_test/SceneManager';

// 导入组件
import ViewFilingLicense                        from '@/components/ViewFilingLicense.vue';

// ==============================
// 管理类实例
// ==============================
let   sceneManager: SceneManager;

// ==============================
// Dom 引用
// ==============================
const sceneRef = ref<HTMLDivElement>();

// ==============================
// 杂项变量常量
// ==============================

onMounted(() => {
  console.log("Rendering Stress Test Mounted");
  if (!sceneRef.value) return;
  
  sceneManager = new SceneManager(
    sceneRef.value,
    (increment, status) => {
      console.log(increment)
    }
  );
  
  sceneManager.init();
  
  // 添加窗口大小调整监听
  window.addEventListener('resize', handleResize);
})

// 添加卸载清理
onUnmounted(() => {
  if (sceneManager) {
    sceneManager.dispose();
    sceneManager = null as any;
  }
  
  // 移除窗口大小调整监听
  window.removeEventListener('resize', handleResize);
})

// 窗口大小调整处理函数
const handleResize = () => {
  if (sceneManager) {
    sceneManager.resize();
  }
}
</script>

<template>
  <div class="page-recreation-hall-container">
    <div ref="sceneRef" class="hall-container"></div>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped lang="scss">
.page-recreation-hall-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.hall-container {
  width: 100%;
  height: 100%;
  position: relative;
}

/* 调试面板样式 */
:global(.debug-panel) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:global(.debug-panel .fps-good) {
  font-weight: bold;
}

:global(.debug-panel .fps-medium) {
  font-weight: bold;
}

:global(.debug-panel .fps-poor) {
  font-weight: bold;
}

:global(.debug-panel div) {
  margin: 2px 0;
}

:global(.debug-panel span) {
  font-weight: bold;
}
</style>