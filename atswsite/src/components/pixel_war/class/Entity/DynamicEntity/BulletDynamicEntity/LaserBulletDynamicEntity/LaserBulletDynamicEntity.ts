import { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

class LaserBulletDynamicEntity extends BulletDynamicEntity {
  constructor(position: Point, direction: Point, ownerId: number | null, teamId: number | null, name: string = 'Laser Bullet') {
    super(position, direction, ownerId, teamId, 'long', name, 30, 'laser_bullet');
    //
  }

  public draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
    ctx.fillRect(-BulletDynamicEntity.WIDTH / 2, -BulletDynamicEntity.HEIGHT / 4, BulletDynamicEntity.WIDTH * 2, BulletDynamicEntity.HEIGHT / 2);
    ctx.restore();
  }

}

export { LaserBulletDynamicEntity };

