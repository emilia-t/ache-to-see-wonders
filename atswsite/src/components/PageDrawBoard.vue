<script setup lang="ts">
// The relative position of this file: src/components/PageDrawBoard.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'
import ViewDrawBoard from '@/components/draw_board/ViewDrawBoard.vue'
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
  <div class="page-drawboard-container">
    <ViewDrawBoard/>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped>

</style>