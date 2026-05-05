import { Entity } from '@/components/pixel_war/class/Entity/Entity';
import type { EntityDebugFlags, Point } from '@/components/pixel_war/interface/Interface';

abstract class ItemEntity extends Entity {
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
    tag: string,
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

  /**
   * 绘制实体
   * @param ctx 
   * @param worldToScreen 
   * @param canvasSize 
   * @param debugFlags 
   */
  draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    if (this.isDisappearing) return;
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const left = screenPos.x - this.width / 2;
    const top = screenPos.y - this.height / 2;

    const lifeOpacity = this.getLifetimeOpacity();
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, lifeOpacity));
    if (this.texture?.loaded) {
      ctx.drawImage(this.texture.img, left, top, this.width, this.height);
    } else {
      ctx.fillStyle = '#f5c16c';
      ctx.fillRect(left, top, this.width, this.height);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(left, top, this.width, this.height);
    }
    ctx.restore();
  }
}

export { ItemEntity };

