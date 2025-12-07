// The relative position of this file: src/class/SceneManager.ts
// 负责Three.js场景、相机、渲染器、灯光等的创建和管理
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sceneConfig, cameraConfig, rendererConfig, lightConfig } from '@/config/chineseChessConfig.ts';
import type Coord3D from '@/interface/Coord3D';

export class SceneManager {
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

  constructor(sceneRef: HTMLElement, onProgressUpdate?: (increment: number, status: string) => void) {
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
    this.initLabelRenderer();
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
    // 顶部光源1
    this.directionalLight1 = new THREE.DirectionalLight(
      lightConfig.directional.color,
      lightConfig.directional.intensity
    );
    this.directionalLight1.position.set(
      lightConfig.directional.position.x,
      lightConfig.directional.position.y,
      lightConfig.directional.position.z
    );
    this.directionalLight1.castShadow = true;
    this.configureShadow(this.directionalLight1, lightConfig.directional.shadow);
    this.directionalLight1.name = "directional_light1";
    this.scene.add(this.directionalLight1);

    // 顶部光源2
    this.directionalLight2 = new THREE.DirectionalLight(
      lightConfig.directional2.color,
      lightConfig.directional2.intensity
    );
    this.directionalLight2.position.set(
      lightConfig.directional2.position.x,
      lightConfig.directional2.position.y,
      lightConfig.directional2.position.z
    );
    this.directionalLight2.castShadow = true;
    this.configureShadow(this.directionalLight2, lightConfig.directional2.shadow);
    this.directionalLight2.name = "directional_light2";
    this.scene.add(this.directionalLight2);

    // 补光光源
    this.fillLight = new THREE.DirectionalLight(
      lightConfig.fillLight.color,
      lightConfig.fillLight.intensity
    );
    this.fillLight.position.set(
      lightConfig.fillLight.position.x,
      lightConfig.fillLight.position.y,
      lightConfig.fillLight.position.z
    );
    this.fillLight.castShadow = false;
    this.fillLight.name = "fill_light";
    this.scene.add(this.fillLight);

    // 环境光源
    this.ambientLight = new THREE.AmbientLight(
      lightConfig.ambient.color,
      lightConfig.ambient.intensity
    );
    this.ambientLight.name = "ambient_light";
    this.scene.add(this.ambientLight);
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

  public resize() {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer?.setSize(window.innerWidth, window.innerHeight);
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