import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';
import type { NpcAttitude } from '@/components/pixel_war/type/Type';

export type NpcActionLoopContext = {
  deltaTime: number;
  staticEntities: StaticEntity[];
  spawnBullet: (bullet: BulletDynamicEntity) => void;
};

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
  abstract actionLoop(context: NpcActionLoopContext): void;
  abstract action(context: NpcActionLoopContext): void;
  abstract actionBefore(context: NpcActionLoopContext): void;
  abstract actionAfter(context: NpcActionLoopContext): void;
}

export { NpcDynamicEntity };
