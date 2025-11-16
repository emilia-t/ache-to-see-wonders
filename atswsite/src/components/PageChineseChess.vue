<script setup lang="ts">
// The relative position of this file: src/components/PageChineseChess.vue
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sceneConfig, piecesConfig, cameraConfig, rendererConfig, lightConfig } from '@/config/chineseChessConfig.ts';
import ChineseChessInstruct from '@/class/ChineseChessInstruct';
import Tool from '@/class/Tool';
import type LogConfig from '@/interface/LogConfig';
import type InstructObject from '@/interface/InstructObject';
import ViewUserLayer from './ViewUserLayer.vue';
import {CHINESE_CHESS_SERVER_URL} from '@/config/apiConfig.ts';
import ViewHeart from '@/components/ViewHeart.vue'
import PartCc1Loading from './PartCc1Loading.vue';
import PartCc1Start from './PartCc1Start.vue';

type Coord3D = {
  x: number;
  y: number;
  z: number;
};
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
let gGraniteSlate: THREE.Group; // 咖啡桌模型组
let chessBoard: THREE.Group; // 棋盘模型组
let chessPieces: THREE.Group; // 棋子模型组
let panoramaCube: THREE.Mesh; // 全景立方体
let centerGridHelper: THREE.GridHelper; // 参考网格
let centerAxesHelper: THREE.AxesHelper; // 参考坐标轴

// ==============================
// 第一人称视角控制相关变量
// ==============================
let isPointerLocked = false;
const moveState = {forward: false,backward: false,left: false,right: false};
let canJump = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let pitch = 0;// 俯仰角（上下看）
let yaw = 0;// 偏航角（左右看）
const rotationSpeed = 0.002;

// ==============================
// 第一人称棋子操作相关变量
// ==============================
let raycaster: THREE.Raycaster;
let isPicking = false;
let pickedPiece: THREE.Object3D | null = null;
let originalMaterial: THREE.Material | THREE.Material[] | null = null;
let transparentMaterial: THREE.MeshLambertMaterial;

// ==============================
// 棋子状态管理
// ==============================
const chessPiecesState = ref<{ [key: string]: { 
  isPicked: boolean; 
  pickedBy: string; 
  position: { x: number; y: number; z: number };
  lastUpdate: number;
} }>({});

// ==============================
// 棋子材质管理
// ==============================
const pieceOriginalMaterials = new Map<string, THREE.Material | THREE.Material[]>(); // 保存棋子原始材质

// ==============================
// 棋子移动轨迹
// ==============================
let moveTrajectory: Coord3D[] = [];
let lastMoveBroadcastTime = 0;
const MOVE_BROADCAST_INTERVAL = 20; // 20ms = 0.02秒



// ==============================
// 加载状态管理
// ==============================
const loadingState = ref({
  isLoading: true,
  progress: 0,
  statusText: '正在初始化场景...',
  loadedResources: 0,
  totalResources: 0
});


// 创建对子组件的引用
const heartRef = ref<InstanceType<typeof ViewHeart> | null>(null)
const heartStatusText = ref('')

// ==============================
// 通信相关
// ==============================
const ccInstruct = new ChineseChessInstruct(CHINESE_CHESS_SERVER_URL);
ccInstruct.onLog = (message:string,type:'tip'|'warn'|'error',data?:any):LogConfig=>{
  const logConfig = {
    code:0,
    time:Tool.getFormatTime(),
    text:message,
    from:'ChineseChessInstruct',
    type:type,
    data:data
  }
  return logConfig;
};
ccInstruct.onOpen = (ev: Event):void=>{
  console.log("服务器已连接");
  // 获取公钥
  ccInstruct.getPublickey();
  // 自动登录
  const localStorageUserId = localStorage.getItem('user_id');
  const localStorageUserToken = localStorage.getItem('user_token');
  if(localStorageUserId && localStorageUserToken){
    ccInstruct.getTokenLogin(Number(localStorageUserId),localStorageUserToken);
    // 登录成功后请求棋子状态同步
    setTimeout(() => {
      ccInstruct.getSyncChessPieces();
    }, 1000);
  }
};
ccInstruct.onClose = (ev: Event):void=>{
  console.log("服务器断开连接",ev);
};
ccInstruct.onError = (ev: Event):void=>{
  console.log("服务器连接失败",ev);
};
ccInstruct.onMessage = (instructObj: InstructObject):void=>{
  handleServerInstruct(instructObj);
};

/**
 * 处理服务器指令
 */
