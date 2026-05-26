import { NpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

abstract class NeutralNpcDynamicEntity extends NpcDynamicEntity {
  constructor(
    position: Point,
    ownerId: number | null,
    teamId: number | null,
    texturePath: string,
    name: string,
    pickupRange: number,
    tag: string
  ) {
    super(position, ownerId, teamId, texturePath, name, 'neutral', pickupRange, tag);
  }
}

export { NeutralNpcDynamicEntity };

