export { CursorManager } from './CursorManager/CursorManager';
export { EffectManager } from './EffectManager/EffectManager';
export { Entity } from './Entity/Entity';
export { EmptyEntity } from './Entity/EmptyEntity/EmptyEntity';
export { StaticEntity } from './Entity/StaticEntity/StaticEntity';
export { BoxStaticEntity } from './Entity/StaticEntity/BoxStaticEntity/BoxStaticEntity';
export { WallStaticEntity } from './Entity/StaticEntity/WallStaticEntity/WallStaticEntity';
export { CurbStaticEntity } from './Entity/StaticEntity/CurbStaticEntity/CurbStaticEntity';
export { ItemEntity } from './Entity/ItemEntity/ItemEntity';
export { HealingGemItemEntity } from './Entity/ItemEntity/FoodItemEntity/HealingGemItemEntity/HealingGemItemEntity';
export { DynamicEntity } from './Entity/DynamicEntity/DynamicEntity';
export { NpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
export { FriendlyNpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/FriendlyNpcDynamicEntity';
export { NeutralNpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/NeutralNpcDynamicEntity/NeutralNpcDynamicEntity';
export { HostileNpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
export { WhitePixelEntity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/WhitePixelEntity/WhitePixelEntity';
export { PlayerDynamicEntity } from './Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
export { GrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
export { SmokeGrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/SmokeGrenadeDynamicEntity/SmokeGrenadeDynamicEntity';
export { FragGrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/FragGrenadeDynamicEntity/FragGrenadeDynamicEntity';
export { StunGrenadeDynamicEntity } from './Entity/DynamicEntity/GrenadeDynamicEntity/StunGrenadeDynamicEntity/StunGrenadeDynamicEntity';
export { BulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
export { BuckshotBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/BuckshotBulletDynamicEntity/BuckshotBulletDynamicEntity';
export { OrdinaryBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
export { LaserBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/LaserBulletDynamicEntity/LaserBulletDynamicEntity';
export { SniperBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/SniperBulletDynamicEntity/SniperBulletDynamicEntity';


export const PrototypeChain = {
  "CursorManager": "CursorManager",
  "EffectManager": "EffectManager",
  "Entity": {
    "StaticEntity": {
      "BoxStaticEntity": "BoxStaticEntity",
      "WallStaticEntity": "WallStaticEntity",
      "CurbStaticEntity": "CurbStaticEntity"
    },
    "ItemEntity": {
      "FoodItemEntity": {
        "HealingGemItemEntity": "HealingGemItemEntity"
      }
    },
    "DynamicEntity": {
      "NpcDynamicEntity": {
        "FriendlyNpcDynamicEntity": "FriendlyNpcDynamicEntity",
        "NeutralNpcDynamicEntity": "NeutralNpcDynamicEntity",
        "HostileNpcDynamicEntity": {
          "WhitePixelEntity": "WhitePixelEntity"
        }
      },
      "PlayerDynamicEntity": "PlayerDynamicEntity",
      "GrenadeDynamicEntity": {
        "SmokeGrenadeDynamicEntity": "SmokeGrenadeDynamicEntity",
        "FragGrenadeDynamicEntity": "FragGrenadeDynamicEntity",
        "StunGrenadeDynamicEntity": "StunGrenadeDynamicEntity"
      },
      "BulletDynamicEntity": {
        "BuckshotBulletDynamicEntity": "BuckshotBulletDynamicEntity",
        "OrdinaryBulletDynamicEntity": "OrdinaryBulletDynamicEntity",
        "LaserBulletDynamicEntity": "LaserBulletDynamicEntity",
        "SniperBulletDynamicEntity": "SniperBulletDynamicEntity"
      }
    },
    "EmptyEntity": "EmptyEntity"
  }
};