const handleServerInstruct = (instructObj: InstructObject) => {
  const { type, class: class_, conveyor, data } = instructObj;

  if (type === 'broadcast') {
    switch (class_) {
      case 'pick_up_chess':
        handleBroadcastPickUpChess(conveyor, data);
        break;
      case 'pick_down_chess':
        handleBroadcastPickDownChess(conveyor, data);
        break;
      case 'moving_chess':
        handleBroadcastMovingChess(conveyor, data);
        break;
      case 'reset_all_chess_pieces':
        handleBroadcastResetAllChessPieces(conveyor, data);
        break;
    }
  }
  else if(type === 'sync_chess_pieces'){
    handleSyncChessPieces(data);
  }
  else if(type === 'heart_tk'){
    handleHeartTk();
  }
};

/**
 * 服务器返回点赞事件处理
 */
const handleHeartTk = () => {
  if (heartRef.value) {
    heartRef.value.setLiked(true);
    heartStatusText.value = '已点赞';
  }
}

/**
 * 处理点赞事件
 */
const handleHeart3=()=>{
  ccInstruct.heart3();
};

/**
 * 处理广播的重置所有棋子指令
 */
const handleBroadcastResetAllChessPieces = (conveyor: string, data: any) => {
  console.log(`玩家 ${conveyor} 重置了所有棋子`);
  
  // 重置所有棋子状态
  Object.keys(chessPiecesState.value).forEach(pieceName => {
    chessPiecesState.value[pieceName] = {
      isPicked: false,
      pickedBy: '',
      position: { x: 0, y: 0, z: 0 },
      lastUpdate: Date.now()
    };
    
    // 在场景中重置棋子位置和状态
    const piece = chessPieces?.getObjectByName(pieceName);
    if (piece) {
      // 重置位置
      piece.position.set(0, 0, 0);
      
      // 恢复原始材质
      restorePieceState(piece);
    }
  });
  
  // 如果当前正在拾起棋子，也重置拾起状态
  if (isPicking && pickedPiece) {
    resetPickingState();
  }
  
  console.log("所有棋子已重置到初始位置");
};

/**
 * 处理同步棋子状态指令
 */
const handleSyncChessPieces = (data: any) => {
  const { pieces } = data;
  
  if (!pieces || !Array.isArray(pieces)) {
    console.error('同步棋子数据格式错误');
    return;
  }
  
  // 更新所有棋子状态
  pieces.forEach(pieceData => {
    const { piece_name, position, is_picked, picked_by } = pieceData;
    
    // 更新棋子状态管理
    chessPiecesState.value[piece_name] = {
      isPicked: is_picked,
      pickedBy: picked_by,
      position: position,
      lastUpdate: Date.now()
    };
    
    // 在场景中更新棋子位置和状态
    const piece = chessPieces?.getObjectByName(piece_name);
    if (piece) {
      // 更新位置
      piece.position.set(position.x, position.y, position.z);
      
      // 更新状态显示
      if (is_picked && picked_by) {
        setPieceAsPickedByOther(piece);
      } else {
        restorePieceState(piece);
      }
    }
  });
  
  console.log('棋子状态同步完成');
};

/**
 * 处理广播的拾起棋子指令
 */
const handleBroadcastPickUpChess = (conveyor: string, data: any) => {
  const { piece_name, position } = data;
  
  // 更新棋子状态
  chessPiecesState.value[piece_name] = {
    isPicked: true,
    pickedBy: conveyor,
    position: position,
    lastUpdate: Date.now()
  };
  
  // 在场景中更新棋子状态
  const piece = chessPieces?.getObjectByName(piece_name);
  if (piece) {
    setPieceAsPickedByOther(piece);
  }
  
  console.log(`玩家 ${conveyor} 拾起了棋子 ${piece_name}`);
};

/**
 * 处理广播的放置棋子指令
 */
const handleBroadcastPickDownChess = (conveyor: string, data: any) => {
  const { piece_name, position } = data;
  
  // 更新棋子状态
  chessPiecesState.value[piece_name] = {
    isPicked: false,
    pickedBy: '',
    position: position,
    lastUpdate: Date.now()
  };
  
  // 在场景中更新棋子状态和位置
  const piece = chessPieces?.getObjectByName(piece_name);
  if (piece) {
    restorePieceState(piece); // 这会恢复原始材质
    piece.position.set(position.x, position.y, position.z);
  }
  
  console.log(`玩家 ${conveyor} 放置了棋子 ${piece_name}`);
};

/**
 * 处理广播的移动中棋子指令
 */
