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

    const bodyWidth = BulletDynamicEntity.WIDTH;
    const bodyHeight = BulletDynamicEntity.HEIGHT / 2;
    const trailLength = bodyWidth * 3.5;
    const trailWidth = BulletDynamicEntity.HEIGHT * 1.4;
    const trailGradient = ctx.createLinearGradient(-trailLength, 0, bodyWidth / 2, 0);
    trailGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    trailGradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.16)');
    trailGradient.addColorStop(1, this.bulletColor);

    ctx.fillStyle = trailGradient;
    ctx.beginPath();
    ctx.moveTo(-trailLength, 0);
    ctx.quadraticCurveTo(-bodyWidth, -trailWidth / 2, bodyWidth / 2, -bodyHeight / 2);
    ctx.lineTo(bodyWidth / 2, bodyHeight / 2);
    ctx.quadraticCurveTo(-bodyWidth, trailWidth / 2, -trailLength, 0);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 8;
    ctx.shadowColor = this.bulletColor;
    ctx.fillStyle = this.bulletColor;
    ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight);
    ctx.restore();
  }
}

export { OrdinaryBulletDynamicEntity };
