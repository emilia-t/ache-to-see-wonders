<script setup lang="ts">
// The relative position of this file: src/components/PageNeuroSandbox.vue

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { mat4, vec3 } from 'gl-matrix';

const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const longSideParallel = computed(() => windowWidth.value >= windowHeight.value);
const UnitOfDistance = "px";
const BlockPx = 16;//一格方块的长度像素为16像素

//游戏内的配置
const gameWorldConfig = {
  cubeX: 16,//方块的三维长度
  cubeY: 16,
  cubeZ: 16,
  
  chunkX: 256,//区块的三维长度
  chunkY: 256,
  chunkZ: 1024,
  
  ChessMaxBlockX: 16,//棋子最大占据的格数
  ChessMaxBlockY: 16,
  ChessMaxBlockZ: 64,

  ChessMinBlockX: 1,//棋子最小占据的格数
  ChessMinBlockY: 1,
  ChessMinBlockZ: 1,

  worldLeftEdgeX: -2048,//世界的边缘的三维坐标
  worldRightEdgeX: 2047,
  worldTopEdgeY: 2047,
  worldBottomEdgeY: -2048,
  worldUpEdgeZ: 511,
  worldDownEdgeZ: -512,//从坐标可以看出假设相机从上向下俯视游戏世界的话:x轴向右是正,y轴向上是正,z轴向屏幕外是正

  WorldLeftChunkCountX: -128,//世界的最大区块数量（x轴编号从左到右为 -128 至 127）
  WorldRightChunkCountX: 127,
  WorldTopChunkCountY: 127,//世界的最大区块数量（y轴编号从下到上为 -128 至 127）
  WorldBottomChunkCountY: -128,
};

//相机的配置
const cameraConfig = ref({
  CameraPointX: 0,//相机中心点位置
  CameraPointY: 0,
  CameraPointZ: 100,
  Azimuth: 0, // 初始水平角度(XY 平面上的方向顺时针角度 以相对于 x 轴的度数为单位)
  Elevation: 30, // 初始垂直角度(XY 平面指向 Z 轴的方向角度，以度为单位)
  MinElevation: 5, // 最小垂直角度
  MaxElevation: 85, // 最大垂直角度
  Distance: 200, // 相机距离
});

//调试相关配置
const debuggingConfig = {
  ShowChunkBoundary: true,// 显示区块边界线（黄色线）
  ShowChunkTextLocation: false,// 显示区块的编号
  ShowDebuggingPanel: true,// 显示调试面板
  ShowDirectionIndicator: true // 右下角显示一个 x(红) y(蓝) z(绿) 的正向箭头坐标轴，用于展示在相机视角下游戏世界实际的坐标轴方向，会随着视角变动而变化
};

//棋子的数据
const chessData = [
  {
    id:1,
    name:"testChesskBlockSize_2x2x2",
    healthPoint:20,
    vertexBlockPostion:{//方块的八个顶点的方格坐标(单位是Block)
      up0:[0,0,2],//up开头的顶点在顶面(x,y,z)
      up1:[0,2,2],
      up2:[2,2,2],
      up3:[2,0,2],
      down0:[0,0,0],//down开头的顶点在底面(x,y,z)
      down1:[0,2,0],
      down2:[2,2,0],
      down3:[2,0,0]
    },
    textures:{//方块的六个面的材质路径，或者填充颜色
      left: {
        type:"rgba",
        value:"rgba(255, 167, 164, 1)"
      },
      right: {
        type:"rgba",
        value:"rgba(123, 255, 163, 1)"
      },
      top: {
        type:"rgba",
        value:"rgba(123, 212, 255, 1)"
      },
      bottom: {
        type:"rgba",
        value:"rgba(255, 248, 153, 1)"
      },
      up: {
        type:"rgba",
        value:"rgba(255, 255, 255, 1)"
      },
      down: {
        type:"rgba",
        value:"rgba(110, 120, 140, 1)"
      }
    }
  }  
]

/**
 * 用于修改和管理世界中的棋子、世界的大小等
 */
