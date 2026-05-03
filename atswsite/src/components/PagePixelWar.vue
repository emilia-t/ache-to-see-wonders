<script setup lang="ts">
// The relative position of this file: src/components/PagePixelWar.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'
import ViewPixelWar from '@/components/pixel_war/ViewPixelWar.vue'
onMounted(() => {
  
})
onUnmounted(() => {
    
})

const emptyComputed = computed(() =>{
        return;
    }
)
</script>

<template>
  <div class="page-pixelwar-container">
    <ViewPixelWar/>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped>

</style>