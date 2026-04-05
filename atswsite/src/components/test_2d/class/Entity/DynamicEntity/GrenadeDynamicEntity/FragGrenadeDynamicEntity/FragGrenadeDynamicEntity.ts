import { GrenadeDynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

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

