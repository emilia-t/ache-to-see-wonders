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
  // 咖啡桌模型配置
  S_table: {
    modelPath: '/gltf/game_scene/build/S_table/S_table.gltf',
    scale: 1,
    position: { x: 0, y: 0, z: 0 }
  },
  // 棋盘模型配置
  S_chess_board: {
    modelPath: '/gltf/game_scene/build/S_chess_board/S_chess_board.gltf',
    scale: 1, 
    position: { x: 0, y: 0, z: 0 }
  },
  // 模型加载失败时使用的棋盘配置
  F_chess_board: {
    size: { width: 48, height: 2, depth: 48 },
    position: { y: 1.005 }, // 棋盘高度（在咖啡桌上方）
    scaleFactor: 100 // 缩放因子，将厘米转换为米
  },
  // 场景各物体的颜色
  color: {
    tempBackgroundColor: 0x000000,//初始加载场景时的背景颜色
    axesX: 0xff0000,//坐标轴颜色
    axesY: 0x0000ff,
    axesZ: 0x00ff00,
    helperGrid: 0xffffff,//地表参考网格线颜色
    helperGridCenterLine: 0x0000ff,
    fallBackPanorama:[0x4444ff, 0x44ff44, 0xff4444, 0xffff44, 0xff44ff, 0x44ffff]//错误加载全景图的颜色
  },
  // 全景立方体配置
  panorama: {
    size: 100, // 立方体大小，确保足够大以包围整个场景
    texturePaths: {
      right: '/bg/scene_bg_r.jpg',   // 右
      left: '/bg/scene_bg_l.jpg',    // 左
      top: '/bg/scene_bg_u.jpg',     // 上
      bottom: '/bg/scene_bg_d.jpg',  // 下
      front: '/bg/scene_bg_f.jpg',   // 前
      back: '/bg/scene_bg_b.jpg'     // 后
    }
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
    playerHeight: 1.7  // 玩家身高
  },
  // 棋子操作配置
  pieceInteraction: {
    liftHeight: 0.1, // 拿起时抬高的高度
    transparency: 0.7, // 拿起时的透明度
    followSpeed: 0.3, // 棋子跟随视角的速度
    holdDistance: 2.0 // 拿起棋子时距离相机的距离
  },
  // 模型的海拔高度 y 轴值
  altitude:{
    S_ground:0.0,//地面始终为0.0
    S_table:0.0,
    S_chess_board:0.0,
    S_chess_pieces_max:0.0,
    S_chess_pieces_min:0.0,
    S_chess_pieces_height:0.0,
    S_chess_pieces_max_plus:0.0
  },
  // 各棋子的模型水平偏移值（x和z轴）
  piecesOffset:{
    Black_00_chariot_left:{x:0.0,y:0.0,z:0.0},
    Black_01_horse_left:{x:0.0,y:0.0,z:0.0},
    Black_02_elephant_left:{x:0.0,y:0.0,z:0.0},
    Black_03_advisor_left:{x:0.0,y:0.0,z:0.0},
    Black_04_general:{x:0.0,y:0.0,z:0.0},
    Black_05_advisor_right:{x:0.0,y:0.0,z:0.0},
    Black_06_elephant_right:{x:0.0,y:0.0,z:0.0},
    Black_07_horse_right:{x:0.0,y:0.0,z:0.0},
    Black_08_chariot_right:{x:0.0,y:0.0,z:0.0},
    Black_09_cannon_left:{x:0.0,y:0.0,z:0.0},
    Black_10_cannon_right:{x:0.0,y:0.0,z:0.0},
    Black_11_soldier_1:{x:0.0,y:0.0,z:0.0},
    Black_12_soldier_2:{x:0.0,y:0.0,z:0.0},
    Black_13_soldier_3:{x:0.0,y:0.0,z:0.0},
    Black_14_soldier_4:{x:0.0,y:0.0,z:0.0},
    Black_15_soldier_5:{x:0.0,y:0.0,z:0.0},
    Red_16_soldier_1:{x:0.0,y:0.0,z:0.0},
    Red_17_soldier_2:{x:0.0,y:0.0,z:0.0},
    Red_18_soldier_3:{x:0.0,y:0.0,z:0.0},
    Red_19_soldier_4:{x:0.0,y:0.0,z:0.0},
    Red_20_soldier_5:{x:0.0,y:0.0,z:0.0},
    Red_21_cannon_left:{x:0.0,y:0.0,z:0.0},
    Red_22_cannon_right:{x:0.0,y:0.0,z:0.0},
    Red_23_chariot_left:{x:0.0,y:0.0,z:0.0},
    Red_24_horse_left:{x:0.0,y:0.0,z:0.0},
    Red_25_elephant_left:{x:0.0,y:0.0,z:0.0},
    Red_26_advisor_left:{x:0.0,y:0.0,z:0.0},
    Red_27_general:{x:0.0,y:0.0,z:0.0},
    Red_28_advisor_right:{x:0.0,y:0.0,z:0.0},
    Red_29_elephant_right:{x:0.0,y:0.0,z:0.0},
    Red_30_horse_right:{x:0.0,y:0.0,z:0.0},
    Red_31_chariot_right:{x:0.0,y:0.0,z:0.0}
  }
};
// ==============================
// 棋子模型配置
// ==============================
export const piecesConfig =  [
  {name: 'Black_00_chariot_left',
    modelPath: '/gltf/game_scene/build/Black_00_chariot_left/Black_00_chariot_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_01_horse_left',
    modelPath: '/gltf/game_scene/build/Black_01_horse_left/Black_01_horse_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_02_elephant_left',
    modelPath: '/gltf/game_scene/build/Black_02_elephant_left/Black_02_elephant_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_03_advisor_left',
    modelPath: '/gltf/game_scene/build/Black_03_advisor_left/Black_03_advisor_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_04_general',
    modelPath: '/gltf/game_scene/build/Black_04_general/Black_04_general.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_05_advisor_right',
    modelPath: '/gltf/game_scene/build/Black_05_advisor_right/Black_05_advisor_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_06_elephant_right',
    modelPath: '/gltf/game_scene/build/Black_06_elephant_right/Black_06_elephant_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_07_horse_right',
    modelPath: '/gltf/game_scene/build/Black_07_horse_right/Black_07_horse_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_08_chariot_right',
    modelPath: '/gltf/game_scene/build/Black_08_chariot_right/Black_08_chariot_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_09_cannon_left',
    modelPath: '/gltf/game_scene/build/Black_09_cannon_left/Black_09_cannon_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_10_cannon_right',
    modelPath: '/gltf/game_scene/build/Black_10_cannon_right/Black_10_cannon_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_11_soldier_1',
    modelPath: '/gltf/game_scene/build/Black_11_soldier_1/Black_11_soldier_1.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_12_soldier_2',
    modelPath: '/gltf/game_scene/build/Black_12_soldier_2/Black_12_soldier_2.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_13_soldier_3',
    modelPath: '/gltf/game_scene/build/Black_13_soldier_3/Black_13_soldier_3.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_14_soldier_4',
    modelPath: '/gltf/game_scene/build/Black_14_soldier_4/Black_14_soldier_4.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Black_15_soldier_5',
    modelPath: '/gltf/game_scene/build/Black_15_soldier_5/Black_15_soldier_5.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_16_soldier_1',
    modelPath: '/gltf/game_scene/build/Red_16_soldier_1/Red_16_soldier_1.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_17_soldier_2',
    modelPath: '/gltf/game_scene/build/Red_17_soldier_2/Red_17_soldier_2.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_18_soldier_3',
    modelPath: '/gltf/game_scene/build/Red_18_soldier_3/Red_18_soldier_3.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_19_soldier_4',
    modelPath: '/gltf/game_scene/build/Red_19_soldier_4/Red_19_soldier_4.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_20_soldier_5',
    modelPath: '/gltf/game_scene/build/Red_20_soldier_5/Red_20_soldier_5.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_21_cannon_left',
    modelPath: '/gltf/game_scene/build/Red_21_cannon_left/Red_21_cannon_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_22_cannon_right',
    modelPath: '/gltf/game_scene/build/Red_22_cannon_right/Red_22_cannon_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_23_chariot_left',
    modelPath: '/gltf/game_scene/build/Red_23_chariot_left/Red_23_chariot_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_24_horse_left',
    modelPath: '/gltf/game_scene/build/Red_24_horse_left/Red_24_horse_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_25_elephant_left',
    modelPath: '/gltf/game_scene/build/Red_25_elephant_left/Red_25_elephant_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_26_advisor_left',
    modelPath: '/gltf/game_scene/build/Red_26_advisor_left/Red_26_advisor_left.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_27_general',
    modelPath: '/gltf/game_scene/build/Red_27_general/Red_27_general.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_28_advisor_right',
    modelPath: '/gltf/game_scene/build/Red_28_advisor_right/Red_28_advisor_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_29_elephant_right',
    modelPath: '/gltf/game_scene/build/Red_29_elephant_right/Red_29_elephant_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_30_horse_right',
    modelPath: '/gltf/game_scene/build/Red_30_horse_right/Red_30_horse_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }},
  {name: 'Red_31_chariot_right',
    modelPath: '/gltf/game_scene/build/Red_31_chariot_right/Red_31_chariot_right.gltf',
    scale: 1, position: { x: 0, y: 0, z: 0 }}
];
// ==============================
// 相机配置
// ==============================
export const cameraConfig = {
  position: { x: 0, y: sceneConfig.firstPerson.playerHeight, z: 1 }, // 相机位置（第一人称高度）
  fov: 50,      // 视野角度
  near: 0.1,    // 近裁剪面
  far: 2000     // 远裁剪面
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
    intensity: 5.0,
    position: { x: 2, y: 3, z: 1 },
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        near: 0.0,
        far: 0.0,
        left: -5,
        right: 5,
        top: 5,
        bottom: -5
      }
    }
  },
  // 环境光配置
  ambient: {
    color: 0x404040,
    intensity: 0.6 // 环境光强度
  }
};