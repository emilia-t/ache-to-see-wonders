import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 回旋弹基色(弹体/拖尾/发光共用):琥珀金 */
const BOOMERANG_BULLET_COLOR = 'rgba(255, 196, 92, 0.9)';

/**
 * 回旋弹(boomerang_bullet)
 *
 * <p>去而复返:先沿发射方向飞出 {@link BoomerangBulletDynamicEntity.OUTBOUND_SECONDS} 秒,
 * 随后<b>整条速度取反</b>并乘以 {@link BoomerangBulletDynamicEntity.RETURN_SPEED_MULTIPLIER}
 * 加速返回,因此弹道是一条"折返"的往返线段。</p>
 *
 * <p>折返仅发生一次,完全在 {@link update} 内实现(保持方向由速度推导,
 * 多人模式下客户端按速度渲染的朝向也随之翻转);此后按基类寿命自然消失。</p>
 */
class BoomerangBulletDynamicEntity extends BulletDynamicEntity {
  /** 弹体基色 */
  public static readonly COLOR = BOOMERANG_BULLET_COLOR;
  /** 飞出阶段时长(秒),到达后折返 */
  public static readonly OUTBOUND_SECONDS = 0.85;
  /** 折返时的速度倍率(>1 表示返程更快) */
  public static readonly RETURN_SPEED_MULTIPLIER = 1.3;

  /** 已飞行时间(秒) */
  private elapsed = 0;
  /** 是否已经折返(只折返一次) */
  private returned = false;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = '',
    moveSpeed: number = BulletDynamicEntity.MOVE_SPEED
  ) {
    super(position, direction, ownerId, teamId, 'long', name, 1, 'boomerang_bullet', moveSpeed);
    this.bulletColor = BOOMERANG_BULLET_COLOR;
  }

  /**
   * 飞出阶段结束后把速度取反(并提速),之后按基类逻辑继续推进。
   */
  public override update(dt: number, staticEntities: StaticEntity[]): void {
    if (this.shouldRemove) return;

    this.elapsed += dt;
    if (!this.returned && this.elapsed >= BoomerangBulletDynamicEntity.OUTBOUND_SECONDS) {
      this.returned = true;
      const multiplier = BoomerangBulletDynamicEntity.RETURN_SPEED_MULTIPLIER;
      this.velocity.x = -this.velocity.x * multiplier;
      this.velocity.y = -this.velocity.y * multiplier;
      this.speed = Math.hypot(this.velocity.x, this.velocity.y);
      this.minMoveSpeed = this.speed;
      this.maxMoveSpeed = this.speed;
    }

    super.update(dt, staticEntities);
  }

  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    // 弹体较长,强调"回旋镖"的手感
    this.drawBulletVisual(
      ctx,
      worldToScreen,
      BulletDynamicEntity.WIDTH * 1.6,
      BulletDynamicEntity.BODY_WIDTH
    );
  }
}

export { BoomerangBulletDynamicEntity };
