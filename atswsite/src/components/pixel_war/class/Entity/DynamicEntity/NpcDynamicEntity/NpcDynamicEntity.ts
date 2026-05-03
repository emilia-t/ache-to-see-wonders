import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { NpcAttitude } from '@/components/pixel_war/type/Type';
import type { Point } from '@/components/pixel_war/interface/Interface';
import { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';

abstract class NpcDynamicEntity extends DynamicEntity {
  attitude: NpcAttitude; // 友好/中立/敌对
  pickupRange: number; // 拾取范围
  
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    attitude: NpcAttitude,
    pickupRange: number,
    tag: string
  ) {
    super(position, width, height, texturePath, name, 'npc', tag);
    this.attitude = attitude;
    this.pickupRange = pickupRange;
  }
  abstract tryPickupItem(item: ItemEntity): boolean;
  abstract pickupItem(item: ItemEntity): void;
}

export { NpcDynamicEntity };

