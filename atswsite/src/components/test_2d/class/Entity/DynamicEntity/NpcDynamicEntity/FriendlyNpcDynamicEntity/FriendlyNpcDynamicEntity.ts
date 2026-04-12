import { NpcDynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

abstract class FriendlyNpcDynamicEntity extends NpcDynamicEntity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    pickupRange: number,
    tag: string
  ) {
    super(position, width, height, texturePath, name, 'friendly', pickupRange, tag);
  }
}

export { FriendlyNpcDynamicEntity };

