<script setup lang="ts">
// The relative position of this file: src/components/PageNeuroSandbox.vue
// 贴图存放在 /textures 
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { mat4, vec3 } from 'gl-matrix';
import ViewFilingLicense from '@/components/ViewFilingLicense.vue'

const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const longSideParallel = computed(() => windowWidth.value >= windowHeight.value);

// 配置常量
const config = {
  ResolutionUnit: "px",
  ProjectionMethod: "OrthographicDimetric",
  WorldMaxChunkX: 256,
  WorldMaxChunkY: 256,
  BlockPxX: 32,
  BlockPxY: 16,
  ChessMaxBlockX: 16,
  ChessMaxBlockY: 16,
  ChessMinBlockX: 1,
  ChessMinBlockY: 1,
  ChunkBlockX: 16,
  ChunkBlockY: 16,
  InitialPointX: 0,
  InitialPointY: 0,
  InitialZoom: 1,
  ZoomMin: 0.0625,
  ZoomMax: 16,
  ShowChunkBoundary: true,
  ShowChunkLocation: false,
  ShowBlockBoundary: true,
  ShowBlockLocation: false,
  ShowDebuggingPanel: true
};

// 计算世界坐标范围
const worldBounds = {
  MinChunkX: -config.WorldMaxChunkX / 2,
  MaxChunkXValue: config.WorldMaxChunkX / 2 - 1,
  MinChunkY: -config.WorldMaxChunkY / 2,
  MaxChunkYValue: config.WorldMaxChunkY / 2 - 1,
  MinBlockX: (-config.WorldMaxChunkX / 2) * 16,
  MaxBlockX: (config.WorldMaxChunkX / 2 - 1) * 16 + 15,
  MinBlockY: (-config.WorldMaxChunkY / 2) * 16,
  MaxBlockY: (config.WorldMaxChunkY / 2 - 1) * 16 + 15
};

// 使用ref使其响应式
const nowCameraPointX = ref(config.InitialPointX);
const nowCameraPointY = ref(config.InitialPointY);
const nowZoomLevel = ref(config.InitialZoom);

// 性能优化相关变量
const performanceMode = ref(false);
const performFrameCount = ref(0);
const performFps = ref(0);
const performLastFpsUpdate = ref(0);

// 鼠标交互相关变量
const mouseIsDragging = ref(false);

// WebGLRenderer 实例
let webglRenderer: WebGLRenderer | null = null;

/**
 * ChessEntity类 - 封装棋子实体类
 */
class ChessEntity {
  // 统一字符串标签 (UST)
  private ust: Map<string, string> = new Map();
  
  // 自定义字符串标签 (CST)
  private cst: Map<string, string> = new Map();
  
  // 固有属性
  private frontTexture: string;
  private entityBlocksX1: number;
  private entityBlocksX2: number;
  private entityBlocksY1: number;
  private entityBlocksY2: number;
  private entityBlocksZ: number; // 新增：高度
  private entityMargin: number;
  private healthPoints: number;
  private justicePoints: number;
  private createdTime: number;
  private destroyedTime: number;
  
  // 自定义私有函数 (CPF)
  private customPrivateFunctions: Map<string, Function> = new Map();
  
  // 统一公有函数 (UCF)
  private unifiedCommunalFunctions: Map<string, Function> = new Map();

  constructor(
    frontTexture: string,
    entityBlocksX1: number,
    entityBlocksX2: number,
    entityBlocksY1: number,
    entityBlocksY2: number,
    entityBlocksZ: number = 1, // 默认高度为1
    commonName?: string
  ) {
    // 设置固有属性
    this.frontTexture = frontTexture;
    this.entityBlocksX1 = entityBlocksX1;
    this.entityBlocksX2 = entityBlocksX2;
    this.entityBlocksY1 = entityBlocksY1;
    this.entityBlocksY2 = entityBlocksY2;
    this.entityBlocksZ = entityBlocksZ;
    this.entityMargin = 1;
    this.healthPoints = 20;
    this.justicePoints = 0;
    this.createdTime = Date.now();
    this.destroyedTime = 0;
    
    // 设置统一字符串标签
    this.setUST('CommonName', commonName || 'Unnamed Entity');
    
    // 初始化默认的统一公有函数
    this.initializeUnifiedFunctions();
    
    // 调用创建函数
    this.onCreate();
  }

  /**
   * 初始化统一公有函数
   */
  private initializeUnifiedFunctions(): void {
    this.unifiedCommunalFunctions.set('getPosition', () => ({
      x1: this.entityBlocksX1,
      x2: this.entityBlocksX2,
      y1: this.entityBlocksY1,
      y2: this.entityBlocksY2,
      z: this.entityBlocksZ
    }));
    
    this.unifiedCommunalFunctions.set('getHealth', () => this.healthPoints);
    this.unifiedCommunalFunctions.set('setHealth', (health: number) => {
      this.healthPoints = health;
      if (this.healthPoints <= 0) {
        this.onDestroy();
      }
    });
    
    this.unifiedCommunalFunctions.set('getCommonName', () => this.getUST('CommonName'));
    this.unifiedCommunalFunctions.set('setCommonName', (name: string) => this.setUST('CommonName', name));
  }