const handleBroadcastMovingChess = (conveyor: string, data: any) => {
  const { piece_name, trajectory } = data;
  
  if (trajectory && trajectory.length > 0) {
    const latestPosition = trajectory[trajectory.length - 1];
    
    // 更新棋子状态
    chessPiecesState.value[piece_name] = {
      isPicked: true,
      pickedBy: conveyor,
      position: latestPosition,
      lastUpdate: Date.now()
    };
    
    // 在场景中更新棋子位置
    const piece = chessPieces?.getObjectByName(piece_name);
    if (piece && piece !== pickedPiece) { // 不更新自己正在操作的棋子
      piece.position.set(latestPosition.x, latestPosition.y, latestPosition.z);
    }
  }
};

/**
 * 处理加载完成事件
 */
const handleLoadingComplete = () => {
  console.log('资源加载完毕加载界面已隐藏');
};

/**
 * 重置棋子功能
 */
const resetAllChessPieces = () => {
  ccInstruct.broadcastResetAllChessPieces("");
};

/** 
 *  计算总资源数量
 */
const calculateTotalResources = () => {
  // 全景图6个面 + 花岗岩石板 + 棋盘 + 棋子数量
  const total = 6 + 1 + 1 + piecesConfig.length;
  loadingState.value.totalResources = total;
  return total;
};

/**
 * 更新加载进度
 */
const updateLoadingProgress = (increment = 1, status = '') => {
  loadingState.value.loadedResources += increment;
  const progress = (loadingState.value.loadedResources / loadingState.value.totalResources) * 100;
  loadingState.value.progress = Math.min(100, progress);
  
  if (status) {
    loadingState.value.statusText = status;
  }
  
  // 检查是否所有资源都加载完成
  if (loadingState.value.loadedResources >= loadingState.value.totalResources) {
    setTimeout(() => {
      loadingState.value.isLoading = false;
      loadingState.value.statusText = '场景加载完成！';
    }, 500);
  }
};

/**
 * 设置棋子为被其他玩家拾起状态
 */
const setPieceAsPickedByOther = (piece: THREE.Object3D) => {
  const highlightMaterial = new THREE.MeshLambertMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.6
  });
  materialSetObject(piece, highlightMaterial);
};

/**
 * 恢复棋子状态
 */
const restorePieceState = (piece: THREE.Object3D) => {
  materialRestorePieceOriginal(piece);
};


// ==============================
// 工具函数
// ==============================

/**
 * 创建可交互对象过滤器
 */
const createIntersectableFilter = (excludePiece: THREE.Object3D | null = null) => {
  return (obj: THREE.Object3D) => {
    return obj !== chessPieces && 
           obj !== excludePiece && 
           obj !== centerGridHelper &&
           obj !== centerAxesHelper &&
           obj !== panoramaCube;};
};

/**
 * 应用棋子偏移修正
 */
const applyPieceOffset = (position: THREE.Vector3, pieceName: string) => {
  const offset = sceneConfig.piecesOffset[pieceName as keyof typeof sceneConfig.piecesOffset];
  if (offset) {
    position.x -= offset.x;
    position.y -= offset.y;
    position.z -= offset.z;
  }
  return position;
};

/**
 * 设置对象及其子对象的材质
 */
const materialSetObject = (object: THREE.Object3D, material: THREE.Material) => {
  if (object instanceof THREE.Mesh) {
    //originalMaterial = object.material;// 只在拾起时保存原始材质，不在这里保存
    object.material = material;
  } else {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        //originalMaterial = child.material;// 只在拾起时保存原始材质，不在这里保存
        child.material = material;
      }
    });
  }
};

/**
 * 恢复对象的原始材质
 */
const materialRestoreObject = (object: THREE.Object3D) => {
  materialRestorePieceOriginal(object);
};

/**
 * 保存棋子的原始材质
 */
const materialSavePieceOriginal = (piece: THREE.Object3D) => {
  if (!piece.name) return;
  
  if (piece instanceof THREE.Mesh) {
    pieceOriginalMaterials.set(piece.name, piece.material);
  } else {
    // 对于组对象，收集所有子网格的材质
    const materials: THREE.Material[] = [];
    piece.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        materials.push(child.material);
      }
    });
    if (materials.length > 0) {
      pieceOriginalMaterials.set(piece.name, materials);
    }
  }
};

/**
 * 恢复棋子的原始材质
 */
