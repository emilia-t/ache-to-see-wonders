import { GrenadeDynamicEntity } from '../GrenadeDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class StunGrenadeDynamicEntity extends GrenadeDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string = 'Stun Grenade',
    tag?: string
  ) {
    super(position, width, height, texturePath, name, 'stun', tag);
  }
}

export { StunGrenadeDynamicEntity };

