import { Entity } from '../Entity';
import type { Point } from '../../../interface/InterfaceTest2d';

class ItemEntity extends Entity {
  lifetimeTotal: number; // 初始寿命（秒）
  lifetimeRemaining: number; // 寿命剩余时间（秒）
  isDisappearing: boolean; // 是否进入消失特效阶段
  disappearDuration: number; // 消失特效总时长（秒）
  disappearTimer: number; // 消失特效剩余时长（秒）

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string,
    lifetimeSeconds: number = 300
  ) {
    super('item', position, width, height, texturePath, name, tag);
    this.lifetimeTotal = Math.max(0, lifetimeSeconds);
    this.lifetimeRemaining = this.lifetimeTotal;
    this.isDisappearing = false;
    this.disappearDuration = 0.45;
    this.disappearTimer = 0;
    // ItemEntity 不参与碰撞体积计算
    this.collisionBox = {
      x: position.x,
      y: position.y,
      width: 0,
      height: 0,
    };
  }

  // item 无碰撞盒，位置变化不需要更新碰撞盒
  updateCollisionBox() {}

  updateLifetime(dt: number) {
    if (this.isDisappearing) {
      this.disappearTimer = Math.max(0, this.disappearTimer - dt);
      return;
    }
    if (this.lifetimeRemaining <= 0) {
      this.beginDisappear();
      return;
    }
    this.lifetimeRemaining = Math.max(0, this.lifetimeRemaining - dt);
    if (this.lifetimeRemaining <= 0) {
      this.beginDisappear();
    }
  }

  beginDisappear() {
    if (this.isDisappearing) return;
    this.isDisappearing = true;
    this.disappearTimer = this.disappearDuration;
  }

  isReadyToRemove() {
    return this.isDisappearing && this.disappearTimer <= 0;
  }

  getLifetimeOpacity() {
    if (this.lifetimeTotal <= 0) return 1;
    const ratio = this.lifetimeRemaining / this.lifetimeTotal;
    if (ratio > 0.75) return 1;
    if (ratio > 0.5) return 0.75;
    if (ratio > 0.25) return 0.5;
    return 0.25;
  }
}

export { ItemEntity };

