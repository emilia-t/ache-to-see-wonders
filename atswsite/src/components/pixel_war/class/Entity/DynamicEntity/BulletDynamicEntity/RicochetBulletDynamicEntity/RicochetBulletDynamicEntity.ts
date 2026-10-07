import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 跳弹基色(弹体/拖尾/发光共用):钴蓝 */
const RICOCHET_BULLET_COLOR = 'rgba(110, 170, 255, 0.9)';

/**
 * 跳弹(ricochet_bullet)
 *
 * <p>撞墙时<b>反弹</b>而不是消失,最多反弹 {@link RicochetBulletDynamicEntity.MAX_BOUNCES} 次,
 * 超出后按普通子弹处理(撞墙即消失)。</p>
 *
 * <p>反弹采用<b>分轴判定</b>:分别用「只走 X」「只走 Y」的候选位置复检静态碰撞,
 * 因此正面撞墙、沿墙滑行与角落双反弹都表现自然,不会出现卡进墙里的情况。</p>
 */
class RicochetBulletDynamicEntity extends BulletDynamicEntity {
  /** 弹体基色 */
  public static readonly COLOR = RICOCHET_BULLET_COLOR;
  /** 最大反弹次数 */
  public static readonly MAX_BOUNCES = 3;

  /** 剩余可反弹次数(随快照下发,多人渲染不需要,仅权威端使用) */
  public remainingBounces = RicochetBulletDynamicEntity.MAX_BOUNCES;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = '',
    moveSpeed: number = BulletDynamicEntity.MOVE_SPEED
  ) {
    super(position, direction, ownerId, teamId, 'long', name, 1, 'ricochet_bullet', moveSpeed);
    this.bulletColor = RICOCHET_BULLET_COLOR;
  }

  /**
   * 撞墙:按剩余次数反弹,位置保持不动(下一帧按反向速度继续前进)。
   */
  protected override onStaticCollision(nextPos: Point, staticEntities: StaticEntity[]): void {
    if (this.remainingBounces <= 0) {
      this.shouldRemove = true;
      return;
    }
    this.remainingBounces -= 1;

    const hitX = this.collidesWithStatic({ x: nextPos.x, y: this.position.y }, staticEntities);
    const hitY = this.collidesWithStatic({ x: this.position.x, y: nextPos.y }, staticEntities);
    if (hitX && !hitY) {
      this.velocity.x = -this.velocity.x;
    } else if (hitY && !hitX) {
      this.velocity.y = -this.velocity.y;
    } else {
      // 角落:两轴同时反弹
      this.velocity.x = -this.velocity.x;
      this.velocity.y = -this.velocity.y;
    }
  }

  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    this.drawBulletVisual(
      ctx,
      worldToScreen,
      BulletDynamicEntity.WIDTH * 1.4,
      BulletDynamicEntity.BODY_WIDTH
    );
  }
}

export { RicochetBulletDynamicEntity };
