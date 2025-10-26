<script setup lang="ts">
// The relative position of this file: src/components/PageChineseChess.vue
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sceneConfig, piecesConfig, cameraConfig, rendererConfig, lightConfig } from '@/config/chineseChessConfig.ts';

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
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false
};
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
           obj !== panoramaCube;
  };
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
const setObjectMaterial = (object: THREE.Object3D, material: THREE.Material) => {
  if (object instanceof THREE.Mesh) {
    originalMaterial = object.material;
    object.material = material;
  } else {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalMaterial = child.material;
        child.material = material;
      }
    });
  }
};

/**
 * 恢复对象的原始材质
 */
const restoreObjectMaterial = (object: THREE.Object3D) => {
  if (object instanceof THREE.Mesh && originalMaterial) {
    object.material = originalMaterial as THREE.Material;
  } else {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && originalMaterial) {
        child.material = originalMaterial as THREE.Material;
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
  createCoffeeTable();// 咖啡桌
  createChessBoard();// 棋盘
  createChessPieces();// 棋子
}

/**
 * 初始化交互系统
 */
const initInteractionSystem = () => {
  raycaster = new THREE.Raycaster();// 初始化射线投射器
  
  transparentMaterial = new THREE.MeshLambertMaterial({// 创建透明材质用于拿起状态
    transparent: true,
    opacity: sceneConfig.pieceInteraction.transparency
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
  isPointerLocked = document.pointerLockElement === renderer.domElement;
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
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);// 从屏幕中心发射射线（第一人称视角）
  const intersects = raycaster.intersectObjects(chessPieces.children, true);// 与棋子的交点
  
  if (intersects.length > 0) {
    let piece = intersects[0].object;
    while (piece.parent && piece.parent !== chessPieces && piece.parent !== scene) {// 向上查找父对象，直到找到棋子组中的直接子对象
      piece = piece.parent;
    }
    
    if (chessPieces.children.includes(piece)) {
      pickUpPiece(piece);
    }
  }
}

/**
 * 拿起棋子
 */
const pickUpPiece = (piece: THREE.Object3D) => {
  isPicking = true;
  pickedPiece = piece;
  setObjectMaterial(piece, transparentMaterial);
}

/**
 * 放下棋子
 */
const placePiece = () => {
  if (!pickedPiece) return;
  
  const pieceName = pickedPiece.name as keyof typeof sceneConfig.piecesOffset;
  if (!pieceName) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);// 从屏幕中心发射射线检测放置位置
  const intersectableObjects = scene.children.filter(createIntersectableFilter(pickedPiece));// 检测与场景中物体的交点（排除棋子自身）
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  if (intersects.length === 0) return;
  
  const targetPosition = intersects[0].point.clone();
  const adjustedPosition = applyPieceOffset(targetPosition, pieceName);
  pickedPiece.position.copy(adjustedPosition);
  
  restoreObjectMaterial(pickedPiece);
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
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);// 从屏幕中心发射射线（视野中心线）
  const intersectableObjects = scene.children.filter(createIntersectableFilter(pickedPiece));// 检测与场景中物体的交点（排除棋子自身和辅助对象）
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  let targetPosition: THREE.Vector3;
  
  if (intersects.length > 0) {
    const intersect = intersects[0];// 找到第一个有效的交点
    targetPosition = intersect.point.clone();
    
    const bbox = new THREE.Box3().setFromObject(pickedPiece);// 计算棋子底部偏移
    const bottomOffset = bbox.min.y;
    targetPosition.y -= bottomOffset;
    
    const pieceName = pickedPiece.name as keyof typeof sceneConfig.piecesOffset;// 应用水平偏移修正
    if (sceneConfig.piecesOffset[pieceName]) {
      targetPosition.x -= sceneConfig.piecesOffset[pieceName].x;
      targetPosition.z -= sceneConfig.piecesOffset[pieceName].z;
    }
    
    targetPosition.y += 0.001;// 稍微抬起来一点避免穿模
  } 
  else {// 默认悬浮位置
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    targetPosition = camera.position.clone().add(direction.multiplyScalar(0.1));
  }
  pickedPiece.position.lerp(targetPosition, sceneConfig.pieceInteraction.followSpeed);// 平滑移动到目标位置
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
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);// 创建立方体几何体
  
  const sides = [// 定义六个面的顺序（Three.js默认顺序）
    { path: sceneConfig.panorama.texturePaths.right, name: 'right' },
    { path: sceneConfig.panorama.texturePaths.left, name: 'left' },
    { path: sceneConfig.panorama.texturePaths.top, name: 'top' },
    { path: sceneConfig.panorama.texturePaths.bottom, name: 'bottom' },
    { path: sceneConfig.panorama.texturePaths.front, name: 'front' },
    { path: sceneConfig.panorama.texturePaths.back, name: 'back' }
  ];
  
  const textureLoader = new THREE.TextureLoader();// 创建纹理加载器
  const materials = sides.map((side, index) => {// 为每个面创建材质
    try {
      const texture = textureLoader.load(side.path);// 设置纹理参数
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      
      return new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        transparent: false
      });
    } catch (error) {
      console.error(`全景纹理加载失败: ${side.path}`, error);
      const fallbackColor = sceneConfig.color.fallBackPanorama[index];
      return new THREE.MeshBasicMaterial({
        color: fallbackColor,
        side: THREE.BackSide,// 重要：设置图片为内在面
        transparent: false
      });
    }
  });
  
  panoramaCube = new THREE.Mesh(geometry, materials);// 创建立方体网格
  panoramaCube.name = 'panorama-cube';
  scene.add(panoramaCube);
}

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
    },
    undefined,
    (error) => {
      console.error(`${name}模型加载失败:`, error);
    }
  );
}

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
  
  piecesConfig.forEach((pieceConfig, index) => {
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
          sceneConfig.piecesOffset[pieceName].y = pos_xyz.y;
          sceneConfig.piecesOffset[pieceName].z = pos_xyz.z;
        }
        
        chessPieces.add(piece);
      },
      undefined,
      (error) => {
        console.error(`棋子模型加载失败: ${pieceConfig.modelPath}`, error);
      }
    );
  });
  
  scene.add(chessPieces);
}

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
    <div class="consoleBorad"></div>
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
  cursor: none;
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
.chess-container:fullscreen,
.chess-container:-webkit-full-screen,
.chess-container:-moz-full-screen {
  cursor: none;
}
</style>