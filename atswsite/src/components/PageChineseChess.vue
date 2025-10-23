<script setup lang="ts">
// The relative position of this file: src/components/PageChineseChess.vue
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ==============================
// 组件引用
// ==============================
const sceneRef = ref<HTMLDivElement>();

// ==============================
// Three.js 对象变量
// ==============================
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let directionalLight: THREE.DirectionalLight;
let coffeeTable: THREE.Group; // 咖啡桌模型组
let chessBoard: THREE.Group; // 棋盘模型组
let chessPieces: THREE.Group; // 棋子模型组
let panoramaCube: THREE.Mesh; // 全景立方体
let centerGridHelper: THREE.GridHelper; // 参考网格
let centerAxesHelper: THREE.AxesHelper; // 参考坐标轴

// ==============================
// 第一人称视角控制相关变量
// ==============================
let isPointerLocked = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let pitch = 0; // 俯仰角（上下看）
let yaw = 0;   // 偏航角（左右看）
let rotationSpeed = 0.002;

// ==============================
// 第一人称棋子操作相关变量
// ==============================
let raycaster: THREE.Raycaster;
let isPicking = false;
let pickedPiece: THREE.Object3D | null = null;
let originalPosition: THREE.Vector3 | null = null;
let originalMaterial: THREE.Material | THREE.Material[] | null = null;
let transparentMaterial: THREE.MeshLambertMaterial;

// ==============================
// 场景配置
// ==============================
const sceneConfig = {
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
    fallBackChessBoard: 0xe6cb63,//错误加载的棋盘颜色
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
const piecesConfig = [
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
const cameraConfig = {
  position: { x: 0, y: sceneConfig.firstPerson.playerHeight, z: 1 }, // 相机位置（第一人称高度）
  fov: 50,      // 视野角度
  near: 0.1,    // 近裁剪面
  far: 2000     // 远裁剪面
};
// ==============================
// 渲染器配置
// ==============================
const rendererConfig = {
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
const lightConfig = {
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
// ==============================
// 核心函数
// ==============================

/**
 * 初始化Three.js场景
 */
const initScene = () => {
  if (!sceneRef.value) return;

  // 创建场景、相机、渲染器
  createScene();
  createCamera();
  createRenderer();
  
  // 设置灯光
  createLights();
  
  // 创建场景内容
  createSceneContent();

  // 初始化交互系统
  initInteractionSystem();
  
  // 添加窗口调整事件监听
  window.addEventListener('resize', onWindowResize);
}

/**
 * 初始化交互系统
 */
const initInteractionSystem = () => {
  // 初始化射线投射器
  raycaster = new THREE.Raycaster();
  
  // 创建透明材质用于拿起状态
  transparentMaterial = new THREE.MeshLambertMaterial({
    transparent: true,
    opacity: sceneConfig.pieceInteraction.transparency
  });
  
  // 添加鼠标事件监听
  if (renderer.domElement) {
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
  }
  
  // 初始化指针锁定
  initPointerLock();
}

/**
 * 初始化指针锁定
 */
const initPointerLock = () => {
  const element = renderer.domElement;
  
  element.addEventListener('click', () => {
    if (!isPointerLocked) {
      element.requestPointerLock();
    }
  });
  
  // 指针锁定状态变化事件
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('mozpointerlockchange', onPointerLockChange);
}

/**
 * 指针锁定状态变化处理
 */
const onPointerLockChange = () => {
  isPointerLocked = document.pointerLockElement === renderer.domElement;
  
  // if (isPointerLocked) {
  //   console.log('指针锁定已启用');
  // } else {
  //   console.log('指针锁定已禁用');
  // }
}

/**
 * 鼠标点击事件处理
 */
const onClick = (event: MouseEvent) => {
  if (!isPointerLocked) return;
  
  if (!isPicking) {
    // 尝试拿起棋子
    tryPickPiece();
  } else {
    // 放下棋子
    placePiece();
  }
}

/**
 * 鼠标移动事件处理（第一人称视角控制）
 */
const onMouseMove = (event: MouseEvent) => {
  if (!isPointerLocked) return;
  
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;
  
  // 使用四元数控制相机旋转，避免万向节锁
  yaw -= movementX * rotationSpeed;
  pitch -= movementY * rotationSpeed;
  
  // 限制俯仰角范围（避免翻转）
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
  
  // 使用四元数设置相机旋转
  const quaternion = new THREE.Quaternion();
  quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  camera.setRotationFromQuaternion(quaternion);
}

/**
 * 键盘按下事件处理
 */
const onKeyDown = (event: KeyboardEvent) => {
  if (!isPointerLocked) return;
  
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (canJump) {
        velocity.y += sceneConfig.firstPerson.jumpForce;
        canJump = false;
      }
      break;
  }
}

/**
 * 键盘释放事件处理
 */
const onKeyUp = (event: KeyboardEvent) => {
  if (!isPointerLocked) return;
  
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
}

/**
 * 尝试拿起棋子
 */
const tryPickPiece = () => {
  if (isPicking) return;
  
  // 从屏幕中心发射射线（第一人称视角）
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  // 检测与棋子的交点
  if (chessPieces) {
    const intersects = raycaster.intersectObjects(chessPieces.children, true);
    
    for(let i =0; i<intersects.length; i++){
      //console.log('已选中：'+intersects[i].object.userData['name']);
      break;
    }
    
    if (intersects.length > 0) {
      // 找到被点击的棋子
      const intersectedObject = intersects[0].object;
      
      // 向上查找父对象，直到找到棋子组中的直接子对象
      let piece = intersectedObject;
      while (piece.parent && piece.parent !== chessPieces && piece.parent !== scene) {
        piece = piece.parent;
      }
      
      if (chessPieces.children.includes(piece)) {
        // 拿起棋子
        pickUpPiece(piece);
      }
    }
  }
}

/**
 * 拿起棋子
 */
const pickUpPiece = (piece: THREE.Object3D) => {
  isPicking = true;
  pickedPiece = piece;
  originalPosition = piece.position.clone();
  
  // 计算棋子高度信息
  const bbox = new THREE.Box3().setFromObject(piece);
  const pieceHeight = bbox.max.y - bbox.min.y;
  const bottomOffset = bbox.min.y;
  //console.log(`拿起棋子: ${piece.name}, 高度: ${pieceHeight}, 底部偏移: ${bottomOffset}`);
  
  // 保存原始材质
  if (piece instanceof THREE.Mesh) {
    originalMaterial = piece.material;
    piece.material = transparentMaterial;
  } else {
    // 如果是组对象，遍历所有网格并设置透明材质
    piece.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalMaterial = child.material;
        child.material = transparentMaterial;
      }
    });
  }
}

