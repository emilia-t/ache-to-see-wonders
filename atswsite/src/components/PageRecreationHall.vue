<script setup lang="ts">
// The relative position of this file: src/components/PageRecreationHall.vue
// Code name:RH3
import {ref,computed,onMounted,onUnmounted}     from 'vue';

import SceneManager                             from '@/class/recreation_hall_3d/SceneManager';

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

<style scoped>

</style>