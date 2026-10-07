import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 疾进弹基色(弹体/拖尾/发光共用):橙红,与普通黄弹、钴蓝跳弹区分 */
const ACCELERATING_BULLET_COLOR = 'rgba(255, 122, 74, 0.9)';

/**
 * 疾进弹(accelerating_bullet)
 *
 * <p>出膛时慢、越飞越快:速度从 {@link AcceleratingBulletDynamicEntity.INITIAL_SPEED_MULTIPLIER}
 * 倍基础速度开始,在 {@link AcceleratingBulletDynamicEntity.RAMP_SECONDS} 秒内线性爬升到
 * {@link AcceleratingBulletDynamicEntity.MAX_SPEED_MULTIPLIER} 倍,之后保持恒定。</p>
 *
 * <p>因此它的威胁是"后发制人":贴脸时容易走位闪开,但拉开距离后反而更难躲。
 * 速度的爬升完全在 {@link update} 内完成,不依赖权威端的任何特殊处理;
 * 拖尾长度由基类的 `getTrailSpeedScale()` 按当前速度自动拉长,手感上"越飞越快"。</p>
 */
class AcceleratingBulletDynamicEntity extends BulletDynamicEntity {
  /** 弹体基色 */
  public static readonly COLOR = ACCELERATING_BULLET_COLOR;
  /** 出膛时的速度倍率(相对基础速度) */
  public static readonly INITIAL_SPEED_MULTIPLIER = 0.45;
  /** 速度爬升上限倍率 */
  public static readonly MAX_SPEED_MULTIPLIER = 2.1;
  /** 从初始倍率线性爬升到最大倍率所需时间(秒) */
  public static readonly RAMP_SECONDS = 1.1;

  /** 已飞行时间(秒) */
  private elapsed = 0;
  /** 基础速度(px/s):爬升倍率的参考速度 */
  private readonly baseSpeed: number;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = '',
    moveSpeed: number = BulletDynamicEntity.MOVE_SPEED
  ) {
    super(position, direction, ownerId, teamId, 'short', name, 1, 'accelerating_bullet', moveSpeed);
    this.bulletColor = ACCELERATING_BULLET_COLOR;
    const speed = Number.isFinite(moveSpeed) && moveSpeed > 0
      ? moveSpeed
      : BulletDynamicEntity.MOVE_SPEED;
    this.baseSpeed = speed;
    // 出膛时先按较低速度飞行(方向沿用构造参数,与基类一致)
    const len = Math.hypot(direction.x, direction.y);
    const dirX = len > 0.0001 ? direction.x / len : 1;
    const dirY = len > 0.0001 ? direction.y / len : 0;
    this.velocity = {
      x: dirX * speed * AcceleratingBulletDynamicEntity.INITIAL_SPEED_MULTIPLIER,
      y: dirY * speed * AcceleratingBulletDynamicEntity.INITIAL_SPEED_MULTIPLIER
    };
    this.speed = speed * AcceleratingBulletDynamicEntity.INITIAL_SPEED_MULTIPLIER;
  }

  /** 当前速度倍率(0~1 的爬升进度线性映射到 [初始倍率, 最大倍率]) */
  private getSpeedMultiplier(): number {
    const t = Math.max(0, Math.min(1, this.elapsed / AcceleratingBulletDynamicEntity.RAMP_SECONDS));
    return AcceleratingBulletDynamicEntity.INITIAL_SPEED_MULTIPLIER
      + (AcceleratingBulletDynamicEntity.MAX_SPEED_MULTIPLIER
        - AcceleratingBulletDynamicEntity.INITIAL_SPEED_MULTIPLIER) * t;
  }

  /**
   * 飞行中按固定倍率爬升:保持方向不变,仅把速度大小乘以当前倍率,再交给基类推进。
   */
  public override update(dt: number, staticEntities: StaticEntity[]): void {
    if (this.shouldRemove) return;

    this.elapsed += dt;
    const speed = this.baseSpeed * this.getSpeedMultiplier();
    const len = Math.hypot(this.velocity.x, this.velocity.y);
    const dirX = len > 0.0001 ? this.velocity.x / len : 1;
    const dirY = len > 0.0001 ? this.velocity.y / len : 0;
    this.velocity.x = dirX * speed;
    this.velocity.y = dirY * speed;
    // 同步速度字段:基类据此缩放拖尾长度
    this.speed = speed;
    this.minMoveSpeed = speed;
    this.maxMoveSpeed = speed;

    super.update(dt, staticEntities);
  }

  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    // 弹体略短,强调"越飞越快的弹丸"
    this.drawBulletVisual(
      ctx,
      worldToScreen,
      BulletDynamicEntity.WIDTH * 1.15,
      BulletDynamicEntity.BODY_WIDTH
    );
  }
}

export { AcceleratingBulletDynamicEntity };
