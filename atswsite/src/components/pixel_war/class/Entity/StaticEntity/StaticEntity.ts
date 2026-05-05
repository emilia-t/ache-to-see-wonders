import { Entity } from '@/components/pixel_war/class/Entity/Entity';
import type { EntityDebugFlags, Point } from '@/components/pixel_war/interface/Interface';

abstract class StaticEntity extends Entity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag: string,
  ) {
    super('static', position, width, height, texturePath, name, tag);
  }

  /**
   * 绘制实体
   * @param ctx 
   * @param worldToScreen 
   * @param canvasSize 
   * @param debugFlags 
   */
  draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const left = screenPos.x - this.width / 2;
    const top = screenPos.y - this.height / 2;
    ctx.save();
    if (this.texture?.loaded) {
      ctx.drawImage(this.texture.img, left, top, this.width, this.height);
    } else {
      ctx.fillStyle = this.fillColor || '#aaaaaa';
      ctx.fillRect(left, top, this.width, this.height);
      ctx.strokeStyle = this.strokeColor || '#000';
      ctx.strokeRect(left, top, this.width, this.height);
    }
    ctx.restore();
  }
}

export { StaticEntity };