class GameWorld{
  private chessEntities: ChessEntity[] = [];
  private chunks: Map<string, any> = new Map();
  
  constructor() {
    this.initializeWorld();
  }
  
  private initializeWorld() {
    // 创建初始棋子
    chessData.forEach(data => {
      const chess = new ChessEntity(
        data.id,
        data.name,
        data.healthPoint,
        data.vertexBlockPostion,
        data.textures
      );
      this.addChess(chess);
    });
    
    // 初始化区块
    // this.initializeChunks();
  }
  
  private initializeChunks() {
    // 简单实现：创建一些基础区块
    for (let x = gameWorldConfig.WorldLeftChunkCountX; x <= gameWorldConfig.WorldRightChunkCountX; x += 4) {
      for (let y = gameWorldConfig.WorldBottomChunkCountY; y <= gameWorldConfig.WorldTopChunkCountY; y += 4) {
        const chunkKey = `${x},${y}`;
        this.chunks.set(chunkKey, {
          x,
          y,
          blocks: this.generateChunkBlocks(x, y)
        });
      }
    }
  }
  
  private generateChunkBlocks(chunkX: number, chunkY: number): any[] {
    const blocks = [];
    // 简单的地形生成：每个区块中间有一个平台
    if (chunkX === 0 && chunkY === 0) {
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          blocks.push({
            x: chunkX * gameWorldConfig.chunkX + x * gameWorldConfig.cubeX,
            y: chunkY * gameWorldConfig.chunkY + y * gameWorldConfig.cubeY,
            z: 0,
            color: [0.2, 0.6, 0.8, 1.0]
          });
        }
      }
    }
    return blocks;
  }
  
  addChess(chess: ChessEntity) {
    this.chessEntities.push(chess);
  }
  
  removeChess(chessId: number) {
    this.chessEntities = this.chessEntities.filter(chess => chess.id !== chessId);
  }
  
  getChessEntities(): ChessEntity[] {
    return this.chessEntities;
  }
  
  getChunks(): Map<string, any> {
    return this.chunks;
  }
  
  render(gl: WebGLRenderingContext, camera: CameraObject) {
    // 渲染区块
    this.chunks.forEach(chunk => {
      this.renderChunk(gl, chunk, camera);
    });
    
    // 渲染棋子
    this.chessEntities.forEach(chess => {
      chess.render(gl, camera);
    });
  }
  
  private renderChunk(gl: WebGLRenderingContext, chunk: any, camera: CameraObject) {
    // 渲染区块边界
    if (debuggingConfig.ShowChunkBoundary) {
      this.renderChunkBoundary(gl, chunk, camera);
    }
    
    // 渲染区块内的方块
    chunk.blocks.forEach((block: any) => {
      this.renderBlock(gl, block, camera);
    });
  }
  
  private renderChunkBoundary(gl: WebGLRenderingContext, chunk: any, camera: CameraObject) {
    const x = chunk.x * gameWorldConfig.chunkX;
    const y = chunk.y * gameWorldConfig.chunkY;
    const z = 0;
    
    const vertices = [
      x, y, z,
      x + gameWorldConfig.chunkX, y, z,
      x + gameWorldConfig.chunkX, y + gameWorldConfig.chunkY, z,
      x, y + gameWorldConfig.chunkY, z,
      x, y, z, // 闭合
    ];
    
    camera.renderLines(gl, vertices, [1.0, 1.0, 0.0, 1.0]); // 黄色边界
  }
  
  private renderBlock(gl: WebGLRenderingContext, block: any, camera: CameraObject) {
    const x = block.x;
    const y = block.y;
    const z = block.z;
    const size = gameWorldConfig.cubeX;
    
    // 创建立方体的8个顶点
    const vertices = [
      // 底面
      x, y, z,
      x + size, y, z,
      x + size, y + size, z,
      x, y + size, z,
      
      // 顶面
      x, y, z + size,
      x + size, y, z + size,
      x + size, y + size, z + size,
      x, y + size, z + size,
    ];
    
    // 立方体的面索引
    const indices = [
      // 底面
      0, 1, 2, 0, 2, 3,
      // 顶面
      4, 5, 6, 4, 6, 7,
      // 前面
      0, 4, 5, 0, 5, 1,
      // 后面
      3, 7, 6, 3, 6, 2,
      // 左面
      0, 4, 7, 0, 7, 3,
      // 右面
      1, 5, 6, 1, 6, 2
    ];
    
    camera.renderCube(gl, vertices, indices, block.color);
  }
}

