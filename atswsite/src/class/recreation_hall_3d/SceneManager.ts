// The relative position of this file: src/class/recreation_hall_3d/SceneManager.ts
// Code name:RH3
// 负责Three.js场景、相机、渲染器、灯光、各种模型的创建和管理
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sceneConfig, cameraConfig, rendererConfig, lightConfig, modelPathList, videoList } from '@/config/recreationHallConfig';
import type Coord3D from '@/interface/Coord3D';
import CameraController from './CameraController';
import { VideoTextureManager } from './VideoTextureManager';

export interface VideoAspectRatio {
  width: number;
  height: number;
  ratio: number;
}

export default class SceneManager {
  public  scene: THREE.Scene = new THREE.Scene;
  public  camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera;
  public  renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer;
  public  labelRenderer: CSS2DRenderer = new CSS2DRenderer;
  public  ambientLight: THREE.AmbientLight = new THREE.AmbientLight;

  private fillLight: THREE.DirectionalLight = new THREE.DirectionalLight;
  private centerGridHelper: THREE.GridHelper = new THREE.GridHelper;
  private centerAxesHelper: THREE.AxesHelper = new THREE.AxesHelper;
  private ground: THREE.Mesh = new THREE.Mesh;
  private loadedModels: THREE.Group[] = [];  // 存储已加载的模型
  private sceneRef: HTMLElement | null = null;
  private onProgressUpdate?: (increment: number, status: string) => void;

  private cameraController: CameraController | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  private animationId: number | null = null;

  // 视频纹理管理器
  private videoTextureManager: VideoTextureManager | null = null;
  private screenMesh: THREE.Mesh | null = null;
  private screenAspectRatio: number = 16 / 9; // 默认16:9

