<script setup lang="ts">
// The relative position of this file: src/components/PageCollisionDetectionTest.vue
// Code name:CDT1
import * as THREE                                 from 'three'
import { ref, computed, onMounted, onUnmounted, nextTick }  from 'vue'

import type Coord3D                               from '@/interface/Coord3D';
import type Rotation3D                            from '@/interface/Rotation3D';

import SceneManager                               from '@/class/collision_detection_test/SceneManager'

import ViewFilingLicense                          from '@/components/ViewFilingLicense.vue'
import ViewCDT1Console                            from '@/components/collision_detection_test/ViewCDT1Console.vue';

let   sceneManager: SceneManager;
const sceneRef = ref<HTMLElement>();
const cdt1ConsoleRef = ref<InstanceType<typeof ViewCDT1Console>>();

// 获取方向文字函数
const getDirectionFromYaw = (yaw: number): string => {
  const yawDeg = THREE.MathUtils.radToDeg(yaw);
  const normalized = ((yawDeg % 360) + 360) % 360;
  
  if (normalized >= 337.5 || normalized < 22.5) return "北";
  if (normalized >= 22.5 && normalized < 67.5) return "西北";
  if (normalized >= 67.5 && normalized < 112.5) return "西";
  if (normalized >= 112.5 && normalized < 157.5) return "西南";
  if (normalized >= 157.5 && normalized < 202.5) return "南";
  if (normalized >= 202.5 && normalized < 247.5) return "东南";
  if (normalized >= 247.5 && normalized < 292.5) return "东";
  return "东北";
};

const onCameraMoving = (position:Coord3D,rotation:Rotation3D) => {
  if (position && rotation && cdt1ConsoleRef.value) {
    // 更新控制台调试信息
    cdt1ConsoleRef.value.updateDebugInfo({
      position: position,
      rotation: rotation,
      direction: getDirectionFromYaw(rotation.yaw)
    });
  }
};

const onCameraRotating = (rotation:Rotation3D) => {
  if (rotation && cdt1ConsoleRef.value) {
    // 更新控制台调试信息
    cdt1ConsoleRef.value.updateDebugInfo({
      rotation: rotation,
      direction: getDirectionFromYaw(rotation.yaw)
    });
  }
};

const onCameraModeChange = (isFirstPerson:boolean) => {
  if (cdt1ConsoleRef.value) {
    // 更新控制台调试信息
    cdt1ConsoleRef.value.updateDebugInfo({
      mode: isFirstPerson ? '第一人称' : '第三人称'
    });
    
    // 更新模型可见性
    updateModelVisibilityInfo(isFirstPerson);
  }
};

const onCameraJump = (velocity:number) => {
  if (cdt1ConsoleRef.value) {
    // 更新控制台调试信息
    cdt1ConsoleRef.value.updateDebugInfo({
      jumpVelocity: velocity
    });
    
    // 1.5秒后清除跳跃信息
    setTimeout(() => {
      if (cdt1ConsoleRef.value) {
        cdt1ConsoleRef.value.updateDebugInfo({
          jumpVelocity: null
        });
      }
    }, 1500);
  }
};

// 更新玩家模型信息
const updateModelInfo = () => {
  if (!sceneManager || !cdt1ConsoleRef.value) return;
  
  const playerEntity = sceneManager.playerEntity;
  if (playerEntity) {
    const playerModel = playerEntity.getPlayerModel();
    const isFirstPerson = playerEntity.getIsFirstPerson();
    
    // 更新模型可见性
    updateModelVisibilityInfo(isFirstPerson);
    
    if (playerModel) {
      // 获取模型位置
      const modelPosition = {
        x: playerModel.position.x,
        y: playerModel.position.y,
        z: playerModel.position.z
      };
      
      cdt1ConsoleRef.value.updateDebugInfo({
        modelPosition: modelPosition
      });
    } else {
      cdt1ConsoleRef.value.updateDebugInfo({
        modelPosition: null
      });
    }
  }
};
// next_
// 1.测试发现第三人称模式时相机撞到物体会停止移动
// 2.测试发现第一人称时不会到产生碰撞
// 3.修改碰撞逻辑
// ：
// 1.以玩家的模型的中心点创建一个碰撞箱，同时为所有物体创建碰撞箱，
//   通过检测碰撞箱是否相交来判断是否发生碰撞
// 2.在每次移动之前计算下一次的移动是否会发生碰撞，如果是则将移动方向像量投影到碰撞面的切线方向上，从而实现滑动效果;

// 更新模型可见性信息
const updateModelVisibilityInfo = (isFirstPerson: boolean) => {
  if (cdt1ConsoleRef.value) {
    // 第一人称时模型隐藏，第三人称时模型可见
    cdt1ConsoleRef.value.updateDebugInfo({
      isModelVisible: !isFirstPerson
    });
  }
};

// 定期更新模型信息的定时器引用
let modelInfoInterval: number | null = null;

onMounted(async () => {
  if(!sceneRef.value) return;
  
  // 等待控制台组件加载完成
  await nextTick();
  
  sceneManager = new SceneManager(
    sceneRef.value,
    {
      onMoving: onCameraMoving,
      onRotating: onCameraRotating,
      onModeChange: onCameraModeChange,
      onJump: onCameraJump
    }
  );
  
  // 初始化控制台信息
  if (cdt1ConsoleRef.value) {
    cdt1ConsoleRef.value.updateDebugInfo({
      mode: '第一人称',
      direction: '北',
      isModelVisible: false // 第一人称时模型隐藏
    });
  }
  
  // 设置定期更新模型信息的定时器
  modelInfoInterval = window.setInterval(() => {
    updateModelInfo();
  }, 100); // 每100毫秒更新一次
  
  // 初始更新一次
  updateModelInfo();
})

onUnmounted(() => {
    if(sceneManager){
      sceneManager.disposeScene();
      sceneManager = null as any;
    }
    
    // 清理定时器
    if (modelInfoInterval) {
      clearInterval(modelInfoInterval);
      modelInfoInterval = null;
    }
})

const emptyComputed = computed(() =>{
        return;
    }
)
</script>

<template>
  <div class="page-collision-detection-test-container">
    <div ref="sceneRef" class="hall-container"></div>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
  <ViewCDT1Console ref="cdt1ConsoleRef"></ViewCDT1Console>
</template>

<style scoped>
.page-collision-detection-test-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.hall-container {
  width: 100%;
  height: 100%;
}
</style>