/**
 * 放下棋子
 */
const placePiece = () => {
  if (!pickedPiece) return;
  if (pickedPiece.name == '') return;
  const pieceName = pickedPiece.name as keyof typeof sceneConfig.piecesOffset;
  // 从屏幕中心发射射线检测放置位置
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  // 检测与场景中物体的交点（排除棋子自身）
  const intersectableObjects = scene.children.filter(
  (obj) => {
    const include = obj !== chessPieces && 
                   obj !== pickedPiece && 
                   obj !== centerGridHelper &&
                   obj !== centerAxesHelper &&
                   obj !== panoramaCube;
    return include;
    }
  );
  
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  //console.log('检测到的交点:', intersects);
  if (intersects.length == 0) {//没有任何交点
    return;
  }
  if (intersects.length > 0) {
    // 将棋子放置到交点位置
    const targetPosition = intersects[0].point.clone();
    const intersectedObject = intersects[0].object;
    //console.log('交互物体: ', intersectedObject.name);
    if(intersectedObject.name == ''){
      return;
    }
    // 根据物体类型设置不同的高度
    if (intersectedObject.name.includes('board')) {
      // 棋盘：棋子放置在棋盘表面
      const pos = {
        x:targetPosition.x,
        y:targetPosition.y,
        z:targetPosition.z
      };
      if(sceneConfig.piecesOffset[pieceName]){
        pos.x -= sceneConfig.piecesOffset[pieceName].x;
        pos.y -= sceneConfig.piecesOffset[pieceName].y;
        pos.z -= sceneConfig.piecesOffset[pieceName].z;
      }
      pickedPiece.position.set(pos.x, pos.y, pos.z);
      //console.log('放置位置: ', pos);
    } else if (intersectedObject.name.includes('table')) {
      // 咖啡桌：棋子放置在咖啡桌表面
      const pos = {
        x:targetPosition.x,
        y:targetPosition.y,
        z:targetPosition.z
      };
      if(sceneConfig.piecesOffset[pieceName]){
        pos.x -= sceneConfig.piecesOffset[pieceName].x;
        pos.y -= sceneConfig.piecesOffset[pieceName].y;
        pos.z -= sceneConfig.piecesOffset[pieceName].z;
      }
      pickedPiece.position.set(pos.x, pos.y, pos.z);
      //console.log('放置位置: ', pos);
    } else if (intersectedObject.name.includes('ground')) {
      // 地面：棋子放置在地面上
      const pos = {
        x:targetPosition.x,
        y:targetPosition.y,
        z:targetPosition.z
      };
      if(sceneConfig.piecesOffset[pieceName]){
        pos.x -= sceneConfig.piecesOffset[pieceName].x;
        pos.y -= sceneConfig.piecesOffset[pieceName].y;
        pos.z -= sceneConfig.piecesOffset[pieceName].z;
      }
      pickedPiece.position.set(pos.x, pos.y, pos.z);
      //console.log('放置位置: ', pos);
    } else {
      const pos = {
        x:targetPosition.x,
        y:targetPosition.y,
        z:targetPosition.z
      };
      if(sceneConfig.piecesOffset[pieceName]){
        pos.x -= sceneConfig.piecesOffset[pieceName].x;
        pos.y -= sceneConfig.piecesOffset[pieceName].y;
        pos.z -= sceneConfig.piecesOffset[pieceName].z;
      }
      pickedPiece.position.set(pos.x, pos.y, pos.z);
      //console.log('放置位置: ', pos);
    }
  }
  
  // 恢复原始材质
  if (pickedPiece instanceof THREE.Mesh) {
    pickedPiece.material = originalMaterial as THREE.Material;
  } else {
    // 如果是组对象，遍历所有网格并恢复原始材质
    pickedPiece.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = originalMaterial as THREE.Material;
      }
    });
  }
  
  //console.log('放下棋子:', pickedPiece.name);
  
  // 重置状态
  resetPickingState();
}