const materialRestorePieceOriginal = (piece: THREE.Object3D) => {
  if (!piece.name) return;
  
  const originalMaterial = pieceOriginalMaterials.get(piece.name);
  if (!originalMaterial) return;
  
  if (piece instanceof THREE.Mesh && !Array.isArray(originalMaterial)) {
    piece.material = originalMaterial;
  } else if (Array.isArray(originalMaterial)) {
    // 对于组对象，恢复所有子网格的材质
    let materialIndex = 0;
    piece.traverse((child) => {
      if (child instanceof THREE.Mesh && materialIndex < originalMaterial.length) {
        child.material = originalMaterial[materialIndex];
        materialIndex++;
      }
    });
  }
};

// ==============================
// 主要功能函数
// ==============================
const initScene = () => {
  if (!sceneRef.value) return;
  createScene();// 场景
  createCamera();// 相机
  createRenderer();// 渲染器
  createLights();// 灯光
  createPanoramaCube();// 全景图
  createHelpers();// 辅助对象
  createGround();// 地面
  //createCoffeeTable();// 咖啡桌
  createGraniteSlate();
  createChessBoard();// 棋盘
  createChessPieces();// 棋子
  calculateTotalResources();
}

/**
 * 初始化交互系统
 */
const initInteractionSystem = () => {
  raycaster = new THREE.Raycaster();// 初始化射线投射器
  transparentMaterial = new THREE.MeshLambertMaterial({
    transparent: true,
    opacity: sceneConfig.pieceInteraction.transparency,
    color: 0xffffff // 确保透明材质也有基础颜色
  });
  if (renderer.domElement) {// 添加鼠标键盘事件监听
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
  }
  const element = renderer.domElement;// 初始化指针锁定
  element.addEventListener('click', () => {
    if (!isPointerLocked) {
      element.requestPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', onPointerLockChange);// 指针锁定状态变化事件
  document.addEventListener('mozpointerlockchange', onPointerLockChange);
}

/**
 * 指针锁定状态变化处理
 */
const onPointerLockChange = () => {
  const wasPointerLocked = isPointerLocked;
  isPointerLocked = document.pointerLockElement === renderer.domElement;
  
  // 当指针锁定状态变化时，更新光标样式
  if (renderer?.domElement) {
    if (isPointerLocked) {
      // 锁定时光标隐藏
      renderer.domElement.style.cursor = 'none';
    } else {
      // 解除锁定时光标显示为默认
      renderer.domElement.style.cursor = 'default';
    }
  }
}

/**
 * 鼠标点击事件处理
 */
const onClick = (event: MouseEvent) => {
  if (!isPointerLocked) return;
  isPicking ? placePiece() : tryPickPiece();
}

/**
 * 鼠标移动事件处理（第一人称视角控制）
 */
const onMouseMove = (event: MouseEvent) => {
  if (!isPointerLocked) return;
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;
  yaw -= movementX * rotationSpeed;// 使用四元数控制相机旋转，避免万向节锁
  pitch -= movementY * rotationSpeed;
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));// 限制俯仰角范围（避免翻转）
  const quaternion = new THREE.Quaternion();// 使用四元数设置相机旋转
  quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  camera.setRotationFromQuaternion(quaternion);
}

/**
 * 键盘按下事件处理
 */
const onKeyDown = (event: KeyboardEvent) => {
  if (!isPointerLocked) return;
  const keyActions: { [key: string]: () => void } = {
    'ArrowUp': () => moveState.forward = true,
    'KeyW': () => moveState.forward = true,
    'ArrowLeft': () => moveState.left = true,
    'KeyA': () => moveState.left = true,
    'ArrowDown': () => moveState.backward = true,
    'KeyS': () => moveState.backward = true,
    'ArrowRight': () => moveState.right = true,
    'KeyD': () => moveState.right = true,
    'Space': () => {
      if (canJump) {
        velocity.y += sceneConfig.firstPerson.jumpForce;
        canJump = false;
      }
    }
  };
  keyActions[event.code]?.();
}

/**
 * 键盘释放事件处理
 */
const onKeyUp = (event: KeyboardEvent) => {
  if (!isPointerLocked) return;
  const keyActions: { [key: string]: () => void } = {
    'ArrowUp': () => moveState.forward = false,
    'KeyW': () => moveState.forward = false,
    'ArrowLeft': () => moveState.left = false,
    'KeyA': () => moveState.left = false,
    'ArrowDown': () => moveState.backward = false,
    'KeyS': () => moveState.backward = false,
    'ArrowRight': () => moveState.right = false,
    'KeyD': () => moveState.right = false
  };
  keyActions[event.code]?.();
}

/**
 * 尝试拿起棋子
 */
const tryPickPiece = () => {
  if (isPicking || !chessPieces) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(chessPieces.children, true);
  
  if (intersects.length > 0) {
    let piece = intersects[0].object;
    while (piece.parent && piece.parent !== chessPieces && piece.parent !== scene) {
      piece = piece.parent;
    }
    if (chessPieces.children.includes(piece)) {
      // 检查棋子是否已被其他玩家拾起
      const pieceState = chessPiecesState.value[piece.name];
      if (pieceState && pieceState.isPicked && pieceState.pickedBy) {
        console.log(`棋子 ${piece.name} 已被玩家 ${pieceState.pickedBy} 拾起，无法操作`);
        return;
      }
      
      pickUpPiece(piece);
      
      // 发送拾起棋子指令到服务器
      const position = {
        x: piece.position.x,
        y: piece.position.y,
        z: piece.position.z
      };
      ccInstruct.broadcastPickUpChess('',piece.name, position);
      
      // 初始化移动轨迹
      moveTrajectory = [position];
      lastMoveBroadcastTime = Date.now();
    }
  }
}

/**
 * 拿起棋子
 */
const pickUpPiece = (piece: THREE.Object3D) => {
  isPicking = true;
  pickedPiece = piece;
  materialSetObject(piece, transparentMaterial);
}

/**
 * 放下棋子
 */
const placePiece = () => {
  if (!pickedPiece) return;
  
  const pieceName = pickedPiece.name;
  if (!pieceName) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersectableObjects = scene.children.filter(createIntersectableFilter(pickedPiece));
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  if (intersects.length === 0) return;
  
  const targetPosition = intersects[0].point.clone();
  const adjustedPosition = applyPieceOffset(targetPosition, pieceName);
  pickedPiece.position.copy(adjustedPosition);
  
  // 恢复原始材质
  materialRestoreObject(pickedPiece);
  
  // 发送放置棋子指令到服务器
  const position = {
    x: pickedPiece.position.x,
    y: pickedPiece.position.y,
    z: pickedPiece.position.z
  };
  ccInstruct.broadcastPickDownChess('', pieceName, position);
  
  // 清理移动轨迹
  moveTrajectory = [];
  
  resetPickingState();
}

/**
 * 重置拾取状态
 */
const resetPickingState = () => {
  isPicking = false;
  pickedPiece = null;
  originalMaterial = null;
}

/**
 * 更新棋子跟随视角
 * 注意：为了让玩家可视化棋子的放置点，如果视线与棋盘或桌子存在交叉点则这个棋子应该在桌子或棋盘之上，否则默认悬浮在视线的前方。
 */
const updatePieceFollowing = () => {
  if (!isPicking || !pickedPiece) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersectableObjects = scene.children.filter(createIntersectableFilter(pickedPiece));
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  let targetPosition: THREE.Vector3;
  
  if (intersects.length > 0) {
    const intersect = intersects[0];
    targetPosition = intersect.point.clone();
    
    const bbox = new THREE.Box3().setFromObject(pickedPiece);
    const bottomOffset = bbox.min.y;
    targetPosition.y -= bottomOffset;
    
    const pieceName = pickedPiece.name as keyof typeof sceneConfig.piecesOffset;
    if (sceneConfig.piecesOffset[pieceName]) {
      targetPosition.x -= sceneConfig.piecesOffset[pieceName].x;
      targetPosition.z -= sceneConfig.piecesOffset[pieceName].z;
    }
    
    targetPosition.y += 0.001;
  } 
  else {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    targetPosition = camera.position.clone().add(direction.multiplyScalar(0.1));
  }
  
  pickedPiece.position.lerp(targetPosition, sceneConfig.pieceInteraction.followSpeed);
  
  // 记录移动轨迹并定期发送
  const currentTime = Date.now();
  if (currentTime - lastMoveBroadcastTime >= MOVE_BROADCAST_INTERVAL) {
    const currentPosition = {
      x: pickedPiece.position.x,
      y: pickedPiece.position.y,
      z: pickedPiece.position.z
    };
    
    moveTrajectory.push(currentPosition);
    
    // 限制轨迹长度，避免数据过大
    if (moveTrajectory.length > 10) {
      moveTrajectory = moveTrajectory.slice(-10);
    }
    
    // 发送移动中棋子指令
    ccInstruct.broadcastMovingChess('',pickedPiece.name, moveTrajectory);
    
    lastMoveBroadcastTime = currentTime;
  }
}

/**
 * 更新第一人称移动
 */
const updateFirstPersonMovement = (delta: number) => {
  if (!isPointerLocked) return;
  
  velocity.x -= velocity.x * 10.0 * delta;// 根据移动方向更新速度
  velocity.z -= velocity.z * 10.0 * delta;
  
  direction.z = Number(moveState.forward) - Number(moveState.backward);
  direction.x = Number(moveState.right) - Number(moveState.left);
  direction.normalize();// 确保对角线移动不会更快
  
  if (!moveState.forward && !moveState.backward && !moveState.left && !moveState.right) {// 如果没有移动输入，确保速度归零
    velocity.x = 0;
    velocity.z = 0;
  }
  
  if (moveState.forward || moveState.backward || moveState.left || moveState.right) {// 使用相机的方向来正确计算移动
    const cameraDirection = new THREE.Vector3();// 获取相机的方向向量（看向的方向）
    camera.getWorldDirection(cameraDirection);

    const cameraRight = new THREE.Vector3();// 创建右侧方向向量（相机的右侧）
    cameraRight.crossVectors(cameraDirection, camera.up).normalize();
    
    const moveDirection = new THREE.Vector3(0, 0, 0);// 重置移动方向
    
    if (moveState.forward) moveDirection.add(cameraDirection);// 前后移动：沿着相机看向的方向
    if (moveState.backward) moveDirection.sub(cameraDirection);
    if (moveState.left) moveDirection.sub(cameraRight);// 左右移动：沿着相机右侧方向
    if (moveState.right) moveDirection.add(cameraRight);
    
    moveDirection.y = 0;// 移除Y轴分量，确保只在水平面移动
    moveDirection.normalize();
    
    velocity.x += moveDirection.x * sceneConfig.firstPerson.moveSpeed * delta;// 应用移动速度
    velocity.z += moveDirection.z * sceneConfig.firstPerson.moveSpeed * delta;
  }
  
  velocity.y -= sceneConfig.firstPerson.gravity * delta;// 应用重力
  
  camera.position.x += velocity.x * delta;// 移动相机 - 使用直接位置更新而不是translate
  camera.position.y += velocity.y * delta;
  camera.position.z += velocity.z * delta;
  
  if (camera.position.y < sceneConfig.firstPerson.playerHeight) {// 简单的碰撞检测（防止穿过地面）
    velocity.y = 0;
    camera.position.y = sceneConfig.firstPerson.playerHeight;
    canJump = true;
  }
}

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
  pitch = 0;// 初始化旋转角度
  yaw = 0;
  const quaternion = new THREE.Quaternion();// 设置初始朝向（看向负Z轴）
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
  directionalLight = new THREE.DirectionalLight(// 创建定向光
    lightConfig.directional.color, 
    lightConfig.directional.intensity
  );
  directionalLight.position.set(
    lightConfig.directional.position.x,
    lightConfig.directional.position.y,
    lightConfig.directional.position.z
  );
  directionalLight.castShadow = true;
  const shadowConfig = lightConfig.directional.shadow;// 配置阴影属性
  directionalLight.shadow.mapSize.width = shadowConfig.mapSize.width;
  directionalLight.shadow.mapSize.height = shadowConfig.mapSize.height;
  directionalLight.shadow.camera.near = shadowConfig.camera.near;
  directionalLight.shadow.camera.far = shadowConfig.camera.far;
  directionalLight.shadow.camera.left = shadowConfig.camera.left;
  directionalLight.shadow.camera.right = shadowConfig.camera.right;
  directionalLight.shadow.camera.top = shadowConfig.camera.top;
  directionalLight.shadow.camera.bottom = shadowConfig.camera.bottom;
  scene.add(directionalLight);
  const ambientLight = new THREE.AmbientLight(// 创建环境光
    lightConfig.ambient.color, 
    lightConfig.ambient.intensity
  );
  scene.add(ambientLight);
}

