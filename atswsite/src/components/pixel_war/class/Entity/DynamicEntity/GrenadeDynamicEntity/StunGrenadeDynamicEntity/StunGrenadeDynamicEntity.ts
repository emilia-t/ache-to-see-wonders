import { GrenadeDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

class StunGrenadeDynamicEntity extends GrenadeDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    ownerId: number | null,
    teamId: number | null,
    texturePath: string,
    name: string = '',
    tag: string
  ) {
    super(position, width, height, ownerId, teamId, texturePath, name, 'stun', tag);
  }

  public draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    //待定
  }
}

export { StunGrenadeDynamicEntity };

