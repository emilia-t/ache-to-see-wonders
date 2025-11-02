<script setup lang="ts">
// The relative position of this file: src/App.vue
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
/* 全局样式 */
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