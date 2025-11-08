<script setup lang="ts">
// The relative position of this file: src/App.vue
import { RouterView } from 'vue-router'
// 使用debugger语句
// setInterval(function(){
//   var startTime = performance.now();
//   debugger;
//   var endTime = performance.now();
//   if (endTime - startTime > 100) {
//     // 如果调试器暂停了执行
//     window.location.reload();
//   }
// }, 1000);
</script>

<template>
  <RouterView />
</template>

<style>
/* 全局样式 */
@font-face {
  font-family: 'WenQuanYiMicroHei';
  src: url('/font/WenQuanYiMicroHei.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
  unicode-range: U+4E00-9FFF; /* 只包含中文字符 */
}
body {
  font-family: 'WenQuanYiMicroHei', sans-serif;
  background-color: rgb(255, 255, 255);
}
#app {
  width: 100%;
  min-height: 100vh;
}
#html,body {
  margin: 0;
  border: 0;
  padding: 0;
}
::-webkit-scrollbar{
  width: 8px;
}
::-webkit-scrollbar-button{
  display: none;
}
::-webkit-scrollbar-track{
  background-color: rgb(240, 248, 255);
}
::-webkit-scrollbar-track-piece{
  background-color: rgb(255, 255, 255);
}
::-webkit-scrollbar-thumb{
  background-color: rgb(223, 223, 223);
  border-radius: 10px;
  width: 6px;
}
::-webkit-scrollbar-corner{
  display: none;
}
</style>