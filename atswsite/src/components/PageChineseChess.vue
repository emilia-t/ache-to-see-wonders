<script setup lang="ts">
// The relative position of this file: src/components/PageChineseChess.vue
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
let controls: OrbitControls;
let directionalLight: THREE.DirectionalLight;
let coffeeTable: THREE.Group; // 咖啡桌模型组
let chessBoard: THREE.Group; // 棋盘模型组
let chessTest: THREE.Group; // 棋盘模型组
let panoramaCube: THREE.Mesh; // 全景立方体

// ==============================
// 场景配置
// ==============================
const sceneConfig = {
  // 地面配置
  ground: {
    size: { width: 200, height: 200 },
    color: 0xffffff,
    opacity: 0.3 // 地面透明度
  },
  
  // 咖啡桌模型配置
  table: {
    modelPath: '/gltf/CoffeeTable1/CoffeeTable1.json',
    scale: 1,
    position: { x: 0, y: 0, z: 0 }
  },

  // 棋盘模型配置
  chess_board: {
    modelPath: '/gltf/ChessBoard3/chess_model3.json',
    scale: 4,
    position: { x: 0, y: 1.003, z: 0 }
  },

  // 测试棋子模型配置
  chess_black_chariot: {
    modelPath: '/gltf/Chess/hei_che/hei_che.json',
    scale: 0.14,
    position: { x: 0, y: 0.982, z: 0 }
  },

  // 棋盘配置
  board: {
    size: { width: 48, height: 2, depth: 48 },
    color: 0xe6cb63,
    position: { y: 1.005 }, // 棋盘高度（在咖啡桌上方）
    scaleFactor: 100 // 缩放因子，将厘米转换为米
  },
  
  // 场景背景色（临时）
  tempBackgroundColor: 0x000000,
  
  // 全景立方体配置
  panorama: {
    size: 1000, // 立方体大小，确保足够大以包围整个场景
    texturePaths: {
      right: '/bg/scene_bg_r.jpg',   // 右
      left: '/bg/scene_bg_l.jpg',    // 左
      top: '/bg/scene_bg_u.jpg',     // 上
      bottom: '/bg/scene_bg_d.jpg',  // 下
      front: '/bg/scene_bg_f.jpg',   // 前
      back: '/bg/scene_bg_b.jpg'     // 后
    },
    fallbackColors: [0x4444ff, 0x44ff44, 0xff4444, 0xffff44, 0xff44ff, 0x44ffff] // 备用颜色
  },
  
  // 辅助对象配置
  helpers: {
    grid: {
      size: 2,
      divisions: 10,
      colors: { centerLine: 0x0000ff, grid: 0x808080 },
      position: { y: -0.01 }
    },
    axes: {
      size: 1
    }
  }
};

// ==============================
// 棋子配置
// ==============================
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
  
  // 棋盘网格配置
  board: {
    width: 40,   // 棋盘宽度（厘米）
    length: 40,  // 棋盘长度（厘米）
    cols: 8,     // 列数
    rows: 9      // 行数
  },
  
  // 棋子布局配置
  layout: {
    // 红方（下方）棋子类型和位置
    red: {
      mainRow: 0,    // 主力行
      cannonRow: 2,  // 炮行
      soldierRow: 3  // 兵行
    },
    // 黑方（上方）棋子类型和位置  
    black: {
      mainRow: 0,    // 主力行
      cannonRow: 2,  // 炮行
      soldierRow: 3  // 卒行
    }
  },
  
  scaleFactor: 100 // 缩放因子，将厘米转换为米
};

