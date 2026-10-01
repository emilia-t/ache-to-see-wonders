import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 霰弹基色(弹体/拖尾/发光共用) */
const BUCKSHOT_BULLET_COLOR = 'rgba(200, 180, 50, 0.9)';

class BuckshotBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, teamId: number | null, name: string = 'Buckshot Bullet') {
    super(position, direction, ownerId, teamId ,'short', name, 1, 'buckshot_bullet');
    this.bulletColor = BUCKSHOT_BULLET_COLOR;
  }

  public override draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    // 霰弹弹体最短:长度 = 子弹宽度
    this.drawBulletVisual(ctx, worldToScreen, BulletDynamicEntity.WIDTH, BulletDynamicEntity.BODY_WIDTH);
  }
}

export { BuckshotBulletDynamicEntity };
