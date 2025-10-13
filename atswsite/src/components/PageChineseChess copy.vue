<script setup lang="ts">
// The relative position of this file: src/components/PageChineseChess.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 场景引用
const sceneRef = ref<HTMLDivElement>();

// 场景和渲染器变量
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let directionalLight: THREE.DirectionalLight;
let coffeeTable: THREE.Group; // 咖啡桌模型组

// 场景配置
const sceneConfig = {
  // 地面配置
  ground: {
    size: { width: 200, height: 200 },
    color: 0xffffff
  },
  
  // 桌子配置 (更新为咖啡桌的尺寸)
  table: {
    scale: 1, // 缩放因子，使咖啡桌适配场景
    position: { x: 0, y: 0, z: 0 }
  },
  
  // 棋盘配置
  board: {
    size: { width: 48, height: 2, depth: 48 },
    color: 0xe6cb63,
    position: { y: 1.005 } // 调整棋盘高度使其在咖啡桌上方
  },
  
  // 场景背景色
  backgroundColor: 0x87CEEB
};

// 棋子配置
const piecesConfig = {
  // 棋子几何属性
  geometry: {
    radiusTop: 1.8,
    radiusBottom: 1.8,
    height: 1.3,
    radialSegments: 32
  },
  
  // 棋子材质
  material: {
    color: 0xc13b29
  },
  
  // 棋子位置计算
  positions: {
    boardWidth: 40,
    boardLength: 40,
    gridCols: 8,  // 棋盘列数
    gridRows: 9   // 棋盘行数
  }
};

// 相机配置
const cameraConfig = {
  position: { x: 0, y: 1.5, z: 2.4 }, // 调整相机位置以更好地观察咖啡桌
  fov: 60,
  near: 0.1,
  far: 100
};

// 灯光配置
const lightConfig = {
  directional: {
    color: 0xffffff,
    intensity: 2.0,
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
  ambient: {
    color: 0x404040,
    intensity: 0.6 // 增加环境光强度以更好地显示模型细节
  }
};

onMounted(() => {
  initScene();
  animate();
})

onUnmounted(() => {
  // 清理资源
  if (renderer) {
    renderer.dispose();
  }
  if (scene) {
    scene.clear();
  }
})

// 初始化场景
const initScene = () => {
  if (!sceneRef.value) return;

  // 1. 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneConfig.backgroundColor);

  // 2. 创建相机
  const aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(
    cameraConfig.fov, 
    aspectRatio, 
    cameraConfig.near, 
    cameraConfig.far
  );
  // 设置相机位置
  camera.position.set(
    cameraConfig.position.x,
    cameraConfig.position.y,
    cameraConfig.position.z
  );
  
  // 3. 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sceneRef.value.appendChild(renderer.domElement);

  // 4. 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // 设置控制器目标点，让相机看向场景中心
  controls.target.set(0, 0.3, 0);
  controls.update();

  // 5. 添加灯光
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
  directionalLight.shadow.mapSize.width = lightConfig.directional.shadow.mapSize.width;
  directionalLight.shadow.mapSize.height = lightConfig.directional.shadow.mapSize.height;
  directionalLight.shadow.camera.near = lightConfig.directional.shadow.camera.near;
  directionalLight.shadow.camera.far = lightConfig.directional.shadow.camera.far;
  directionalLight.shadow.camera.left = lightConfig.directional.shadow.camera.left;
  directionalLight.shadow.camera.right = lightConfig.directional.shadow.camera.right;
  directionalLight.shadow.camera.top = lightConfig.directional.shadow.camera.top;
  directionalLight.shadow.camera.bottom = lightConfig.directional.shadow.camera.bottom;
  scene.add(directionalLight);

  // 添加环境光
  const ambientLight = new THREE.AmbientLight(
    lightConfig.ambient.color, 
    lightConfig.ambient.intensity
  );
  scene.add(ambientLight);

  // 6. 添加3D网格坐标系
  const gridHelper = new THREE.GridHelper(2, 10, 0x0000ff, 0x808080);
  gridHelper.position.y = -0.01; // 稍微低于地面避免z-fighting
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(1);
  scene.add(axesHelper);

  // 7. 创建地面
  const groundGeometry = new THREE.PlaneGeometry(
    sceneConfig.ground.size.width, 
    sceneConfig.ground.size.height
  );
  const groundMaterial = new THREE.MeshLambertMaterial({ 
    color: sceneConfig.ground.color 
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; // 让平面水平
  ground.receiveShadow = true;
  scene.add(ground);

  // 8. 加载咖啡桌模型
  loadCoffeeTable();

  // 9. 创建棋盘和棋子
  createChessBoardAndPieces();

  // 窗口大小调整事件
  window.addEventListener('resize', onWindowResize);
}

// 加载咖啡桌模型
const loadCoffeeTable = () => {
  const loader = new GLTFLoader();
  loader.load(
    '/gltf/CoffeeTable1/CoffeeTable1.json',
    (gltf) => {
      coffeeTable = gltf.scene;
      
      // 设置咖啡桌的位置和缩放
      coffeeTable.position.set(
        sceneConfig.table.position.x,
        sceneConfig.table.position.y,
        sceneConfig.table.position.z
      );
      coffeeTable.scale.set(
        sceneConfig.table.scale,
        sceneConfig.table.scale,
        sceneConfig.table.scale
      );
      
      // 启用阴影
      coffeeTable.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      scene.add(coffeeTable);
      console.log('咖啡桌模型加载成功');
      
      // 模型加载后，调整棋盘位置使其位于咖啡桌上方
      adjustBoardPosition();
    },
    undefined,
    (error) => {
      console.error('咖啡桌模型加载失败:', error);
      // 如果模型加载失败，创建备用立方体桌子
      createFallbackTable();
    }
  );
}

// 创建备用立方体桌子（如果模型加载失败）
const createFallbackTable = () => {
  const tableGeometry = new THREE.BoxGeometry(1, 0.3, 1);
  const tableMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x8B4513 // 棕色
  });
  const table = new THREE.Mesh(tableGeometry, tableMaterial);
  table.position.y = 0.15;
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);
  console.log('创建备用立方体桌子');
}