/**
 * 用于创建一个棋子，并提供对棋子属性访问和修改的API
 */
class ChessEntity{
  constructor(
    public id: number,
    public name: string,
    public healthPoint: number,
    public vertexBlockPostion: any,
    public textures: any
  ) {}
  

  render(gl: WebGLRenderingContext, camera: CameraObject) {
    // 将方块坐标转换为世界坐标
    const vertices: number[] = [];
    const indices: number[] = [];
    // 8顶点
    const positions = [
      this.vertexBlockPostion.down0,
      this.vertexBlockPostion.down1,
      this.vertexBlockPostion.down2,
      this.vertexBlockPostion.down3,
      this.vertexBlockPostion.up0,
      this.vertexBlockPostion.up1,
      this.vertexBlockPostion.up2,
      this.vertexBlockPostion.up3
    ];
    positions.forEach(pos => {
      vertices.push(
        pos[0] * BlockPx,
        pos[1] * BlockPx,
        pos[2] * BlockPx
      );
    });
    // 立方体面索引
    indices.push(
      // 底面
      0, 1, 2, 0, 2, 3,
      // 顶面
      4, 5, 6, 4, 6, 7,
      // 前面
      0, 4, 5, 0, 5, 1,
      // 后面
      3, 7, 6, 3, 6, 2,
      // 左面
      0, 4, 7, 0, 7, 3,
      // 右面
      1, 5, 6, 1, 6, 2
    );
    // 6面颜色
    const faceColors = [
      this.parseColor(this.textures.bottom.value), // 0 底面
      this.parseColor(this.textures.up.value),     // 1 顶面
      this.parseColor(this.textures.front?.value ?? this.textures.left.value), // 2 前面（如无则用left）
      this.parseColor(this.textures.back?.value ?? this.textures.right.value), // 3 后面（如无则用right）
      this.parseColor(this.textures.left.value),   // 4 左面
      this.parseColor(this.textures.right.value)   // 5 右面
    ];
    camera.renderCube(gl, vertices, indices, faceColors);
  }
  
  private parseColor(colorStr: string): number[] {
    const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (match) {
      return [
        parseInt(match[1]) / 255,
        parseInt(match[2]) / 255,
        parseInt(match[3]) / 255,
        parseFloat(match[4])
      ];
    }
    return [0.5, 0.5, 0.5, 1.0]; // 默认灰色
  }
  
  updateHealth(newHealth: number) {
    this.healthPoint = newHealth;
  }
  
  moveTo(x: number, y: number, z: number) {
    // 更新棋子位置逻辑
    console.log(`Moving chess ${this.id} to (${x}, ${y}, ${z})`);
  }
}

/**
 * 用于创建一个相机对象并可以将相机扔进游戏世界中以呈现游戏世界中的画面
 */
class CameraObject{
  private projectionMatrix: mat4;
  private viewMatrix: mat4;
  private modelMatrix: mat4;
  
  constructor() {
    this.projectionMatrix = mat4.create();
    this.viewMatrix = mat4.create();
    this.modelMatrix = mat4.create();
    
    this.updateProjectionMatrix();
    this.updateViewMatrix();
  }
  
  updateProjectionMatrix() {
    const aspect = windowWidth.value / windowHeight.value;
    mat4.perspective(
      this.projectionMatrix,
      45 * Math.PI / 180, // 视野角度
      aspect,
      0.1, // 近平面
      1000.0 // 远平面
    );
  }
  