/**
 * 重置拾取状态
 */
const resetPickingState = () => {
  isPicking = false;
  pickedPiece = null;
  originalPosition = null;
  originalMaterial = null;
}

/**
 * 更新棋子跟随视角
 * 注意：为了让玩家可视化棋子的放置点，如果视线与棋盘或桌子存在交叉点则这个棋子应该在桌子或棋盘之上，否则默认悬浮在视线的前方。
 */
const updatePieceFollowing = () => {
  if (!isPicking || !pickedPiece) return;
  
  // 从屏幕中心发射射线（视野中心线）
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  // 检测与场景中物体的交点（排除棋子自身和辅助对象）
  const intersectableObjects = scene.children.filter(
    (obj) => {
      const include = obj !== chessPieces && 
                     obj !== pickedPiece && 
                     obj !== centerGridHelper &&
                     obj !== centerAxesHelper &&
                     obj !== panoramaCube;
      return include;
    }
  );
  
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  if (intersects.length > 0) {
    // 找到第一个有效的交点
    const intersect = intersects[0];
    const targetPosition = intersect.point.clone();
    const intersectedObject = intersect.object;
    
    // 根据交点的物体类型调整棋子位置
    if (intersectedObject.name.includes('board') || intersectedObject.name.includes('table')) {
      // 对于棋盘或桌子，将棋子放置在交点表面上方
      const pieceName = pickedPiece.name as keyof typeof sceneConfig.piecesOffset;
      
      // 计算棋子底部到模型原点的偏移
      const bbox = new THREE.Box3().setFromObject(pickedPiece);
      const bottomOffset = bbox.min.y;
      
      // 将棋子放置在交点表面，考虑棋子的底部偏移
      targetPosition.y -= bottomOffset;
      
      // 应用棋子的水平偏移修正
      if (sceneConfig.piecesOffset[pieceName]) {
        targetPosition.x -= sceneConfig.piecesOffset[pieceName].x;
        targetPosition.z -= sceneConfig.piecesOffset[pieceName].z;
      }
      
      // 稍微抬高一点，避免穿插
      targetPosition.y += 0.001;
    } else if (intersectedObject.name.includes('ground')) {
      // 对于地面，将棋子放置在地面上方
      const pieceName = pickedPiece.name as keyof typeof sceneConfig.piecesOffset;
      const bbox = new THREE.Box3().setFromObject(pickedPiece);
      const bottomOffset = bbox.min.y;
      
      targetPosition.y -= bottomOffset;
      
      if (sceneConfig.piecesOffset[pieceName]) {
        targetPosition.x -= sceneConfig.piecesOffset[pieceName].x;
        targetPosition.z -= sceneConfig.piecesOffset[pieceName].z;
      }
      
      targetPosition.y += 0.001;
    } else {
      // 其他物体，使用默认的悬浮位置
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      targetPosition.copy(camera.position).add(direction.multiplyScalar(0.5));
    }
    
    // 平滑移动到目标位置
    pickedPiece.position.lerp(targetPosition, sceneConfig.pieceInteraction.followSpeed);
  } else {
    // 没有交点，默认悬浮在视线前方0.5单位长度处
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const targetPosition = camera.position.clone().add(
      direction.multiplyScalar(0.1)
    );
    
    // 平滑移动到目标位置
    pickedPiece.position.lerp(targetPosition, sceneConfig.pieceInteraction.followSpeed);
  }
}

