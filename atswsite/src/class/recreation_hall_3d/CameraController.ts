// The relative position of this file: src/class/recreation_hall_3d/CameraController.ts
// Code name:RH3
// 负责Three.js 相机 的位置移动、视角旋转，此相机支持第一人称视角和第三人称视角

import * as THREE from 'three';
import { sceneConfig, cameraConfig } from '@/config/recreationHallConfig';

export interface CameraControllerConfig {
  moveSpeed: number;
  lookSpeed: number;
  gravity: number;
  jumpForce: number;
  playerHeight: number;
}

export default class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  
  // 控制状态
  private isFirstPerson: boolean = true;
  private isLocked: boolean = false;
  private keys: { [key: string]: boolean } = {};
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private canJump: boolean = true;
  
  // 第三人称相关
  private target: THREE.Object3D;
  private distance: number = 5;
  private angleX: number = 0; // 水平旋转角度
  private angleY: number = Math.PI / 6; // 垂直旋转角度 (30度俯角)
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  
  // 鼠标控制
  private pitch: number = 0; // 俯仰角
  private yaw: number = 0; // 偏航角
  
  // 配置
  private config: CameraControllerConfig;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.config = sceneConfig.firstPerson;
    
    // 创建第三人称的目标对象
    this.target = new THREE.Object3D();
    this.target.position.copy(camera.position);
    this.target.position.y = 0; // 目标在地面上
    
    // 初始化视角
    this.resetCamera();
    
    // 绑定事件
    this.bindEvents();
  }

  private bindEvents(): void {
    // 键盘事件
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
    
    // 鼠标事件
    this.domElement.addEventListener('click', this.onMouseClick.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this));
    
    // 添加指针锁定状态变化监听 - 简化处理
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    
    // F8切换视角
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F8') {
        this.toggleCameraMode();
        e.preventDefault();
      }
    });
  }

  // 简化指针锁定状态变化处理方法
  private onPointerLockChange(): void {
    this.isLocked = document.pointerLockElement === this.domElement;
    
    // 可选：更新光标样式
    if (this.isLocked) {
      this.domElement.style.cursor = 'none';
    } else {
      this.domElement.style.cursor = 'default';
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys[event.key.toLowerCase()] = true;
    
    // 空格键跳跃（仅第一人称）
    if (event.code === 'Space' && this.isFirstPerson && this.canJump) {
      this.velocity.y = this.config.jumpForce;
      this.canJump = false;
    }
    
    // ESC键退出指针锁定
    if (event.key === 'Escape') {
      if (document.pointerLockElement === this.domElement) {
        document.exitPointerLock();
      }
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys[event.key.toLowerCase()] = false;
  }

  // 简化的鼠标点击处理，参考 FirstPersonController 的实现
  private onMouseClick(event: MouseEvent): void {
    // 如果是右键点击，不进行指针锁定（保留右键菜单功能）
    if (event.button === 2) return;
    
    // 简化逻辑：如果没有锁定就尝试锁定
    if (!this.isLocked) {
      this.domElement.requestPointerLock();
    }
  }

  private onMouseMove(event: MouseEvent): void {
    // 只在锁定状态下处理鼠标移动
    if (this.isLocked) {
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;
      
      if (this.isFirstPerson) {
        // 第一人称鼠标控制
        this.yaw -= movementX * this.config.lookSpeed;
        this.pitch -= movementY * this.config.lookSpeed;
        
        // 限制俯仰角度（防止相机翻转）
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
      } else {
        // 第三人称鼠标控制
        this.angleX -= movementX * this.config.lookSpeed;
        this.angleY -= movementY * this.config.lookSpeed;
        
        // 限制垂直角度
        this.angleY = Math.max(Math.PI / 12, Math.min(Math.PI / 2, this.angleY));
      }
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private toggleCameraMode(): void {
    this.isFirstPerson = !this.isFirstPerson;
    console.log(`切换到${this.isFirstPerson ? '第一人称' : '第三人称'}视角`);
    
    if (this.isFirstPerson) {
      // 切换到第一人称：将相机放回目标位置
      this.camera.position.copy(this.target.position);
      this.camera.position.y += this.config.playerHeight;
      this.updateCameraRotation();
    } else {
      // 切换到第三人称：更新第三人称相机位置
      this.updateThirdPersonCamera();
    }
  }

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
    
    // 归一化并应用速度
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      moveDirection.multiplyScalar(this.config.moveSpeed * deltaTime);
      this.camera.position.add(moveDirection);
    }
    
    // 应用重力
    this.velocity.y -= this.config.gravity * deltaTime;
    this.camera.position.y += this.velocity.y * deltaTime;
    
    // 地面检测
    if (this.camera.position.y < this.config.playerHeight) {
      this.camera.position.y = this.config.playerHeight;
      this.velocity.y = 0;
      this.canJump = true;
    }
    
    // 更新目标位置（用于第三人称）
    this.target.position.copy(this.camera.position);
    this.target.position.y = 0;
  }

  private updateThirdPerson(deltaTime: number): void {
    // 第三人称下，控制目标对象移动
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (this.keys['w'] || this.keys['arrowup']) {
      moveDirection.z -= 1;
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      moveDirection.z += 1;
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      moveDirection.x -= 1;
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      moveDirection.x += 1;
    }
    
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      
      // 根据相机方向旋转移动向量
      const angle = this.angleX;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const x = moveDirection.x * cos - moveDirection.z * sin;
      const z = moveDirection.x * sin + moveDirection.z * cos;
      
      moveDirection.set(x, 0, z);
      moveDirection.multiplyScalar(this.config.moveSpeed * deltaTime);
      this.target.position.add(moveDirection);
    }
    
    // 更新第三人称相机位置
    this.updateThirdPersonCamera();
    
    // 更新第一人称的旋转（保持同步）
    this.yaw = this.angleX;
    this.pitch = 0;
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
  }

  public update(deltaTime: number): void {
    if (this.isFirstPerson) {
      this.updateFirstPerson(deltaTime);
    } else {
      this.updateThirdPerson(deltaTime);
    }
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
  }

  public dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    
    if (this.domElement) {
      this.domElement.removeEventListener('click', this.onMouseClick.bind(this));
      this.domElement.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.domElement.removeEventListener('contextmenu', this.onContextMenu.bind(this));
    }
    
    // 退出指针锁定
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }
}