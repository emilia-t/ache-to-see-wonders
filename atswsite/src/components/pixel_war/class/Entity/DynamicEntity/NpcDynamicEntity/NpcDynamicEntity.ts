import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import { GrenadeDynamicEntity } from '@/components/pixel_war/class';
import { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';
import type { NpcAttitude } from '@/components/pixel_war/type/Type';

export type NpcActionLoopContext = {
  deltaTime: number;
  staticEntities: StaticEntity[];
  spawnBullet: (bullet: BulletDynamicEntity) => void;
  spawnGrenade: (grenade: GrenadeDynamicEntity) => void;
};

abstract class NpcDynamicEntity extends DynamicEntity {

  static readonly WIDTH = 25;
  static readonly HEIGHT = 25;
  static GENERATE_WEIGHT = 1;//随机刷新的权重 (0,1]

  ownerId: number | null;
  attitude: NpcAttitude; // 友好/中立/敌对
  pickupRange: number; // 拾取范围

  constructor(
    position: Point,
    texturePath: string,
    name: string,
    attitude: NpcAttitude,
    pickupRange: number,
    tag: string
  ) {
    super(position, NpcDynamicEntity.WIDTH, NpcDynamicEntity.HEIGHT, texturePath, name, 'npc', tag);
    this.attitude = attitude;
    this.pickupRange = pickupRange;
    this.ownerId = null;
  }

  abstract tryPickupItem(item: ItemEntity): boolean;
  abstract pickupItem(item: ItemEntity): void;
  abstract actionLoop(context: NpcActionLoopContext): void;
  abstract action(context: NpcActionLoopContext): void;
  abstract actionBefore(context: NpcActionLoopContext): void;
  abstract actionAfter(context: NpcActionLoopContext): void;
  
}

export { NpcDynamicEntity };