/**
 * 创建辅助对象（网格、坐标轴）
 */
const createHelpers = () => {
  centerGridHelper = new THREE.GridHelper(// 网格辅助对象
    sceneConfig.helpers.grid.size,
    sceneConfig.helpers.grid.divisions,
    sceneConfig.color.helperGridCenterLine,
    sceneConfig.color.helperGrid
  );
  centerGridHelper.position.y = sceneConfig.helpers.grid.position.y;
  scene.add(centerGridHelper);
  centerAxesHelper = new THREE.AxesHelper(sceneConfig.helpers.axes.size);// 坐标轴辅助对象
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
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const sides = [
    { path: sceneConfig.panorama.texturePaths.right, name: 'right' },
    { path: sceneConfig.panorama.texturePaths.left, name: 'left' },
    { path: sceneConfig.panorama.texturePaths.top, name: 'top' },
    { path: sceneConfig.panorama.texturePaths.bottom, name: 'bottom' },
    { path: sceneConfig.panorama.texturePaths.front, name: 'front' },
    { path: sceneConfig.panorama.texturePaths.back, name: 'back' }
  ];
  
  const textureLoader = new THREE.TextureLoader();
  let loadedTextures = 0;
  const totalTextures = sides.length;
  
  const materials = sides.map((side, index) => {
    return new Promise<THREE.Material>((resolve) => {
      try {
        const texture = textureLoader.load(
          side.path,
          () => {
            // 纹理加载成功
            loadedTextures++;
            updateLoadingProgress(1, `加载全景纹理... (${loadedTextures}/${totalTextures})`);
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.BackSide,
              transparent: false
            });
            resolve(material);
          },
          undefined,
          (error) => {
            // 纹理加载失败，使用回退颜色
            console.error(`全景纹理加载失败: ${side.path}`, error);
            loadedTextures++;
            updateLoadingProgress(1, `加载全景纹理... (${loadedTextures}/${totalTextures})`);
            
            const fallbackColor = sceneConfig.color.fallBackPanorama[index];
            const material = new THREE.MeshBasicMaterial({
              color: fallbackColor,
              side: THREE.BackSide,
              transparent: false
            });
            resolve(material);
          }
        );
      } catch (error) {
        // 加载异常处理
        console.error(`全景纹理加载异常: ${side.path}`, error);
        loadedTextures++;
        updateLoadingProgress(1, `加载全景纹理... (${loadedTextures}/${totalTextures})`);
        
        const fallbackColor = sceneConfig.color.fallBackPanorama[index];
        const material = new THREE.MeshBasicMaterial({
          color: fallbackColor,
          side: THREE.BackSide,
          transparent: false
        });
        resolve(material);
      }
    });
  });

  // 等待所有材质加载完成
  Promise.all(materials).then((loadedMaterials) => {
    panoramaCube = new THREE.Mesh(geometry, loadedMaterials);
    panoramaCube.name = 'panorama-cube';
    scene.add(panoramaCube);
    console.log('全景图加载完成');
  });
};