  constructor(
    sceneRef: HTMLElement,
    onProgressUpdate?: (increment: number, status: string) => void
  ) {
    this.sceneRef = sceneRef;
    this.onProgressUpdate = onProgressUpdate;
    // 初始化视频纹理管理器
    this.videoTextureManager = new VideoTextureManager();
    
    // 设置元数据加载回调
    this.videoTextureManager.setOnMetadataLoadedCallback(
      this.handleVideoMetadataLoaded.bind(this)
    );
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

    // 半球光（HemisphereLight）来模拟天光和地面反射
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

  private createCeilingLight(position:Coord3D,name:string) {
      const topLight = new THREE.DirectionalLight(
        0xffffff,
        1.0
      );
      
      topLight.position.set(
        position.x,
        position.y,
        position.z
      );
      
      topLight.name = name;
      
      // 设置灯光朝向地面
      topLight.target.position.set(0, 0, 0);
      this.scene.add(topLight.target);
      
      this.scene.add(topLight);
  }

  private createStaticModel(): void {
    const totalModels = modelPathList.length;
    const isCeilingLight = /^ceiling_light/;
    let loadedCount = 0;
    this.onProgressUpdate?.(0, `开始加载${totalModels}个模型...`);
    
    // 使用递归函数按顺序加载模型
    const loadNextModel = (index: number) => {
      if (index >= totalModels) {// 所有模型加载完成
        //重新调整灯光位置
        //this.adjustLightsToModels();
        this.onProgressUpdate?.(1, `所有模型加载完成 (${loadedCount}/${totalModels})`);
        console.log(`所有静态模型加载完成: ${loadedCount}/${totalModels} 个模型`);
        return;
      }
      
      const modelName = modelPathList[index].name;
      const modelPath = modelPathList[index].path;
    
      const loader = new GLTFLoader();
      
      // 更新加载状态
      this.onProgressUpdate?.(
        index / totalModels, 
        `正在加载 ${modelName}... (${index + 1}/${totalModels})`
      );
      
      loader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene;
          
          model.position.set(0, 0, 0);
          model.rotation.set(0, 0, 0);
          model.scale.set(1, 1, 1);
          
          // 如果是屏幕模型，应用视频材质
          if (modelName === 'screen') {
            this.applyVideoMaterialToScreen(model);
          }

          model.name = modelName;
          // 如果是天花板灯光模型，创建对应的灯光
          if(isCeilingLight.test(modelName)){
            const Box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            Box.getCenter(center);
            this.createCeilingLight(center,modelName);
          }
          // 遍历模型的所有子对象，设置阴影和优化材质
          model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // 启用阴影
            child.castShadow = true;
            child.receiveShadow = true;
            
            // 优化材质性能
            if(modelName === 'screen'){
              // 屏幕材质已特殊处理，跳过
            }else{
              if(child.material) {
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
          }
          });
          
          // 将模型添加到场景
          this.scene.add(model);
          this.loadedModels.push(model);
          
          loadedCount++;
          this.calculateModelOffset(model, modelName);
          console.log(`模型加载完成: ${modelName}`);
          
          // 加载下一个模型
          loadNextModel(index + 1);
        },
        // 加载进度回调
        (xhr) => {
          if (xhr.lengthComputable) {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            this.onProgressUpdate?.(
              (index + percentComplete / 100) / totalModels, 
              `正在加载 ${modelName}... ${Math.round(percentComplete)}%`
            );
          }
        },
        // 错误处理
        (error) => {
          console.error(`模型 ${modelName} 加载失败:`, error);
          console.warn(`跳过模型: ${modelName}`);
          
          // 继续加载下一个模型
          loadNextModel(index + 1);
        }
      );
    };
    
    // 开始加载第一个模型
    loadNextModel(0);
  }

  private calculateModelOffset(model: THREE.Object3D, modelName: string): void {
      const Box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      Box.getCenter(center);
      // 存储模型中心点相对于世界坐标原点的偏移
      const offset = sceneConfig.offset as { [key: string]: { x: number; y: number; z: number } };
      offset[modelName] = { x: center.x, y: center.y, z: center.z };
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
      
      // 更新相机控制器
      if (this.cameraController) {
        this.cameraController.update(deltaTime);
      }
      
      // 渲染场景
      this.render();
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



  /**
   * 处理视频元数据加载
   */
  private handleVideoMetadataLoaded(aspectRatio: VideoAspectRatio): void {
    console.log(`视频宽高比: ${aspectRatio.width}x${aspectRatio.height} (${aspectRatio.ratio.toFixed(2)})`);
    
    // 应用UV变换以保持宽高比
    this.adjustVideoTextureToScreen();
  }

  /**
   * 计算屏幕模型的宽高比
   */
  private calculateScreenAspectRatio(screenMesh: THREE.Mesh): number {
    const geometry = screenMesh.geometry;
    
    // 方法1: 使用边界框计算
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    
    if (bbox) {
      const width = bbox.max.x - bbox.min.x;
      const height = bbox.max.y - bbox.min.y;
      const aspectRatio = Math.abs(width / height);
      
      console.log(`屏幕边界框尺寸: ${width.toFixed(2)} x ${height.toFixed(2)}, 宽高比: ${aspectRatio.toFixed(2)}`);
      return aspectRatio;
    }
    
    // 方法2: 使用位置数组计算（备选）
    const positions = geometry.attributes.position.array;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = Math.abs(width / height);
    
    console.log(`屏幕计算尺寸: ${width.toFixed(2)} x ${height.toFixed(2)}, 宽高比: ${aspectRatio.toFixed(2)}`);
    return aspectRatio;
  }

  /**
   * 调整视频纹理以适配屏幕
   */
  private adjustVideoTextureToScreen(): void {
    if (!this.videoTextureManager || !this.screenMesh) return;
    
    // 计算屏幕宽高比
    const screenAspect = this.calculateScreenAspectRatio(this.screenMesh);
    this.screenAspectRatio = screenAspect;
    
    // 计算UV变换
    const transform = this.videoTextureManager.calculateUVTransform(screenAspect);
    
    // 应用变换到纹理
    this.videoTextureManager.applyUVTransformToTexture(transform);
    
    console.log(`已调整视频纹理适配屏幕 (屏幕宽高比: ${screenAspect.toFixed(2)})`);
  }


  /**
   * 为屏幕模型应用视频材质
   */
  private applyVideoMaterialToScreen(screenModel: THREE.Group): void {
    // 遍历屏幕模型的子对象，找到网格
    screenModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.screenMesh = child;
        
        // 计算屏幕宽高比
        this.screenAspectRatio = this.calculateScreenAspectRatio(child);

        // 创建视频材质
        const videoTexture = this.videoTextureManager!.createVideoTexture(
          videoList[0].url
        );
        
        // 等待一段时间后调整纹理（确保视频元数据已加载）
        setTimeout(() => {
          this.adjustVideoTextureToScreen();
        }, 1000);

        // 创建自发光材质，使视频看起来更亮
        const videoMaterial = new THREE.MeshBasicMaterial({
          map: videoTexture,
          side: THREE.DoubleSide, // 双面显示
          transparent: false,
          toneMapped: false, // 避免色调映射，保持视频原色
        });
        
        // 保存原始材质以便切换
        (child as any).originalMaterial = child.material;
        child.material = videoMaterial;
        
        // 存储屏幕网格引用
        this.screenMesh = child;
        
        console.log('已为屏幕应用视频材质');
      }
    });
  }

  /**
   * 播放屏幕视频
   */
  public async playScreenVideo(videoUrl?: string): Promise<void> {
    if (!this.videoTextureManager) {
      console.error('视频纹理管理器未初始化');
      return;
    }
    
    if (videoUrl) {
      this.videoTextureManager.updateVideoSource(videoUrl);
    }
    
    try {
      await this.videoTextureManager.play();
      console.log('屏幕视频开始播放');
    } catch (error) {
      console.error('播放视频失败:', error);
      // 提示用户可能需要交互才能播放
    }
  }

  /**
   * 暂停屏幕视频
   */
  public pauseScreenVideo(): void {
    if (this.videoTextureManager) {
      this.videoTextureManager.pause();
      console.log('屏幕视频已暂停');
    }
  }

  /**
   * 停止屏幕视频
   */
  public stopScreenVideo(): void {
    if (this.videoTextureManager) {
      this.videoTextureManager.stop();
      console.log('屏幕视频已停止');
    }
  }

  /**
   * 切换视频静音
   */
  public toggleVideoMute(): boolean {
    if (this.videoTextureManager) {
      return this.videoTextureManager.toggleMute();
    }
    return false;
  }

  /**
   * 设置视频音量
   */
  public setVideoVolume(volume: number): void {
    if (this.videoTextureManager) {
      this.videoTextureManager.setVolume(volume);
    }
  }

  /**
   * 获取视频状态
   */
  public getVideoStatus() {
    if (this.videoTextureManager) {
      return this.videoTextureManager.getVideoStatus();
    }
    return null;
  }

  /**
   * 继续播放屏幕视频
   */
  public async resumeScreenVideo(): Promise<void> {
    if (!this.videoTextureManager) {
      console.error('视频纹理管理器未初始化');
      return;
    }
    
    try {
      await this.videoTextureManager.resume();
      console.log('屏幕视频继续播放');
    } catch (error) {
      console.error('继续播放视频失败:', error);
    }
  }

  /**
   * 更换视频源
   */
  public changeVideoSource(videoUrl: string, keepCurrentTime: boolean = false): void {
    if (this.videoTextureManager) {
      // 保存当前播放状态
      const currentStatus = this.getVideoStatus();
      
      // 更新视频源，可选保持当前播放时间
      this.videoTextureManager.updateVideoSource(videoUrl, keepCurrentTime);
      
      // 等待视频加载后重新调整纹理
      setTimeout(() => {
        this.adjustVideoTextureToScreen();
        
        // 如果之前正在播放，且没有保持当前时间，则从头播放
        if (currentStatus && currentStatus.isPlaying && !keepCurrentTime) {
          this.playScreenVideo(videoUrl);
        }
      }, 500);
      
      console.log(`已更换视频源: ${videoUrl}, 保持时间: ${keepCurrentTime}`);
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
    // 清理视频纹理管理器
    if (this.videoTextureManager) {
      this.videoTextureManager.dispose();
      this.videoTextureManager = null;
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