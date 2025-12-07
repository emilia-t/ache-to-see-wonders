// The relative position of this file: src/class/FirstPersonController.ts
// 负责第一人称视角的鼠标键盘控制和移动逻辑
import * as THREE from 'three';
import { sceneConfig } from '@/config/chineseChessConfig.ts';
import type GameSettings from '@/interface/CC1GameSetting';

export class FirstPersonController {
  public isPointerLocked = false;
  public canJump = false;
  public pitch = 0;
  public yaw = 0;
  
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };
  
  private prevTime = performance.now();
  private rotationSpeed = 0.002;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private gameSettings: GameSettings;
  
  private onPointerLockChange: () => void;
  private onMouseMove: (event: MouseEvent) => void;
  private onKeyDown: (event: KeyboardEvent) => void;
  private onKeyUp: (event: KeyboardEvent) => void;
  private onClick?: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    gameSettings: GameSettings,
    onClick?: () => void
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.gameSettings = gameSettings;
    this.onClick = onClick;
    
    this.onPointerLockChange = this.handlePointerLockChange.bind(this);
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onKeyUp = this.handleKeyUp.bind(this);
  }

  public init() {
    this.domElement.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.domElement.requestPointerLock();
      }
    });
    
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mozpointerlockchange', this.onPointerLockChange);
    
    if (this.onClick) {
      this.domElement.addEventListener('click', this.onClick);
    }
    
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  public update(delta: number) {
    if (!this.isPointerLocked) return;
    
    this.updateMovement(delta);
  }

  private updateMovement(delta: number) {
    // 减速
    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;

    // 计算移动方向
    this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
    this.direction.x = Number(this.moveState.right) - Number(this.moveState.left);
    this.direction.normalize();

    // 如果没有输入，速度归零
    if (!this.moveState.forward && !this.moveState.backward && !this.moveState.left && !this.moveState.right) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // 计算实际移动方向
    if (this.moveState.forward || this.moveState.backward || this.moveState.left || this.moveState.right) {
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);

      const cameraRight = new THREE.Vector3();
      cameraRight.crossVectors(cameraDirection, this.camera.up).normalize();

      const moveDirection = new THREE.Vector3(0, 0, 0);

      if (this.moveState.forward) moveDirection.add(cameraDirection);
      if (this.moveState.backward) moveDirection.sub(cameraDirection);
      if (this.moveState.left) moveDirection.sub(cameraRight);
      if (this.moveState.right) moveDirection.add(cameraRight);

      moveDirection.y = 0;
      moveDirection.normalize();

      const moveSpeed = sceneConfig.firstPerson.moveSpeed * this.gameSettings.moveSensitivity / 100;
      this.velocity.x += moveDirection.x * moveSpeed * delta;
      this.velocity.z += moveDirection.z * moveSpeed * delta;
    }

    // 应用重力
    this.velocity.y -= sceneConfig.firstPerson.gravity * delta;

    // 移动相机
    this.camera.position.x += this.velocity.x * delta;
    this.camera.position.y += this.velocity.y * delta;
    this.camera.position.z += this.velocity.z * delta;

    // 地面碰撞检测
    if (this.camera.position.y < sceneConfig.firstPerson.playerHeight) {
      this.velocity.y = 0;
      this.camera.position.y = sceneConfig.firstPerson.playerHeight;
      this.canJump = true;
    }
  }

  private handlePointerLockChange() {
    const wasPointerLocked = this.isPointerLocked;
    this.isPointerLocked = document.pointerLockElement === this.domElement;

    if (this.isPointerLocked) {
      this.domElement.style.cursor = 'none';
    } else {
      this.domElement.style.cursor = 'default';
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.isPointerLocked) return;
    
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    
    const sensitivity = this.gameSettings.mouseSensitivity / 100;
    this.yaw -= (movementX * this.rotationSpeed) * sensitivity;
    this.pitch -= (movementY * this.rotationSpeed) * sensitivity;
    
    // 限制俯仰角
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    
    // 更新相机旋转
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.setRotationFromQuaternion(quaternion);
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!this.isPointerLocked) return;
    
    const keyActions: { [key: string]: () => void } = {
      'ArrowUp': () => this.moveState.forward = true,
      'KeyW': () => this.moveState.forward = true,
      'ArrowLeft': () => this.moveState.left = true,
      'KeyA': () => this.moveState.left = true,
      'ArrowDown': () => this.moveState.backward = true,
      'KeyS': () => this.moveState.backward = true,
      'ArrowRight': () => this.moveState.right = true,
      'KeyD': () => this.moveState.right = true,
      'Space': () => {
        if (this.canJump) {
          this.velocity.y += sceneConfig.firstPerson.jumpForce;
          this.canJump = false;
        }
      }
    };
    
    keyActions[event.code]?.();
  }

  private handleKeyUp(event: KeyboardEvent) {
    if (!this.isPointerLocked) return;
    
    const keyActions: { [key: string]: () => void } = {
      'ArrowUp': () => this.moveState.forward = false,
      'KeyW': () => this.moveState.forward = false,
      'ArrowLeft': () => this.moveState.left = false,
      'KeyA': () => this.moveState.left = false,
      'ArrowDown': () => this.moveState.backward = false,
      'KeyS': () => this.moveState.backward = false,
      'ArrowRight': () => this.moveState.right = false,
      'KeyD': () => this.moveState.right = false
    };
    
    keyActions[event.code]?.();
  }

  public getPosition(): { x: number; y: number; z: number } {
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z
    };
  }

  public setCameraPosition(position: { x: number; y: number; z: number }, pitch: number, yaw: number) {
    this.camera.position.set(position.x, position.y, position.z);
    this.pitch = pitch;
    this.yaw = yaw;
    
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.setRotationFromQuaternion(quaternion);
  }

  public updateGameSettings(settings: GameSettings) {
    this.gameSettings = settings;
  }

  public dispose() {
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mozpointerlockchange', this.onPointerLockChange);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    
    if (this.onClick) {
      this.domElement.removeEventListener('click', this.onClick);
    }
    
    this.domElement.style.cursor = 'default';
  }
}