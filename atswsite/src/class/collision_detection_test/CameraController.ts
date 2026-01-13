// The relative position of this file: src/class/collision_detection_test/CameraController.ts
// Code name:CDT1

import * as THREE from 'three';
import { sceneConfig, cameraConfig } from '@/config/collisionDetectionTestConfig';
import type Coord3D from '@/interface/Coord3D';
import type CameraControllerProperty from '@/interface/CameraControllerProperty';
import type CameraControllerCallbacks from '@/interface/CameraControllerCallbacks';

export default class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  
  // 控制状态
  private isFirstPerson: boolean = true;
  private keys: { [key: string]: boolean } = {};
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private canJump: boolean = true;
  
  // 第三人称相关
  private target: THREE.Object3D;
  private distance: number = 5;
  private angleX: number = 0; // 水平旋转角度
  private angleY: number = Math.PI / 6; // 垂直旋转角度 (30度俯角)
  
  // 相机旋转
  private pitch: number = 0; // 俯仰角
  private yaw: number = 0; // 偏航角
  
  // 配置
  private cameraControllerProperty: CameraControllerProperty;

  // 回调函数
  private callbacks: CameraControllerCallbacks;
  
  // 用于检测位置/旋转变化
  private lastPosition: THREE.Vector3;
  private lastRotation: { yaw: number; pitch: number };

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    callbacks: CameraControllerCallbacks = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.cameraControllerProperty = sceneConfig.firstPersonCameraController;
    this.callbacks = callbacks;
    
    // 创建第三人称的目标对象
    this.target = new THREE.Object3D();
    this.target.position.copy(camera.position);
    this.target.position.y = 0; // 目标在地面上
    
    // 初始化视角
    this.resetCamera();
    
    // 初始化追踪变量
    this.lastPosition = this.camera.position.clone();
    this.lastRotation = { yaw: this.yaw, pitch: this.pitch };
    
    // 不再在CameraController中绑定事件，由PlayerEntity控制
  }

  // 设置回调函数
  public setCallbacks(callbacks: CameraControllerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ========== 被动控制方法 ==========

  /**
   * 设置按键状态
   */
  public setKey(key: string, isPressed: boolean): void {
    this.keys[key.toLowerCase()] = isPressed;
  }

  /**
   * 处理鼠标移动
   */
  public handleMouseMove(movementX: number, movementY: number, isLocked: boolean): void {
    if (isLocked) {
      let rotationChanged = false;
      
      if (this.isFirstPerson) {
        // 第一人称鼠标控制
        const oldYaw = this.yaw;
        const oldPitch = this.pitch;
        
        this.yaw -= movementX * this.cameraControllerProperty.lookSpeed;
        this.pitch -= movementY * this.cameraControllerProperty.lookSpeed;
        
        // 限制俯仰角度
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        
        // 检查旋转是否改变
        rotationChanged = (oldYaw !== this.yaw || oldPitch !== this.pitch);
      } else {
        // 第三人称鼠标控制
        const oldAngleX = this.angleX;
        const oldAngleY = this.angleY;
        
        this.angleX -= movementX * this.cameraControllerProperty.lookSpeed;
        // 注意：这里改为加号，使上下方向符合直觉
        this.angleY += movementY * this.cameraControllerProperty.lookSpeed;
        
        // 限制垂直角度
        this.angleY = Math.max(Math.PI / 12, Math.min(Math.PI / 2, this.angleY));
        
        // 同步第一人称旋转
        const oldYaw = this.yaw;
        this.yaw = this.angleX;
        
        rotationChanged = (oldAngleX !== this.angleX || oldAngleY !== this.angleY || oldYaw !== this.yaw);
      }
      
      // 触发旋转回调
      if (rotationChanged && this.callbacks.onRotating) {
        this.callbacks.onRotating({
          yaw: this.yaw,
          pitch: this.isFirstPerson ? this.pitch : 0
        });
      }
    }
  }

  /**
   * 处理跳跃
   */
  public handleJump(): void {
    if (this.canJump) {  // 移除 isFirstPerson 条件检查
      this.velocity.y = this.cameraControllerProperty.jumpForce;
      this.canJump = false;
      
      // 触发跳跃回调
      if (this.callbacks.onJump) {
        this.callbacks.onJump(this.velocity.y);
      }
    }
  }

  /**
   * 切换视角模式
   */
  public toggleCameraMode(): void {
    this.isFirstPerson = !this.isFirstPerson;
    console.log(`切换到${this.isFirstPerson ? '第一人称' : '第三人称'}视角`);
    
    // 触发视角模式改变回调
    if (this.callbacks.onModeChange) {
      this.callbacks.onModeChange(this.isFirstPerson);
    }
    
    if (this.isFirstPerson) {
      // 切换到第一人称：将相机放回目标位置
      this.camera.position.copy(this.target.position);
      this.camera.position.y += this.cameraControllerProperty.playerHeight;
      this.updateCameraRotation();
    } else {
      // 切换到第三人称：更新第三人称相机位置
      this.updateThirdPersonCamera();
    }
    
    // 触发位置变化回调
    this.triggerMoveCallback();
  }

  /**
   * 更新相机控制器
   */
  public update(deltaTime: number): void {
    if (this.isFirstPerson) {
      this.updateFirstPerson(deltaTime);
    } else {
      this.updateThirdPerson(deltaTime);
    }
    
    // 检查旋转变化
    const rotationChanged = (
      this.yaw !== this.lastRotation.yaw || 
      this.pitch !== this.lastRotation.pitch
    );
    
    if (rotationChanged) {
      if (this.callbacks.onRotating) {
        this.callbacks.onRotating({
          yaw: this.yaw,
          pitch: this.isFirstPerson ? this.pitch : 0
        });
      }
      this.lastRotation = { yaw: this.yaw, pitch: this.pitch };
    }
  }

  // ========== 内部更新方法 ==========

  private updateFirstPerson(deltaTime: number): void {
    // 更新相机旋转
    this.updateCameraRotation();
    
    // 计算移动方向
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    forward.applyQuaternion(this.camera.quaternion);
    right.applyQuaternion(this.camera.quaternion);
    
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();
    
    // 根据按键移动
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (this.keys['w'] || this.keys['arrowup']) {
      moveDirection.add(forward);
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      moveDirection.sub(forward);
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      moveDirection.sub(right);
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      moveDirection.add(right);
    }
    
    // 检查是否有移动输入
    const hasMovementInput = moveDirection.length() > 0;
    
    // 归一化并应用速度
    if (hasMovementInput) {
      moveDirection.normalize();
      moveDirection.multiplyScalar(this.cameraControllerProperty.moveSpeed * deltaTime);
      this.camera.position.add(moveDirection);
    }
    
    // 应用重力
    this.velocity.y -= this.cameraControllerProperty.gravity * deltaTime;
    this.camera.position.y += this.velocity.y * deltaTime;
    
    // 地面检测
    if (this.camera.position.y < this.cameraControllerProperty.playerHeight) {
      this.camera.position.y = this.cameraControllerProperty.playerHeight;
      this.velocity.y = 0;
      this.canJump = true;
    }
    
    // 更新目标位置（用于第三人称）
    this.target.position.copy(this.camera.position);
    this.target.position.y = 0;
    
    // 检查位置变化
    const positionChanged = !this.camera.position.equals(this.lastPosition);
    
    if (positionChanged) {
      this.triggerMoveCallback();
      this.lastPosition.copy(this.camera.position);
    }
  }

  private updateThirdPerson(deltaTime: number): void {
    // 第三人称下，控制目标对象移动
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    // 根据相机角度计算前进和右方向（与第一人称相同）
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    // 根据相机水平角度旋转方向向量
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.angleX);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.angleX);
    
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();
    
    // 根据按键移动
    if (this.keys['w'] || this.keys['arrowup']) {
      moveDirection.add(forward);
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      moveDirection.sub(forward);
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      moveDirection.sub(right);
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      moveDirection.add(right);
    }
    
    // 检查是否有移动输入
    const hasMovementInput = moveDirection.length() > 0;
    let positionChanged = false;
    
    if (hasMovementInput) {
      const oldPosition = this.target.position.clone();
      
      moveDirection.normalize();
      moveDirection.multiplyScalar(this.cameraControllerProperty.moveSpeed * deltaTime);
      this.target.position.add(moveDirection);
      
      // 检查目标位置是否改变
      positionChanged = !this.target.position.equals(oldPosition);
    }
    
    // 应用重力（第三人称也需要重力模拟）
    this.velocity.y -= this.cameraControllerProperty.gravity * deltaTime;
    this.target.position.y += this.velocity.y * deltaTime;
    
    // 地面检测
    if (this.target.position.y < 0) {
      this.target.position.y = 0;
      this.velocity.y = 0;
      this.canJump = true;
    }
    
    // 更新第三人称相机位置
    this.updateThirdPersonCamera();
    
    // 同步相机位置到第一人称（用于模式切换时平滑过渡）
    this.camera.position.y = this.target.position.y + this.cameraControllerProperty.playerHeight;
    
    // 更新第一人称的旋转（保持同步）
    this.yaw = this.angleX;
    this.pitch = 0;
    
    // 检查相机位置变化
    const cameraPositionChanged = !this.camera.position.equals(this.lastPosition);
    
    if (positionChanged || cameraPositionChanged) {
      this.triggerMoveCallback();
      this.lastPosition.copy(this.camera.position);
    }
  }

  private updateThirdPersonCamera(): void {
    // 计算相机位置（球面坐标）
    const distance = this.distance;
    
    const x = this.target.position.x + distance * Math.sin(this.angleX) * Math.cos(this.angleY);
    const y = this.target.position.y + distance * Math.sin(this.angleY);
    const z = this.target.position.z + distance * Math.cos(this.angleX) * Math.cos(this.angleY);
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target.position);
  }

  private updateCameraRotation(): void {
    // 更新相机四元数
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(quaternion);
    
    // 检查旋转是否改变
    if (this.lastRotation === undefined) {
      this.lastRotation = {
        yaw: this.yaw,
        pitch: this.pitch
      };
    }
    const rotationChanged = (
      this.yaw !== this.lastRotation.yaw ||
      this.pitch !== this.lastRotation.pitch
    );
    
    if (rotationChanged) {
      this.lastRotation = { yaw: this.yaw, pitch: this.pitch };
    }
  }

  // 触发移动回调
  private triggerMoveCallback(): void {
    if (this.callbacks.onMoving) {
      const position: Coord3D = {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      };
      
      const rotation = {
        yaw: this.yaw,
        pitch: this.isFirstPerson ? this.pitch : 0
      };
      
      this.callbacks.onMoving(position, rotation);
    }
  }

  // ========== 其他公有方法 ==========

  /**
   * 获取第三人称目标位置
   */
  public getThirdPersonTarget(): THREE.Vector3 {
    return this.target.position.clone();
  }

  /**
   * 获取第三人称距离
   */
  public getThirdPersonDistance(): number {
    return this.distance;
  }

  /**
   * 获取第三人称角度
   */
  public getThirdPersonAngles(): { x: number; y: number } {
    return { x: this.angleX, y: this.angleY };
  }


  public resetCamera(): void {
    this.camera.position.set(
      cameraConfig.position.x,
      cameraConfig.position.y,
      cameraConfig.position.z
    );
    this.target.position.copy(this.camera.position);
    this.target.position.y = 0;
    
    this.pitch = 0;
    this.yaw = 0;
    this.angleX = 0;
    this.angleY = Math.PI / 6;
    
    this.updateCameraRotation();
    this.triggerMoveCallback();
  }

  public dispose(): void {
    // 清理工作
    this.keys = {};
    this.velocity.set(0, 0, 0);
  }

  /**
   * 获取当前相机信息
   */
  public getCameraInfo(): {
    position: Coord3D;
    rotation: { yaw: number; pitch: number };
    isFirstPerson: boolean;
  } {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      rotation: {
        yaw: this.yaw,
        pitch: this.isFirstPerson ? this.pitch : 0
      },
      isFirstPerson: this.isFirstPerson
    };
  }
  
  /**
   * 手动触发移动回调（如果需要外部手动调用）
   */
  public triggerMoveEvent(): void {
    this.triggerMoveCallback();
  }

  /**
   * 获取是否第一人称
   */
  public getIsFirstPerson(): boolean {
    return this.isFirstPerson;
  }

  /**
   * 获取相机对象
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * 获取DOM元素
   */
  public getDomElement(): HTMLElement {
    return this.domElement;
  }
}