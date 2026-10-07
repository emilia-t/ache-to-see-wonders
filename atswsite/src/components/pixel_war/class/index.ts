export { CursorManager } from './CursorManager/CursorManager';
export { EffectManager } from './EffectManager/EffectManager';
export { NumericalManager }from './NumericalManager/NumericalManager';
export { Entity } from './Entity/Entity';
export { DynamicEntity } from './Entity/DynamicEntity/DynamicEntity';
// BulletDynamicEntity and its subclasses
export { BulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
export { BuckshotBulletDynamicEntity } from './Entity/DynamicEntity/BulletDynamicEntity/BuckshotBulletDynamicEntity/BuckshotBulletDynamicEntity';
export { LaserBulletDynamicEntity, H_setLaserClockPaused, H_isLaserClockPaused } from './Entity/DynamicEntity/BulletDynamicEntity/LaserBulletDynamicEntity/LaserBulletDynamicEntity';
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
// BulletOrbDynamicEntity
export { BulletOrbDynamicEntity } from './Entity/DynamicEntity/BulletOrbDynamicEntity/BulletOrbDynamicEntity';
// Skill(技能体系)
export { Skill } from './Skill/Skill';
export type { SkillTagType, SkillCastContext, SkillTrigger } from './Skill/Skill';
export { Va2ShootSkill } from './Skill/Skills/Va2ShootSkill/Va2ShootSkill';
export { Xa4ShootSkill } from './Skill/Skills/Xa4ShootSkill/Xa4ShootSkill';
export { Oa18ShootSkill } from './Skill/Skills/Oa18ShootSkill/Oa18ShootSkill';
export { Ls1ShootSkill } from './Skill/Skills/Ls1ShootSkill/Ls1ShootSkill';
export { DodgeSkill } from './Skill/Skills/DodgeSkill/DodgeSkill';
export {
  H_preloadSkillIconTextures,
  H_isSkillIconTextureReady,
  H_drawSkillIconTexture
} from './Skill/SkillIconTexture';
// Inventory(背包)
export {
  INVENTORY_SKILL_SLOT_COUNT,
  INVENTORY_INNATE_SKILL_SLOT_COUNT,
  INVENTORY_EXTENDED_SKILL_SLOT_COUNT,
  H_inventoryIsInnateSkillSlot,
  H_inventoryIsExtendedSkillSlot,
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
// Research(专研)
export {
  H_getResearchDefinition,
  H_getAllResearchDefinitions,
  H_getResearchLevel,
  H_getResearchEntry,
  H_isResearchMaxed,
  H_getResearchTriggerProbability,
  H_rollResearchOptions,
  H_getResearchEffectText,
  RESEARCH_OPTION_COUNT,
  RESEARCH_NORMAL_COLOR,
  RESEARCH_LEGENDARY_COLOR,
  RESEARCH_FORTRESS_ABSORB_PER_LEVEL
} from './Research/Research';
export type { ResearchTagType, ResearchDefinition } from './Research/Research';
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
export { GoldenDodgeXa4Entity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/GoldenDodgeXa4Entity/GoldenDodgeXa4Entity';
export { PurpleFireworkOa18Entity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/PurpleFireworkOa18Entity/PurpleFireworkOa18Entity';
export { OnahauLoneLs1Entity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/OnahauLoneLs1Entity/OnahauLoneLs1Entity';
export { CoralRedTentacleT1Entity } from './Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/CoralRedTentacleT1Entity/CoralRedTentacleT1Entity';
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