/**
 * 更新第一人称移动
 */
const updateFirstPersonMovement = (delta: number) => {
  if (!isPointerLocked) return;
  
  // 根据移动方向更新速度
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize(); // 确保对角线移动不会更快
  
  // 如果没有移动输入，确保速度归零
  if (!moveForward && !moveBackward && !moveLeft && !moveRight) {
    velocity.x = 0;
    velocity.z = 0;
  }
  
  // 使用相机的方向来正确计算移动
  if (moveForward || moveBackward || moveLeft || moveRight) {
    // 获取相机的方向向量（看向的方向）
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // 创建右侧方向向量（相机的右侧）
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, camera.up).normalize(); // 修正叉乘顺序
    
    // 重置移动方向
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    // 前后移动：沿着相机看向的方向
    if (moveForward) {
      moveDirection.add(cameraDirection);
    }
    if (moveBackward) {
      moveDirection.sub(cameraDirection);
    }
    
    // 左右移动：沿着相机右侧方向
    if (moveLeft) {
      moveDirection.sub(cameraRight);
    }
    if (moveRight) {
      moveDirection.add(cameraRight);
    }
    
    // 移除Y轴分量，确保只在水平面移动
    moveDirection.y = 0;
    moveDirection.normalize();
    
    // 应用移动速度
    velocity.x += moveDirection.x * sceneConfig.firstPerson.moveSpeed * delta;
    velocity.z += moveDirection.z * sceneConfig.firstPerson.moveSpeed * delta;
  }
  
  // 应用重力
  velocity.y -= sceneConfig.firstPerson.gravity * delta;
  
  // 移动相机 - 使用直接位置更新而不是translate
  camera.position.x += velocity.x * delta;
  camera.position.y += velocity.y * delta;
  camera.position.z += velocity.z * delta;
  
  // 简单的碰撞检测（防止穿过地面）
  if (camera.position.y < sceneConfig.firstPerson.playerHeight) {
    velocity.y = 0;
    camera.position.y = sceneConfig.firstPerson.playerHeight;
    canJump = true;
  }
}

/////////////////////constration////////////////////////
const testCameraXup = ()=>{
  camera.translateX(0.1);
}
const testCameraXdown = ()=>{
  camera.translateX(-0.1);
}
const testCameraYup = ()=>{
  camera.translateY(0.1);
}
const testCameraYdown = ()=>{
  camera.translateY(-0.1);
}
const testCameraZup = ()=>{
  camera.translateZ(0.1);
}
const testCameraZdown = ()=>{
  camera.translateZ(-0.1);
}
const testCameraRxup = ()=>{
  camera.rotateX(0.01);
}
const testCameraRxdown = ()=>{
  camera.rotateX(-0.01);
}
const testCameraRyup = ()=>{
  camera.rotateY(0.01);
}
const testCameraRydown = ()=>{
  camera.rotateY(-0.01);
}
const testCameraRzup = ()=>{
  camera.rotateZ(0.01);
}
const testCameraRzdown = ()=>{
  camera.rotateZ(-0.01);
}
//////////////////////constration///////////////////////

// ==============================
// 场景创建函数
// ==============================

/**
 * 创建Three.js场景
 */
const createScene = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneConfig.color.tempBackgroundColor);
}

/**
 * 创建透视相机
 */
