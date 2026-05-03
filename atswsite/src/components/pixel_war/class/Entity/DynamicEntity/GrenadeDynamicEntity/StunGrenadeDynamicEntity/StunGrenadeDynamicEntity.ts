import { GrenadeDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class StunGrenadeDynamicEntity extends GrenadeDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string = 'Stun Grenade',
    tag: string
  ) {
    super(position, width, height, texturePath, name, 'stun', tag);
  }
}

export { StunGrenadeDynamicEntity };

