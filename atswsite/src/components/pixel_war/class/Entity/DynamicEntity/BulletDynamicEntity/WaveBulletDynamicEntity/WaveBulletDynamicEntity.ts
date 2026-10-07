import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 波纹弹基色(弹体/拖尾/发光共用):靛紫,与青绿螺旋弹、品红穿甲弹区分 */
const WAVE_BULLET_COLOR = 'rgba(150, 160, 255, 0.9)';

/**
 * 波纹弹(wave_bullet)
 *
 * <p>沿主轴前进的同时<b>左右摆动</b>:每帧以"基准方向"为轴、按正弦波偏转
 * ±{@link WaveBulletDynamicEntity.WEAVE_DEG} 度后重新计算速度,因此弹道是一条
 * 规则的蛇形波浪线。</p>
 *
 * <p>摆幅有 {@link WaveBulletDynamicEntity.WEAVE_RAMP_SECONDS} 秒的展开时间
 * (出膛时笔直,随后逐渐摆开),便于玩家看清来向。速度由
 * {@link WaveBulletDynamicEntity.baseDirection} 重新推导(而不是在上一帧速度上反复旋转),
 * 因此不会累积浮点漂移,波形长期稳定。</p>
 */
class WaveBulletDynamicEntity extends BulletDynamicEntity {
  /** 弹体基色 */
  public static readonly COLOR = WAVE_BULLET_COLOR;
  /** 摆动最大偏角(度) */
  public static readonly WEAVE_DEG = 26;
  /** 摆动频率(Hz,每秒完整往复次数) */
  public static readonly WEAVE_HZ = 1.5;
  /** 摆幅展开时间(秒):出膛后逐渐从笔直摆到最大偏角 */
  public static readonly WEAVE_RAMP_SECONDS = 0.35;

  /** 已飞行时间(秒) */
  private elapsed = 0;
  /** 基準方向(单位向量):波形围绕它摆动,不随帧累积漂移 */
  private readonly baseDirection: Point;
  /** 基础速度(px/s) */
  private readonly baseSpeed: number;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = '',
    moveSpeed: number = BulletDynamicEntity.MOVE_SPEED
  ) {
    super(position, direction, ownerId, teamId, 'short', name, 1, 'wave_bullet', moveSpeed);
    this.bulletColor = WAVE_BULLET_COLOR;
    const speed = Number.isFinite(moveSpeed) && moveSpeed > 0
      ? moveSpeed
      : BulletDynamicEntity.MOVE_SPEED;
    const len = Math.hypot(direction.x, direction.y);
    this.baseDirection = len > 0.0001
      ? { x: direction.x / len, y: direction.y / len }
      : { x: 1, y: 0 };
    this.baseSpeed = speed;
  }

  /**
   * 飞行中按正弦规律左右偏转:始终以基准方向为轴,避免逐帧旋转导致的方向漂移。
   */
  public override update(dt: number, staticEntities: StaticEntity[]): void {
    if (this.shouldRemove) return;

    this.elapsed += dt;
    const envelope = Math.min(1, this.elapsed / WaveBulletDynamicEntity.WEAVE_RAMP_SECONDS);
    const wave = Math.sin(
      this.elapsed * WaveBulletDynamicEntity.WEAVE_HZ * Math.PI * 2
    );
    const rad = (
      WaveBulletDynamicEntity.WEAVE_DEG * envelope * wave
    ) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dirX = this.baseDirection.x * cos - this.baseDirection.y * sin;
    const dirY = this.baseDirection.x * sin + this.baseDirection.y * cos;
    this.velocity.x = dirX * this.baseSpeed;
    this.velocity.y = dirY * this.baseSpeed;

    super.update(dt, staticEntities);
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
      BulletDynamicEntity.WIDTH,
      BulletDynamicEntity.BODY_WIDTH
    );
  }
}

export { WaveBulletDynamicEntity };