const createCamera = () => {
  const aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(
    cameraConfig.fov, 
    aspectRatio, 
    cameraConfig.near, 
    cameraConfig.far
  );
  camera.position.set(
    cameraConfig.position.x,
    cameraConfig.position.y,
    cameraConfig.position.z
  );
  
  // 初始化旋转角度
  pitch = 0;
  yaw = 0;
  
  // 设置初始朝向（看向负Z轴）
  const quaternion = new THREE.Quaternion();
  quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  camera.setRotationFromQuaternion(quaternion);
}

/**
 * 创建WebGL渲染器
 */
const createRenderer = () => {
  if (!sceneRef.value) return;
  
  renderer = new THREE.WebGLRenderer({ 
    antialias: rendererConfig.antialias,
    alpha: rendererConfig.alpha
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = rendererConfig.shadowMap.enabled;
  renderer.shadowMap.type = rendererConfig.shadowMap.type;
  sceneRef.value.appendChild(renderer.domElement);
}

/**
 * 创建场景灯光
 */
const createLights = () => {
  // 创建定向光
  directionalLight = new THREE.DirectionalLight(
    lightConfig.directional.color, 
    lightConfig.directional.intensity
  );
  directionalLight.position.set(
    lightConfig.directional.position.x,
    lightConfig.directional.position.y,
    lightConfig.directional.position.z
  );
  directionalLight.castShadow = true;
  
  // 配置阴影属性
  const shadowConfig = lightConfig.directional.shadow;
  directionalLight.shadow.mapSize.width = shadowConfig.mapSize.width;
  directionalLight.shadow.mapSize.height = shadowConfig.mapSize.height;
  directionalLight.shadow.camera.near = shadowConfig.camera.near;
  directionalLight.shadow.camera.far = shadowConfig.camera.far;
  directionalLight.shadow.camera.left = shadowConfig.camera.left;
  directionalLight.shadow.camera.right = shadowConfig.camera.right;
  directionalLight.shadow.camera.top = shadowConfig.camera.top;
  directionalLight.shadow.camera.bottom = shadowConfig.camera.bottom;
  
  scene.add(directionalLight);

  // 创建环境光
  const ambientLight = new THREE.AmbientLight(
    lightConfig.ambient.color, 
    lightConfig.ambient.intensity
  );
  scene.add(ambientLight);
}

/**
 * 创建场景内容（地面、辅助对象、模型等）
 */
const createSceneContent = () => {
  // 首先创建全景立方体背景
  createPanoramaCube();

  // 创建辅助对象
  createHelpers();
  
  // 创建地面
  createGround();
  
  // 创建咖啡桌模型
  createCoffeeTable();

  // 创建棋盘
  createChessBoard();

  // 创建棋子
  createChessPieces();
}

/**
 * 创建辅助对象（网格、坐标轴）
 */
const createHelpers = () => {
  // 网格辅助对象
  centerGridHelper = new THREE.GridHelper(
    sceneConfig.helpers.grid.size,
    sceneConfig.helpers.grid.divisions,
    sceneConfig.color.helperGridCenterLine,
    sceneConfig.color.helperGrid
  );
  centerGridHelper.position.y = sceneConfig.helpers.grid.position.y;
  scene.add(centerGridHelper);

  // 坐标轴辅助对象
  centerAxesHelper = new THREE.AxesHelper(sceneConfig.helpers.axes.size);
  centerAxesHelper.setColors(sceneConfig.color.axesX, sceneConfig.color.axesY, sceneConfig.color.axesZ);
  scene.add(centerAxesHelper);
}

/**
 * 创建地面
 */
const createGround = () => {
  const groundGeometry = new THREE.PlaneGeometry(
    sceneConfig.S_ground.size.width, 
    sceneConfig.S_ground.size.height
  );
  const groundMaterial = new THREE.MeshLambertMaterial({ 
    color: sceneConfig.S_ground.color,
    transparent: true,
    opacity: sceneConfig.S_ground.opacity
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);
}

/**
 * 创建全景立方体背景
 */
const createPanoramaCube = () => {
  const cubeSize = sceneConfig.panorama.size;
  
  // 创建立方体几何体
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  
  // 创建材质数组
  const materials: THREE.MeshBasicMaterial[] = [];
  
  // 定义六个面的顺序（Three.js默认顺序）
  const sides = [
    { path: sceneConfig.panorama.texturePaths.right, name: 'right' },   // 右 (+X)
    { path: sceneConfig.panorama.texturePaths.left, name: 'left' },     // 左 (-X)
    { path: sceneConfig.panorama.texturePaths.top, name: 'top' },       // 上 (+Y)
    { path: sceneConfig.panorama.texturePaths.bottom, name: 'bottom' }, // 下 (-Y)
    { path: sceneConfig.panorama.texturePaths.front, name: 'front' },   // 前 (+Z)
    { path: sceneConfig.panorama.texturePaths.back, name: 'back' }      // 后 (-Z)
  ];
  
  // 创建纹理加载器
  const textureLoader = new THREE.TextureLoader();
  
  // 为每个面创建材质
  sides.forEach((side, index) => {    
    try {
      const texture = textureLoader.load(side.path);
      
      // 设置纹理参数
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide, // 重要：设置为背面，这样纹理就在立方体内部可见
        transparent: false
      });
      
      materials.push(material);
    } catch (error) {
      console.error(`全景纹理加载失败: ${side.path}`, error);
      // 如果加载失败，使用备用颜色材质
      const fallbackColor = sceneConfig.color.fallBackPanorama[index];
      const material = new THREE.MeshBasicMaterial({
        color: fallbackColor,
        side: THREE.BackSide,
        transparent: false
      });
      materials.push(material);
    }
  });
  
  // 创建立方体网格
  panoramaCube = new THREE.Mesh(geometry, materials);
  panoramaCube.name = 'panorama-cube';
  
  // 将立方体添加到场景
  scene.add(panoramaCube);
}

/**
 * 加载咖啡桌模型
 */
const createCoffeeTable = () => {
  const loader = new GLTFLoader();
  loader.load(
    sceneConfig.S_table.modelPath,
    (gltf) => {
      coffeeTable = gltf.scene;
      
      // 设置咖啡桌的位置和缩放
      coffeeTable.position.set(
        sceneConfig.S_table.position.x,
        sceneConfig.S_table.position.y,
        sceneConfig.S_table.position.z
      );
      coffeeTable.scale.set(
        sceneConfig.S_table.scale,
        sceneConfig.S_table.scale,
        sceneConfig.S_table.scale
      );
      
      // 启用阴影
      coffeeTable.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.name = 'table'; // 为桌子部件命名
        }
      });
      // 获取桌子高度
      const tableBbox = new THREE.Box3().setFromObject(coffeeTable);
      sceneConfig.altitude.S_table = tableBbox.max.y;
      //console.log(`咖啡桌最高点高度: ${sceneConfig.altitude.S_table}`);
      // 添加桌子
      scene.add(coffeeTable);
    },
    undefined,
    (error) => {
      console.error('咖啡桌模型加载失败:', error);
      createFallbackTable();
    }
  );
}

