<script setup lang="ts">
// The relative position of this file: src/components/PartCc1Start.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'

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
  <div class="part-cc1-start-container">
    
  </div>
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped>
    .part-cc1-start-container{
        width: 100vw;
        height: 100vh;
        position: fixed;
        z-index: 2000;
        left: 0;
        top: 0;
        background-color: beige;
    }
</style>