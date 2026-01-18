// The relative position of this file: src/class/collision_detection_test/SceneManager.ts
// Code name:CDT1
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type CameraControllerCallbacks from '@/interface/CameraControllerCallbacks';

import { sceneConfig , cameraConfig , rendererConfig , lightConfig} from '@/config/collisionDetectionTestConfig';
import CameraController from '@/class/collision_detection_test/CameraController';
import PlayerEntity from '@/class/collision_detection_test/PlayerEntity';
import Octree from './Octree';

export default class SceneManager {
    /**ss
     * 场景元素引用 starts
     */
    public scene: THREE.Scene = new THREE.Scene;
    public camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer;
    public ambientLight: THREE.AmbientLight = new THREE.AmbientLight;
    public fillLight: THREE.DirectionalLight = new THREE.DirectionalLight;
    public centerGridHelper: THREE.GridHelper = new THREE.GridHelper;
    public centerAxesHelper: THREE.AxesHelper = new THREE.AxesHelper;
    public ground: THREE.Mesh = new THREE.Mesh;
    public loadedModels: Map<string, THREE.Object3D> = new Map();
    public playerEntity: PlayerEntity | null = null;
    /**
     * 场景元素引用 end
     */
    /**
     * 杂项 start
     */
    private sceneRef: HTMLElement | null = null;
    private cameraController: CameraController | null = null;
    private clock: THREE.Clock = new THREE.Clock();
    private animationId: number = 0;
    private gltfLoader: GLTFLoader | null = null;
    private cameraControllerCallbacks: CameraControllerCallbacks = {};
    /**
     * 杂项 end
     */
    /**
     * 初始化 start
     */
    constructor(
        sceneRef: HTMLElement,
        cameraControllerCallbacks: CameraControllerCallbacks = {}
    ) {
        this.sceneRef = sceneRef;
        this.cameraControllerCallbacks = cameraControllerCallbacks;
        this.init();
    }  
    public init(): void {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.createHelpers();
        this.createGround();
        this.createPlayerEntity();
        this.createModels();
        this.createEventListeners();
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
        this.centerAxesHelper.position.y = sceneConfig.helpers.grid.position.y+0.01;

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
    private createEventListeners() {
        window.addEventListener('resize', this.onResize.bind(this), false);
    }
    private createPlayerEntity(): void {
        if (!this.renderer.domElement) return;
        
        // 创建PlayerEntity而不是直接创建CameraController
        this.playerEntity = new PlayerEntity(
            this.camera,
            this.renderer.domElement,
            this.cameraControllerCallbacks
        );
        
        // 如果需要，可以通过playerEntity获取cameraController
        // this.cameraController = this.playerEntity.getCameraController();
    }

    private createModels(): void {
    // 遍历配置文件中的模型数组
    sceneConfig.models.forEach((modelConfig) => {
        // 如果标记为忽略加载，则跳过
        if (modelConfig.ignore_load) {
            console.log(`跳过加载模型: ${modelConfig.name} (ignore_load: true)`);
            return;
        }

        console.log(`开始加载模型: ${modelConfig.name}，路径: ${modelConfig.path}`);

        // 加载模型
        this.loadGlbOrGLTF(modelConfig.path, modelConfig.name)
        .then((model) => {
            // 设置默认位置（根据配置或场景需求）
            model.position.set(0, 0, 0);
            
            console.log(`模型加载成功: ${modelConfig.name}`);
            
            // 可以根据模型名称进行特殊处理
            if (modelConfig.name === 'player') {
                model.position.set(0, 0, 0);
                model.scale.set(1, 1, 1);
            
                // 将玩家模型设置为玩家实体
                if (this.playerEntity) {
                    this.playerEntity.setPlayerModel(model);
                
                    // 将玩家模型添加到碰撞检测对象（如果模型需要参与碰撞）
                    // this.playerEntity.addCollisionObject(model);
                }
            } 
            else if (modelConfig.name === 'test') {
                model.position.set(2, 0, 0);
            
                // 将测试模型添加到碰撞检测对象
                if (this.playerEntity) {
                    this.playerEntity.addCollisionObject(model);
                }
                debugger;
                console.log(model)
                debugger;
            }
        })
        .catch((error) => {
            console.error(`模型加载失败: ${modelConfig.name}`, error);
        });
    });
    }

    private startAnimation(): void {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // 计算时间增量
            const deltaTime = this.clock.getDelta();
            
            // 更新玩家实体（它会更新相机控制器）
            if (this.playerEntity) {
                this.playerEntity.update(deltaTime);
            }
            
            // 渲染场景
            this.render();
        };
        
        animate();
    }
    /**
     * 初始化 end
     */
    /**
     * 事件处理函数 start
     */
    public onResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    /**
     * 事件处理函数 end
     */
    /**
     * 功能函数 start
     */
    
    public movePlayerTo(position: THREE.Vector3): void {
        if (this.camera) {
            this.camera.position.copy(position);
        }
    }

    public updateScene(deltaTime: number): void {
        // Scene update code here
    }
    public disposeScene(): void {
        if (this.playerEntity) {
            this.playerEntity.dispose();
            this.playerEntity = null;
        }
    }
    public render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    /**
     * 加载 GLB/GLTF 模型
     * @param modelPath 模型文件路径
     * @param modelName 模型名称（用于引用）
     * @param position 模型位置 (可选)
     * @param scale 模型缩放 (可选)
     * @param rotation 模型旋转 (可选)
     * @returns Promise<THREE.Object3D>
     */
    public loadGlbOrGLTF(
        modelPath: string, 
        modelName: string,
        position?: THREE.Vector3,
        scale?: THREE.Vector3,
        rotation?: THREE.Euler
    ): Promise<THREE.Object3D> {
        return new Promise((resolve, reject) => {
            // 如果已经加载过同名模型，直接返回
            if (this.loadedModels.has(modelName)) {
                console.warn(`Model "${modelName}" already loaded`);
                resolve(this.loadedModels.get(modelName)!);
                return;
            }

            // 初始化 GLTFLoader
            if (!this.gltfLoader) {
                this.gltfLoader = new GLTFLoader();
            }

            // 加载模型
            this.gltfLoader.load(
                modelPath,
                (gltf: GLTF) => {
                    const model = gltf.scene;
                    
                    // 设置模型名称
                    model.name = modelName;
                    
                    // 应用位置、缩放、旋转
                    if (position) {
                        model.position.copy(position);
                    }
                    
                    if (scale) {
                        model.scale.copy(scale);
                    }
                    
                    if (rotation) {
                        model.rotation.copy(rotation);
                    }
                    
                    // 启用阴影（如果模型有网格）
                    model.traverse((child: THREE.Object3D) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    // 添加到场景
                    this.scene.add(model);
                    
                    // 存储引用
                    this.loadedModels.set(modelName, model);
                    
                    console.log(`Model "${modelName}" loaded successfully`);
                    resolve(model);
                },
                (xhr: ProgressEvent<EventTarget>) => {
                    // 加载进度回调
                    if (xhr.lengthComputable) {
                        const progress = (xhr.loaded / xhr.total) * 100;
                        console.log(`Loading "${modelName}": ${progress.toFixed(2)}%`);
                    }
                },
                (error: unknown) => {
                    // 加载失败 - 使用 unknown 类型
                    console.error(`Failed to load model "${modelName}":`, error);
                    
                    // 将错误转换为 Error 对象
                    const errorObj = error instanceof Error 
                        ? error 
                        : new Error(`Failed to load model "${modelName}": ${String(error)}`);
                    reject(errorObj);
                }
            );
        });
    }
    /**
     * 功能函数 end
     */ 
}