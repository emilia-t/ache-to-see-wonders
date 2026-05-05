import { OrdinaryBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import type { NpcActionLoopContext } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class WhitePixelEntity extends HostileNpcDynamicEntity {
  static readonly WIDTH = 25;
  static readonly HEIGHT = 25;
  private static readonly ACTION_INTERVAL = 1;

  private isActionLoopRunning: boolean;
  private actionCooldownRemaining: number;

  constructor(position: Point) {
    super(position, WhitePixelEntity.WIDTH, WhitePixelEntity.HEIGHT, '', '', 0, 'white_pixel');
    this.fillColor = '#ffffff';
    this.strokeColor = '#bebebe';
    this.health = 100;
    this.healthMax = 100;
    this.isActionLoopRunning = false;
    this.actionCooldownRemaining = 0;
  }

  tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  pickupItem(_item: ItemEntity): void {
    // 白色像素不拾取任何物品。
  }

  actionLoop(context: NpcActionLoopContext): void {
    if (this.isDead || !this.isMoving) {
      if (this.isActionLoopRunning) {
        this.actionAfter(context);
      }
      return;
    }

    if (!this.isActionLoopRunning) {
      this.actionBefore(context);
      return;
    }

    this.actionCooldownRemaining -= context.deltaTime;
    while (this.actionCooldownRemaining <= 0 && this.isMoving && !this.isDead) {
      this.action(context);
      this.actionCooldownRemaining += WhitePixelEntity.ACTION_INTERVAL;
    }
  }

  action(context: NpcActionLoopContext): void {
    const direction = this.getNormalizedFacingDirection();
    const spawnDistance = this.width * 0.6;
    context.spawnProjectile(
      new OrdinaryBulletDynamicEntity(
        {
          x: this.position.x + direction.x * spawnDistance,
          y: this.position.y + direction.y * spawnDistance,
        },
        direction,
        this.id
      )
    );
  }

  actionBefore(context: NpcActionLoopContext): void {
    this.isActionLoopRunning = true;
    this.action(context);
    this.actionCooldownRemaining = WhitePixelEntity.ACTION_INTERVAL;
  }

  actionAfter(_context: NpcActionLoopContext): void {
    this.isActionLoopRunning = false;
    this.actionCooldownRemaining = 0;
  }

  /**
   * 白色像素只沿上下左右四个正交方向随机移动。
   * @param target 忽略，实际目标由内部生成
   * @param staticEntities 静态实体列表，用于避障
   * @param options 忽略
   */
  override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const directions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const distance = 100 + Math.random() * 200;
    const newTarget: Point = {
      x: this.position.x + randomDir.x * distance,
      y: this.position.y + randomDir.y * distance,
    };

    return super.setTarget(newTarget, staticEntities, { preferStraight: true });
  }

  /**
   * 移动完成后缩短停留时间，停留结束后自动开始下一段正交移动。
   */
  override update(dt: number, staticEntities: StaticEntity[]): void {
    const wasMoving = this.isMoving;

    super.update(dt, staticEntities);

    if (this.isDead) return;

    if (wasMoving && !this.isMoving && this.stayDurationRemaining > 0) {
      this.stayDurationRemaining = 1 + Math.random() * 2;
    }

    if (!this.isMoving && this.stayDurationRemaining <= 0) {
      this.setTarget(this.position, staticEntities, { preferStraight: true });
    }
  }

  private getNormalizedFacingDirection(): Point {
    const len = Math.hypot(this.facingDirection.x, this.facingDirection.y);
    if (len < 0.0001) return { x: 0, y: 1 };
    return {
      x: this.facingDirection.x / len,
      y: this.facingDirection.y / len,
    };
  }
}

export { WhitePixelEntity };