// ==============================
// 相机配置
// ==============================
const cameraConfig = {
  position: { x: 0, y: 1.5, z: 2.4 }, // 相机位置
  target: { x: 0, y: 0.3, z: 0 },     // 观察目标
  fov: 60,      // 视野角度
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
// 轨道控制器配置
// ==============================
const controlsConfig = {
  enableDamping: true,   // 启用阻尼效果
  dampingFactor: 0.05    // 阻尼系数
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
  
  // 设置控制器和灯光
  setupControls();
  setupLights();
  
  // 创建场景内容
  createSceneContent();
  
  // 添加窗口调整事件监听
  window.addEventListener('resize', onWindowResize);
}

/**
 * 创建Three.js场景
 */
const createScene = () => {
  scene = new THREE.Scene();
  // 设置临时黑色背景，等全景加载后再移除
  scene.background = new THREE.Color(sceneConfig.tempBackgroundColor);
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
 * 设置轨道控制器
 */
const setupControls = () => {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = controlsConfig.enableDamping;
  controls.dampingFactor = controlsConfig.dampingFactor;
  controls.target.set(
    cameraConfig.target.x,
    cameraConfig.target.y,
    cameraConfig.target.z
  );
  controls.update();
}

/**
 * 设置场景灯光
 */
const setupLights = () => {
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

  // 创建棋盘和棋子
  createChessBoardAndPieces();
}

/**
 * 创建辅助对象（网格、坐标轴）
 */
const createHelpers = () => {
  // 网格辅助对象
  const gridHelper = new THREE.GridHelper(
    sceneConfig.helpers.grid.size,
    sceneConfig.helpers.grid.divisions,
    sceneConfig.helpers.grid.colors.centerLine,
    sceneConfig.helpers.grid.colors.grid
  );
  gridHelper.position.y = sceneConfig.helpers.grid.position.y;
  scene.add(gridHelper);

  // 坐标轴辅助对象
  const axesHelper = new THREE.AxesHelper(sceneConfig.helpers.axes.size);
  scene.add(axesHelper);
}

/**
 * 创建地面
 */
const createGround = () => {
  const groundGeometry = new THREE.PlaneGeometry(
    sceneConfig.ground.size.width, 
    sceneConfig.ground.size.height
  );
  const groundMaterial = new THREE.MeshLambertMaterial({ 
    color: sceneConfig.ground.color,
    transparent: true,
    opacity: sceneConfig.ground.opacity
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
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
    console.log(`加载全景纹理: ${side.path} (${side.name})`);
    
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
      console.log(`全景纹理加载成功: ${side.path}`);
    } catch (error) {
      console.error(`全景纹理加载失败: ${side.path}`, error);
      // 如果加载失败，使用备用颜色材质
      const fallbackColor = sceneConfig.panorama.fallbackColors[index];
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
  
  console.log('全景立方体创建完成，材质数量:', materials.length);
}

/**
 * 加载咖啡桌模型
 */
const createCoffeeTable = () => {
  const loader = new GLTFLoader();
  loader.load(
    sceneConfig.table.modelPath,
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


/**
 * 加载棋盘模型
 */
const createChessBoard = () => {
  const loader = new GLTFLoader();
  loader.load(
    sceneConfig.chess_board.modelPath,
    (gltf) => {
      chessBoard = gltf.scene;
      
      // 设置棋盘的位置和缩放
      chessBoard.position.set(
        sceneConfig.chess_board.position.x,
        sceneConfig.chess_board.position.y,
        sceneConfig.chess_board.position.z
      );
      chessBoard.scale.set(
        sceneConfig.chess_board.scale,
        sceneConfig.chess_board.scale,
        sceneConfig.chess_board.scale
      );
      
      // 启用阴影
      chessBoard.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      scene.add(chessBoard);
      console.log('棋盘模型加载成功');
      
    },
    undefined,
    (error) => {
      console.error('棋盘模型加载失败:', error);
      // 如果模型加载失败，创建备用立方体桌子
      createFallbackChessBoard();
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
  scene.add(table);
  console.log('创建备用立方体桌子');
}

/**
 * 调整棋盘位置使其位于咖啡桌上方
 */
const adjustBoardPosition = () => {
  // 这里可以根据咖啡桌的实际高度调整棋盘位置
  // 目前使用预设的位置
  console.log('调整棋盘位置到咖啡桌上方');
}

/**
 * 创建棋盘和棋子
 */
const createChessBoardAndPieces = () => {
  // 创建棋盘
  createChessBoard();
  
  // 创建所有棋子
  createChessPieces();
}

/**
 * 创建棋盘
 */
const createFallbackChessBoard = () => {
  const scaleFactor = sceneConfig.board.scaleFactor;
  const boardGeometry = new THREE.BoxGeometry(
    sceneConfig.board.size.width / scaleFactor,
    sceneConfig.board.size.height / scaleFactor,
    sceneConfig.board.size.depth / scaleFactor
  );
  const boardMaterial = new THREE.MeshLambertMaterial({ 
    color: sceneConfig.board.color 
  });
  const board = new THREE.Mesh(boardGeometry, boardMaterial);
  board.position.y = sceneConfig.board.position.y;
  board.castShadow = true;
  board.receiveShadow = true;
  scene.add(board);
  
  console.log('棋盘创建完成');
}

/**
 * 创建所有棋子
 */
const createChessPieces = () => {
  const loader = new GLTFLoader();
  loader.load(
    sceneConfig.chess_black_chariot.modelPath,
    (gltf) => {
      chessTest = gltf.scene;
      
      // 设置棋盘的位置和缩放
      chessTest.position.set(
        sceneConfig.chess_black_chariot.position.x,
        sceneConfig.chess_black_chariot.position.y,
        sceneConfig.chess_black_chariot.position.z
      );
      chessTest.scale.set(
        sceneConfig.chess_black_chariot.scale,
        sceneConfig.chess_black_chariot.scale,
        sceneConfig.chess_black_chariot.scale
      );
      
      // 启用阴影
      chessTest.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      scene.add(chessTest);
      console.log('棋子模型加载成功');
      
    },
    undefined,
    (error) => {
      console.error('棋子模型加载失败:', error);
      // 如果模型加载失败，创建备用立方体桌子
      createFallbackChessPieces();
    }
  );
}

/**
 * 创建所有棋子
 */
const createFallbackChessPieces = () => {
  const scaleFactor = piecesConfig.scaleFactor;
  
  // 创建棋子几何体
  const pieceGeometry = new THREE.CylinderGeometry(
    piecesConfig.geometry.radiusTop / scaleFactor,
    piecesConfig.geometry.radiusBottom / scaleFactor,
    piecesConfig.geometry.height / scaleFactor,
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
      pos.x / scaleFactor, 
      sceneConfig.board.position.y + sceneConfig.board.size.height / 115, 
      pos.z / scaleFactor
    );
    piece.castShadow = true;
    piece.receiveShadow = true;
    
    // 给棋子命名以便后续识别
    piece.name = `chess-piece-${index}`;
    scene.add(piece);
  });
  
  console.log(`棋子创建完成，共 ${piecePositions.length} 个棋子`);
}

/**
 * 计算所有棋子的位置
 */
const calculatePiecePositions = () => {
  const positions: any[] = [];
  const boardWidth = piecesConfig.board.width;
  const boardLength = piecesConfig.board.length;
  const gridSizeX = boardWidth / piecesConfig.board.cols;
  const gridSizeZ = boardLength / piecesConfig.board.rows;

  // 红方棋子 (下方)
  createRedPieces(positions, boardWidth, boardLength, gridSizeX, gridSizeZ);
  
  // 黑方棋子 (上方)
  createBlackPieces(positions, boardWidth, boardLength, gridSizeX, gridSizeZ);

  return positions;
}

/**
 * 创建红方棋子
 */
const createRedPieces = (positions: any[], boardWidth: number, boardLength: number, gridSizeX: number, gridSizeZ: number) => {
  const layout = piecesConfig.layout.red;
  
  // 红方主力行（车马相士帅士相马车）
  for (let i = 0; i < 9; i++) {
    positions.push({
      x: -boardWidth/2 + i * gridSizeX,
      z: boardLength/2 - layout.mainRow * gridSizeZ
    });
  }
  
  // 红方炮
  positions.push({
    x: -boardWidth/2 + 1 * gridSizeX,
    z: boardLength/2 - layout.cannonRow * gridSizeZ
  });
  positions.push({
    x: -boardWidth/2 + 7 * gridSizeX,
    z: boardLength/2 - layout.cannonRow * gridSizeZ
  });
  
  // 红方兵
  for (let i = 0; i < 5; i++) {
    positions.push({
      x: -boardWidth/2 + i * 2 * gridSizeX,
      z: boardLength/2 - layout.soldierRow * gridSizeZ
    });
  }
}

/**
 * 创建黑方棋子
 */
const createBlackPieces = (positions: any[], boardWidth: number, boardLength: number, gridSizeX: number, gridSizeZ: number) => {
  const layout = piecesConfig.layout.black;
  
  // 黑方主力行
  for (let i = 0; i < 9; i++) {
    positions.push({
      x: -boardWidth/2 + i * gridSizeX,
      z: -boardLength/2 + layout.mainRow * gridSizeZ
    });
  }
  
  // 黑方炮
  positions.push({
    x: -boardWidth/2 + 1 * gridSizeX,
    z: -boardLength/2 + layout.cannonRow * gridSizeZ
  });
  positions.push({
    x: -boardWidth/2 + 7 * gridSizeX,
    z: -boardLength/2 + layout.cannonRow * gridSizeZ
  });
  
  // 黑方卒
  for (let i = 0; i < 5; i++) {
    positions.push({
      x: -boardWidth/2 + i * 2 * gridSizeX,
      z: -boardLength/2 + layout.soldierRow * gridSizeZ
    });
  }
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
  
  if (controls) {
    controls.update();
  }
  
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
  // 延迟检查全景状态
  setTimeout(() => {
    debugPanorama();
  }, 2000);
})

onUnmounted(() => {
  // 清理资源
  if (renderer) {
    renderer.dispose();
  }
  if (scene) {
    scene.clear();
  }
  // 移除事件监听
  window.removeEventListener('resize', onWindowResize);
})
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