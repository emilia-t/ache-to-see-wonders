import { GrenadeDynamicEntity } from '../GrenadeDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class SmokeGrenadeDynamicEntity extends GrenadeDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string = 'Smoke Grenade',
    tag?: string
  ) {
    super(position, width, height, texturePath, name, 'smoke', tag);
  }
}

export { SmokeGrenadeDynamicEntity };

