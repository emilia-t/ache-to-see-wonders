import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/** 狙击弹基色(弹体/拖尾/发光共用) */
const SNIPER_BULLET_COLOR = 'rgba(255, 255, 255, 0.9)';

class SniperBulletDynamicEntity extends BulletDynamicEntity {
  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null,
    name: string = ''
  ) {
    super(position, direction, ownerId, teamId, 'long', name, 1, 'sniper_bullet');
    this.bulletColor = SNIPER_BULLET_COLOR;
  }

  public override draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    // 狙击弹弹体最长:长度 = 子弹宽度 × 2.5,拖尾与发光同步变长
    this.drawBulletVisual(ctx, worldToScreen, BulletDynamicEntity.WIDTH * 2.5, BulletDynamicEntity.BODY_WIDTH);
  }
}

export { SniperBulletDynamicEntity };
