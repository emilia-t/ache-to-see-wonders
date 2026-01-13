<script setup lang="ts">
// The relative position of this file: src/components/collision_detection_test/ViewCDT1Console.vue
// Code name:CDT1
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import * as THREE from 'three'

// 定义props接口
interface DebugInfo {
  position: { x: number; y: number; z: number } | null;
  modelPosition: { x: number; y: number; z: number } | null; // 玩家模型位置
  rotation: { yaw: number; pitch: number } | null;
  direction: string | null;
  mode: string | null;
  jumpVelocity: number | null;
  isModelVisible: boolean | null; // 模型是否可见
}

// 响应式数据
const debugInfo = ref<DebugInfo>({
  position: null,
  modelPosition: null,
  rotation: null,
  direction: null,
  mode: null,
  jumpVelocity: null,
  isModelVisible: null
});

// 格式化数字显示
const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toFixed(decimals);
};

// 将弧度转换为角度
const radToDeg = (rad: number): number => {
  return THREE.MathUtils.radToDeg(rad);
};

// 根据偏航角获取方向文字
const getDirectionFromYaw = (yaw: number): string => {
  const yawDeg = radToDeg(yaw);
  const normalized = ((yawDeg % 360) + 360) % 360;
  
  if (normalized >= 337.5 || normalized < 22.5) return "北";
  if (normalized >= 22.5 && normalized < 67.5) return "东北";
  if (normalized >= 67.5 && normalized < 112.5) return "东";
  if (normalized >= 112.5 && normalized < 157.5) return "东南";
  if (normalized >= 157.5 && normalized < 202.5) return "南";
  if (normalized >= 202.5 && normalized < 247.5) return "西南";
  if (normalized >= 247.5 && normalized < 292.5) return "西";
  return "西北";
};

// 从父组件接收调试信息
// 这里使用事件总线或provide/inject模式，这里使用provide/inject作为示例
// 在父组件中提供debugInfo更新函数

// 提供更新函数
const updateDebugInfo = (info: Partial<DebugInfo>) => {
  debugInfo.value = { ...debugInfo.value, ...info };
};

// 暴露更新函数供父组件使用
defineExpose({
  updateDebugInfo
});

onMounted(() => {
  console.log('CDT1 控制台已加载');
})
onUnmounted(() => {
    console.log('CDT1 控制台已卸载');
})

// 计算属性
const formattedPosition = computed(() => {
  if (!debugInfo.value.position) return '等待数据...';
  const { x, y, z } = debugInfo.value.position;
  return `X: ${formatNumber(x)} | Y: ${formatNumber(y)} | Z: ${formatNumber(z)}`;
});

// 格式化模型位置显示
const formattedModelPosition = computed(() => {
  if (!debugInfo.value.modelPosition) return '无模型/等待数据...';
  const { x, y, z } = debugInfo.value.modelPosition;
  return `X: ${formatNumber(x)} | Y: ${formatNumber(y)} | Z: ${formatNumber(z)}`;
});

const formattedRotation = computed(() => {
  if (!debugInfo.value.rotation) return '等待数据...';
  const { yaw, pitch } = debugInfo.value.rotation;
  return `偏航: ${formatNumber(radToDeg(yaw), 1)}° | 俯仰: ${formatNumber(radToDeg(pitch), 1)}°`;
});

const currentDirection = computed(() => {
  if (!debugInfo.value.rotation) return '未知';
  return getDirectionFromYaw(debugInfo.value.rotation.yaw);
});

const currentMode = computed(() => {
  return debugInfo.value.mode || '等待数据...';
});

const jumpInfo = computed(() => {
  if (debugInfo.value.jumpVelocity === null) return '无跳跃';
  return `跳跃速度: ${formatNumber(debugInfo.value.jumpVelocity, 1)}`;
});

// 模型可见性状态
const modelVisibility = computed(() => {
  if (debugInfo.value.isModelVisible === null) return '未知';
  return debugInfo.value.isModelVisible ? '可见' : '隐藏';
});
</script>

<template>
  <div class="view-cdt1-console-container">
    <div class="title">
      碰撞检测测试控制台
    </div>
    
    <div class="debug-section">
      <div class="section-title">相机信息</div>
      <div class="debug-item">
        <span class="label">相机位置:</span>
        <span class="value">{{ formattedPosition }}</span>
      </div>
      
      <div class="debug-item">
        <span class="label">相机旋转:</span>
        <span class="value">{{ formattedRotation }}</span>
      </div>
      
      <div class="debug-item">
        <span class="label">朝向:</span>
        <span class="value">{{ currentDirection }}</span>
      </div>
      
      <div class="debug-item">
        <span class="label">视角模式:</span>
        <span class="value">{{ currentMode }}</span>
      </div>
      
      <div class="debug-item">
        <span class="label">跳跃状态:</span>
        <span class="value">{{ jumpInfo }}</span>
      </div>
    </div>
    
    <!-- 玩家模型信息 -->
    <div class="debug-section model-info">
      <div class="section-title">玩家模型信息</div>
      <div class="debug-item">
        <span class="label">模型位置:</span>
        <span class="value">{{ formattedModelPosition }}</span>
      </div>
      
      <div class="debug-item">
        <span class="label">模型可见性:</span>
        <span class="value">{{ modelVisibility }}</span>
      </div>
    </div>
    
    <div class="instructions">
      <div>操作说明:</div>
      <div>• 左键点击: 锁定/解锁鼠标</div>
      <div>• WASD/方向键: 移动</div>
      <div>• 空格键: 跳跃</div>
      <div>• F8键: 切换视角模式</div>
      <div>• ESC键: 退出指针锁定</div>
    </div>
  </div>
</template>

<style scoped>
.view-cdt1-console-container{
    position: fixed;
    bottom: 20px;
    right: 20px;
    min-width: 320px;
    min-height: 350px;
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    overflow-y: auto;
    max-height: 80vh;
}

.title {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 15px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    color: #4fc3f7;
}

.debug-section {
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-section.model-info {
    background-color: rgba(30, 30, 40, 0.6);
    padding: 10px;
    border-radius: 6px;
    border: 1px solid rgba(100, 150, 255, 0.2);
}

.section-title {
    font-size: 14px;
    font-weight: bold;
    color: #81c784;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px dotted rgba(255, 255, 255, 0.1);
}

.debug-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    padding: 4px 0;
}

.debug-item .label {
    color: #bbbbbb;
    font-size: 13px;
}

.debug-item .value {
    color: #ffffff;
    font-size: 13px;
    font-weight: bold;
    text-align: right;
}

.instructions {
    font-size: 12px;
    color: #aaaaaa;
    line-height: 1.5;
    margin-top: 10px;
}

.instructions > div:first-child {
    color: #4fc3f7;
    margin-bottom: 5px;
    font-weight: bold;
}
</style>