/**
 * 创建备用立方体桌子（如果模型加载失败）
 */
const createFallbackTable = () => {
  const tableGeometry = new THREE.BoxGeometry(1, 0.3, 1);
  const tableMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x8B4513 // 棕色
  });
  const table = new THREE.Mesh(tableGeometry, tableMaterial);
  table.position.y = 0.15;
  table.castShadow = true;
  table.receiveShadow = true;
  table.name = 'table';
  scene.add(table);
  console.log('备用立方体桌子创建完成');
}

/**
 * 加载棋盘模型
 */
const createChessBoard = () => {
  const loader = new GLTFLoader();
  loader.load(
    sceneConfig.S_chess_board.modelPath,
    (gltf) => {
      chessBoard = gltf.scene;
      
      // 设置棋盘的位置和缩放
      chessBoard.position.set(
        sceneConfig.S_chess_board.position.x,
        sceneConfig.S_chess_board.position.y,
        sceneConfig.S_chess_board.position.z
      );
      chessBoard.scale.set(
        sceneConfig.S_chess_board.scale,
        sceneConfig.S_chess_board.scale,
        sceneConfig.S_chess_board.scale
      );
      
      // 启用阴影
      chessBoard.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.name = 'board'; // 为棋盘部件命名
        }
      });
      // 获取棋盘的高度
      const boardBbox = new THREE.Box3().setFromObject(chessBoard);
      sceneConfig.altitude.S_chess_board = boardBbox.max.y;
      //console.log(`棋盘最高点高度: ${sceneConfig.altitude.S_chess_board}`);
      // 添加棋盘到场景中
      scene.add(chessBoard);
    },
    undefined,
    (error) => {
      console.error('棋盘模型加载失败:', error);
      createFallbackChessBoard();
    }
  );
}