  updateViewMatrix() {
    const camera = cameraConfig.value;
    
    // 计算相机位置（球坐标转直角坐标）
    const azimuthRad = camera.Azimuth * Math.PI / 180;
    const elevationRad = camera.Elevation * Math.PI / 180;
    
    const x = camera.Distance * Math.cos(elevationRad) * Math.cos(azimuthRad);
    const y = camera.Distance * Math.cos(elevationRad) * Math.sin(azimuthRad);
    const z = camera.Distance * Math.sin(elevationRad);
    
    const eye = vec3.fromValues(
      camera.CameraPointX + x,
      camera.CameraPointY + y,
      camera.CameraPointZ + z
    );
    
    const center = vec3.fromValues(
      camera.CameraPointX,
      camera.CameraPointY,
      camera.CameraPointZ
    );
    
    const up = vec3.fromValues(0, 0, 1);
    
    mat4.lookAt(this.viewMatrix, eye, center, up);
  }
  
  renderCube(gl: WebGLRenderingContext, vertices: number[], indices: number[], faceColors: number[][]) {
    // 每个三角面6个面，每面2个三角形，每三角形3顶点
    // 36个顶点，每个顶点3坐标+4色
    const expandedVertices: number[] = [];
    const expandedColors: number[] = [];
    // 6个面，每面2三角形
    for (let face = 0; face < 6; face++) {
      const color = faceColors[face];
      for (let tri = 0; tri < 2; tri++) {
        for (let v = 0; v < 3; v++) {
          const idx = indices[face * 6 + tri * 3 + v];
          expandedVertices.push(vertices[idx * 3], vertices[idx * 3 + 1], vertices[idx * 3 + 2]);
          expandedColors.push(...color);
        }
      }
    }
    // 创建缓冲区
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(expandedVertices), gl.STATIC_DRAW);
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(expandedColors), gl.STATIC_DRAW);
    // 着色器
    const vertexShaderSource = `
      attribute vec3 aPosition;
      attribute vec4 aColor;
      varying vec4 vColor;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uModelMatrix;
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
        vColor = aColor;
      }
    `;
    const fragmentShaderSource = `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }
    `;
    const program = this.createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;
    gl.useProgram(program);
    // 位置
    const positionAttributeLocation = gl.getAttribLocation(program, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    // 颜色
    const colorAttributeLocation = gl.getAttribLocation(program, "aColor");
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.enableVertexAttribArray(colorAttributeLocation);
    gl.vertexAttribPointer(colorAttributeLocation, 4, gl.FLOAT, false, 0, 0);
    // uniform
    const projectionMatrixLocation = gl.getUniformLocation(program, "uProjectionMatrix");
    const viewMatrixLocation = gl.getUniformLocation(program, "uViewMatrix");
    const modelMatrixLocation = gl.getUniformLocation(program, "uModelMatrix");
    gl.uniformMatrix4fv(projectionMatrixLocation, false, this.projectionMatrix);
    gl.uniformMatrix4fv(viewMatrixLocation, false, this.viewMatrix);
    gl.uniformMatrix4fv(modelMatrixLocation, false, this.modelMatrix);
    // 绘制
    gl.drawArrays(gl.TRIANGLES, 0, expandedVertices.length / 3);
  }
  
  renderLines(gl: WebGLRenderingContext, vertices: number[], color: number[]) {
    // 创建顶点缓冲区
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    
    // 设置着色器程序
    const vertexShaderSource = `
      attribute vec3 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uModelMatrix;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      }
    `;
    
    const fragmentShaderSource = `
      precision mediump float;
      uniform vec4 uColor;
      
      void main() {
        gl_FragColor = uColor;
      }
    `;
    
    const program = this.createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    
    if (!program) return;
    
    gl.useProgram(program);
    
    // 获取属性位置
    const positionAttributeLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    
    // 获取uniform位置
    const projectionMatrixLocation = gl.getUniformLocation(program, "uProjectionMatrix");
    const viewMatrixLocation = gl.getUniformLocation(program, "uViewMatrix");
    const modelMatrixLocation = gl.getUniformLocation(program, "uModelMatrix");
    const colorLocation = gl.getUniformLocation(program, "uColor");
    
    // 设置uniform
    gl.uniformMatrix4fv(projectionMatrixLocation, false, this.projectionMatrix);
    gl.uniformMatrix4fv(viewMatrixLocation, false, this.viewMatrix);
    gl.uniformMatrix4fv(modelMatrixLocation, false, this.modelMatrix);
    gl.uniform4fv(colorLocation, color);
    
    // 绘制线条
    gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 3);
  }
  
  private createShaderProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    
    if (!vertexShader || !fragmentShader) {
      return null;
    }
    
    const program = gl.createProgram();
    if (!program) {
      return null;
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }
  
  private compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  updateCameraPosition() {
    this.updateViewMatrix();
  }
}

