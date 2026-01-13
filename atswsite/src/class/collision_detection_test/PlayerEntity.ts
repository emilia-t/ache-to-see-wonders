// The relative position of this file: src/class/collision_detection_test/PlayerEntity.ts
// Code name:CDT1

import * as THREE from 'three';
import type Coord3D from '@/interface/Coord3D';
import type Rotation3D from '@/interface/Rotation3D';
import CameraController from './CameraController';

export default class PlayerEntity {
  private cameraController: CameraController;
  private isLocked: boolean = false;
  private keys: { [key: string]: boolean } = {};
  
  // 玩家模型引用
  private playerModel: THREE.Object3D | null = null;
  
  // 碰撞检测相关
  private boundingBox: THREE.Box3 = new THREE.Box3();
  private collisionObjects: THREE.Object3D[] = [];
  private isColliding: boolean = false;
  private lastCollisionCheckTime: number = 0;
  private collisionCheckInterval: number = 0.1; // 碰撞检测间隔（秒）

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    callbacks: any = {}
  ) {
    // 创建相机控制器
    this.cameraController = new CameraController(camera, domElement, callbacks);
    
    // 绑定事件
    this.bindEvents();
    
    // 初始化碰撞检测边界框
    this.updateBoundingBox();
  }

  // ========== 事件绑定 ==========

  private bindEvents(): void {
    // 键盘事件
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
    
    // 鼠标事件
    const domElement = this.cameraController.getDomElement();
    domElement.addEventListener('click', this.onMouseClick.bind(this));
    domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    domElement.addEventListener('contextmenu', this.onContextMenu.bind(this));
    
    // 指针锁定状态变化监听
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    
    // F8切换视角
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F8') {
        this.toggleCameraMode();
        e.preventDefault();
      }
    });
  }

  private onPointerLockChange(): void {
    const domElement = this.cameraController.getDomElement();
    this.isLocked = document.pointerLockElement === domElement;
    
    if (this.isLocked) {
      domElement.style.cursor = 'none';
    } else {
      domElement.style.cursor = 'default';
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keys[key] = true;
    
    // 更新相机控制器的按键状态
    this.cameraController.setKey(key, true);
    
    // 空格键跳跃
    if (event.code === 'Space') {
      this.cameraController.handleJump();
    }
    
    // ESC键退出指针锁定
    if (event.key === 'Escape') {
      const domElement = this.cameraController.getDomElement();
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keys[key] = false;
    
    // 更新相机控制器的按键状态
    this.cameraController.setKey(key, false);
  }

  private onMouseClick(event: MouseEvent): void {
    if (event.button === 2) return; // 右键不触发指针锁定
    
    if (!this.isLocked) {
      const domElement = this.cameraController.getDomElement();
      domElement.requestPointerLock();
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    
    // 传递给相机控制器处理
    this.cameraController.handleMouseMove(movementX, movementY, this.isLocked);
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  // ========== 公有方法 ==========

  /**
   * 设置玩家模型
   */
  public setPlayerModel(model: THREE.Object3D): void {
    this.playerModel = model;
    
    // 初始设置
    this.updatePlayerModel();
    
    // 根据当前视角模式设置模型可见性
    this.updateModelVisibility();
  }

  /**
   * 切换视角模式
   */
  public toggleCameraMode(): void {
    this.cameraController.toggleCameraMode();
    
    // 切换视角后更新模型可见性
    this.updateModelVisibility();
  }

  /**
   * 更新玩家实体
   */
  public update(deltaTime: number): void {
    // 先进行碰撞检测
    this.checkCollisions();
    
    // 如果没有碰撞，则更新相机控制器
    if (!this.isColliding) {
      this.cameraController.update(deltaTime);
      
      // 更新碰撞检测边界框
      this.updateBoundingBox();
      
      // 更新玩家模型的位置和旋转
      this.updatePlayerModel();
    } else {
      // 如果发生碰撞，可以在这里处理碰撞响应
      this.handleCollisionResponse();
    }
  }

  /**
   * 更新玩家模型的位置和旋转
   */
  private updatePlayerModel(): void {
    if (!this.playerModel) return;
    
    const cameraInfo = this.cameraController.getCameraInfo();
    const isFirstPerson = this.cameraController.getIsFirstPerson();
    
    if (isFirstPerson) {
        // 第一人称：玩家模型跟随相机，但位置稍微偏移
        const camera = this.cameraController.getCamera();
        this.playerModel.position.copy(camera.position);
        
        // 将模型稍微向下移动，使其看起来像是从腰部观察
        this.playerModel.position.y -= 0.5;
        
        // 只设置Y轴旋转（yaw）
        this.playerModel.rotation.y = cameraInfo.rotation.yaw;
    } else {
        // 第三人称：玩家模型跟随目标位置
        const target = this.cameraController.getThirdPersonTarget();
        
        if (target) {
        // 直接复制目标位置（包括y轴跳跃高度）
        this.playerModel.position.copy(target);
        
        // 只设置Y轴旋转（yaw）
        this.playerModel.rotation.y = cameraInfo.rotation.yaw;
        }
    }
    }

  /**
   * 更新模型可见性
   */
  private updateModelVisibility(): void {
    if (!this.playerModel) return;
    
    const isFirstPerson = this.cameraController.getIsFirstPerson();
    
    // 第一人称时隐藏模型，第三人称时显示模型
    this.playerModel.visible = !isFirstPerson;
  }

  /**
   * 获取第三人称目标位置（用于模型跟随）
   */
  private getThirdPersonTarget(): THREE.Vector3 | null {
    return this.cameraController.getThirdPersonTarget();
  }

  /**
   * 添加碰撞检测对象
   */
  public addCollisionObject(object: THREE.Object3D): void {
    this.collisionObjects.push(object);
  }

  /**
   * 移除碰撞检测对象
   */
  public removeCollisionObject(object: THREE.Object3D): void {
    const index = this.collisionObjects.indexOf(object);
    if (index !== -1) {
      this.collisionObjects.splice(index, 1);
    }
  }

  /**
   * 设置碰撞检测对象列表
   */
  public setCollisionObjects(objects: THREE.Object3D[]): void {
    this.collisionObjects = objects;
  }

  /**
   * 获取相机控制器
   */
  public getCameraController(): CameraController {
    return this.cameraController;
  }

  /**
   * 获取玩家位置
   */
  public getPosition(): Coord3D {
    const camera = this.cameraController.getCamera();
    return {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
  }

  /**
   * 获取玩家旋转
   */
  public getRotation(): Rotation3D {
    const info = this.cameraController.getCameraInfo();
    return info.rotation;
  }

  /**
   * 获取是否第一人称
   */
  public getIsFirstPerson(): boolean {
    return this.cameraController.getIsFirstPerson();
  }

  /**
   * 获取是否指针锁定
   */
  public getIsLocked(): boolean {
    return this.isLocked;
  }

  /**
   * 重置玩家位置
   */
  public reset(): void {
    this.cameraController.resetCamera();
    this.updateBoundingBox();
    
    // 重置玩家模型位置
    if (this.playerModel) {
      this.updatePlayerModel();
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 移除事件监听器
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    
    const domElement = this.cameraController.getDomElement();
    if (domElement) {
      domElement.removeEventListener('click', this.onMouseClick.bind(this));
      domElement.removeEventListener('mousemove', this.onMouseMove.bind(this));
      domElement.removeEventListener('contextmenu', this.onContextMenu.bind(this));
    }
    
    // 退出指针锁定
    if (document.pointerLockElement === domElement) {
      document.exitPointerLock();
    }
    
    // 清理相机控制器
    this.cameraController.dispose();
  }

  // ========== 碰撞检测方法 ==========

  private updateBoundingBox(): void {
    const camera = this.cameraController.getCamera();
    const position = camera.position;
    
    // 创建一个围绕玩家的边界框（可以根据需要调整大小）
    const size = 0.5; // 玩家边界框大小
    this.boundingBox.set(
      new THREE.Vector3(position.x - size, position.y - size, position.z - size),
      new THREE.Vector3(position.x + size, position.y + size, position.z + size)
    );
  }

  private checkCollisions(): void {
    // 可以在这里实现更复杂的碰撞检测逻辑
    // 这里是一个简单的示例，检测边界框是否与其他物体相交
    
    for (const object of this.collisionObjects) {
      // 获取物体的边界框
      const objectBox = new THREE.Box3().setFromObject(object);
      
      if (this.boundingBox.intersectsBox(objectBox)) {
        this.isColliding = true;
        return;
      }
    }
    
    this.isColliding = false;
  }

  private handleCollisionResponse(): void {
    // 简单的碰撞响应：阻止移动
    // 这里可以根据需要实现更复杂的碰撞响应逻辑
    
    // 可以记录碰撞点、计算反弹方向等
    console.log('碰撞发生，阻止移动');
  }

  /**
   * 获取玩家模型引用
   */
  public getPlayerModel(): THREE.Object3D | null {
    return this.playerModel;
  }
}