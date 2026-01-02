// The relative position of this file: src/class/rendering_stress_test/SceneManager.ts
// Code name:RH3
// 负责Three.js场景、相机、渲染器、灯光、各种模型的创建和管理
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sceneConfig, cameraConfig, rendererConfig, lightConfig } from '@/config/recreationHallConfig';
import type Coord3D from '@/interface/Coord3D';
import CameraController from './CameraController';

// FPS计数器接口
interface FPSCounter {
  current: number;
  max: number;
  min: number;
  avg: number;
  history: number[];
  lastUpdate: number;
  frameCount: number;
}

export default class SceneManager {
  public  scene: THREE.Scene = new THREE.Scene;
  public  camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera;
  public  renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer;
  public  labelRenderer: CSS2DRenderer = new CSS2DRenderer;
  public  ambientLight: THREE.AmbientLight = new THREE.AmbientLight;

  private directionalLight1: THREE.DirectionalLight = new THREE.DirectionalLight;
  private directionalLight2: THREE.DirectionalLight = new THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight = new THREE.DirectionalLight;
  private centerGridHelper: THREE.GridHelper = new THREE.GridHelper;
  private centerAxesHelper: THREE.AxesHelper = new THREE.AxesHelper;
  private ground: THREE.Mesh = new THREE.Mesh;
  
  private sceneRef: HTMLElement | null = null;
  private onProgressUpdate?: (increment: number, status: string) => void;

  private cameraController: CameraController | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  private animationId: number | null = null;


  // 调试信息相关
  private debugPanel: HTMLElement | null = null;
  private fpsCounter: FPSCounter = {
    current: 0,
    max: 0,
    min: Infinity,
    avg: 0,
    history: [],
    lastUpdate: 0,
    frameCount: 0
  };
  private lastFrameTime: number = 0;
  private isDebugPanelVisible: boolean = true;


  constructor(
    sceneRef: HTMLElement,
    onProgressUpdate?: (increment: number, status: string) => void
  ) {
    this.sceneRef = sceneRef;
    this.onProgressUpdate = onProgressUpdate;
  }

  public init() {
    this.createScene();
    this.createCamera();
    this.createRenderer();
    this.createLights();
    this.createHelpers();
    this.createGround();
    this.createStaticModel();
    this.initLabelRenderer();
    this.initCameraController();
    this.startAnimation();
  }

  private createScene() {
    this.scene = new THREE.Scene();
    this.scene.name = "root_scene";
    this.scene.background = new THREE.Color(sceneConfig.color.tempBackgroundColor);
  }

