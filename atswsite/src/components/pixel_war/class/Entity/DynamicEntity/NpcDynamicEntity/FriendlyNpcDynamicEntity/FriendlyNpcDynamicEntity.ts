import { NpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

abstract class FriendlyNpcDynamicEntity extends NpcDynamicEntity {
  constructor(
    position: Point,
    ownerId: number | null,
    teamId: number | null,
    texturePath: string,
    name: string,
    pickupRange: number,
    tag: string
  ) {
    super(position, ownerId, teamId, texturePath, name, 'friendly', pickupRange, tag);
  }
}

export { FriendlyNpcDynamicEntity };

