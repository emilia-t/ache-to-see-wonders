import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

class OrdinaryBulletDynamicEntity extends BulletDynamicEntity {
  public bulletColor: string;

  constructor(
    position: Point,
    direction: Point,
    ownerId: number | null,
    teamId: number | null, 
    name: string = '',
    bulletColor: string = 'rgba(255, 255, 50, 0.9)'
  ) {
    super(position, direction, ownerId, teamId, 'short', name, 50, 'ordinary_bullet');
    this.bulletColor = bulletColor;
  }

  public override draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    const angle = this.getScreenRotationAngle();
    ctx.rotate(angle);
    ctx.fillStyle = this.bulletColor;
    ctx.fillRect(-BulletDynamicEntity.WIDTH / 2, -BulletDynamicEntity.HEIGHT / 4, BulletDynamicEntity.WIDTH, BulletDynamicEntity.HEIGHT / 2);
    ctx.restore();
  }
}

export { OrdinaryBulletDynamicEntity };
