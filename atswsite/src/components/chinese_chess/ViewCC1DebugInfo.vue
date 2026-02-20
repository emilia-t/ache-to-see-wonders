<script setup lang="ts">
// The relative position of this file: src/components/ViewCC1DebugInfo.vue
import { ref } from 'vue';
const props = defineProps<{enabledDebug:boolean;debugInfo:any}>();

</script>

<template>
  <div v-if="enabledDebug"  class="debug-info-container">
      <div class="debug-section">
        <h4>相机位置</h4>
        <div class="coord-line">
          <span>X: {{ debugInfo.cameraPosition.x }}</span>
          <span>Y: {{ debugInfo.cameraPosition.y }}</span>
          <span>Z: {{ debugInfo.cameraPosition.z }}</span>
        </div>
      </div>
      <div class="debug-section">
        <h4>视线交点</h4>
        <div class="coord-line">
          <span>X: {{ debugInfo.intersectionPoint.x }}</span>
          <span>Y: {{ debugInfo.intersectionPoint.y }}</span>
          <span>Z: {{ debugInfo.intersectionPoint.z }}</span>
        </div>
        <div v-if="!debugInfo.hasIntersection" class="no-intersection">
          (无交点)
        </div>
      </div>
    </div>
</template>

<style scoped>
.debug-info-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  z-index: 1000;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 200px;
}

.debug-section {
  margin-bottom: 10px;
}

.debug-section:last-child {
  margin-bottom: 0;
}

.debug-section h4 {
  margin: 0 0 5px 0;
  font-size: 11px;
  color: #ccc;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.coord-line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.coord-line span {
  min-width: 100px;
  flex: 1;
  text-align: left;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 5px;
  border-radius: 3px;
}

.no-intersection {
  font-size: 10px;
  color: #ff6b6b;
  text-align: center;
  margin-top: 3px;
  font-style: italic;
}
</style>