  /**
   * 创建函数 - 在棋子创建时调用
   */
  private onCreate(): void {
    console.log(`ChessEntity "${this.getUST('CommonName')}" created at ${new Date(this.createdTime).toISOString()}`);
  }

  /**
   * 销毁函数 - 在棋子销毁时调用
   */
  private onDestroy(): void {
    this.destroyedTime = Date.now();
    console.log(`ChessEntity "${this.getUST('CommonName')}" destroyed at ${new Date(this.destroyedTime).toISOString()}`);
  }

  /**
   * 设置统一字符串标签
   */
  setUST(key: string, value: string): void {
    this.ust.set(key, value);
  }

  /**
   * 获取统一字符串标签
   */
  getUST(key: string): string | undefined {
    return this.ust.get(key);
  }

  /**
   * 设置自定义字符串标签
   */
  setCST(key: string, value: string): void {
    this.cst.set(key, value);
  }

  /**
   * 获取自定义字符串标签
   */
  getCST(key: string): string | undefined {
    return this.cst.get(key);
  }

  /**
   * 添加自定义私有函数
   */
  addCPF(name: string, func: Function): void {
    this.customPrivateFunctions.set(name, func);
  }

  /**
   * 执行自定义私有函数
   */
  executeCPF(name: string, ...args: any[]): any {
    const func = this.customPrivateFunctions.get(name);
    if (func) {
      return func(...args);
    }
    return undefined;
  }

  /**
   * 获取统一公有函数
   */
  getUCF(name: string): Function | undefined {
    return this.unifiedCommunalFunctions.get(name);
  }

  /**
   * 获取棋子中心位置
   */
  getCenterPosition(): { x: number, y: number, z: number } {
    return {
      x: (this.entityBlocksX1 + this.entityBlocksX2) / 2,
      y: (this.entityBlocksY1 + this.entityBlocksY2) / 2,
      z: this.entityBlocksZ / 2
    };
  }

  /**
   * 获取棋子宽度（方格数）
   */
  getWidth(): number {
    return Math.abs(this.entityBlocksX2 - this.entityBlocksX1) + 1;
  }

  /**
   * 获取棋子高度（方格数）
   */
  getHeight(): number {
    return Math.abs(this.entityBlocksY2 - this.entityBlocksY1) + 1;
  }

  // Getter 和 Setter 方法
  getFrontTexture(): string { return this.frontTexture; }
  setFrontTexture(texture: string): void { this.frontTexture = texture; }

  getEntityBlocksX1(): number { return this.entityBlocksX1; }
  setEntityBlocksX1(x1: number): void { this.entityBlocksX1 = x1; }

  getEntityBlocksX2(): number { return this.entityBlocksX2; }
  setEntityBlocksX2(x2: number): void { this.entityBlocksX2 = x2; }

  getEntityBlocksY1(): number { return this.entityBlocksY1; }
  setEntityBlocksY1(y1: number): void { this.entityBlocksY1 = y1; }

  getEntityBlocksY2(): number { return this.entityBlocksY2; }
  setEntityBlocksY2(y2: number): void { this.entityBlocksY2 = y2; }

  getEntityBlocksZ(): number { return this.entityBlocksZ; }
  setEntityBlocksZ(z: number): void { this.entityBlocksZ = z; }

  getEntityMargin(): number { return this.entityMargin; }
  setEntityMargin(margin: number): void { this.entityMargin = margin; }

  getHealthPoints(): number { return this.healthPoints; }
  setHealthPoints(health: number): void { 
    this.healthPoints = health;
    if (this.healthPoints <= 0) {
      this.onDestroy();
    }
  }

  getJusticePoints(): number { return this.justicePoints; }
  setJusticePoints(justice: number): void { this.justicePoints = justice; }

  getCreatedTime(): number { return this.createdTime; }
  getDestroyedTime(): number { return this.destroyedTime; }
}

/**
 * WebGL渲染器类 - 使用WebGL进行3D渲染
 */
