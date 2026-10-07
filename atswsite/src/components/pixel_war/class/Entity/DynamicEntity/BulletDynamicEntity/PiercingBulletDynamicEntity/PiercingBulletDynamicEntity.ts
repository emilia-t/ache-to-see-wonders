import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 穿甲弹基色(弹体/拖尾/发光共用):亮品红,与其它弹种区分 */
const PIERCING_BULLET_COLOR = 'rgba(255, 120, 200, 0.9)';

/**
 * 穿甲弹(piercing_bullet)
 *
 * <p>命中目标后<b>不消失</b> —— 继续沿原方向飞行,并对沿途每个目标各造成一次伤害。
 * 同一目标对同一发子弹只结算一次(权威端记录已命中的目标 id,见
 * {@link BulletDynamicEntity.hasDamagedTarget}),因此穿透多个敌人时不会重复扣血。</p>
 *
 * <p>飞行/撞墙/寿命逻辑完全复用基类;命中穿透由 {@code Service.updateBulletEntities} 的
 * {@link BulletDynamicEntity.piercesTargets} 分支处理。</p>
 */
class PiercingBulletDynamicEntity extends BulletDynamicEntity {
  /** 弹体基色 */
  public static readonly COLOR = PIERCING_BULLET_COLOR;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = '',
    moveSpeed: number = BulletDynamicEntity.MOVE_SPEED
  ) {
    super(position, direction, ownerId, teamId, 'long', name, 1, 'piercing_bullet', moveSpeed);
    this.bulletColor = PIERCING_BULLET_COLOR;
    this.piercesTargets = true;
  }

  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    // 弹体较长,强调"贯穿"的手感
    this.drawBulletVisual(
      ctx,
      worldToScreen,
      BulletDynamicEntity.WIDTH * 2.2,
      BulletDynamicEntity.BODY_WIDTH
    );
  }
}

export { PiercingBulletDynamicEntity };
