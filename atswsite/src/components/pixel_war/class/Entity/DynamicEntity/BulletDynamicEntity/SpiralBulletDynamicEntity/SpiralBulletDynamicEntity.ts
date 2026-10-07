import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 螺旋弹基色(弹体/拖尾/发光共用):青绿色荧光,与普通黄弹、白色狙击弹区分 */
const SPIRAL_BULLET_COLOR = 'rgba(150, 255, 220, 0.9)';

/**
 * 螺旋弹(spiral_bullet)
 *
 * <p>与普通子弹一样按固定速率飞行,但飞行过程中<b>速度方向持续旋转</b>,
 * 因此轨迹是一条平滑的螺旋弧线,用于制造"盘旋弹幕"。</p>
 *
 * <p>实现:重写 {@link update},先把速度向量按 {@link SpiralBulletDynamicEntity.CURVE_DEG_PER_SEC}
 * 旋转一个帧角,再交给基类按新速度推进(撞墙/寿命逻辑完全复用)。
 * 由于方向由速度推导,快照下发的 velocity 天然携带弯曲后的方向,多人模式渲染一致。</p>
 *
 * <p>命中判定与普通子弹共用(World.updateBulletEntities 统一处理),无需额外分支。</p>
 */
class SpiralBulletDynamicEntity extends BulletDynamicEntity {
  /** 弹体基色 */
  public static readonly COLOR = SPIRAL_BULLET_COLOR;
  /** 速度方向旋转角速度(度/秒):正值代表逆时针偏转 */
  public static readonly CURVE_DEG_PER_SEC = 150;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = '',
    moveSpeed: number = BulletDynamicEntity.MOVE_SPEED
  ) {
    super(position, direction, ownerId, teamId, 'long', name, 1, 'spiral_bullet', moveSpeed);
    this.bulletColor = SPIRAL_BULLET_COLOR;
  }

  /**
   * 飞行中让速度方向按固定角速度旋转,再交给基类按新速度推进。
   */
  public override update(dt: number, staticEntities: StaticEntity[]): void {
    if (this.shouldRemove) return;

    const rad = SpiralBulletDynamicEntity.CURVE_DEG_PER_SEC * dt * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const vx = this.velocity.x;
    const vy = this.velocity.y;
    this.velocity.x = vx * cos - vy * sin;
    this.velocity.y = vx * sin + vy * cos;

    super.update(dt, staticEntities);
  }

  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    // 弹体长度约为普通子弹的 1.6 倍,拖尾随射速自动缩放
    this.drawBulletVisual(
      ctx,
      worldToScreen,
      BulletDynamicEntity.WIDTH * 1.6,
      BulletDynamicEntity.BODY_WIDTH
    );
  }
}

export { SpiralBulletDynamicEntity };