class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  
  // 着色器程序
  private shaderProgram: WebGLProgram | null = null;
  
  // 缓冲区
  private positionBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private textureCoordBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  
  // 矩阵
  private projectionMatrix = mat4.create();
  private viewMatrix = mat4.create();
  private modelMatrix = mat4.create();
  
  // 着色器属性位置
  private aPositionLocation: number = -1;
  private aColorLocation: number = -1;
  private aTextureCoordLocation: number = -1;
  private uProjectionMatrixLocation: WebGLUniformLocation | null = null;
  private uViewMatrixLocation: WebGLUniformLocation | null = null;
  private uModelMatrixLocation: WebGLUniformLocation | null = null;
  
  // 状态引用
  private cameraX: typeof nowCameraPointX;
  private cameraY: typeof nowCameraPointY;
  private zoomLevel: typeof nowZoomLevel;
  private perfMode: typeof performanceMode;
  private fps: typeof performFps;
  private frameCount: typeof performFrameCount;
  private lastFpsUpdate: typeof performLastFpsUpdate;
  private isDragging: typeof mouseIsDragging;
  
  // 渲染状态
  private lastRenderTime = 0;
  private targetFPS = 60;
  private frameInterval = 1000 / this.targetFPS;
  
  // 棋子管理
  private chessEntities: ChessEntity[] = [];
  
  // 贴图管理
  private textures: Map<string, WebGLTexture> = new Map();
  private textureLoading: Map<string, boolean> = new Map();
  
  // 鼠标状态
  private mouseXLast = 0;
  private mouseYLast = 0;

  constructor(
    canvasElement: HTMLCanvasElement,
    cameraX: typeof nowCameraPointX,
    cameraY: typeof nowCameraPointY,
    zoomLevel: typeof nowZoomLevel,
    perfMode: typeof performanceMode,
    fps: typeof performFps,
    frameCount: typeof performFrameCount,
    lastFpsUpdate: typeof performLastFpsUpdate,
    isDragging: typeof mouseIsDragging
  ) {
    this.canvas = canvasElement;
    
    // 获取WebGL上下文
    const gl = this.canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;
    
    // 保存状态引用
    this.cameraX = cameraX;
    this.cameraY = cameraY;
    this.zoomLevel = zoomLevel;
    this.perfMode = perfMode;
    this.fps = fps;
    this.frameCount = frameCount;
    this.lastFpsUpdate = lastFpsUpdate;
    this.isDragging = isDragging;
    
    // 设置Canvas尺寸
    this.canvas.width = windowWidth.value;
    this.canvas.height = windowHeight.value;
    
    // 初始化WebGL
    this.initWebGL();
    
    // 设置初始光标样式
    this.canvas.style.cursor = 'grab';
  }

  /**
   * 初始化WebGL
   */
  private initWebGL(): void {
    const gl = this.gl;
    
    // 设置视口 (显示范围 x1,y1 , x2,y2)左下角，右上角
    // 以屏幕左下角为中心 横向向右 为 x+ 竖向向上为 y+
    // gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    // 设置清除颜色 (R G B A)范围 0-1 当调用 clear() 方法时使用此颜色值
    gl.clearColor(0.1, 0.1, 0.1, 0.1);
    
    // 如果需要则启用深度测试
    // gl.enable(gl.DEPTH_TEST);
    
    // 启用混合（用于透明纹理）
    gl.enable(gl.BLEND);
    // 定义了使用哪个函数来作为混合像素的算法
    gl.blendFunc(
      gl.SRC_ALPHA,//源混合因子的乘数:将所有颜色与源 alpha 值相乘。
      gl.ONE_MINUS_SRC_ALPHA//目标混合因子的乘数:将所有颜色与 1 减去每个源颜色相乘。
    );
    
    // 初始化着色器
    this.initShaders();
    
    // 初始化缓冲区
    this.initBuffers();
    
    // 初始化矩阵
    this.updateMatrices();
  }

  /**
   * 初始化着色器
   */
  private initShaders(): void {
    const gl = this.gl;
    
    // 顶点着色器源码(GSLS代码)
    const Vertex_Shader_Source_Code = `
      /*
      A attribute 是 逐顶点 的数据，由 CPU 端（比如 JavaScript 或 C++）通过缓冲区传入
      B vec2/3/4是连续存储的浮点数,分别占用2/3/4个浮点数的存储空间
      C attribute vec3 aPosition 类似于Java中的 private float[] aPosition
      D 限定符 uniform 用于表示一个统一且只读的全局变量，该变量为所有着色器所共用
      E mat4 是一个宽松但类型安全的4X4矩阵类型,既接受普通数组,也接受类数组对象Float32Array只要长度是16个实数即可
      F MVP 矩阵 blog.csdn.net/qq_65461674/article/details/139216662
      G 限定符 varying 限定的变量只能在shader之间传递,是Vertex Shader(顶点着色器)的输出,Fragment Shader(片段着色器)的输入,即只能从顶点着色器传递到片段着色器的变量
      */
      attribute vec3 aPosition;//顶点的模型坐标xyz
      attribute vec4 aColor;//顶点的颜色rgba
      attribute vec2 aTextureCoord;//顶点的纹理坐标uv
      
      uniform mat4 uModelMatrix;//把模型从 模型空间 变换到 世界空间
      uniform mat4 uViewMatrix;//把世界空间变换到 视图空间 相机视角
      uniform mat4 uProjectionMatrix;//把视图空间变换到 裁剪空间 透视或正交投影
      
      varying vec4 vColor;
      varying vec2 vTextureCoord;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);//内置变量,必须赋值,表示顶点在 裁剪空间 的最终位置,vec4把 3D 坐标变成 齐次坐标w=1以便进行 4x4 矩阵乘法
        vColor = aColor;//把颜色原封不动传给片段着色器
        vTextureCoord = aTextureCoord;//把纹理坐标也传给片段着色器
      }
    `;
    
    // 片段着色器源码(GSLS代码) 有纹理就用纹理×顶点色，没纹理就用纯顶点色
    const Fragment_Shader_Source_Code = `
      precision mediump float;//精度声明10bit
      
      varying vec4 vColor;//顶点颜色rgba 0-1
      varying vec2 vTextureCoord;//纹理坐标uv 0-1
      
      uniform sampler2D uSampler;//2D 纹理对象 WebGL 中通过 gl.activeTexture + gl.bindTexture 设置
      uniform bool uUseTexture;//如果为true则启用纹理
      
      void main() {
        if (uUseTexture) {
          gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor;//内置输出变量表示当前像素最终颜色,texture2D(uSampler,vTextureCoord)根据插值后的UV坐标,从纹理里采样一个RGBA颜色
        } else {
          gl_FragColor = vColor;//没有纹理使用顶点绘色
        }
      }
    `;
    
    // 创建着色器程序
    const vertexShader = this.loadShader(gl.VERTEX_SHADER, Vertex_Shader_Source_Code);
    const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, Fragment_Shader_Source_Code);
    
    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }
    
    // 创建着色器程序
    this.shaderProgram = gl.createProgram();
    if (!this.shaderProgram) {
      throw new Error('Failed to create shader program');
    }
    
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);
    
    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
      throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(this.shaderProgram));
    }
    
    // 获取属性位置
    this.aPositionLocation = gl.getAttribLocation(this.shaderProgram, 'aPosition');
    this.aColorLocation = gl.getAttribLocation(this.shaderProgram, 'aColor');
    this.aTextureCoordLocation = gl.getAttribLocation(this.shaderProgram, 'aTextureCoord');
    
    // 获取uniform位置
    this.uProjectionMatrixLocation = gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix');
    this.uViewMatrixLocation = gl.getUniformLocation(this.shaderProgram, 'uViewMatrix');
    this.uModelMatrixLocation = gl.getUniformLocation(this.shaderProgram, 'uModelMatrix');
  }

  /**
   * 加载着色器
   */
  private loadShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    
    if (!shader) {
      console.error('Unable to create shader');
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

  /**
   * 初始化缓冲区
   */
  private initBuffers(): void {
    const gl = this.gl;
    
    // 创建位置缓冲区
    this.positionBuffer = gl.createBuffer();
    
    // 创建颜色缓冲区
    this.colorBuffer = gl.createBuffer();
    
    // 创建纹理坐标缓冲区
    this.textureCoordBuffer = gl.createBuffer();
    
    // 创建索引缓冲区
    this.indexBuffer = gl.createBuffer();
  }

  /**
   * 更新矩阵
   */
  private updateMatrices(): void {
    // 设置投影矩阵（正交投影）
    const aspect = this.canvas.width / this.canvas.height;
    const zoom = this.zoomLevel.value;
    const scaleX = zoom * 0.01;
    const scaleY = zoom * 0.01 * aspect;
    
    mat4.ortho(this.projectionMatrix, -scaleX, scaleX, -scaleY, scaleY, -100, 100);
    
    // 设置视图矩阵（等轴测视角）
    mat4.identity(this.viewMatrix);
    
    // 等轴测视角的旋转角度（约35.264度）
    const angle = Math.PI / 180 * 35.264;
    mat4.rotateX(this.viewMatrix, this.viewMatrix, -angle);
    mat4.rotateZ(this.viewMatrix, this.viewMatrix, Math.PI / 4);
    
    // 根据相机位置平移视图
    mat4.translate(this.viewMatrix, this.viewMatrix, [
      -this.cameraX.value * 0.01,
      -this.cameraY.value * 0.01,
      0
    ]);
    
    // 重置模型矩阵
    mat4.identity(this.modelMatrix);
  }

  /**
   * 加载纹理
   */
  private async loadTexture(textureName: string): Promise<WebGLTexture | null> {
    const gl = this.gl;
    
    // 如果纹理已加载，直接返回
    if (this.textures.has(textureName)) {
      return this.textures.get(textureName)!;
    }
    
    // 如果正在加载，等待
    if (this.textureLoading.get(textureName)) {
      return new Promise((resolve) => {
        const checkTexture = () => {
          setTimeout(() => {
            if (this.textures.has(textureName)) {
              resolve(this.textures.get(textureName)!);
            } else if (this.textureLoading.get(textureName)) {
              checkTexture();
            } else {
              resolve(null);
            }
          }, 100);
        };
        checkTexture();
      });
    }
    
    // 标记为正在加载
    this.textureLoading.set(textureName, true);
    
    return new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) {
        console.warn(`Failed to create texture: ${textureName}`);
        this.textureLoading.set(textureName, false);
        resolve(null);
        return;
      }
      
      const image = new Image();
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        this.textures.set(textureName, texture);
        this.textureLoading.set(textureName, false);
        resolve(texture);
      };
      
      image.onerror = () => {
        console.warn(`Failed to load texture image: ${textureName}`);
        this.textureLoading.set(textureName, false);
        resolve(null);
      };
      
      image.src = `/textures/${textureName}`;
    });
  }

  /**
   * 添加棋子实体
   */
  addChessEntity(entity: ChessEntity): void {
    this.chessEntities.push(entity);
    // 预加载棋子的贴图
    this.loadTexture(entity.getFrontTexture());
  }

  /**
   * 移除棋子实体
   */
  removeChessEntity(entity: ChessEntity): void {
    const index = this.chessEntities.indexOf(entity);
    if (index > -1) {
      this.chessEntities.splice(index, 1);
    }
  }

  /**
   * 获取所有棋子实体
   */
  getChessEntities(): ChessEntity[] {
    return this.chessEntities;
  }

  /**
   * 开始渲染循环
   */
  startRenderLoop(): void {
    requestAnimationFrame(this.render.bind(this));
  }

  /**
   * 渲染函数
   */
  private render(timestamp: number): void {
    // 控制渲染频率
    const deltaTime = timestamp - this.lastRenderTime;
    if (deltaTime < this.frameInterval) {
      requestAnimationFrame(this.render.bind(this));
      return;
    }
    
    this.lastRenderTime = timestamp - (deltaTime % this.frameInterval);
    
    // 更新矩阵
    this.updateMatrices();
    
    // 清除画布
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // 使用着色器程序
    this.gl.useProgram(this.shaderProgram);
    
    // 设置uniform
    this.gl.uniformMatrix4fv(this.uProjectionMatrixLocation, false, this.projectionMatrix);
    this.gl.uniformMatrix4fv(this.uViewMatrixLocation, false, this.viewMatrix);
    this.gl.uniformMatrix4fv(this.uModelMatrixLocation, false, this.modelMatrix);
    
    // 绘制网格
    this.drawGrid();
    
    // 绘制棋子
    this.drawChessEntities();
    
    // 更新FPS计数
    this.updateFPS(timestamp);
    
    // 继续渲染循环
    requestAnimationFrame(this.render.bind(this));
  }

  /**
   * 绘制网格
   */
  private drawGrid(): void {
    if (!config.ShowBlockBoundary && !config.ShowChunkBoundary) {
      return;
    }
    
    const gl = this.gl;
    const zoom = this.zoomLevel.value;
    
    // 根据缩放级别决定绘制细节
    const blockDetailLevel = this.getBlockDetailLevel();
    const chunkDetailLevel = this.getChunkDetailLevel();
    
    if (config.ShowBlockBoundary && blockDetailLevel.drawBlocks) {
      this.drawBlockGrid(blockDetailLevel.blockStep);
    }
    
    if (config.ShowChunkBoundary) {
      this.drawChunkGrid(chunkDetailLevel);
    }
  }

  /**
   * 绘制方块网格
   */
  private drawBlockGrid(blockStep: number): void {
    const gl = this.gl;
    const visibleBlocks = this.getVisibleBlocks(blockStep);
    
    for (const block of visibleBlocks) {
      this.drawBlock(block.x, block.y, 0);
    }
  }

  /**
   * 绘制区块网格
   */
  private drawChunkGrid(chunkStep: number): void {
    const gl = this.gl;
    const visibleChunks = this.getVisibleChunks();
    
    for (const chunk of visibleChunks) {
      if (chunk.x % (config.ChunkBlockX * chunkStep) === 0 && chunk.y % (config.ChunkBlockY * chunkStep) === 0) {
        this.drawChunk(chunk.x, chunk.y);
      }
    }
  }

  /**
   * 绘制单个方块
   */
  private drawBlock(x: number, y: number, z: number): void {
    const gl = this.gl;
    
    // 创建菱形方块的顶点数据
    const positions = [
      // 底面菱形
      x, y, z,
      x + 1, y, z,
      x + 1, y + 1, z,
      x, y + 1, z,
    ];
    
    const colors = [
      0.7, 0.7, 0.7, 0.3,  // 灰色，半透明
      0.7, 0.7, 0.7, 0.3,
      0.7, 0.7, 0.7, 0.3,
      0.7, 0.7, 0.7, 0.3,
    ];
    
    const indices = [
      0, 1, 2,
      0, 2, 3
    ];
    
    // 设置缓冲区数据
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    // 设置属性指针
    gl.enableVertexAttribArray(this.aPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(this.aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    
    gl.enableVertexAttribArray(this.aColorLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.vertexAttribPointer(this.aColorLocation, 4, gl.FLOAT, false, 0, 0);
    
    // 禁用纹理
    gl.uniform1i(gl.getUniformLocation(this.shaderProgram!, 'uUseTexture'), 0);
    
    // 绘制
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * 绘制单个区块
   */
  private drawChunk(chunkX: number, chunkY: number): void {
    const gl = this.gl;
    
    // 创建区块边界线
    const positions = [
      // 边界线
      chunkX, chunkY, 0,
      chunkX + config.ChunkBlockX, chunkY, 0,
      
      chunkX + config.ChunkBlockX, chunkY, 0,
      chunkX + config.ChunkBlockX, chunkY + config.ChunkBlockY, 0,
      
      chunkX + config.ChunkBlockX, chunkY + config.ChunkBlockY, 0,
      chunkX, chunkY + config.ChunkBlockY, 0,
      
      chunkX, chunkY + config.ChunkBlockY, 0,
      chunkX, chunkY, 0,
    ];
    
    const colors = [
      1.0, 0.4, 0.4, 0.5,  // 红色，半透明
      1.0, 0.4, 0.4, 0.5,
      1.0, 0.4, 0.4, 0.5,
      1.0, 0.4, 0.4, 0.5,
      1.0, 0.4, 0.4, 0.5,
      1.0, 0.4, 0.4, 0.5,
      1.0, 0.4, 0.4, 0.5,
      1.0, 0.4, 0.4, 0.5,
    ];
    
    // 设置缓冲区数据
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    // 设置属性指针
    gl.enableVertexAttribArray(this.aPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(this.aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    
    gl.enableVertexAttribArray(this.aColorLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.vertexAttribPointer(this.aColorLocation, 4, gl.FLOAT, false, 0, 0);
    
    // 禁用纹理
    gl.uniform1i(gl.getUniformLocation(this.shaderProgram!, 'uUseTexture'), 0);
    
    // 绘制线条
    gl.drawArrays(gl.LINES, 0, positions.length / 3);
  }

  /**
   * 绘制棋子实体
   */
  private drawChessEntities(): void {
    if (this.zoomLevel.value < 0.125) {
      return;
    }
    
    for (const entity of this.chessEntities) {
      this.drawChessEntity(entity);
    }
  }

  /**
   * 绘制单个棋子实体
   */
  private drawChessEntity(entity: ChessEntity): void {
    const gl = this.gl;
    const center = entity.getCenterPosition();
    const width = entity.getWidth();
    const height = entity.getHeight();
    const depth = entity.getEntityBlocksZ();
    
    // 创建3D立方体表示棋子
    const x1 = entity.getEntityBlocksX1();
    const x2 = entity.getEntityBlocksX2();
    const y1 = entity.getEntityBlocksY1();
    const y2 = entity.getEntityBlocksY2();
    const z = 0;
    
    // 立方体顶点
    const positions = [
      // 底面
      x1, y1, z,
      x2, y1, z,
      x2, y2, z,
      x1, y2, z,
      
      // 顶面
      x1, y1, z + depth,
      x2, y1, z + depth,
      x2, y2, z + depth,
      x1, y2, z + depth,
    ];
    
    const colors = [
      // 底面 - 蓝色
      0.2, 0.2, 0.8, 0.8,
      0.2, 0.2, 0.8, 0.8,
      0.2, 0.2, 0.8, 0.8,
      0.2, 0.2, 0.8, 0.8,
      
      // 顶面 - 浅蓝色
      0.4, 0.4, 1.0, 0.8,
      0.4, 0.4, 1.0, 0.8,
      0.4, 0.4, 1.0, 0.8,
      0.4, 0.4, 1.0, 0.8,
    ];
    
    const indices = [
      // 底面
      0, 1, 2,
      0, 2, 3,
      
      // 顶面
      4, 5, 6,
      4, 6, 7,
      
      // 侧面
      0, 1, 5,
      0, 5, 4,
      
      1, 2, 6,
      1, 6, 5,
      
      2, 3, 7,
      2, 7, 6,
      
      3, 0, 4,
      3, 4, 7,
    ];
    
    // 设置缓冲区数据
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    // 设置属性指针
    gl.enableVertexAttribArray(this.aPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(this.aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    
    gl.enableVertexAttribArray(this.aColorLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.vertexAttribPointer(this.aColorLocation, 4, gl.FLOAT, false, 0, 0);
    
    // 禁用纹理
    gl.uniform1i(gl.getUniformLocation(this.shaderProgram!, 'uUseTexture'), 0);
    
    // 绘制
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * 根据缩放级别设置显示方块边界的细节程度
   */
  private getBlockDetailLevel(): { drawBlocks: boolean; blockStep: number } {
    if (this.zoomLevel.value >= 1) {
      return { drawBlocks: true, blockStep: 1 };
    } else if (this.zoomLevel.value >= 0.5) {
      return { drawBlocks: true, blockStep: 2 };
    } else if (this.zoomLevel.value >= 0.25) {
      return { drawBlocks: true, blockStep: 4 };
    } else if (this.zoomLevel.value >= 0.125) {
      return { drawBlocks: true, blockStep: 8 };
    } else {
      return { drawBlocks: false, blockStep: 16 };
    }
  }

  /**
   * 根据缩放级别设置显示区块边界的细节程度
   */
  private getChunkDetailLevel(): number {
    if (this.zoomLevel.value >= 0.25) {
      return 1;
    } else if (this.zoomLevel.value >= 0.0625) {
      return 2;
    } else {
      return 4;
    }
  }

  /**
   * 获取视野内的所有方格
   */
  private getVisibleBlocks(blockStep: number): Array<{x: number, y: number}> {
    const visibleBlocks: Array<{x: number, y: number}> = [];
    
    // 简化的可见性检查 - 在实际应用中需要更复杂的视锥体剔除
    const viewRange = 20 / this.zoomLevel.value;
    const startX = Math.floor(this.cameraX.value - viewRange);
    const endX = Math.ceil(this.cameraX.value + viewRange);
    const startY = Math.floor(this.cameraY.value - viewRange);
    const endY = Math.ceil(this.cameraY.value + viewRange);
    
    for (let x = startX; x <= endX; x += blockStep) {
      for (let y = startY; y <= endY; y += blockStep) {
        if (x >= worldBounds.MinBlockX && x <= worldBounds.MaxBlockX &&
            y >= worldBounds.MinBlockY && y <= worldBounds.MaxBlockY) {
          visibleBlocks.push({ x, y });
        }
      }
    }
    
    return visibleBlocks;
  }

  /**
   * 获取视野内的所有区块
   */
  private getVisibleChunks(): Array<{x: number, y: number}> {
    const visibleChunks: Array<{x: number, y: number}> = [];
    
    const viewRange = 40 / this.zoomLevel.value;
    const startChunkX = Math.floor((this.cameraX.value - viewRange) / config.ChunkBlockX) * config.ChunkBlockX;
    const endChunkX = Math.ceil((this.cameraX.value + viewRange) / config.ChunkBlockX) * config.ChunkBlockX;
    const startChunkY = Math.floor((this.cameraY.value - viewRange) / config.ChunkBlockY) * config.ChunkBlockY;
    const endChunkY = Math.ceil((this.cameraY.value + viewRange) / config.ChunkBlockY) * config.ChunkBlockY;
    
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += config.ChunkBlockX) {
      for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += config.ChunkBlockY) {
        if (chunkX >= worldBounds.MinBlockX && chunkX <= worldBounds.MaxBlockX &&
            chunkY >= worldBounds.MinBlockY && chunkY <= worldBounds.MaxBlockY) {
          visibleChunks.push({ x: chunkX, y: chunkY });
        }
      }
    }
    
    return visibleChunks;
  }

  /**
   * 鼠标按下事件处理
   */
  handleMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.isDragging.value = true;
      this.mouseXLast = e.clientX;
      this.mouseYLast = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  /**
   * 鼠标移动事件处理
   */
  handleMouseMove(e: MouseEvent): void {
    if (this.isDragging.value) {
      const deltaX = e.clientX - this.mouseXLast;
      const deltaY = e.clientY - this.mouseYLast;
      
      // 根据鼠标移动调整相机位置
      const moveScale = 0.5 / this.zoomLevel.value;
      this.cameraX.value -= deltaX * moveScale;
      this.cameraY.value -= deltaY * moveScale;
      
      // 限制相机范围
      this.cameraX.value = Math.max(worldBounds.MinBlockX, Math.min(worldBounds.MaxBlockX, this.cameraX.value));
      this.cameraY.value = Math.max(worldBounds.MinBlockY, Math.min(worldBounds.MaxBlockY, this.cameraY.value));
      
      this.mouseXLast = e.clientX;
      this.mouseYLast = e.clientY;
    }
  }

  /**
   * 鼠标释放事件处理
   */
  handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.isDragging.value = false;
      this.canvas.style.cursor = 'grab';
    }
  }

  /**
   * 鼠标滚轮事件处理
   */
  handleWheel(e: WheelEvent): void {
    e.preventDefault();
    
    const zoomFactor = 1.1;
    
    if (e.deltaY < 0) {
      this.zoomLevel.value = Math.min(config.ZoomMax, this.zoomLevel.value * zoomFactor);
    } else {
      this.zoomLevel.value = Math.max(config.ZoomMin, this.zoomLevel.value / zoomFactor);
    }
  }

  /**
   * 更新FPS计数
   */
  private updateFPS(timestamp: number): void {
    this.frameCount.value++;
    
    if (timestamp - this.lastFpsUpdate.value >= 1000) {
      this.fps.value = Math.round((this.frameCount.value * 1000) / (timestamp - this.lastFpsUpdate.value));
      this.frameCount.value = 0;
      this.lastFpsUpdate.value = timestamp;
    }
  }

  /**
   * 切换性能模式
   */
  togglePerformanceMode(): void {
    this.perfMode.value = !this.perfMode.value;
    if (this.perfMode.value) {
      this.targetFPS = 30;
      this.frameInterval = 1000 / 30;
    } else {
      this.targetFPS = 60;
      this.frameInterval = 1000 / 60;
    }
  }

  /**
   * 调整Canvas大小
   */
  resize(): void {
    this.canvas.width = windowWidth.value;
    this.canvas.height = windowHeight.value;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.textures.clear();
    this.textureLoading.clear();
    this.chessEntities = [];
    
    // 清理WebGL资源
    if (this.shaderProgram) {
      this.gl.deleteProgram(this.shaderProgram);
    }
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
    }
    if (this.colorBuffer) {
      this.gl.deleteBuffer(this.colorBuffer);
    }
    if (this.textureCoordBuffer) {
      this.gl.deleteBuffer(this.textureCoordBuffer);
    }
    if (this.indexBuffer) {
      this.gl.deleteBuffer(this.indexBuffer);
    }
    
    this.textures.forEach(texture => {
      this.gl.deleteTexture(texture);
    });
  }
}

/** 
 * 初始化
 */ 
onMounted(() => {
  window.addEventListener('resize', onResize);
  
  // 初始化WebGLRenderer
  const canvasElement = document.getElementById('sandboxCanvas') as HTMLCanvasElement;
  if (canvasElement) {
    webglRenderer = new WebGLRenderer(
      canvasElement,
      nowCameraPointX,
      nowCameraPointY,
      nowZoomLevel,
      performanceMode,
      performFps,
      performFrameCount,
      performLastFpsUpdate,
      mouseIsDragging
    );
    
    // 创建白色的椅子棋子并添加到沙盘
    const whiteChair = new ChessEntity(
      'whiteChair001.png',
      0,
      2,
      0,
      2,
      2, // 高度为2个单位
      '白色的椅子'
    );
    
    // 设置一些自定义属性
    whiteChair.setCST('Material', 'Wood');
    whiteChair.setCST('Color', 'White');
    whiteChair.setHealthPoints(15); // 设置生命值
    
    // 添加自定义私有函数
    whiteChair.addCPF('sitOn', () => {
      console.log('Someone is sitting on the white chair!');
    });
    
    // 添加到沙盘
    webglRenderer.addChessEntity(whiteChair);
    
    // 添加事件监听器
    canvasElement.addEventListener('mousedown', (e) => webglRenderer!.handleMouseDown(e));
    canvasElement.addEventListener('mousemove', (e) => webglRenderer!.handleMouseMove(e));
    canvasElement.addEventListener('mouseup', (e) => webglRenderer!.handleMouseUp(e));
    canvasElement.addEventListener('wheel', (e) => webglRenderer!.handleWheel(e));
    
    // 开始渲染循环
    webglRenderer.startRenderLoop();
  }
});

/** 
 * 销毁阶段
 */ 
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  if (webglRenderer) {
    webglRenderer.destroy();
    webglRenderer = null;
  }
});

/** 
 * 用于更新屏幕显示大小
 */ 
function onResize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
  if (webglRenderer) {
    webglRenderer.resize();
  }
}

/** 
 * 切换性能模式
 */ 
function togglePerformanceMode() {
  if (webglRenderer) {
    webglRenderer.togglePerformanceMode();
  }
}
</script>

<template>
  <div class="page-neuro-sandbox-container">
    <div class="center-sandbox" id="sandbox">
      <canvas id="sandboxCanvas"></canvas>
    </div>

    <div class="float-menubar" id="menubar">
      <div class="menu-controls">
        <h3>NeuroSandbox 控制 (WebGL 3D)</h3>
        <div class="control-group">
          <button @click="nowZoomLevel = 1">重置缩放</button>
          <button @click="nowCameraPointX = 0; nowCameraPointY = 0">回到中心</button>
          <button @click="togglePerformanceMode" :class="{ 'active': performanceMode }">
            {{ performanceMode ? '性能模式' : '节能模式' }}
          </button>
        </div>
        <div class="world-info">
          <p>世界范围: X[{{ worldBounds.MinBlockX }}, {{ worldBounds.MaxBlockX }}] Y[{{ worldBounds.MinBlockY }}, {{ worldBounds.MaxBlockY }}]</p>
          <p>区块范围: [{{ worldBounds.MinChunkX }}, {{ worldBounds.MaxChunkXValue }}]</p>
        </div>
      </div>
    </div>

    <div v-if="config.ShowDebuggingPanel" class="float-debugging" id="debugging">
      <h3>调试信息 (WebGL)</h3>
      <p>相机坐标 X: {{ nowCameraPointX.toFixed(2) }}</p>
      <p>相机坐标 Y: {{ nowCameraPointY.toFixed(2) }}</p>
      <p>缩放级别: {{ nowZoomLevel.toFixed(4) }}</p>
      <p>窗口宽度: {{ windowWidth }}</p>
      <p>窗口高度: {{ windowHeight }}</p>
      <p>长边平行: {{ longSideParallel }}</p>
      <p>拖动状态: {{ mouseIsDragging ? '拖动中' : '未拖动' }}</p>
      <p>当前区块: ({{ Math.floor(nowCameraPointX / 16) }}, {{ Math.floor(nowCameraPointY / 16) }})</p>
      <p>FPS: {{ performFps }}</p>
      <p>性能模式: {{ performanceMode ? '开启' : '关闭' }}</p>
    </div>
  </div>
  <ViewFilingLicense></ViewFilingLicense>
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
</style>