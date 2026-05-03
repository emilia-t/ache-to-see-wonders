import { GrenadeDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

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
}

export { FragGrenadeDynamicEntity };