  private createCamera() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      cameraConfig.fov,
      aspectRatio,
      cameraConfig.near,
      cameraConfig.far
    );
    this.camera.position.set(
      cameraConfig.position.x,
      cameraConfig.position.y,
      cameraConfig.position.z
    );
    this.camera.name = "player_camera";
  }

  private createRenderer() {
    if (!this.sceneRef) return;
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: rendererConfig.antialias,
      alpha: rendererConfig.alpha
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = rendererConfig.shadowMap.enabled;
    this.renderer.shadowMap.type = rendererConfig.shadowMap.type;
    this.sceneRef.appendChild(this.renderer.domElement);
  }

  private createLights() {
    // 环境光源 - 增强强度
    this.ambientLight = new THREE.AmbientLight(
      lightConfig.ambient.color,
      lightConfig.ambient.intensity * 2 // 增强环境光强度
    );
    this.ambientLight.name = "ambient_light";
    this.scene.add(this.ambientLight);

    // 创建6个顶灯（定向光）
    const topLightConfigs = [
      // 原有的2个定向光配置
      {
        color: lightConfig.directional.color,
        intensity: lightConfig.directional.intensity * 1.5, // 增强强度
        position: { x: 3, y: 5, z: 2 }, // 提高Y轴高度
        name: "top_light_1"
      },
      {
        color: lightConfig.directional2.color,
        intensity: lightConfig.directional2.intensity * 1.5, // 增强强度
        position: { x: -3, y: 5, z: -2 }, // 提高Y轴高度
        name: "top_light_2"
      },
      // 新增4个顶灯
      {
        color: 0xffffff,
        intensity: 3.0,
        position: { x: 0, y: 5, z: 4 },
        name: "top_light_3"
      },
      {
        color: 0xffffff,
        intensity: 3.0,
        position: { x: 0, y: 5, z: -4 },
        name: "top_light_4"
      },
      {
        color: 0xffffff,
        intensity: 2.5,
        position: { x: 4, y: 5, z: 0 },
        name: "top_light_5"
      },
      {
        color: 0xffffff,
        intensity: 2.5,
        position: { x: -4, y: 5, z: 0 },
        name: "top_light_6"
      }
    ];

    // 创建并添加所有顶灯
    topLightConfigs.forEach((config, index) => {
      const topLight = new THREE.DirectionalLight(
        config.color,
        config.intensity
      );
      
      topLight.position.set(
        config.position.x,
        config.position.y,
        config.position.z
      );
      
      // 只有前两个主灯光投射阴影，避免性能开销过大
      if (index < 2) {
        topLight.castShadow = true;
        const shadowConfig = index === 0 ? lightConfig.directional.shadow : lightConfig.directional2.shadow;
        this.configureShadow(topLight, shadowConfig);
      } else {
        topLight.castShadow = false; // 其他灯光不投射阴影
      }
      
      topLight.name = config.name;
      
      // 设置灯光朝向地面
      topLight.target.position.set(0, 0, 0);
      this.scene.add(topLight.target);
      
      this.scene.add(topLight);
      
      // 保存到对应属性
      if (index === 0) this.directionalLight1 = topLight;
      else if (index === 1) this.directionalLight2 = topLight;
    });

    // 补光光源 - 增强强度
    this.fillLight = new THREE.DirectionalLight(
      lightConfig.fillLight.color,
      lightConfig.fillLight.intensity * 1.5 // 增强强度
    );
    this.fillLight.position.set(
      lightConfig.fillLight.position.x,
      lightConfig.fillLight.position.y + 1, // 稍微提高位置
      lightConfig.fillLight.position.z
    );
    this.fillLight.castShadow = false;
    this.fillLight.name = "fill_light";
    this.scene.add(this.fillLight);

    // 额外添加一个半球光（HemisphereLight）来模拟天光和地面反射
    const hemisphereLight = new THREE.HemisphereLight(
      0x87CEEB, // 天空颜色（浅蓝色）
      0x8B7355, // 地面颜色（棕色）
      0.8 // 强度
    );
    hemisphereLight.position.set(0, 10, 0);
    hemisphereLight.name = "hemisphere_light";
    this.scene.add(hemisphereLight);

    // 添加一个点光源作为补充
    const pointLight = new THREE.PointLight(
      0xffffff, // 颜色
      1.0, // 强度
      50, // 距离
      2 // 衰减
    );
    pointLight.position.set(0, 3, 0);
    pointLight.name = "center_point_light";
    pointLight.castShadow = false;
    this.scene.add(pointLight);
  }


  private createStaticModel(): void {
    // 定义静态模型路径
    const modelPath = "/gltf/recreation_hall/test_build/test.gltf";
    
    // 创建GLTFLoader实例
    const loader = new GLTFLoader();
    
    // 显示加载进度
    this.onProgressUpdate?.(0, "正在加载休闲大厅模型...");
    
    // 加载模型
    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;
        
        // 设置模型位置、旋转和缩放
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.scale.set(1, 1, 1);
        model.name = "recreation_hall_static";
        
        // 遍历模型的所有子对象，设置阴影和优化材质
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // 启用阴影
            child.castShadow = true;
            child.receiveShadow = true;
            
            // 优化材质性能
            if (child.material) {
              // 如果是标准或物理材质，转换为兰伯特材质以提高性能
              if (child.material instanceof THREE.MeshStandardMaterial || 
                  child.material instanceof THREE.MeshPhysicalMaterial) {
                const lambertMaterial = new THREE.MeshLambertMaterial();
                
                // 复制基础属性
                if (child.material.map) lambertMaterial.map = child.material.map;
                if (child.material.color) lambertMaterial.color = child.material.color.clone();
                if (child.material.transparent !== undefined) lambertMaterial.transparent = child.material.transparent;
                if (child.material.opacity !== undefined) lambertMaterial.opacity = child.material.opacity;
                
                // 更新纹理
                if (lambertMaterial.map) {
                  lambertMaterial.map.needsUpdate = true;
                }
                
                child.material = lambertMaterial;
              }
              
              // 确保材质启用阴影
              child.material.needsUpdate = true;
            }
          }
        });
        
        // 将模型添加到场景
        this.scene.add(model);
        
        // 更新进度
        this.onProgressUpdate?.(1, "休闲大厅模型加载完成");
        
        // 输出模型信息（调试用）
        console.log("静态模型加载完成:", model);
        
        // 如果模型有动画，可以在这里设置
        if (gltf.animations && gltf.animations.length > 0) {
          console.log("模型包含动画:", gltf.animations.length, "个动画片段");
        }
        
        // 可选：调整模型位置使其与地面对齐
        this.adjustModelPosition(model);
      },
      // 加载进度回调
      (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          this.onProgressUpdate?.(
            percentComplete / 100, 
            `正在加载模型... ${Math.round(percentComplete)}%`
          );
        }
      },
      // 错误处理
      (error) => {
        console.error("静态模型加载失败:", error);
        this.onProgressUpdate?.(1, "模型加载失败，将使用默认场景");
        
        // 加载失败时创建简单的替代场景
        this.createFallbackScene();
      }
    );
  }

  private createFallbackScene(): void {
    console.log("创建备用场景...");
    
    // 创建一些简单的几何体作为备用场景
    const geometries = [
      // 舞台
      {
        type: 'box' as const,
        position: { x: 0, y: 0.5, z: -5 },
        size: { width: 10, height: 1, depth: 5 },
        color: 0x8B4513,
        name: 'stage'
      },
      // 电影院屏幕
      {
        type: 'plane' as const,
        position: { x: 0, y: 3, z: -8 },
        size: { width: 8, height: 4.5 },
        color: 0x000000,
        name: 'screen'
      },
      // 椅子组
      {
        type: 'chairGroup' as const,
        position: { x: 0, y: 0, z: 5 },
        count: 4,
        spacing: 2.5,
        color: 0x2E8B57,
        name: 'chairs'
      },
      // 桌子
      {
        type: 'box' as const,
        position: { x: 5, y: 0.75, z: 0 },
        size: { width: 2, height: 1.5, depth: 1 },
        color: 0xD2691E,
        name: 'table'
      }
    ];
    
    geometries.forEach((geo) => {
      if (geo.type === 'box') {
        const geometry = new THREE.BoxGeometry(
          geo.size.width, 
          geo.size.height, 
          geo.size.depth
        );
        const material = new THREE.MeshLambertMaterial({ color: geo.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(geo.position.x, geo.position.y, geo.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = geo.name;
        this.scene.add(mesh);
      } 
      else if (geo.type === 'plane') {
        const geometry = new THREE.PlaneGeometry(geo.size.width, geo.size.height);
        const material = new THREE.MeshLambertMaterial({ 
          color: geo.color,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(geo.position.x, geo.position.y, geo.position.z);
        mesh.rotation.y = Math.PI;
        mesh.name = geo.name;
        this.scene.add(mesh);
      }
      else if (geo.type === 'chairGroup') {
        // 创建一组简单的椅子
        for (let i = 0; i < geo.count; i++) {
          const chairGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
          const chairMaterial = new THREE.MeshLambertMaterial({ color: geo.color });
          const chair = new THREE.Mesh(chairGeometry, chairMaterial);
          
          const x = geo.position.x + (i - (geo.count - 1) / 2) * geo.spacing;
          chair.position.set(x, geo.position.y + 0.5, geo.position.z);
          chair.castShadow = true;
          chair.receiveShadow = true;
          chair.name = `${geo.name}_${i}`;
          this.scene.add(chair);
        }
      }
    });
    
    // 添加一些人物占位符
    this.createPlaceholderCharacters();
    
    console.log("备用场景创建完成");
  }

  private createPlaceholderCharacters(): void {
    // 创建简单的人物占位符（圆柱体）
    const characters = [
      { position: { x: 2, y: 0, z: -2 }, color: 0xFF6B6B, name: 'person_1' },
      { position: { x: -2, y: 0, z: -2 }, color: 0x4ECDC4, name: 'person_2' },
      { position: { x: 3, y: 0, z: 3 }, color: 0x45B7D1, name: 'person_3' },
      { position: { x: -3, y: 0, z: 3 }, color: 0x96CEB4, name: 'person_4' },
    ];
    
    characters.forEach((char) => {
      // 身体
      const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
      const bodyMaterial = new THREE.MeshLambertMaterial({ color: char.color });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.set(char.position.x, 0.75, char.position.z);
      body.castShadow = true;
      body.receiveShadow = true;
      body.name = char.name;
      this.scene.add(body);
      
      // 头部
      const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
      const headMaterial = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 }); // 肤色
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.set(char.position.x, 1.65, char.position.z);
      head.castShadow = true;
      head.receiveShadow = true;
      head.name = `${char.name}_head`;
      this.scene.add(head);
    });
  }

  private createHelpers() {
    this.centerGridHelper = new THREE.GridHelper(
      sceneConfig.helpers.grid.size,
      sceneConfig.helpers.grid.divisions,
      sceneConfig.color.helperGridCenterLine,
      sceneConfig.color.helperGrid
    );
    this.centerGridHelper.position.y = sceneConfig.helpers.grid.position.y;
    
    this.centerAxesHelper = new THREE.AxesHelper(sceneConfig.helpers.axes.size);
    this.centerAxesHelper.setColors(
      sceneConfig.color.axesX,
      sceneConfig.color.axesY,
      sceneConfig.color.axesZ
    );
    
    this.centerGridHelper.name = "center_grid_helper";
    this.centerAxesHelper.name = "center_axes_helper";
    
    this.scene.add(this.centerGridHelper);
    this.scene.add(this.centerAxesHelper);
  }

  private createGround() {
    const groundGeometry = new THREE.PlaneGeometry(
      sceneConfig.S_ground.size.width,
      sceneConfig.S_ground.size.height
    );
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: sceneConfig.S_ground.color,
      transparent: true,
      opacity: sceneConfig.S_ground.opacity
    });
    
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.name = 'S_ground';
    this.scene.add(this.ground);
  }

  public createPlayerNameTag(playerId: string, position: Coord3D, playerName: string): CSS2DObject|undefined {
    if (playerName === '') return undefined;

    const nameTagDiv = document.createElement('div');
    nameTagDiv.className = 'player-name-tag';
    nameTagDiv.textContent = playerName;
    nameTagDiv.style.color = 'white';
    nameTagDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    nameTagDiv.style.padding = '4px 8px';
    nameTagDiv.style.borderRadius = '4px';
    nameTagDiv.style.fontSize = '15px';
    nameTagDiv.style.fontFamily = 'Arial, sans-serif';
    nameTagDiv.style.pointerEvents = 'none';
    nameTagDiv.style.whiteSpace = 'nowrap';
    nameTagDiv.style.textAlign = 'center';
    nameTagDiv.style.backdropFilter = 'blur(2px)';
    nameTagDiv.style.border = '1px solid rgba(255, 255, 255, 0.3)';

    const nameTag = new CSS2DObject(nameTagDiv);
    nameTag.position.set(position.x, position.y + 0.18, position.z);
    nameTag.name = "player_name_tag";
    this.scene.add(nameTag);

    return nameTag;
  }

  public loadModel(
    modelPath: string,
    position: Coord3D,
    scale: number,
    name: string,
    onLoad?: (group: THREE.Group) => void
  ): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      
      this.onProgressUpdate?.(0, `加载${name}模型...`);
      
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
          
          model.name = name;
          onLoad?.(model);
          this.scene.add(model);
          
          this.onProgressUpdate?.(1, `${name}模型加载完成`);
          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`${name}模型加载失败:`, error);
          this.onProgressUpdate?.(1, `${name}模型加载失败，使用默认设置`);
          reject(error);
        }
      );
    });
  }

  private initCameraController(): void {
    if (!this.renderer.domElement) return;
    
    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement
    );
  }

  private initLabelRenderer() {
    if (!this.sceneRef) return;
    
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.labelRenderer.domElement.style.zIndex = '1000';
    
    this.sceneRef.appendChild(this.labelRenderer.domElement);
  }

  private startAnimation(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      // 计算时间增量
      const deltaTime = this.clock.getDelta();
      
      // 更新FPS计数器
      this.updateFPS(deltaTime);
      
      // 更新相机控制器
      if (this.cameraController) {
        this.cameraController.update(deltaTime);
      }
      
      // 渲染场景
      this.render();
      
      // 更新调试面板
      this.updateDebugPanel();
    };
    
    animate();
  }

  private configureShadow(light: THREE.DirectionalLight, shadowConfig: any) {
    light.shadow.mapSize.width = shadowConfig.mapSize.width;
    light.shadow.mapSize.height = shadowConfig.mapSize.height;
    light.shadow.camera.near = shadowConfig.camera.near;
    light.shadow.camera.far = shadowConfig.camera.far;
    light.shadow.camera.left = shadowConfig.camera.left;
    light.shadow.camera.right = shadowConfig.camera.right;
    light.shadow.camera.top = shadowConfig.camera.top;
    light.shadow.camera.bottom = shadowConfig.camera.bottom;
  }

  public setNonReflectiveMaterial(model: THREE.Group) {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const nonReflectiveMaterial = new THREE.MeshLambertMaterial();
        const originalMaterial = child.material as any;

        if (originalMaterial.map) nonReflectiveMaterial.map = originalMaterial.map;
        if (originalMaterial.color) nonReflectiveMaterial.color = originalMaterial.color.clone();
        if (originalMaterial.transparent !== undefined) nonReflectiveMaterial.transparent = originalMaterial.transparent;
        if (originalMaterial.opacity !== undefined) nonReflectiveMaterial.opacity = originalMaterial.opacity;

        if (nonReflectiveMaterial.map) {
          nonReflectiveMaterial.map.needsUpdate = true;
        }

        child.material = nonReflectiveMaterial;
        child.receiveShadow = true;
        child.castShadow = true;
      }
    });
  }

  private adjustModelPosition(model: THREE.Group): void {
    // 计算模型的包围盒
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // 计算中心点
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    console.log(`模型尺寸: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
    console.log(`模型中心: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
    
    // 如果模型中心不在原点，调整位置
    if (Math.abs(center.y) > 0.1) {
      // 将模型底部对齐到地面
      model.position.y -= (box.min.y);
      console.log("已将模型底部对齐到地面");
    }
    
    // 调整模型缩放（可选）
    const targetSize = 10; // 目标最大尺寸
    const maxDimension = Math.max(size.x, size.y, size.z);
    
    if (maxDimension > targetSize) {
      const scale = targetSize / maxDimension;
      model.scale.multiplyScalar(scale);
      console.log(`已将模型缩放到原尺寸的 ${(scale * 100).toFixed(0)}%`);
    }
  }

  public resize() {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer?.setSize(window.innerWidth, window.innerHeight);
    
    // 如果切换到第三人称，需要更新相机位置
    if (this.cameraController) {
      // 这里可以根据需要添加特定逻辑
    }
  }

  public render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      if (this.labelRenderer) {
        this.labelRenderer.render(this.scene, this.camera);
      }
    }
  }

  // 创建调试面板
  private createDebugPanel(): void {
    if (!this.sceneRef) return;
    
    // 创建调试面板容器
    this.debugPanel = document.createElement('div');
    this.debugPanel.className = 'debug-panel';
    this.debugPanel.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background-color: rgba(0, 0, 0, 0.7);
      color: #fff;
      padding: 10px 15px;
      border-radius: 5px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      z-index: 1000;
      backdrop-filter: blur(3px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      min-width: 250px;
      user-select: none;
      transition: opacity 0.3s ease;
    `;
    
    // 创建标题栏
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
      padding-bottom: 5px;
    `;
    
    const title = document.createElement('div');
    title.textContent = '调试信息';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '13px';
    
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '隐藏';
    toggleButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
    `;
    
    toggleButton.addEventListener('click', () => {
      this.isDebugPanelVisible = !this.isDebugPanelVisible;
      if (this.debugPanel) {
        const content = this.debugPanel.querySelector('.debug-content');
        if (content) {
          content.style.display = this.isDebugPanelVisible ? 'block' : 'none';
        }
        toggleButton.textContent = this.isDebugPanelVisible ? '隐藏' : '显示';
      }
    });
    
    titleBar.appendChild(title);
    titleBar.appendChild(toggleButton);
    
    // 创建内容区域
    const content = document.createElement('div');
    content.className = 'debug-content';
    content.style.cssText = `
      line-height: 1.4;
    `;
    
    // 添加初始内容
    content.innerHTML = `
      <div class="fps-info">
        <div>FPS: <span class="fps-current">0</span></div>
        <div>最大FPS: <span class="fps-max">0</span></div>
        <div>最小FPS: <span class="fps-min">0</span></div>
        <div>平均FPS: <span class="fps-avg">0</span></div>
      </div>
      <div class="camera-info" style="margin-top: 8px;">
        <div>相机模式: <span class="camera-mode">第一人称</span></div>
        <div>位置: <span class="camera-position">(0, 0, 0)</span></div>
        <div>旋转: <span class="camera-rotation">(0, 0, 0)</span></div>
      </div>
      <div class="performance-info" style="margin-top: 8px;">
        <div>绘制调用: <span class="draw-calls">0</span></div>
        <div>三角形: <span class="triangles">0</span></div>
        <div>内存使用: <span class="memory">0 MB</span></div>
      </div>
    `;
    
    this.debugPanel.appendChild(titleBar);
    this.debugPanel.appendChild(content);
    this.sceneRef.appendChild(this.debugPanel);
    
    // 添加键盘快捷键：按F1显示/隐藏调试面板
    document.addEventListener('keydown', (e) => {
      console.log(e.key);
      if (e.key === 'F1') {
        e.preventDefault();
        this.toggleDebugPanel();
      }
    });
  }

  // 更新FPS计数器
  private updateFPS(deltaTime: number): void {
    const currentTime = performance.now();
    
    // 计算当前FPS
    if (this.lastFrameTime > 0) {
      const frameTime = currentTime - this.lastFrameTime;
      const fps = Math.round(1000 / frameTime);
      
      this.fpsCounter.current = fps;
      this.fpsCounter.frameCount++;
      
      // 更新最大FPS
      if (fps > this.fpsCounter.max) {
        this.fpsCounter.max = fps;
      }
      
      // 更新最小FPS（跳过前几帧和异常值）
      if (this.fpsCounter.frameCount > 10 && fps > 1 && fps < this.fpsCounter.min) {
        this.fpsCounter.min = fps;
      }
      
      // 记录历史数据（最近100帧）
      this.fpsCounter.history.push(fps);
      if (this.fpsCounter.history.length > 100) {
        this.fpsCounter.history.shift();
      }
      
      // 每秒更新一次平均FPS
      if (currentTime - this.fpsCounter.lastUpdate >= 1000) {
        if (this.fpsCounter.history.length > 0) {
          const sum = this.fpsCounter.history.reduce((a, b) => a + b, 0);
          this.fpsCounter.avg = Math.round(sum / this.fpsCounter.history.length);
        }
        this.fpsCounter.lastUpdate = currentTime;
      }
    }
    
    this.lastFrameTime = currentTime;
  }

  // 更新调试面板
  private updateDebugPanel(): void {
    if (!this.debugPanel || !this.isDebugPanelVisible) return;
    
    // 更新FPS信息
    const fpsCurrent = this.debugPanel.querySelector('.fps-current');
    const fpsMax = this.debugPanel.querySelector('.fps-max');
    const fpsMin = this.debugPanel.querySelector('.fps-min');
    const fpsAvg = this.debugPanel.querySelector('.fps-avg');
    
    if (fpsCurrent) fpsCurrent.textContent = this.fpsCounter.current.toString();
    if (fpsMax) fpsMax.textContent = this.fpsCounter.max.toString();
    if (fpsMin) fpsMin.textContent = this.fpsCounter.min === Infinity ? '0' : this.fpsCounter.min.toString();
    if (fpsAvg) fpsAvg.textContent = this.fpsCounter.avg.toString();
    
    // 更新相机信息
    const cameraMode = this.debugPanel.querySelector('.camera-mode');
    const cameraPosition = this.debugPanel.querySelector('.camera-position');
    const cameraRotation = this.debugPanel.querySelector('.camera-rotation');
    
    if (cameraMode && this.cameraController) {
      const isFirstPerson = (this.cameraController as any).isFirstPerson;
      cameraMode.textContent = isFirstPerson ? '第一人称' : '第三人称';
    }
    
    if (cameraPosition && this.camera) {
      cameraPosition.textContent = `(${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`;
    }
    
    if (cameraRotation && this.camera) {
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion);
      cameraRotation.textContent = `(${(euler.x * 180 / Math.PI).toFixed(1)}°, ${(euler.y * 180 / Math.PI).toFixed(1)}°, ${(euler.z * 180 / Math.PI).toFixed(1)}°)`;
    }
    
    // 更新性能信息
    const drawCalls = this.debugPanel.querySelector('.draw-calls');
    const triangles = this.debugPanel.querySelector('.triangles');
    const memory = this.debugPanel.querySelector('.memory');
    
    if (drawCalls && this.renderer.info) {
      drawCalls.textContent = this.renderer.info.render.calls.toString();
    }
    
    if (triangles && this.renderer.info) {
      triangles.textContent = this.renderer.info.render.triangles.toString();
    }
    
    if (memory) {
      // 注意：由于浏览器安全限制，我们无法直接获取准确的内存使用量
      // 这里使用一个近似的估计值
      const estimatedMemory = Math.round(performance.memory?.usedJSHeapSize / (1024 * 1024)) || 0;
      memory.textContent = `${estimatedMemory} MB`;
    }
    
    // 根据FPS改变颜色
    this.updateFPSColor();
  }

  // 根据FPS值更新颜色
  private updateFPSColor(): void {
    const fpsCurrent = this.debugPanel?.querySelector('.fps-current');
    if (!fpsCurrent) return;
    
    const fps = this.fpsCounter.current;
    
    // 移除之前的颜色类
    fpsCurrent.classList.remove('fps-good', 'fps-medium', 'fps-poor');
    
    // 根据FPS值添加不同的颜色类
    if (fps >= 50) {
      fpsCurrent.classList.add('fps-good');
      fpsCurrent.style.color = '#4CAF50'; // 绿色
    } else if (fps >= 30) {
      fpsCurrent.classList.add('fps-medium');
      fpsCurrent.style.color = '#FF9800'; // 橙色
    } else {
      fpsCurrent.classList.add('fps-poor');
      fpsCurrent.style.color = '#F44336'; // 红色
    }
  }

  // 切换调试面板显示/隐藏
  private toggleDebugPanel(): void {
    this.isDebugPanelVisible = !this.isDebugPanelVisible;
    if (this.debugPanel) {
      const content = this.debugPanel.querySelector('.debug-content');
      if (content) {
        content.style.display = this.isDebugPanelVisible ? 'block' : 'none';
      }
      
      // 更新切换按钮文本
      const toggleButton = this.debugPanel.querySelector('button');
      if (toggleButton) {
        toggleButton.textContent = this.isDebugPanelVisible ? '隐藏' : '显示';
      }
    }
  }

  public dispose() {
    // 停止动画循环
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    
    // 清理相机控制器
    if (this.cameraController) {
      this.cameraController.dispose();
      this.cameraController = null;
    }
    
    // 清理代码
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    
    if (this.labelRenderer && this.labelRenderer.domElement.parentNode) {
      this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
    }
    
    if (this.scene) {
      this.scene.clear();
    }
  }
}