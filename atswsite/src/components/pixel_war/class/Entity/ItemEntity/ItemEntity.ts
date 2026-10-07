import { Entity } from '@/components/pixel_war/class/Entity/Entity';
import type { EntityDebugFlags, Point } from '@/components/pixel_war/interface/Interface';
import type { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';

abstract class ItemEntity extends Entity {
  public lifetimeTotal: number; // 初始寿命（秒）
  public lifetimeRemaining: number; // 寿命剩余时间（秒）
  public isDisappearing: boolean; // 是否进入消失特效阶段
  public disappearDuration: number; // 消失特效总时长（秒）
  public disappearTimer: number; // 消失特效剩余时间（秒）
  public count: number; // 该掉落物承载的物品数量（堆叠,1 表示单个;拾取时按背包剩余空间结算）

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
    this.count = 1;
    // ItemEntity 不参与碰撞体积计算
    this.collisionBox = {
      x: position.x,
      y: position.y,
      width: 0,
      height: 0,
    };
  }

  // item 无碰撞盒，位置变化不需要更新碰撞盒
  public updateCollisionBox() {}

  public updateLifetime(dt: number) {
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

  public beginDisappear() {
    if (this.isDisappearing) return;
    this.isDisappearing = true;
    this.disappearTimer = this.disappearDuration;
  }

  public isReadyToRemove() {
    return this.isDisappearing && this.disappearTimer <= 0;
  }

  ////////////////////
  // 统一「掉落物拾取」契约 -->
  //
  // 与经验球 / 技能球 / 子弹球实现同一套接口,因此可由权威端的同一条
  // 「以掉落物为中心」的拾取管线(Service.updatePickups)统一处理。
  // 物品不磁吸:吸引范围为 0,只在玩家「碰到」时拾取。
  ////////////////////

  /** 吸引范围(px):物品不磁吸,恒为 0 */
  public getAbsorbRange(): number {
    return 0;
  }

  /** 拾取范围(px):玩家与物品的「接触半径」(两者半宽之和),与旧行为一致 */
  public getPickupRange(player: PlayerDynamicEntity): number {
    return (player.width + this.width) / 2;
  }

  /** 背包放得下时才能被该玩家拾取 */
  public canBeAbsorbedBy(player: PlayerDynamicEntity): boolean {
    return !this.isDisappearing && player.canAcceptItem(this.tag);
  }

  /** 物品不磁吸:牵引为空实现 */
  public attractTowardPlayer(_player: PlayerDynamicEntity, _dt: number): void {
    // 物品不移动
  }

  /**
   * 被玩家拾取:按背包剩余空间结算(可堆叠),装不下的部分继续留在地上。
   */
  public absorbByPlayer(player: PlayerDynamicEntity): void {
    const want = Math.max(1, Math.floor(this.count));
    const accepted = player.acquireItemCount(this.tag, this.name, want);
    if (accepted <= 0) return;
    this.count = want - accepted;
    if (this.count <= 0) this.beginDisappear();
  }

  /** 是否已被拾取(进入消失阶段即视为已拾取) */
  public isAbsorbed(): boolean {
    return this.isDisappearing;
  }

  ////////////////////
  // <-- 统一「掉落物拾取」契约
  ////////////////////

  public getLifetimeOpacity() {
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
  public draw(
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

    // 堆叠数量大于 1 时在物品右下角标注,便于玩家看清掉落了一堆物品
    if (this.count > 1) {
      const label = `x${this.count}`;
      const labelX = left + this.width;
      const labelY = top + this.height + 4;
      ctx.font = 'bold 10px Consolas, "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(label, labelX, labelY);
      ctx.fillStyle = '#eafdff';
      ctx.fillText(label, labelX, labelY);
    }
    ctx.restore();
  }
}

export { ItemEntity };

