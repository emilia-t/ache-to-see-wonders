<script setup lang="ts">
// The relative position of this file: src/components/PageTest2d.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'
import ViewTest2d from '@/components/test_2d/ViewTest2d.vue'
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
  <div class="page-test2d-container">
    <ViewTest2d/>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
</template>

<style scoped>

</style>