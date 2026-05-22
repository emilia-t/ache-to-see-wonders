import { NpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

abstract class NeutralNpcDynamicEntity extends NpcDynamicEntity {
  constructor(
    position: Point,
    texturePath: string,
    name: string,
    pickupRange: number,
    tag: string
  ) {
    super(position, texturePath, name, 'neutral', pickupRange, tag);
  }
}

export { NeutralNpcDynamicEntity };

