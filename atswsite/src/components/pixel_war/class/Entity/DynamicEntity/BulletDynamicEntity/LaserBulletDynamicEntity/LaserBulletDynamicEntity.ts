import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 激光弹基色(弹体/拖尾/发光共用) */
const LASER_BULLET_COLOR = 'rgba(255, 50, 50, 0.9)';

class LaserBulletDynamicEntity extends BulletDynamicEntity {
  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = ''
  ) {
    super(position, direction, ownerId, teamId, 'long', name, 1, 'laser_bullet');
    this.bulletColor = LASER_BULLET_COLOR;
  }

  public override draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    // 激光弹弹体较长:长度 = 子弹宽度 × 2
    this.drawBulletVisual(ctx, worldToScreen, BulletDynamicEntity.WIDTH * 2, BulletDynamicEntity.BODY_WIDTH);
  }

}

export { LaserBulletDynamicEntity };
