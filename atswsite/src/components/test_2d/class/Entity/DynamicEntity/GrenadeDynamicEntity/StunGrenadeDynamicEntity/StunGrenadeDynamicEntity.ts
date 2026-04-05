import { GrenadeDynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

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

