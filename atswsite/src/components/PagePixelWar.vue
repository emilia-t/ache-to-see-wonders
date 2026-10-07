<script setup lang="ts">
// The relative position of this file: src/components/PagePixelWar.vue
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import ViewFilingLicenseUP from '@/components/ViewFilingLicenseUP.vue'
import ViewPixelWar from '@/components/pixel_war/ViewPixelWar.vue'

const router = useRouter();
const isDirty = ref(true);//默认为true
const markDirty = () => {isDirty.value = true};
const save = () => {isDirty.value = false};
(window as any).__pagePixelWarSave = save;
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (!isDirty.value) return;
  e.preventDefault();
  e.returnValue = '是否要离开？未保存的更改将丢失。';
  return e.returnValue;
};
onBeforeRouteLeave((to, from, next) => {
  if (!isDirty.value) return next();
  const ok = window.confirm('是否要离开？未保存的更改将丢失。');
  if (ok){isDirty.value = false;next();} else {next(false);}
});
onMounted(() => {
  document.addEventListener('input', markDirty, true);
  document.addEventListener('change', markDirty, true);
  window.addEventListener('beforeunload', handleBeforeUnload);
});
onBeforeUnmount(() => {
  document.removeEventListener('input', markDirty, true);
  document.removeEventListener('change', markDirty, true);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  delete (window as any).__pagePixelWarSave;
});
</script>
<template>
  <div class="page-pixelwar-container"><ViewPixelWar/></div>
  <ViewFilingLicenseUP></ViewFilingLicenseUP>
</template>
<style scoped>
</style>