// 全局变量
let gameWorld: GameWorld;
let camera: CameraObject;
let gl: WebGLRenderingContext;
let animationFrameId: number;

/** 
 * 初始化
 */ 
onMounted(() => {
  window.addEventListener('resize', onResize);
  
  // 初始化WebGLRenderer
  const canvasElement = document.getElementById('sandboxCanvas') as HTMLCanvasElement;
  if (canvasElement) {
    gl = canvasElement.getContext('webgl') as WebGLRenderingContext;
    
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    
    // 设置canvas尺寸
    canvasElement.width = windowWidth.value;
    canvasElement.height = windowHeight.value;
    
    // 初始化游戏世界和相机
    gameWorld = new GameWorld();
    camera = new CameraObject();
    
    // 启动渲染循环
    render();
    
    // 添加鼠标事件监听
    setupMouseControls(canvasElement);
  }
});

/** 
 * 销毁阶段
 */ 
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

/** 
 * 用于更新屏幕显示大小
 */ 
function onResize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
  
  const canvasElement = document.getElementById('sandboxCanvas') as HTMLCanvasElement;
  if (canvasElement) {
    canvasElement.width = windowWidth.value;
    canvasElement.height = windowHeight.value;
    
    if (camera) {
      camera.updateProjectionMatrix();
    }
    
    if (gl) {
      gl.viewport(0, 0, windowWidth.value, windowHeight.value);
    }
  }
}

// 渲染循环
function render() {
  if (!gl || !gameWorld || !camera) return;
  // 清除画布
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // 启用深度测试
  gl.enable(gl.DEPTH_TEST);
  // 更新相机
  camera.updateCameraPosition();
  // 渲染游戏世界（WebGL）
  gameWorld.render(gl, camera);
  // 清空2D上下文再绘制文字，避免被WebGL覆盖
  const canvas = gl.canvas as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 重新渲染面字母
    gameWorld.getChessEntities().forEach(chess => {
      const vertices: number[] = [];
      const positions = [
        chess.vertexBlockPostion.down0,
        chess.vertexBlockPostion.down1,
        chess.vertexBlockPostion.down2,
        chess.vertexBlockPostion.down3,
        chess.vertexBlockPostion.up0,
        chess.vertexBlockPostion.up1,
        chess.vertexBlockPostion.up2,
        chess.vertexBlockPostion.up3
      ];
      positions.forEach(pos => {
        vertices.push(
          pos[0] * BlockPx,
          pos[1] * BlockPx,
          pos[2] * BlockPx
        );
      });
    });
  }
  // 继续渲染循环
  animationFrameId = requestAnimationFrame(render);
}

// 设置鼠标控制
function setupMouseControls(canvas: HTMLCanvasElement) {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    
    // 更新相机角度
    cameraConfig.value.Azimuth += deltaX * 0.5;
    cameraConfig.value.Elevation += deltaY * 0.5;
    
    // 限制垂直角度
    cameraConfig.value.Elevation = Math.max(
      cameraConfig.value.MinElevation,
      Math.min(cameraConfig.value.MaxElevation, cameraConfig.value.Elevation)
    );
    
    lastX = e.clientX;
    lastY = e.clientY;
  });
  
  // 鼠标滚轮缩放
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cameraConfig.value.Distance += e.deltaY * 0.1;
    cameraConfig.value.Distance = Math.max(50, Math.min(500, cameraConfig.value.Distance));
  });
}
</script>

