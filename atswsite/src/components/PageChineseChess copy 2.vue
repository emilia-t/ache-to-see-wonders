<script setup lang="ts">
// The relative position of this file: src/components/PageChineseChess.vue
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {sceneConfig,piecesConfig,cameraConfig,rendererConfig,lightConfig}from '@/config/chineseChessConfig.ts';

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
let originalMaterial: THREE.Material | THREE.Material[] | null = null;
let transparentMaterial: THREE.MeshLambertMaterial;

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
    }
  );
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
    }
  );
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
      }
    );
  });
  
  // 将棋子组添加到场景
  scene.add(chessPieces);
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
  window.addEventListener('resize', ()=>{
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  initScene();
  initInteractionSystem();
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
});
</script>

<template>
  <div class="pageBox">
    <div ref="sceneRef" class="chess-container">
    
    </div>
    <div class="crosshair">

    </div>
    <div class="consoleBorad">
      
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