/**
 * 创建棋盘
 */
const createFallbackChessBoard = () => {
  const scaleFactor = sceneConfig.F_chess_board.scaleFactor;
  const boardGeometry = new THREE.BoxGeometry(
    sceneConfig.F_chess_board.size.width / scaleFactor,
    sceneConfig.F_chess_board.size.height / scaleFactor,
    sceneConfig.F_chess_board.size.depth / scaleFactor
  );
  const boardMaterial = new THREE.MeshLambertMaterial({ 
    color: sceneConfig.color.fallBackChessBoard
  });
  const board = new THREE.Mesh(boardGeometry, boardMaterial);
  board.position.y = sceneConfig.F_chess_board.position.y;
  board.castShadow = true;
  board.receiveShadow = true;
  board.name = 'board';
  scene.add(board);
  
  console.log('备用棋盘创建完成');
}

/**
 * 创建棋子
 */
const createChessPieces = () => {
  const loader = new GLTFLoader();
  chessPieces = new THREE.Group(); // 创建棋子组
  chessPieces.name = 'chess-pieces-group';
  
  // 遍历棋子配置数组，加载所有棋子模型
  piecesConfig.forEach((pieceConfig, index) => {
    loader.load(
      pieceConfig.modelPath,
      (gltf) => {
        const piece = gltf.scene;
        
        // 设置棋子的位置和缩放
        piece.position.set(
          pieceConfig.position.x,
          pieceConfig.position.y,
          pieceConfig.position.z
        );
        piece.scale.set(
          pieceConfig.scale,
          pieceConfig.scale,
          pieceConfig.scale
        );
        
        // 启用阴影
        piece.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        // 为棋子添加名称标识，便于调试和交互
        piece.name = pieceConfig.name;
        if(index == 0){
          // 获取棋子的模型高度 和 水平偏移值
          const pieceBbox = new THREE.Box3().setFromObject(piece);
          sceneConfig.altitude.S_chess_pieces_max = pieceBbox.max.y;
          sceneConfig.altitude.S_chess_pieces_min = pieceBbox.min.y;
          sceneConfig.altitude.S_chess_pieces_height = sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_min;
          sceneConfig.altitude.S_chess_pieces_max_plus = sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_height;
        }
        // 获取棋子的模型水平偏移值（x和z轴）
        const pos_xyz = {
          x:piece.children[0].position.x,
          y:piece.children[0].position.y,
          z:piece.children[0].position.z,
        };

        // 记录到配置中
        const pieceName = pieceConfig.name as keyof typeof sceneConfig.piecesOffset;
        if (sceneConfig.piecesOffset[pieceName]) {
          sceneConfig.piecesOffset[pieceName].x = pos_xyz.x;
          sceneConfig.piecesOffset[pieceName].y = pos_xyz.y;
          sceneConfig.piecesOffset[pieceName].z = pos_xyz.z;
        }
        
        // 添加到棋子组
        chessPieces.add(piece);
      },
      undefined,
      (error) => {
        console.error(`棋子模型加载失败: ${pieceConfig.modelPath}`, error);
        // 如果棋子加载失败，创建备用棋子
        createFallbackChessPiece(pieceConfig, index);
      }
    );
  });
  
  // 将棋子组添加到场景
  scene.add(chessPieces);
}

/**
 * 创建备用棋子（如果模型加载失败）
 */
const createFallbackChessPiece = (pieceConfig: any, index: number) => {
  // 根据棋子索引确定颜色（黑棋或红棋）
  const isBlack = index < 16; // 前16个是黑棋
  const pieceColor = isBlack ? 0x000000 : 0xff0000;
  
  // 创建简单的圆柱体作为备用棋子
  const pieceGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16);
  const pieceMaterial = new THREE.MeshLambertMaterial({ 
    color: pieceColor 
  });
  const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);
  
  // 设置位置
  piece.position.set(
    pieceConfig.position.x,
    pieceConfig.position.y + 0.075, // 圆柱体高度的一半
    pieceConfig.position.z
  );
  
  // 启用阴影
  piece.castShadow = true;
  piece.receiveShadow = true;
  
  // 添加名称标识
  piece.name = `fallback-chess-piece-${index}`;
  
  // 添加到棋子组
  if (chessPieces) {
    chessPieces.add(piece);
  } else {
    // 如果棋子组不存在，直接添加到场景
    scene.add(piece);
  }
  
  console.log(`备用棋子创建完成: ${pieceConfig.modelPath}`);
}