<template>
  <div class="page-neuro-sandbox-container">
    <div class="center-sandbox" id="sandbox">
      <canvas id="sandboxCanvas"></canvas>
    </div>

    <div  v-if="false" class="float-menubar" id="menubar">
      <div class="menu-controls">
        <h3>NeuroSandbox 控制 (WebGL 3D)</h3>
        <div class="world-info">
          <p>世界范围: X[{{ gameWorldConfig.worldLeftEdgeX }}, {{ gameWorldConfig.worldRightEdgeX }}] Y[{{ gameWorldConfig.worldTopEdgeY }}, {{ gameWorldConfig.worldBottomEdgeY }}] Z[{{ gameWorldConfig.worldUpEdgeZ }}, {{ gameWorldConfig.worldDownEdgeZ }}]</p>
          <p>区块范围: X[{{ gameWorldConfig.WorldLeftChunkCountX }}, {{ gameWorldConfig.WorldRightChunkCountX }}] Y[{{ gameWorldConfig.WorldTopChunkCountY }}, {{ gameWorldConfig.WorldBottomChunkCountY }}]</p>
        </div>
        <div class="control-group">
          <button @click="cameraConfig.Azimuth = 0; cameraConfig.Elevation = 30">重置视角</button>
          <button @click="cameraConfig.Distance = 200">重置距离</button>
        </div>
      </div>
    </div>

    <div v-if="debuggingConfig.ShowDebuggingPanel" class="float-debugging" id="debugging">
      <h3>调试信息 (WebGL)</h3>
      <p>相机坐标 X: {{ cameraConfig.CameraPointX.toFixed(2) }}</p>
      <p>相机坐标 Y: {{ cameraConfig.CameraPointY.toFixed(2) }}</p>
      <p>相机坐标 Z: {{ cameraConfig.CameraPointZ.toFixed(2) }}</p>
      <p>水平角度: {{ cameraConfig.Azimuth.toFixed(1) }}°</p>
      <p>垂直角度: {{ cameraConfig.Elevation.toFixed(1) }}°</p>
      <p>相机距离: {{ cameraConfig.Distance.toFixed(1) }}</p>
      <p>窗口宽度: {{ windowWidth }}</p>
      <p>窗口高度: {{ windowHeight }}</p>
      <p>长边平行: {{ longSideParallel }}</p>
      <p>当前区块: ({{ Math.floor(cameraConfig.CameraPointX / BlockPx) }}, {{ Math.floor(cameraConfig.CameraPointY / BlockPx) }})</p>
      
      <div class="control-hint">
        <p>控制提示:</p>
        <p>鼠标拖动 - 旋转视角</p>
        <p>鼠标滚轮 - 缩放</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-neuro-sandbox-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.center-sandbox {
  width: 100vw;
  height: 100vh;
}

#sandboxCanvas {
  position: fixed;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.float-menubar {
  width: 100vmin;
  height: 30vh;
  position: fixed;
  z-index: 10;
  background-color: rgba(215, 255, 173, 0.9);
  bottom: 0;
  left: calc((100vw - 100vmin) / 2);
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  padding: 15px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.menu-controls h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.control-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.control-group button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.control-group button:hover {
  background-color: #45a049;
}

.control-group button.active {
  background-color: #2196F3;
}

.world-info {
  font-size: 12px;
  color: #666;
}

.world-info p {
  margin: 2px 0;
}

.float-debugging {
  width: 180px;
  height: 500px;
  position: fixed;
  z-index: 10;
  background-color: rgba(213, 245, 255, 0.9);
  top: 0;
  left: 0;
  border-bottom-right-radius: 10px;
  padding: 15px;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}

.float-debugging h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  border-bottom: 1px solid #ccc;
  padding-bottom: 5px;
}

.float-debugging p {
  margin: 5px 0;
  font-family: monospace;
  font-size: 14px;
}

.control-hint {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #ccc;
}

.control-hint p {
  margin: 3px 0;
  font-size: 12px;
  color: #555;
}
</style>