/**
 * 创建/加载外部模型
 * @param modelPath 模型文件路径
 * @param position 初始化位置
 * @param scale 初始化缩放比
 * @param name 模型名称
 * @param onLoad 加载完毕回调事件
 */
const createModel = (
  modelPath: string, 
  position: { x: number, y: number, z: number }, 
  scale: number,
  name: string,
  onLoad?: (group: THREE.Group) => void
) => {
  const loader = new GLTFLoader();
  
  updateLoadingProgress(0, `加载${name}模型...`);
  
  loader.load(
    modelPath,
    (gltf) => {
      const model = gltf.scene;
      model.position.set(position.x, position.y, position.z);
      model.scale.set(scale, scale, scale);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.name = name;
        }
      });
      
      // 计算模型高度
      const bbox = new THREE.Box3().setFromObject(model);
      const altitudeKey = name === 'table' ? 'S_table' : 'S_chess_board';
      sceneConfig.altitude[altitudeKey] = bbox.max.y;
      
      onLoad?.(model);
      scene.add(model);
      
      // 更新加载进度
      updateLoadingProgress(1, `${name}模型加载完成`);
    },
    (progress) => {
      // 加载进度更新
      const percent = (progress.loaded / progress.total) * 100;
      loadingState.value.statusText = `加载${name}模型... ${Math.round(percent)}%`;
    },
    (error) => {
      console.error(`${name}模型加载失败:`, error);
      // 即使加载失败也要更新进度
      updateLoadingProgress(1, `${name}模型加载失败，使用默认设置`);
    }
  );
};