/**
 * 调试函数：检查全景状态
 */
const debugPanorama = () => {
  if (panoramaCube) {
    console.log('全景立方体信息:');
    console.log('- 位置:', panoramaCube.position);
    console.log('- 缩放:', panoramaCube.scale);
    
    // 检查每个材质的状态
    (panoramaCube.material as THREE.Material[]).forEach((mat, index) => {
      const material = mat as THREE.MeshBasicMaterial;
      console.log(`  材质 ${index}:`, {
        type: material.type,
        map: material.map ? '有纹理' : '无纹理',
        side: material.side,
        transparent: material.transparent
      });
    });
  } else {
    console.log('全景立方体未创建');
  }
}

/**
 * 调试函数：打印各项配置
 */
const debugPrintConfig = () => {
  console.log(sceneConfig.piecesOffset);
  // console.log(piecesConfig);
  // console.log(cameraConfig);
  // console.log(rendererConfig);
  // console.log(lightConfig);
}

/**
 * 调试函数：检查棋子状态
 */
const debugChessPieces = () => {
  if (chessPieces) {
    console.log('棋子组信息:');
    console.log('- 棋子数量:', chessPieces.children.length);
    console.log('- 位置:', chessPieces.position);
    
    // 统计成功加载的棋子数量
    chessPieces.children.forEach((child, index) => {
      console.log(`  棋子 ${index}: ${child.name}`);
    });
  } else {
    console.log('棋子组未创建');
  }
}

/**
 * 窗口大小调整处理
 */
const onWindowResize = () => {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * 动画循环
 */
const animate = () => {
  requestAnimationFrame(animate);
  
  // 计算时间增量
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;
  
  // 更新第一人称移动
  updateFirstPersonMovement(delta);
  
  // 更新棋子跟随视角
  updatePieceFollowing();
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==============================
// 生命周期钩子
// ==============================
onMounted(() => {
  initScene();
  animate();
  //延迟检查全景状态
  // setTimeout(() => {
  //   debugPanorama();
  //   debugChessPieces();
  // }, 2000);
  // setInterval(
  //   ()=>{
  //     debugPrintConfig();
  //   },
  //   6000
  // );
});

onUnmounted(() => {
  // 清理资源
  if (renderer) {
    // 移除事件监听器
    if (renderer.domElement) {
      renderer.domElement.removeEventListener('click', onClick);
    }
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mozpointerlockchange', onPointerLockChange);
    
    renderer.dispose();
  }
  
  if (scene) {
    scene.clear();
  }
  // 移除事件监听
  window.removeEventListener('resize', onWindowResize);
});
</script>

<template>
  <div class="pageBox">
    <div ref="sceneRef" class="chess-container">
    
    </div>
    <div class="crosshair">

    </div>
    <div class="consoleBorad">
      <button @click="testCameraXup">
        camera x +
      </button>
      <button @click="testCameraXdown">
        camera x -
      </button>
      <button @click="testCameraYup">
        camera y +
      </button>
      <button @click="testCameraYdown">
        camera y -
      </button>
      <button @click="testCameraZup">
        camera z +
      </button>
      <button @click="testCameraZdown">
        camera z -
      </button>
      <button @click="testCameraRxup">
        camera rx +
      </button>
      <button @click="testCameraRxdown">
        camera rx -
      </button>
      <button @click="testCameraRyup">
        camera ry +
      </button>
      <button @click="testCameraRydown">
        camera ry -
      </button>
      <button @click="testCameraRzup">
        camera rz +
      </button>
      <button @click="testCameraRzdown">
        camera rz -
      </button>
    </div>
  </div>
</template>

<style scoped>
.pageBox{
  width: 100vw;
  height: 100vh;
}
.consoleBorad{
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 60px;
  z-index: 999;
}
.chess-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  z-index: 10;
  top: 0;
  left: 0;
  overflow: hidden;
  cursor: none; /* 隐藏默认光标 */
}
.crosshair{
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  border: 2px solid white;
  border-radius: 50%;
  background-color: transparent;
  pointer-events: none;
  z-index: 1000;
}
/* 当指针锁定时显示准星 */
.chess-container:fullscreen,
.chess-container:-webkit-full-screen,
.chess-container:-moz-full-screen {
  cursor: none;
}
</style>