import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

class OrdinaryBulletDynamicEntity extends BulletDynamicEntity {
  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null, 
    name: string = '',
    bulletColor: string = BulletDynamicEntity.DEFAULT_COLOR
  ) {
    super(position, direction, ownerId, teamId, 'short', name, 1, 'ordinary_bullet');
    // 基色同时决定弹体、拖尾与发光颜色;空值回退到默认色,避免快照缺省导致颜色丢失
    this.bulletColor = bulletColor || BulletDynamicEntity.DEFAULT_COLOR;
  }

  public override draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    // 弹体长度 = 子弹宽度,宽度 = 子弹高度的一半
    this.drawBulletVisual(ctx, worldToScreen, BulletDynamicEntity.WIDTH, BulletDynamicEntity.BODY_WIDTH);
  }
}

export { OrdinaryBulletDynamicEntity };
