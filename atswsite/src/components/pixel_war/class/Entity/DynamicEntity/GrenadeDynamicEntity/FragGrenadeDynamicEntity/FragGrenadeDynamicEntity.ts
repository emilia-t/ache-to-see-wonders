import { GrenadeDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

class FragGrenadeDynamicEntity extends GrenadeDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string = 'Frag Grenade',
    tag: string
  ) {
    super(position, width, height, texturePath, name, 'frag', tag);
  }
  
  public draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number; }, canvasSize: { width: number; height: number; }, debugFlags?: EntityDebugFlags): void {
    //待定
  }
}

export { FragGrenadeDynamicEntity };

