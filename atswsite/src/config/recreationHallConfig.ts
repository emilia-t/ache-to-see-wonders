// The relative position of this file: src/config/recreationHallConfig.ts
import * as THREE from 'three';
// ==============================
// 各模型文件路径
// ==============================
export const modelPathList = [
  { name: 'ceiling_light_01',     path: '/gltf/recreation_hall/build/ceiling_light_01/ceiling_light_01.gltf' },
  { name: 'ceiling_light_02',     path: '/gltf/recreation_hall/build/ceiling_light_02/ceiling_light_02.gltf' },
  { name: 'ceiling_light_03',     path: '/gltf/recreation_hall/build/ceiling_light_03/ceiling_light_03.gltf' },
  { name: 'ceiling_light_04',     path: '/gltf/recreation_hall/build/ceiling_light_04/ceiling_light_04.gltf' },
  { name: 'ceiling_light_05',     path: '/gltf/recreation_hall/build/ceiling_light_05/ceiling_light_05.gltf' },
  { name: 'ceiling_light_06',     path: '/gltf/recreation_hall/build/ceiling_light_06/ceiling_light_06.gltf' },
  { name: 'ceiling_light_07',     path: '/gltf/recreation_hall/build/ceiling_light_07/ceiling_light_07.gltf' },
  { name: 'ceiling_light_08',     path: '/gltf/recreation_hall/build/ceiling_light_08/ceiling_light_08.gltf' },
  { name: 'ceiling_light_09',     path: '/gltf/recreation_hall/build/ceiling_light_09/ceiling_light_09.gltf' },
  { name: 'ceiling_light_10',     path: '/gltf/recreation_hall/build/ceiling_light_10/ceiling_light_10.gltf' },
  { name: 'ceiling_light_11',     path: '/gltf/recreation_hall/build/ceiling_light_11/ceiling_light_11.gltf' },
  { name: 'ceiling_light_12',     path: '/gltf/recreation_hall/build/ceiling_light_12/ceiling_light_12.gltf' },
  { name: 'ceiling_light_13',     path: '/gltf/recreation_hall/build/ceiling_light_13/ceiling_light_13.gltf' },
  { name: 'ceiling_light_14',     path: '/gltf/recreation_hall/build/ceiling_light_14/ceiling_light_14.gltf' },
  { name: 'ceiling_light_15',     path: '/gltf/recreation_hall/build/ceiling_light_15/ceiling_light_15.gltf' },
  { name: 'ceiling_light_16',     path: '/gltf/recreation_hall/build/ceiling_light_16/ceiling_light_16.gltf' },
  { name: 'ceiling_light_17',     path: '/gltf/recreation_hall/build/ceiling_light_17/ceiling_light_17.gltf' },
  { name: 'ceiling_light_18',     path: '/gltf/recreation_hall/build/ceiling_light_18/ceiling_light_18.gltf' },
  { name: 'ceiling_light_19',     path: '/gltf/recreation_hall/build/ceiling_light_19/ceiling_light_19.gltf' },
  { name: 'ceiling_panel_low',    path: '/gltf/recreation_hall/build/ceiling_panel_low/ceiling_panel_low.gltf' },
  { name: 'ceiling_panel_top',    path: '/gltf/recreation_hall/build/ceiling_panel_top/ceiling_panel_top.gltf' },
  { name: 'floor',                path: '/gltf/recreation_hall/build/floor/floor.gltf' },
  { name: 'left_door',            path: '/gltf/recreation_hall/build/left_door/left_door.gltf' },
  { name: 'right_door',           path: '/gltf/recreation_hall/build/right_door/right_door.gltf' },
  { name: 'screen',               path: '/gltf/recreation_hall/build/screen/screen.gltf' },
  { name: 'screen_border',            path: '/gltf/recreation_hall/build/screen_border/screen_border.gltf' },
  { name: 'screen_border_wireframe',  path: '/gltf/recreation_hall/build/screen_border_wireframe/screen_border_wireframe.gltf' },
  { name: 'single_armchair_template', path: '/gltf/recreation_hall/build/single_armchair_template/single_armchair_template.gltf' },
  { name: 'stairs',                   path: '/gltf/recreation_hall/build/stairs/stairs.gltf' },
  { name: 'wall_bottom',              path: '/gltf/recreation_hall/build/wall_bottom/wall_bottom.gltf' },
  { name: 'wall_left',                path: '/gltf/recreation_hall/build/wall_left/wall_left.gltf' },
  { name: 'wall_right',               path: '/gltf/recreation_hall/build/wall_right/wall_right.gltf' },
  { name: 'wall_top',                 path: '/gltf/recreation_hall/build/wall_top/wall_top.gltf' },
  { name: 'c',       path: '/gltf/recreation_hall/build/ceiling_center_low/ceiling_center_low.gltf' },
  { name: 'ceiling_center_top',       path: '/gltf/recreation_hall/build/ceiling_center_top/ceiling_center_top.gltf' }
];
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
    axesY: 0x0000ff,
    axesZ: 0x00ff00,
    helperGrid: 0xffffff,//地表参考网格线颜色
    helperGridCenterLine: 0x0000ff
  },
  // 辅助对象配置
  helpers: {
    grid: {
      size: 2,
      divisions: 10,
      position: { y: -0.01 }
    },
    axes: {
      size: 1
    }
  },
  // 第一人称控制配置
  firstPerson: {
    moveSpeed: 20.0,    // 移动速度
    lookSpeed: 0.002,  // 视角移动速度
    gravity: 30,       // 重力
    jumpForce: 10,     // 跳跃力量
    playerHeight: 1.5  // 玩家身高
  },
  // 模型的海拔高度 y 轴值
  altitude:{
    S_ground:0.0//地面始终为0.0
  },
  
  // 各模型加载时原始偏移值(模型中心点相对于世界坐标原点的偏移)
  offset: {
    // 天花板灯光
    ceiling_light_01: { x: 0, y: 0, z: 0 },
    ceiling_light_02: { x: 0, y: 0, z: 0 },
    ceiling_light_03: { x: 0, y: 0, z: 0 },
    ceiling_light_04: { x: 0, y: 0, z: 0 },
    ceiling_light_05: { x: 0, y: 0, z: 0 },
    ceiling_light_06: { x: 0, y: 0, z: 0 },
    ceiling_light_07: { x: 0, y: 0, z: 0 },
    ceiling_light_08: { x: 0, y: 0, z: 0 },
    ceiling_light_09: { x: 0, y: 0, z: 0 },
    ceiling_light_10: { x: 0, y: 0, z: 0 },
    ceiling_light_11: { x: 0, y: 0, z: 0 },
    ceiling_light_12: { x: 0, y: 0, z: 0 },
    ceiling_light_13: { x: 0, y: 0, z: 0 },
    ceiling_light_14: { x: 0, y: 0, z: 0 },
    ceiling_light_15: { x: 0, y: 0, z: 0 },
    ceiling_light_16: { x: 0, y: 0, z: 0 },
    ceiling_light_17: { x: 0, y: 0, z: 0 },
    ceiling_light_18: { x: 0, y: 0, z: 0 },
    ceiling_light_19: { x: 0, y: 0, z: 0 },
    // 天花板
    ceiling_panel_low:        { x: 0, y: 0, z: 0 },
    ceiling_panel_top:        { x: 0, y: 0, z: 0 },
    // 地面
    floor:                    { x: 0, y: 0, z: 0 },
    // 门
    left_door:                { x: 0, y: 0, z: 0 },
    right_door:               { x: 0, y: 0, z: 0 },
    // 屏幕
    screen:                   { x: 0, y: 0, z: 0 },
    screen_border:            { x: 0, y: 0, z: 0 },
    screen_border_wireframe:  { x: 0, y: 0, z: 0 },
    // 椅子
    single_armchair_template: { x: 0, y: 0, z: 0 },
    // 楼梯
    stairs:                   { x: 0, y: 0, z: 0 },
    // 墙壁
    wall_bottom:              { x: 0, y: 0, z: 0 },
    wall_left:                { x: 0, y: 0, z: 0 },
    wall_right:               { x: 0, y: 0, z: 0 },
    wall_top:                 { x: 0, y: 0, z: 0 },
    // 天花板中心
    ceiling_center_low:       { x: 0, y: 0, z: 0 },
    ceiling_center_top:       { x: 0, y: 0, z: 0 }
  }
};
// ==============================
// 相机配置
// ==============================
export const cameraConfig = {
  position: { x: 0, y: sceneConfig.firstPerson.playerHeight, z: 1 }, // 相机位置（第一人称高度）
  fov: 70,      // 视野角度
  near: 0.05,    // 近裁剪面
  far: 2000,     // 远裁剪面
  redStartPos: { x: 0, y: sceneConfig.firstPerson.playerHeight, z: 1 },
  redStartPitch:0,
  redStartYaw:0,
  blackStartPos: { x: 0, y: sceneConfig.firstPerson.playerHeight, z: -1 },
  blackStartPitch:0,
  blackStartYaw:Math.PI
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
  // 补光光源
  fillLight: {
    color: 0xffffff, // 改为白色
    intensity: 2.0, // 增加强度
    position: { x: 0, y: 3, z: 0 } // 调整位置
  },
  // 环境光配置
  ambient: {
    color: 0xffffff, // 改为白色
    intensity: 0.8 // 增加强度
  }
};

export const videoList = [
  { name: '默认视频', url: '/video/movie/default.mp4' },
  { name: '自然风光', url: '/video/movie/nature.mp4' },
  { name: '城市夜景', url: '/video/movie/city_night.mp4' },
  { name: '太空星空', url: '/video/movie/space.mp4' }
];