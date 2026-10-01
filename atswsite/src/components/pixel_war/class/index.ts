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
// ExpOrbDynamicEntity
export { ExpOrbDynamicEntity } from './Entity/DynamicEntity/ExpOrbDynamicEntity/ExpOrbDynamicEntity';
// SkillOrbDynamicEntity
export { SkillOrbDynamicEntity } from './Entity/DynamicEntity/SkillOrbDynamicEntity/SkillOrbDynamicEntity';
// Skill(技能体系)
export { Skill } from './Skill/Skill';
export type { SkillTagType, SkillCastContext } from './Skill/Skill';
export { Va2ShootSkill } from './Skill/Skills/Va2ShootSkill/Va2ShootSkill';
export { SKILL_REGISTRY, H_getSkillByTag, H_getAllSkills, H_isSkillTagValid } from './Skill/index';
export {
  H_preloadSkillIconTextures,
  H_isSkillIconTextureReady,
  H_drawSkillIconTexture
} from './Skill/SkillIconTexture';
// Inventory(背包)
export {
  INVENTORY_SKILL_SLOT_COUNT,
  INVENTORY_ITEM_MAX_STACK,
  INVENTORY_BAG_CAPACITY,
  H_createInventoryUid,
  H_createEmptyPlayerInventory,
  H_normalizePlayerInventory,
  H_normalizeEquippedSkills,
  H_ensurePlayerInventory,
  H_inventoryGetEntryAtSlot,
  H_inventoryIndexOfUid,
  H_inventoryFindEntry,
  H_inventoryFirstEmptySlot,
  H_inventoryUsedSlotCount,
  H_inventoryHasSkill,
  H_inventoryCountItem,
  H_inventoryCanAcceptItem,
  H_inventoryAddSkill,
  H_inventoryAddItem,
  H_inventoryRemoveSlot,
  H_inventoryRemoveEntry,
  H_inventoryEquipSkill,
  H_inventoryAutoEquipSkill,
  H_inventoryUnequipSkill,
  H_inventoryUnequipSkillToSlot,
  H_inventoryMoveSkillSlot,
  H_inventoryMoveEntry,
  H_inventoryDestroyEntry,
  H_inventoryDestroySlot,
  H_inventoryDestroyEquipped
} from './Inventory/Inventory';
// ItemRegistry(物品定义表)
export {
  ITEM_REGISTRY,
  H_getItemDefinition,
  H_getAllItemDefinitions,
  H_isItemTagValid
} from './ItemRegistry/ItemRegistry';
// NpcDynamicEntity and its subclasses
export { NpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
export { FriendlyNpcDynamicEntity } from './Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/FriendlyNpcDynamicEntity';
export { SkyBluePixelEntity } from './Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/SkyBluePixelEntity/SkyBluePixelEntity';
export { PurpleShieldEntity } from './Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/PurpleShieldEntity/PurpleShieldEntity';
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
      "ExpOrbDynamicEntity": "ExpOrbDynamicEntity",
      "SkillOrbDynamicEntity": "SkillOrbDynamicEntity",
      "NpcDynamicEntity": {
        "FriendlyNpcDynamicEntity": {
          "SkyBluePixelEntity": "SkyBluePixelEntity",
          "PurpleShieldEntity": "PurpleShieldEntity"
        },
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