// 调整棋盘位置使其位于咖啡桌上方
const adjustBoardPosition = () => {
  // 这里可以根据咖啡桌的实际高度调整棋盘位置
  // 目前使用预设的位置
}

// 创建棋盘和棋子
const createChessBoardAndPieces = () => {
  // 棋盘
  const boardGeometry = new THREE.BoxGeometry(
    sceneConfig.board.size.width / 100, // 缩小棋盘以适应咖啡桌
    sceneConfig.board.size.height / 100,
    sceneConfig.board.size.depth / 100
  );
  const boardMaterial = new THREE.MeshLambertMaterial({ 
    color: sceneConfig.board.color 
  });
  const board = new THREE.Mesh(boardGeometry, boardMaterial);
  board.position.y = sceneConfig.board.position.y;
  board.castShadow = true;
  board.receiveShadow = true;
  scene.add(board);

  // 创建棋子几何体
  const pieceGeometry = new THREE.CylinderGeometry(
    piecesConfig.geometry.radiusTop / 100,
    piecesConfig.geometry.radiusBottom / 100,
    piecesConfig.geometry.height / 100,
    piecesConfig.geometry.radialSegments
  );
  const pieceMaterial = new THREE.MeshLambertMaterial({ 
    color: piecesConfig.material.color 
  });

  // 计算棋子位置
  const piecePositions = calculatePiecePositions();

  // 创建所有棋子
  piecePositions.forEach((pos, index) => {
    const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);
    piece.position.set(
      pos.x / 100, 
      sceneConfig.board.position.y + sceneConfig.board.size.height / 115, 
      pos.z / 100
    );
    piece.castShadow = true;
    piece.receiveShadow = true;
    
    // 给棋子命名以便后续识别
    piece.name = `chess-piece-${index}`;
    scene.add(piece);
  });
}

// 计算棋子位置
const calculatePiecePositions = () => {
  const positions = [];
  const boardWidth = piecesConfig.positions.boardWidth;
  const boardLength = piecesConfig.positions.boardLength;
  const gridSizeX = boardWidth / piecesConfig.positions.gridCols;
  const gridSizeZ = boardLength / piecesConfig.positions.gridRows;

  // 红方棋子 (下方)
  for (let i = 0; i < 9; i++) {
    // 车马相士帅士相马车
    positions.push({
      x: -boardWidth/2 + i * gridSizeX,
      z: boardLength/2 - 0 * gridSizeZ
    });
  }
  
  // 红方炮
  positions.push({
    x: -boardWidth/2 + 1 * gridSizeX,
    z: boardLength/2 - 2 * gridSizeZ
  });
  positions.push({
    x: -boardWidth/2 + 7 * gridSizeX,
    z: boardLength/2 - 2 * gridSizeZ
  });
  
  // 红方兵
  for (let i = 0; i < 5; i++) {
    positions.push({
      x: -boardWidth/2 + i * 2 * gridSizeX,
      z: boardLength/2 - 3 * gridSizeZ
    });
  }

  // 黑方棋子 (上方)
  for (let i = 0; i < 9; i++) {
    positions.push({
      x: -boardWidth/2 + i * gridSizeX,
      z: -boardLength/2 + 0 * gridSizeZ
    });
  }
  
  // 黑方炮
  positions.push({
    x: -boardWidth/2 + 1 * gridSizeX,
    z: -boardLength/2 + 2 * gridSizeZ
  });
  positions.push({
    x: -boardWidth/2 + 7 * gridSizeX,
    z: -boardLength/2 + 2 * gridSizeZ
  });
  
  // 黑方卒
  for (let i = 0; i < 5; i++) {
    positions.push({
      x: -boardWidth/2 + i * 2 * gridSizeX,
      z: -boardLength/2 + 3 * gridSizeZ
    });
  }

  return positions;
}

// 窗口大小调整
const onWindowResize = () => {
  if (!camera || !renderer) return;
  
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// 动画循环
const animate = () => {
  requestAnimationFrame(animate);
  
  if (controls) {
    controls.update();
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
</script>

<template>
  <div ref="sceneRef" class="chess-container"></div>
</template>

<style scoped>
.chess-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
}
</style>