/**
 * 加载咖啡桌模型
 */
const createCoffeeTable = () => {
  createModel(
    sceneConfig.S_table.modelPath,
    sceneConfig.S_table.position,
    sceneConfig.S_table.scale,
    'table',
    (model) => { coffeeTable = model; }
  );
}

/**
 * 加载花岗岩石板模型
 */
const createGraniteSlate = () => {
  createModel(
    sceneConfig.S_granite_slate.modelPath,
    sceneConfig.S_granite_slate.position,
    sceneConfig.S_granite_slate.scale,
    'slate',
    (model) => { gGraniteSlate = model; }
  );
}

/**
 * 加载棋盘模型
 */
const createChessBoard = () => {
  createModel(
    sceneConfig.S_chess_board.modelPath,
    sceneConfig.S_chess_board.position,
    sceneConfig.S_chess_board.scale,
    'board',
    (model) => { chessBoard = model; }
  );
}

/**
 * 创建棋子
 */
const createChessPieces = () => {
  const loader = new GLTFLoader();
  chessPieces = new THREE.Group();
  chessPieces.name = 'chess-pieces-group';
  
  let loadedPieces = 0;
  const totalPieces = piecesConfig.length;
  
  piecesConfig.forEach((pieceConfig, index) => {
    updateLoadingProgress(0, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
    
    loader.load(
      pieceConfig.modelPath,
      (gltf) => {
        const piece = gltf.scene;
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
        piece.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        piece.name = pieceConfig.name;
        
        // 保存棋子的原始材质
        materialSavePieceOriginal(piece);
        
        // 计算棋子尺寸（只在第一个棋子时计算）
        if (index === 0) {
          const pieceBbox = new THREE.Box3().setFromObject(piece);
          sceneConfig.altitude.S_chess_pieces_max = pieceBbox.max.y;
          sceneConfig.altitude.S_chess_pieces_min = pieceBbox.min.y;
          sceneConfig.altitude.S_chess_pieces_height = 
            sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_min;
          sceneConfig.altitude.S_chess_pieces_max_plus = 
            sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_height;
        }
        
        // 记录棋子偏移
        const pos_xyz = {
          x: piece.children[0].position.x,
          y: piece.children[0].position.y,
          z: piece.children[0].position.z,
        };
        const pieceName = pieceConfig.name as keyof typeof sceneConfig.piecesOffset;
        if (sceneConfig.piecesOffset[pieceName]) {
          sceneConfig.piecesOffset[pieceName].x = pos_xyz.x;
          sceneConfig.piecesOffset[pieceName].y = pos_xyz.y - (sceneConfig.altitude.S_chess_pieces_height/2);
          sceneConfig.piecesOffset[pieceName].z = pos_xyz.z;
        }
        
        chessPieces.add(piece);
        loadedPieces++;
        updateLoadingProgress(1, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
      },
      undefined,
      (error) => {
        console.error(`棋子模型加载失败: ${pieceConfig.modelPath}`, error);
        loadedPieces++;
        updateLoadingProgress(1, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
      }
    );
  });
  scene.add(chessPieces);
};

/**
 * 动画循环
 */
const animate = () => {
  requestAnimationFrame(animate);
  const time = performance.now();// 计算时间增量
  const delta = (time - prevTime) / 1000;
  prevTime = time;
  updateFirstPersonMovement(delta);// 更新第一人称移动
  updatePieceFollowing();// 更新棋子跟随视角
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==============================
// 生命周期钩子
// ==============================
onMounted(() => {
  window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  initScene();
  initInteractionSystem();
  animate();
});

onUnmounted(() => {
  if (renderer) {// 清理资源
    if (renderer.domElement) {// 移除事件监听器
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.style.cursor = 'default';
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
});
</script>
<template>
  <div class="pageBox">
    <div ref="sceneRef" class="chess-container"></div>
    <div class="crosshair"></div>
    <!-- 重置棋子按钮 -->
    <div class="reset-button-container">
      <button class="reset-button" @click="resetAllChessPieces" title="重置所有棋子到初始位置">
        重置棋子
      </button>
    </div>
    <view-user-layer theme="light" design="C"/>
    <ViewHeart @like-change="handleHeart3" ref="heartRef" label="Like" />
    <PartCc1Start/>
    <PartCc1Loading :loading-state="loadingState" @loading-complete="handleLoadingComplete"/>
  </div>
</template>
<style scoped>
.chess-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  z-index: 10;
  top: 0;
  left: 0;
  overflow: hidden;
}

.pageBox{
  width: 100vw;
  height: 100vh;
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
  z-index: 100;
}
/* 保持全屏状态下的样式不变 */
.chess-container:fullscreen,
.chess-container:-webkit-full-screen,
.chess-container:-moz-full-screen {
  /* 保留全屏时的光标隐藏 */
  cursor: none;
}

/* 重置棋子按钮 */
.reset-button-container {
  position: fixed;
  bottom: 80px; /* 在控制台上方 */
  left: 20px;
  z-index: 100;
}

.reset-button {
  padding: 10px 16px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  transition: all 0.3s ease;
  min-width: 100px;
}

.reset-button:hover {
  background: linear-gradient(135deg, #ff5252, #e53935);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 107, 107, 0.4);
}

.reset-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.reset-button:disabled {
  background: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .reset-button-container {
    bottom: 70px;
    left: 10px;
  }
  
  .reset-button {
    padding: 8px 12px;
    font-size: 12px;
    min-width: 80px;
  }
}
</style>