export { CursorManager } from './CursorManager/CursorManager';
export { EffectManager } from './EffectManager/EffectManager';
export { NumericalManager }from './NumericalManager/NumericalManager';
export { Entity } from './Entity/Entity';
export { DynamicEntity } from './Entity/DynamicEntity/DynamicEntity';
// BulletDynamicEntity and its subclasses
export { BulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
export { BuckshotBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/BuckshotBulletDynamicEntity/BuckshotBulletDynamicEntity';
export { LaserBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/LaserBulletDynamicEntity/LaserBulletDynamicEntity';
export { OrdinaryBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
export { SniperBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/SniperBulletDynamicEntity/SniperBulletDynamicEntity';
// GrenadeDynamicEntity and its subclasses
export { GrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
export { FragGrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/FragGrenadeDynamicEntity/FragGrenadeDynamicEntity';
export { SmokeGrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/SmokeGrenadeDynamicEntity/SmokeGrenadeDynamicEntity';
export { StunGrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/StunGrenadeDynamicEntity/StunGrenadeDynamicEntity';
export { RedPixelBombEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/RedPixelBombEntity/RedPixelBombEntity';
// NpcDynamicEntity and its subclasses
export { NpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
export { FriendlyNpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/FriendlyNpcDynamicEntity';
// HostileNpcDynamicEntity and its subclasses
export { HostileNpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
export { WhitePixelEntity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/WhitePixelEntity/WhitePixelEntity';
export { WhitePixelVa2Entity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/WhitePixelEntity/WhitePixelVa2Entity/WhitePixelVa2Entity';
export { RedPixelEntity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/RedPixelEntity/RedPixelEntity';
// NeutralNpcDynamicEntity
export { NeutralNpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/NeutralNpcDynamicEntity/NeutralNpcDynamicEntity';
// PlayerDynamicEntity
export { PlayerDynamicEntity } from './Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
// EmptyEntity
export { EmptyEntity } from './Entity/EmptyEntity/EmptyEntity';
// ItemEntity and its subclasses
export { ItemEntity } from './Entity/ItemEntity/ItemEntity';
export { FoodItemEntity } from './Entity/ItemEntity/FoodItemEntity/FoodItemEntity';
export { HealingGemItemEntity } from './Entity/ItemEntity/FoodItemEntity/HealingGemItemEntity/HealingGemItemEntity';
// StaticEntity and its subclasses
export { StaticEntity } from './Entity/StaticEntity/StaticEntity';
export { BoxStaticEntity } from './Entity/StaticEntity/BoxStaticEntity/BoxStaticEntity';
export { CurbStaticEntity } from './Entity/StaticEntity/CurbStaticEntity/CurbStaticEntity';
export { CurbStaticEntity8Length } from './Entity/StaticEntity/CurbStaticEntity/CurbStaticEntity8Length/CurbStaticEntity8Length';
export { WallStaticEntity } from './Entity/StaticEntity/WallStaticEntity/WallStaticEntity';

export const PrototypeChain = {
  "CursorManager": "CursorManager",
  "EffectManager": "EffectManager",
  "NumericalManager": "NumericalManager",
  "Entity": {
    "DynamicEntity": {
      "BulletDynamicEntity": {
        "BuckshotBulletDynamicEntity": "BuckshotBulletDynamicEntity",
        "LaserBulletDynamicEntity": "LaserBulletDynamicEntity",
        "OrdinaryBulletDynamicEntity": "OrdinaryBulletDynamicEntity",
        "SniperBulletDynamicEntity": "SniperBulletDynamicEntity"
      },
      "GrenadeDynamicEntity": {
        "FragGrenadeDynamicEntity": "FragGrenadeDynamicEntity",
        "SmokeGrenadeDynamicEntity": "SmokeGrenadeDynamicEntity",
        "StunGrenadeDynamicEntity": "StunGrenadeDynamicEntity",
        "RedPixelBombEntity": "RedPixelBombEntity"
      },
      "NpcDynamicEntity": {
        "FriendlyNpcDynamicEntity": "FriendlyNpcDynamicEntity",
        "HostileNpcDynamicEntity": {
          "WhitePixelEntity": {
            "WhitePixelVa2Entity":"WhitePixelVa2Entity"
          },
          "RedPixelEntity": "RedPixelEntity"
        },
        "NeutralNpcDynamicEntity": "NeutralNpcDynamicEntity"
      },
      "PlayerDynamicEntity": "PlayerDynamicEntity"
    },
    "EmptyEntity": "EmptyEntity",
    "ItemEntity": {
      "FoodItemEntity": {
        "HealingGemItemEntity": "HealingGemItemEntity"
      }
    },
    "StaticEntity": {
      "BoxStaticEntity": "BoxStaticEntity",
      "CurbStaticEntity": {
        "CurbStaticEntity8Length":"CurbStaticEntity8Length"
      },
      "WallStaticEntity": "WallStaticEntity"
    }
  }
};