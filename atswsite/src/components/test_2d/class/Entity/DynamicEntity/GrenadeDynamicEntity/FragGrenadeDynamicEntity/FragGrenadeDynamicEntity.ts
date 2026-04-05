import { GrenadeDynamicEntity } from '../GrenadeDynamicEntity';
import type { Point } from '../../../../../interface/InterfaceTest2d';

class FragGrenadeDynamicEntity extends GrenadeDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string = 'Frag Grenade',
    tag?: string
  ) {
    super(position, width, height, texturePath, name, 'frag', tag);
  }
}

export { FragGrenadeDynamicEntity };

