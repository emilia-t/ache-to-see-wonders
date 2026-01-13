// The relative position of this file: src/config/renderingStressTestConfig.ts
// Code name:CDT1
import * as THREE from 'three';
// ==============================
// 场景配置
// ==============================
export const sceneConfig = {
  // 地面配置
  S_ground: {
    size: { width: 200, height: 200 },
    color: 0xffffff,
    opacity: 0.3, // 地面透明度
  },
  // 场景各物体的颜色
  color: {
    tempBackgroundColor: 0x000000,//初始加载场景时的背景颜色
    axesX: 0xff0000,//坐标轴颜色
    axesY: 0x00ff00,
    axesZ: 0x0000ff,
    helperGrid: 0xffffff,//地表参考网格线颜色
    helperGridCenterLine: 0xffffff
  },
  // 辅助对象配置
  helpers: {
    grid: {
      size: 2,
      divisions: 10,
      position: { y: 0.1 }
    },
    axes: {
      size: 1
    }
  },
  // 第一人称控制配置
  firstPersonCameraController: {
    moveSpeed: 3.0,    // 移动速度
    lookSpeed: 0.002,  // 视角移动速度
    gravity: 30,       // 重力
    jumpForce: 10,     // 跳跃力量
    playerHeight: 1.5  // 玩家身高
  },
  // 模型的海拔高度 y 轴值
  altitude:{
    S_ground:0.0//地面始终为0.0
  },
  // 各模型加载时原始偏移值(玩家头部盒子)
  offset:{

  },
  models:[
    {
      name:'test',
      path:'gltf/collision_detection_test/test_build/test.glb',
      ignore_load:false
    },
    {
      name:'player',
      path:'gltf/collision_detection_test/build/player/player.glb',
      ignore_load:false
    },
    {
      name:'floor',
      path:'gltf/collision_detection_test/build/floor/floor.glb',
      ignore_load:false
    },
    {
      name:'wall001',
      path:'gltf/collision_detection_test/build/wall001/wall001.glb',
      ignore_load:false
    },
    {
      name:'wall002',
      path:'gltf/collision_detection_test/build/wall002/wall002.glb',
      ignore_load:false
    },
    {
      name:'wall003',
      path:'gltf/collision_detection_test/build/wall003/wall003.glb',
      ignore_load:false
    }
  ]
};
// ==============================
// 相机配置
// ==============================
export const cameraConfig = {
  position: { x: 0, y: sceneConfig.firstPersonCameraController.playerHeight, z: 1 }, // 相机位置（第一人称高度）
  fov: 70,      // 视野角度
  near: 0.05,    // 近裁剪面
  far: 2000,     // 远裁剪面
};
// ==============================
// 渲染器配置
// ==============================
export const rendererConfig = {
  antialias: true,           // 抗锯齿
  alpha: true,               // 允许透明
  shadowMap: {
    enabled: true,           // 启用阴影
    type: THREE.PCFSoftShadowMap // 阴影类型
  }
};
// ==============================
// 灯光配置
// ==============================
export const lightConfig = {
  // 定向光配置
  directional: {
    color: 0xffffff,
    intensity: 3.0, // 增加强度
    position: { x: 3, y: 5, z: 2 }, // 提高Y轴高度
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        near: 0.1,
        far: 50, // 增加远裁剪面
        left: -20,
        right: 20,
        top: 20,
        bottom: -20
      }
    }
  },
  directional2: {
    color: 0xffffff,
    intensity: 3.0, // 增加强度
    position: { x: -3, y: 5, z: -2 }, // 提高Y轴高度
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        near: 0.1,
        far: 50, // 增加远裁剪面
        left: -20,
        right: 20,
        top: 20,
        bottom: -20
      }
    }
  },
  // 补光光源
  fillLight: {
    color: 0xffffff, // 改为白色
    intensity: 2.0, // 增加强度
    position: { x: 0, y: 3, z: 0 } // 调整位置
  },
  // 环境光配置 - 增强
  ambient: {
    color: 0xffffff, // 改为白色
    intensity: 0.8 // 增加强度
  }
};
